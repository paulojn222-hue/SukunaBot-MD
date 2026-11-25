const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const baileys = require("@whiskeysockets/baileys");
const { downloadContentFromMessage, proto, prepareWAMessageMedia } = baileys;

// ==============================================
// ⚙️ CONFIG
// ==============================================
const MAX_SEGUNDOS = 60; // áudio maior que isso é recusado
const DIR_PERSONALIZE = path.join(__dirname, "..", "personalize_aqui");

// ==============================================
// 🔧 AUXILIARES
// ==============================================
function desembrulhar(m) {
  if (!m) return {};
  return m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m;
}

async function baixar(conteudo, tipo) {
  const stream = await downloadContentFromMessage(conteudo, tipo);
  const partes = [];
  for await (const c of stream) partes.push(c);
  return Buffer.concat(partes);
}

// Imagem base padrão (quando o usuário não manda imagem):
// 1) personalize_aqui/fig_audio_base.(png|jpg|jpeg|webp)  2) degradê azul gerado aqui
function baseDoUsuario() {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const p = path.join(DIR_PERSONALIZE, `fig_audio_base.${ext}`);
    try { if (fs.existsSync(p)) return { buffer: fs.readFileSync(p), ext }; } catch {}
  }
  return null;
}

// PPM é um formato simples que o ffmpeg lê direto (sem lavfi, sem libs extras)
function gerarBasePPM() {
  const T = 512;
  const head = Buffer.from(`P6\n${T} ${T}\n255\n`);
  const px = Buffer.alloc(T * T * 3);
  let i = 0;
  for (let y = 0; y < T; y++) {
    const t = 1 - y / (T - 1);
    const r = 0, g = Math.round(20 + 40 * t), b = Math.round(60 + 140 * t);
    for (let x = 0; x < T; x++) { px[i++] = r; px[i++] = g; px[i++] = b; }
  }
  return { buffer: Buffer.concat([head, px]), ext: "ppm" };
}

