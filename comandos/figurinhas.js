const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const ffmpeg = require("fluent-ffmpeg");
const config = require("../config.js");

// ==============================================
// 🎨 ESTILO DO PACK
// ==============================================
const PACK_NAME = config.NOME_BOT || "HoshinoBot-MD v2";
const AUTHOR_NAME = config.DONO_PRINCIPAL_NOME || "Dono";

// ==============================================
// 🛠️ HELPERS
// ==============================================
async function getFileBuffer(mediaKey, MediaType) {
  const stream = await downloadContentFromMessage(mediaKey, MediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

function pegarMidia(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;

  if (quoted) {
    if (quoted.imageMessage) return { media: quoted.imageMessage, tipo: "image" };
    if (quoted.videoMessage) return { media: quoted.videoMessage, tipo: "video" };
    if (quoted.stickerMessage) return { media: quoted.stickerMessage, tipo: "sticker" };
    if (quoted.viewOnceMessageV2?.message?.imageMessage) return { media: quoted.viewOnceMessageV2.message.imageMessage, tipo: "image" };
    if (quoted.viewOnceMessage?.message?.imageMessage) return { media: quoted.viewOnceMessage.message.imageMessage, tipo: "image" };
    if (quoted.viewOnceMessageV2?.message?.videoMessage) return { media: quoted.viewOnceMessageV2.message.videoMessage, tipo: "video" };
    if (quoted.viewOnceMessage?.message?.videoMessage) return { media: quoted.viewOnceMessage.message.videoMessage, tipo: "video" };
  }

  if (msg.message?.imageMessage) return { media: msg.message.imageMessage, tipo: "image" };
  if (msg.message?.videoMessage) return { media: msg.message.videoMessage, tipo: "video" };
  if (msg.message?.stickerMessage) return { media: msg.message.stickerMessage, tipo: "sticker" };

  return null;
}

// Converte imagem pra figurinha (FFmpeg)
async function criarFiguraImagem(buffer, formato = "quadrado") {
  const tmpIn = path.join(__dirname, "..", "dados", `tmp_${Date.now()}.jpg`);
  const tmpOut = path.join(__dirname, "..", "dados", `tmp_${Date.now()}.webp`);

  fs.mkdirSync(path.dirname(tmpIn), { recursive: true });
  fs.writeFileSync(tmpIn, buffer);

  const filtro = formato === "quadrado"
    ? "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512"
    : "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000";

  return new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .outputOptions([
        "-vcodec libwebp",
        "-vf", filtro,
        "-lossless 0",
        "-compression_level 6",
        "-q:v 80",
        "-an",
        "-vsync 0"
      ])
      .toFormat("webp")
      .save(tmpOut)
      .on("end", () => {
        try {
          const out = fs.readFileSync(tmpOut);
          fs.unlinkSync(tmpIn);
          fs.unlinkSync(tmpOut);
          resolve(out);
        } catch (e) { reject(e); }
      })
      .on("error", (err) => {
        try { fs.unlinkSync(tmpIn); } catch {}
        try { fs.unlinkSync(tmpOut); } catch {}
        reject(err);
      });
  });
}

// Converte vídeo pra figurinha animada (FFmpeg)
async function criarFiguraVideo(buffer, formato = "quadrado") {
  const tmpIn = path.join(__dirname, "..", "dados", `tmp_${Date.now()}.mp4`);
  const tmpOut = path.join(__dirname, "..", "dados", `tmp_${Date.now()}.webp`);

  fs.mkdirSync(path.dirname(tmpIn), { recursive: true });
  fs.writeFileSync(tmpIn, buffer);

  const filtro = formato === "quadrado"
    ? "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512"
    : "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000";

  return new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .inputOptions(["-t 6"])
      .outputOptions([
        "-vcodec libwebp",
        "-vf", `fps=15,${filtro}`,
        "-lossless 0",
        "-compression_level 6",
        "-q:v 50",
        "-loop 0",
        "-an",
        "-vsync 0"
      ])
      .toFormat("webp")
      .save(tmpOut)
      .on("end", () => {
        try {
          const out = fs.readFileSync(tmpOut);
          fs.unlinkSync(tmpIn);
          fs.unlinkSync(tmpOut);
          resolve(out);
        } catch (e) { reject(e); }
      })
      .on("error", (err) => {
        try { fs.unlinkSync(tmpIn); } catch {}
        try { fs.unlinkSync(tmpOut); } catch {}
        reject(err);
      });
  });
}