function rodarFFmpeg(args, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", d => { err += d; if (err.length > 8000) err = err.slice(-4000); });

    const timer = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg demorou demais")); }, timeoutMs);

    p.on("error", e => { clearTimeout(timer); reject(e); });
    p.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg falhou (${code}): ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

// imagem => figurinha WebP estática 512x512 (fundo transparente, < 100KB)
async function criarWebp(imagem) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "figsom-"));
  try {
    const imgPath = path.join(dir, `img.${imagem.ext}`);
    const outPath = path.join(dir, "fig.webp");
    fs.writeFileSync(imgPath, imagem.buffer);

    let buf = null;
    for (const q of [70, 45, 25]) {
      await rodarFFmpeg([
        "-y", "-i", imgPath,
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        "-c:v", "libwebp", "-lossless", "0", "-q:v", String(q),
        "-frames:v", "1", "-an",
        outPath
      ]);
      buf = fs.readFileSync(outPath);
      if (buf.length <= 100 * 1024) break;
    }
    return buf;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

// imagem + áudio => vídeo mp4 quadrado 512x512 com som
async function criarVideo(imagem, audio, segundos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "figsom-"));
  try {
    const imgPath = path.join(dir, `img.${imagem.ext}`);
    const audPath = path.join(dir, "audio.ogg");
    const outPath = path.join(dir, "saida.mp4");
    fs.writeFileSync(imgPath, imagem.buffer);
    fs.writeFileSync(audPath, audio);

    const limite = Math.min(MAX_SEGUNDOS, Math.ceil(segundos || MAX_SEGUNDOS) + 1);

    await rodarFFmpeg([
      "-y",
      "-loop", "1", "-framerate", "10", "-i", imgPath,
      "-i", audPath,
      "-vf", "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=yuv420p",
      "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
      "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1",
      "-t", String(limite),
      "-shortest",
      "-movflags", "+faststart",
      outPath
    ]);

    return fs.readFileSync(outPath);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

// ==============================================
// 🧬 FIGURINHA COM ÁUDIO NATIVA (audioStickerMessage)
// Ensina o protobuf da Baileys a escrever dois campos que ela não conhece:
//   Message.audioStickerMessage (campo 134)  e  StickerMessage.audioMessage (campo 26)
// ==============================================
const CHAVE_PATCH = Symbol.for("tomioka.audioSticker.encoder");

function garantirPatchProto() {
  const Msg = proto?.Message;
  if (
    !Msg ||
    typeof Msg.encode !== "function" ||
    typeof Msg.FutureProofMessage?.encode !== "function" ||
    typeof Msg.StickerMessage?.encode !== "function" ||
    typeof Msg.AudioMessage?.encode !== "function"
  ) {
    throw new Error("a versão da Baileys não possui os tipos necessários.");
  }
  if (Msg[CHAVE_PATCH]) return;

  const tipos = [
    [Msg, "audioStickerMessage", 1074, Msg.FutureProofMessage],
    [Msg.StickerMessage, "audioMessage", 210, Msg.AudioMessage]
  ];

  for (const [tipo, campo, tag, schema] of tipos) {
    const encodeOriginal = tipo.encode;
    tipo.encode = function (mensagem, writer) {
      const resultado = encodeOriginal.call(this, mensagem, writer);
      if (mensagem[campo]) {
        return schema.encode(mensagem[campo], resultado.uint32(tag).fork()).ldelim();
      }
      return resultado;
    };
  }
  Object.defineProperty(Msg, CHAVE_PATCH, { value: true });
}

async function enviarFigComAudio(sock, idChat, webp, audioMsg) {
  garantirPatchProto();

  // sobe a figurinha (a imagem do usuário) pro servidor do WhatsApp
  const midia = await prepareWAMessageMedia({ sticker: webp }, { upload: sock.waUploadToServer });
  if (!midia?.stickerMessage) throw new Error("não consegui preparar a figurinha.");

  midia.stickerMessage.width = 512;
  midia.stickerMessage.height = 512;
  midia.stickerMessage.isAnimated = false;

  // o áudio respondido já está no servidor: só anexamos a referência dele
  midia.stickerMessage.audioMessage = audioMsg;

  await sock.relayMessage(
    idChat,
    {
      proto: midia,
      audioStickerMessage: { message: midia },
      messageContextInfo: { messageSecret: crypto.randomBytes(32) }
    },
    {}
  );
}

// ==============================================
// 🎙️ COMANDOS
// modo "nativo": figurinha COM áudio de verdade (audioStickerMessage)
// modo "webp":   figurinha WebP + áudio logo em seguida (plano B)
// modo "gif":    vídeo em loop com som
// modo "video":  vídeo normal
// ==============================================
function criarComando(modo) {
  return async function executar({ sock, idChat, msg, PREFIXO }) {
    const p = PREFIXO || "!";
    const m = desembrulhar(msg.message);

    const ctx = (m.extendedTextMessage || m.imageMessage || m.videoMessage || {}).contextInfo;
    const citada = desembrulhar(ctx?.quotedMessage);
    const audioCitado = citada?.audioMessage;

    if (!audioCitado) {
      return sock.sendMessage(idChat, {
        text:
          `❌ Responda a um *áudio* para criar a figurinha com áudio.\n\n` +
          `> *${p}figsom* — responde o áudio (usa a imagem padrão)\n` +
          `> Ou mande uma *imagem* com a legenda *${p}figsom* respondendo o áudio.`
      }, { quoted: msg });
    }

    if ((audioCitado.seconds || 0) > MAX_SEGUNDOS) {
      return sock.sendMessage(idChat, {
        text: `❌ Áudio muito longo! O máximo é *${MAX_SEGUNDOS}s*.`
      }, { quoted: msg });
    }

    await sock.sendMessage(idChat, { text: "⏳ Criando sua figurinha com áudio..." }, { quoted: msg });

    try {
      let imagem;
      if (m.imageMessage) {
        imagem = { buffer: await baixar(m.imageMessage, "image"), ext: "jpg" };
      } else {
        imagem = baseDoUsuario() || gerarBasePPM();
      }

      if (modo === "nativo") {
        const webp = await criarWebp(imagem);
        try {
          await enviarFigComAudio(sock, idChat, webp, audioCitado);
        } catch (e) {
          // plano B automático: figurinha + áudio separados
          console.log("fig_som nativo falhou, usando plano B:", e.message);
          await sock.sendMessage(idChat, { text: `⚠️ Não consegui o modo nativo (${e.message}). Enviando figurinha e áudio separados.` }, { quoted: msg });
          await sock.sendMessage(idChat, { sticker: webp }, { quoted: msg });
          const audio = await baixar(audioCitado, "audio");
          await sock.sendMessage(idChat, { audio, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
        }
      } else if (modo === "webp") {
        const webp = await criarWebp(imagem);
        const audio = await baixar(audioCitado, "audio");
        await sock.sendMessage(idChat, { sticker: webp }, { quoted: msg });
        await sock.sendMessage(idChat, { audio, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
      } else {
        const audio = await baixar(audioCitado, "audio");
        const video = await criarVideo(imagem, audio, audioCitado.seconds);
        await sock.sendMessage(idChat, { video, mimetype: "video/mp4", gifPlayback: modo === "gif" }, { quoted: msg });
      }
      console.log(`✅ figsom (${modo}) enviado`);
    } catch (e) {
      console.log("Erro no comando figsom:", e);
      const semFFmpeg = e.code === "ENOENT";
      await sock.sendMessage(idChat, {
        text: semFFmpeg
          ? "❌ O *ffmpeg* não está instalado no servidor.\n\n> No Termux: *pkg install ffmpeg*"
          : `❌ Não consegui criar a figurinha com áudio: ${e.message}`
      }, { quoted: msg });
    }
  };
}

const executarNativo = criarComando("nativo");

module.exports = {
  comandos: [
    { nome: "figsom", descricao: "Figurinha com áudio", executar: executarNativo },
    { nome: "fig_som", descricao: "Figurinha com áudio", executar: executarNativo },
    { nome: "figaudio", descricao: "Figurinha com áudio", executar: executarNativo },
    { nome: "figurinhasom", descricao: "Figurinha com áudio", executar: executarNativo },
    { nome: "figsomwebp", descricao: "Figurinha WebP + áudio separado", executar: criarComando("webp") },
    { nome: "figsomgif", descricao: "Vídeo em loop com som", executar: criarComando("gif") },
    { nome: "figsomvideo", descricao: "Vídeo (imagem + áudio)", executar: criarComando("video") }
  ],
  _criarWebp: criarWebp,
  _criarVideo: criarVideo,
  _gerarBasePPM: gerarBasePPM,
  _garantirPatchProto: garantirPatchProto
};