// ==============================================
// 📄 MENU FIG
// ==============================================
function carregarMenuFig() {
  const ARQ = path.join(__dirname, "..", "personalize_aqui", "menu_fig.txt");
  try {
    return fs.readFileSync(ARQ, "utf8");
  } catch {
    return "❌ Arquivo personalize_aqui/menu_fig.txt não encontrado!";
  }
}

module.exports = {
  comandos: [
    // ==============================================
    // 📋 MENU FIG
    // ==============================================
    {
      nome: "menufig",
      descricao: "Mostra o menu de figurinhas",
      async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME }) {
        const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

        let texto = carregarMenuFig()
          .replace(/{PREFIXO}/g, PREFIXO || "!")
          .replace(/{BOT}/g, NOME_BOT || "Bot")
          .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
          .replace(/{DATA}/g, data);

        const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menufig.json");
        let midia = null;
        try {
          if (fs.existsSync(caminhoMeta)) {
            const meta = JSON.parse(fs.readFileSync(caminhoMeta, "utf8"));
            if (meta && typeof meta.arquivo === "string") {
              const caminhoArq = path.join(__dirname, "..", "dados", meta.arquivo);
              if (fs.existsSync(caminhoArq)) {
                midia = { meta, buffer: fs.readFileSync(caminhoArq) };
              }
            }
          }
        } catch {}

        const remetente = msg.key.participant || msg.key.remoteJid;

        if (midia?.meta?.tipo === "image") {
          await sock.sendMessage(idChat, { image: midia.buffer, caption: texto, mentions: [remetente] });
        } else if (midia?.meta?.tipo === "video") {
          await sock.sendMessage(idChat, { video: midia.buffer, caption: texto, mentions: [remetente], gifPlayback: true });
        } else {
          await sock.sendMessage(idChat, { text: texto, mentions: [remetente] });
        }
      }
    },

    // ==============================================
    // 🪄 !s
    // ==============================================
    {
      nome: "s",
      descricao: "Faz figurinha de mídia (quadrada)",
      async executar({ sock, idChat, msg }) {
        const midia = pegarMidia(msg);

        if (!midia) return sock.sendMessage(idChat, { text: "❌ Envie ou responda a uma *foto* ou *vídeo*." });
        if (midia.tipo === "sticker") return sock.sendMessage(idChat, { text: "❌ Isso já é figurinha." });

        try {
          const buffer = await getFileBuffer(midia.media, midia.tipo);
          let webp;

          if (midia.tipo === "image") {
            webp = await criarFiguraImagem(buffer, "quadrado");
          } else {
            webp = await criarFiguraVideo(buffer, "quadrado");
          }

          await sock.sendMessage(idChat, {
            sticker: webp,
            packname: PACK_NAME,
            author: AUTHOR_NAME
          });
        } catch (e) {
          console.log("Erro s:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao criar figurinha." });
        }
      }
    },

    // ==============================================
    // 🪄 !s2
    // ==============================================
    {
      nome: "s2",
      descricao: "Faz figurinha de mídia (banner)",
      async executar({ sock, idChat, msg }) {
        const midia = pegarMidia(msg);

        if (!midia) return sock.sendMessage(idChat, { text: "❌ Envie ou responda a uma *foto* ou *vídeo*." });
        if (midia.tipo === "sticker") return sock.sendMessage(idChat, { text: "❌ Isso já é figurinha." });

        try {
          const buffer = await getFileBuffer(midia.media, midia.tipo);
          let webp;

          if (midia.tipo === "image") {
            webp = await criarFiguraImagem(buffer, "banner");
          } else {
            webp = await criarFiguraVideo(buffer, "banner");
          }

          await sock.sendMessage(idChat, {
            sticker: webp,
            packname: PACK_NAME,
            author: AUTHOR_NAME
          });
        } catch (e) {
          console.log("Erro s2:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao criar figurinha." });
        }
      }
    },

    // ==============================================
    // 🪄 !toimg
    // ==============================================
    {
      nome: "toimg",
      descricao: "Figurinha → imagem",
      async executar({ sock, idChat, msg }) {
        const midia = pegarMidia(msg);

        if (!midia || midia.tipo !== "sticker") {
          return sock.sendMessage(idChat, { text: "❌ Responda a uma *figurinha* com *!toimg*." });
        }

        try {
          const buffer = await getFileBuffer(midia.media, "sticker");

          const tmpIn = path.join(__dirname, "..", "dados", `tmp_${Date.now()}.webp`);
          const tmpOut = path.join(__dirname, "..", "dados", `tmp_${Date.now()}.png`);

          fs.mkdirSync(path.dirname(tmpIn), { recursive: true });
          fs.writeFileSync(tmpIn, buffer);

          await new Promise((resolve, reject) => {
            ffmpeg(tmpIn)
              .inputOptions(["-y"])
              .outputOptions(["-vcodec png", "-frames:v 1", "-update 1", "-pix_fmt rgba"])
              .save(tmpOut)
              .on("end", resolve)
              .on("error", reject);
          });

          if (!fs.existsSync(tmpOut) || fs.statSync(tmpOut).size === 0) {
            throw new Error("Arquivo PNG vazio");
          }

          const png = fs.readFileSync(tmpOut);
          fs.unlinkSync(tmpIn);
          fs.unlinkSync(tmpOut);

          await sock.sendMessage(idChat, { image: png });
        } catch (e) {
          console.log("Erro toimg:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao converter figurinha." });
        }
      }
    },

    // ==============================================
    // 🪄 !rename
    // ==============================================
{
  nome: "rename",
  descricao: "Renomeia o pack da figurinha",
  async executar({ sock, idChat, msg, resto, downloadMediaMessage }) {
    const t = (resto || "").trim();
    if (!t) {
      return sock.sendMessage(idChat, { text: "🎨 Uso: *!rename <texto>* (responda uma figurinha)" });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    const q = ctx.quotedMessage;

    if (!q || !q.stickerMessage) {
      return sock.sendMessage(idChat, { text: "🎨 Responda uma *figurinha* com *!rename texto*" });
    }

    try {
      // 👇 Usa downloadMediaMessage do Baileys (passado pelo index)
      const alvo = {
        key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false },
        message: { stickerMessage: q.stickerMessage }
      };

      const buf = await downloadMediaMessage(
        alvo,
        "buffer",
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      let outBuf = buf;

      try {
        const { Image } = require("node-webpmux");
        const img = new Image();
        await img.load(buf);

        const json = {
          "sticker-pack-id": "com.hoshino." + Date.now(),
          "sticker-pack-name": t,
          "sticker-pack-publisher": t,
          "emojis": ["✨"]
        };

        const exifAttr = Buffer.from([
          0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,
          0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,
          0x00,0x00
        ]);
        const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
        const exif = Buffer.concat([exifAttr, jsonBuf]);
        exif.writeUIntLE(jsonBuf.length, 14, 4);

        img.exif = exif;
        outBuf = await img.save(null);
      } catch (e) {
        console.log("Aviso exif:", e.message);
      }

      await sock.sendMessage(idChat, {
        sticker: outBuf,
        packname: t,
        author: t
      });
    } catch (e) {
      console.log("Erro rename:", e.message);
      await sock.sendMessage(idChat, { text: "🌙💢 " + e.message });
    }
  }
},

    // ==============================================
    // 🪄 !attp
    // ==============================================
    {
      nome: "attp",
      descricao: "Figurinha de texto (fundo branco)",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: "❌ Exemplo: *!attp seu texto*" });

        try {
          const API_KEY = config.API_KEY_BRONXYS || "";
          await sock.sendMessage(idChat, {
            sticker: { url: `https://api.bronxyshost.com.br/api-bronxys/attp_edit?texto=${encodeURIComponent(q)}&fonte=Noto Emoji, Noto Sans Mono&apikey=${API_KEY}` }
          });
        } catch (e) {
          console.log("Erro attp:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao gerar figurinha." });
        }
      }
    },

    // ==============================================
    // 🪄 !attp2
    // ==============================================
    {
      nome: "attp2",
      descricao: "Figurinha de texto (fundo verde)",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: "❌ Exemplo: *!attp2 seu texto*" });

        try {
          const API_KEY = config.API_KEY_BRONXYS || "";
          await sock.sendMessage(idChat, {
            sticker: { url: `https://api.bronxyshost.com.br/api-bronxys/attp_edit?texto=${encodeURIComponent(q)}&fonte=Roboto&apikey=${API_KEY}` }
          });
        } catch (e) {
          console.log("Erro attp2:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao gerar figurinha." });
        }
      }
    },

    // ==============================================
    // 🪄 !ttp_white
    // ==============================================
    {
      nome: "ttp_white",
      descricao: "Figurinha animada (branca)",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: "❌ Exemplo: *!ttp_white seu texto*" });

        try {
          const API_KEY = config.API_KEY_BRONXYS || "";
          await sock.sendMessage(idChat, {
            sticker: { url: `https://api.bronxyshost.com.br/api-bronxys/ttp_white?texto=${encodeURIComponent(q)}&fonte=Arial&apikey=${API_KEY}` }
          });
        } catch (e) {
          console.log("Erro ttp_white:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao gerar figurinha." });
        }
      }
    },

    // ==============================================
    // 🪄 !brat
    // ==============================================
    {
      nome: "brat",
      descricao: "Figurinha animada brat",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: "❌ Exemplo: *!brat seu texto*" });

        try {
          const API_KEY = config.API_KEY_BRONXYS || "";
          await sock.sendMessage(idChat, {
            sticker: { url: `https://api.bronxyshost.com.br/api-bronxys/ttp_brat?texto=${encodeURIComponent(q)}&fonte=Arial&apikey=${API_KEY}` }
          });
        } catch (e) {
          console.log("Erro brat:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao gerar figurinha." });
        }
      }
    },

    // ==============================================
    // 🪄 !autofig (por grupo)
    // ==============================================
    {
      nome: "autofig",
      descricao: "Ativa/desativa figurinha automática",
      async executar({ sock, idChat, resto }) {
        if (!idChat.endsWith("@g.us")) {
          return sock.sendMessage(idChat, {
            text: "❌ Esse comando só funciona em grupos."
          });
        }

        const op = (resto || "").trim().toLowerCase();
        if (!["on", "off"].includes(op)) {
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!autofig on* ou *!autofig off*"
          });
        }

        const ARQ = path.join(__dirname, "..", "dados", "autofig.json");
        let dados = {};
        try {
          if (fs.existsSync(ARQ)) dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
        } catch {}

        if (!dados[idChat]) dados[idChat] = { ativo: false };
        dados[idChat].ativo = op === "on";

        fs.mkdirSync(path.dirname(ARQ), { recursive: true });
        fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

        await sock.sendMessage(idChat, {
          text: op === "on"
            ? "✅ *Autofig ATIVADO nesse grupo!*"
            : "❌ *Autofig DESATIVADO nesse grupo!*"
        });
      }
    }
  ],

  // ==============================================
  // 🪄 HOOK AUTOFIG
  // ==============================================
  async aoReceberMensagem({ idChat, remetente, msg, sock }) {
    try {
      if (!idChat.endsWith("@g.us")) return;

      const ARQ = path.join(__dirname, "..", "dados", "autofig.json");
      if (!fs.existsSync(ARQ)) return;

      const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));

      if (!dados[idChat]?.ativo) return;

      const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      if (texto.startsWith(config.PREFIXO || "!")) return;

      const midia = pegarMidia(msg);
      if (!midia) return;
      if (midia.tipo === "sticker") return;

      const buffer = await getFileBuffer(midia.media, midia.tipo);
      let webp;

      if (midia.tipo === "image") {
        webp = await criarFiguraImagem(buffer, "quadrado");
      } else if (midia.tipo === "video") {
        webp = await criarFiguraVideo(buffer, "quadrado");
      }

      await sock.sendMessage(idChat, {
        sticker: webp,
        packname: PACK_NAME,
        author: AUTHOR_NAME
      });
    } catch (e) {
      console.log("Erro hook autofig:", e.message);
    }
  }
};
