// ✅ Acentuação
process.env.LANG = 'pt_BR.UTF-8';
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

const { verificarLicenca, iniciarRevalidacao } = require("./licenca.js");
const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const config = require("./config.js");
const { COR, TEMA } = require("./config_visual.js");

const CRIADOR_NOME = "Moon";
const CRIADOR_NUMERO = "+55 81 9564-7053";

// ==============================================
// ⚙️ VARIÁVEIS GLOBAIS
// ==============================================
const hooksMensagem = [];
const comandos = new Map();

let NOME_BOT = config.NOME_BOT || "HoshinoBot-MD v2";
let DONO_PRINCIPAL_NOME = config.DONO_PRINCIPAL_NOME || "Não definido";
let DONO_PRINCIPAL_NUMERO = String(config.DONO_PRINCIPAL_NUMERO || "").replace(/\D/g, "");

let sock = null;
let conexaoAtiva = false;
let numeroConectado = null;
let pairingCodeRequested = false;
let escutando = false;

// ==============================================
// 👑 SISTEMA DE PERMISSÕES
// ==============================================
const ARQUIVO_SUBDONOS = path.join(__dirname, "dados", "subdonos.json");
const ARQUIVO_SEM_PREFIXO = path.join(__dirname, "dados", "sem_prefixo.json");
const ARQUIVO_ALUGUEIS = path.join(__dirname, "dados", "alugueis.json");
const ARQ_GRUPOS_PROT = path.join(__dirname, "dados", "grupos.json");
const ARQ_PARCERIAS_PROT = path.join(__dirname, "dados", "parcerias.json");

// ==============================================
// 💤 SISTEMA AFK
// ==============================================
const ARQ_AFK = path.join(__dirname, "dados", "afk.json");

function formatarTempo(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const partes = [];
  if (h > 0) partes.push(`${h}h`);
  if (m > 0) partes.push(`${m}m`);
  if (seg > 0 || partes.length === 0) partes.push(`${seg}s`);
  return partes.join(" ");
}

function carregarAFK() {
  return lerJSON(ARQ_AFK, {});
}

function salvarAFK(dados) {
  salvarJSON(ARQ_AFK, dados);
}

function lerJSON(arquivo, padrao = {}) {
  try {
    if (!fs.existsSync(arquivo)) return padrao;
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch { return padrao; }
}

function salvarJSON(arquivo, dados) {
  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
  } catch (e) { console.log("Erro salvando JSON:", e.message); }
}

function normalizarNumero(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
}

function eDono(remetente) {
  const num = normalizarNumero(remetente);
  const lidConfig = normalizarNumero(config.DONO_PRINCIPAL_LID);
  const numConfig = normalizarNumero(config.DONO_PRINCIPAL_NUMERO);
  return (lidConfig && num === lidConfig) || (numConfig && num === numConfig);
}

function eSubDono(remetente) {
  const num = normalizarNumero(remetente);
  const subs = lerJSON(ARQUIVO_SUBDONOS, { lista: [] });
  return (subs.lista || []).some(s => {
    const sLid = typeof s === "string" ? s : s.lid;
    return normalizarNumero(sLid) === num;
  });
}

function eDonoOuSub(remetente) {
  return eDono(remetente) || eSubDono(remetente);
}

function listarSemPrefixo() {
  const dados = lerJSON(ARQUIVO_SEM_PREFIXO, { lista: [] });
  return dados.lista || [];
}

function botaoCanal() {
  const ARQ_CANAL = path.join(__dirname, "dados", "canal.json");
  try {
    if (!fs.existsSync(ARQ_CANAL)) return {};
    const c = JSON.parse(fs.readFileSync(ARQ_CANAL, "utf8"));
    if (!c.jid) return {};

    return {
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: c.jid,
          newsletterName: "Ver Canal",
          serverMessageId: Math.floor(Math.random() * 99999) + 1
        }
      }
    };
  } catch { return {}; }
}

function carregarCfgGrupo(gid) {
  try {
    if (!fs.existsSync(ARQ_GRUPOS_PROT)) return {};
    const dados = JSON.parse(fs.readFileSync(ARQ_GRUPOS_PROT, "utf8"));
    return dados[gid] || {};
  } catch { return {}; }
}

function carregarNegra(gid) {
  const ARQ = path.join(__dirname, "dados", "listanegra.json");
  try {
    if (!fs.existsSync(ARQ)) return [];
    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    return dados[gid]?.lista || [];
  } catch { return []; }
}

// ==============================================
// 📝 EXTRAIR TEXTO
// ==============================================
function extrairTexto(msg) {
  const mm = msg.message || {};
  if (mm.conversation) return mm.conversation;
  if (mm.extendedTextMessage?.text) return mm.extendedTextMessage.text;
  if (mm.imageMessage?.caption) return mm.imageMessage.caption;
  if (mm.videoMessage?.caption) return mm.videoMessage.caption;
  if (mm.documentMessage?.caption) return mm.documentMessage.caption;
  if (mm.viewOnceMessage?.message?.imageMessage?.caption) return mm.viewOnceMessage.message.imageMessage.caption;
  if (mm.viewOnceMessage?.message?.videoMessage?.caption) return mm.viewOnceMessage.message.videoMessage.caption;
  if (mm.viewOnceMessageV2?.message?.imageMessage?.caption) return mm.viewOnceMessageV2.message.imageMessage.caption;
  if (mm.viewOnceMessageV2?.message?.videoMessage?.caption) return mm.viewOnceMessageV2.message.videoMessage.caption;
  if (mm.viewOnceMessageV2Extension?.message?.imageMessage?.caption) return mm.viewOnceMessageV2Extension.message.imageMessage.caption;
  if (mm.ephemeralMessage?.message?.conversation) return mm.ephemeralMessage.message.conversation;
  if (mm.ephemeralMessage?.message?.extendedTextMessage?.text) return mm.ephemeralMessage.message.extendedTextMessage.text;
  if (mm.ephemeralMessage?.message?.imageMessage?.caption) return mm.ephemeralMessage.message.imageMessage.caption;
  return "";
}

// ==============================================
// 🛡️ MOTOR DE PROTEÇÃO AUTOMÁTICA
// ==============================================
async function aplicarProtecao(sock, msg, idChat, remetente, ehAdm) {
  if (!idChat.endsWith("@g.us")) return false;
  if (ehAdm) return false;

  const cfg = carregarCfgGrupo(idChat);
  const msgContent = msg.message || {};
  const numRem = normalizarNumero(remetente);

  // 🚫 Lista negra (por grupo + por número)
  const ARQ_NEGRA = path.join(__dirname, "dados", "listanegra.json");
  const negraCfg = lerJSON(ARQ_NEGRA, {});
  const negraGrupo = negraCfg[idChat]?.lista || [];
  if (negraGrupo.some(n => normalizarNumero(n) === numRem)) {
    try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}
    console.log("🛡️ Bloqueado: lista negra");
    return true;
  }

  // 🔇 Mute
  if (cfg.mutados?.some(m => normalizarNumero(m) === numRem)) {
    try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}
    console.log("🛡️ Bloqueado: mute");
    return true;
  }

  // 🔗 Anti-link
  if (cfg.antilink) {
    const texto = extrairTexto(msg);
    const regexLink = /(chat\.whatsapp\.com|wa\.me|t\.me|http:\/\/|https:\/\/)/i;

    if (texto && regexLink.test(texto)) {
      let liberado = false;
      let motivo = "🚫 *Você não tem permissão pra mandar links aqui!*\n\n> Fale com um admin se quiser parceria.";

      const regexGrupo = /(chat\.whatsapp\.com\/[A-Za-z0-9_-]+)/i;
      const linkGrupo = texto.match(regexGrupo);

      try {
        if (fs.existsSync(ARQ_PARCERIAS_PROT)) {
          const dados = JSON.parse(fs.readFileSync(ARQ_PARCERIAS_PROT, "utf8"));
          const lista = dados[idChat]?.lista || [];

          const parceria = lista.find(p => normalizarNumero(p.jid) === numRem);

          if (parceria) {
            const hoje = new Date().toDateString();
            if (parceria.ultimoDia !== hoje) {
              parceria.usados = 0;
              parceria.ultimoDia = hoje;
            }

            const usados = parceria.usados || 0;
            const limite = parceria.quantia || 0;

            if (linkGrupo && usados < limite) {
              parceria.usados = usados + 1;
              liberado = true;

              const restantes = limite - parceria.usados;
              try {
                await sock.sendMessage(idChat, {
                  text:
                    `✨ *Tudo certo, @${numRem}!*\n\n` +
                    `> Você ainda pode divulgar *${restantes}* ${restantes === 1 ? "link" : "links"} hoje.\n` +
                    `> ⏰ O limite reseta todo dia às *00:00*.`,
                  mentions: [remetente]
                });
              } catch {}

              fs.writeFileSync(ARQ_PARCERIAS_PROT, JSON.stringify(dados, null, 2));
              return false;
            } else if (!linkGrupo) {
              motivo = "🚫 *Só links de grupo são permitidos por parceiros!*";
            } else {
              motivo = "✨ *Você atingiu o limite diário de links!*\n\n> Volte amanhã às *00:00*.";
            }

            fs.writeFileSync(ARQ_PARCERIAS_PROT, JSON.stringify(dados, null, 2));
          }
        }
      } catch (e) { console.log("Erro parceria:", e.message); }

      try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}

      try {
        await sock.sendMessage(idChat, {
          text: `🔗 *Link bloqueado!*\n\n> @${numRem} — ${motivo}`,
          mentions: [remetente]
        });
      } catch {}

      console.log("🛡️ Bloqueado: antilink");
      return true;
    }
  }

  // 🖼️ Anti-imagem
  if (cfg.antiimg && msgContent.imageMessage) {
    try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}
    console.log("🛡️ Bloqueado: antiimg");
    return true;
  }

  // 🎨 Anti-figurinha
  if (cfg.antifig && msgContent.stickerMessage) {
    try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}
    console.log("🛡️ Bloqueado: antifig");
    return true;
  }

  // 🎤 Anti-áudio
  if (cfg.antaudio && msgContent.audioMessage) {
    try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}
    console.log("🛡️ Bloqueado: antaudio");
    return true;
  }

  // 🎥 Anti-vídeo
  if (cfg.antivideo && msgContent.videoMessage) {
    try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}
    console.log("🛡️ Bloqueado: antivideo");
    return true;
  }

  return false;
}

// ==============================================
// ⏰ AGENDADOR DE ABRIR/FECHAR
// ==============================================
async function processarAgendamentos(sock) {
  const ARQ = path.join(__dirname, "dados", "grupos.json");
  if (!fs.existsSync(ARQ)) return;

  let dados;
  try { dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return; }

  const agora = new Date();
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();
  const hoje = agora.toDateString();

  let mudou = false;

  for (const [gid, cfg] of Object.entries(dados)) {
    if (!cfg) continue;

    if (cfg.agendarFechar && cfg.ultimoFechar !== hoje) {
      const [hh, mm] = cfg.agendarFechar.split(":").map(Number);
      const minutosAgendados = hh * 60 + mm;

      if (horaAtual >= minutosAgendados) {
        try {
          await sock.groupSettingUpdate(gid, "announcement");
          cfg.ultimoFechar = hoje;
          mudou = true;

          const legendaArq = path.join(__dirname, "dados", "legendas", `fechar_${gid}.txt`);
          const fotoArq = path.join(__dirname, "dados", "fotos", `fechar_${gid}.jpg`);

          let legenda = "🔒 *Grupo fechado automaticamente!*";
          if (fs.existsSync(legendaArq)) {
            const l = fs.readFileSync(legendaArq, "utf8").trim();
            if (l) legenda = l;
          }

          if (fs.existsSync(fotoArq)) {
            await sock.sendMessage(gid, { image: fs.readFileSync(fotoArq), caption: legenda });
          } else {
            await sock.sendMessage(gid, { text: legenda });
          }
          console.log(`🔒 Grupo ${gid} fechado (agendado ${cfg.agendarFechar})`);
        } catch (e) {
          console.log("Erro agendarFechar:", e.message);
        }
      }
    }

    if (cfg.agendarAbrir && cfg.ultimoAbrir !== hoje) {
      const [hh, mm] = cfg.agendarAbrir.split(":").map(Number);
      const minutosAgendados = hh * 60 + mm;

      if (horaAtual >= minutosAgendados) {
        try {
          await sock.groupSettingUpdate(gid, "not_announcement");
          cfg.ultimoAbrir = hoje;
          mudou = true;

          const legendaArq = path.join(__dirname, "dados", "legendas", `abrir_${gid}.txt`);
          const fotoArq = path.join(__dirname, "dados", "fotos", `abrir_${gid}.jpg`);

          let legenda = "🔓 *Grupo aberto automaticamente!*";
          if (fs.existsSync(legendaArq)) {
            const l = fs.readFileSync(legendaArq, "utf8").trim();
            if (l) legenda = l;
          }

          if (fs.existsSync(fotoArq)) {
            await sock.sendMessage(gid, { image: fs.readFileSync(fotoArq), caption: legenda });
          } else {
            await sock.sendMessage(gid, { text: legenda });
          }
          console.log(`🔓 Grupo ${gid} aberto (agendado ${cfg.agendarAbrir})`);
        } catch (e) {
          console.log("Erro agendarAbrir:", e.message);
        }
      }
    }
  }

  if (mudou) {
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));
  }
}

// ==============================================
// 🔰 BEM-VINDO / SAÍDA
// ==============================================
async function processarEntradaSaida(sock, update) {
  const { id, participants, action } = update;
  if (!id.endsWith("@g.us")) return;

  const cfg = carregarCfgGrupo(id);
  if (!cfg.bemvindo) return;

  let nomeGrupo = "Grupo";
  try {
    const meta = await sock.groupMetadata(id);
    nomeGrupo = meta.subject || "Grupo";
  } catch {}

  for (const p of participants) {
    const jid = typeof p === "string" ? p : (p.id || p.jid);
    const num = normalizarNumero(jid);

    let nomeContato = num;
    try {
      const contato = sock.store?.contacts?.[jid];
      nomeContato = contato?.name || contato?.notify || contato?.verifiedName || num;
    } catch {}

    if (action === "add") {
      let texto = cfg.textoBemvindo || `👋 *Bem-vindo(a)!*\n\n> {user} entrou no grupo!`;
      texto = texto
        .replace(/{user}/g, `@${num}`)
        .replace(/{nome}/g, nomeContato)
        .replace(/{grupo}/g, nomeGrupo)
        .replace(/{num}/g, num);

      let foto = null;
      try { foto = await sock.profilePictureUrl(jid, "image"); } catch {}

      try {
        if (cfg.midiaBemvindo) {
          const arq = path.join(__dirname, "dados", cfg.midiaBemvindo.arquivo);
          if (fs.existsSync(arq)) {
            const buffer = fs.readFileSync(arq);
            if (cfg.midiaBemvindo.tipo === "image") {
              await sock.sendMessage(id, { image: buffer, caption: texto, mentions: [jid] });
            } else {
              await sock.sendMessage(id, { video: buffer, caption: texto, mentions: [jid] });
            }
            continue;
          }
        }

        if (foto) {
          await sock.sendMessage(id, { image: { url: foto }, caption: texto, mentions: [jid] });
        } else {
          await sock.sendMessage(id, { text: texto, mentions: [jid] });
        }
      } catch (e) { console.log("Erro bemvindo:", e.message); }
    }

    if (action === "remove") {
      let texto = cfg.textoSaiu || `👋 *Até mais!*\n\n> {user} saiu do grupo...`;
      texto = texto
        .replace(/{user}/g, `@${num}`)
        .replace(/{nome}/g, nomeContato)
        .replace(/{grupo}/g, nomeGrupo)
        .replace(/{num}/g, num);

      try {
        if (cfg.midiaSaiu) {
          const arq = path.join(__dirname, "dados", cfg.midiaSaiu.arquivo);
          if (fs.existsSync(arq)) {
            const buffer = fs.readFileSync(arq);
            if (cfg.midiaSaiu.tipo === "image") {
              await sock.sendMessage(id, { image: buffer, caption: texto, mentions: [jid] });
            } else {
              await sock.sendMessage(id, { video: buffer, caption: texto, mentions: [jid] });
            }
            continue;
          }
        }
        await sock.sendMessage(id, { text: texto, mentions: [jid] });
      } catch (e) { console.log("Erro saida:", e.message); }
    }
  }
}

const logger = pino({ level: "silent" });

// ==============================================
// 📥 CARREGAR COMANDOS
// ==============================================
function carregarComandos() {
  const pastaComandos = path.join(__dirname, "comandos");

  if (!fs.existsSync(pastaComandos)) {
    console.log(`${TEMA.erro}❌ Pasta "comandos/" não existe!${COR.reset}`);
    return;
  }

  const arquivos = fs.readdirSync(pastaComandos).filter(a => a.endsWith(".js"));

  arquivos.forEach(arq => {
    try {
      const mod = require(path.join(pastaComandos, arq));

      if (mod.comandos && Array.isArray(mod.comandos)) {
        mod.comandos.forEach(c => comandos.set(c.nome, c.executar));
        console.log(`${TEMA.sucesso}✅ ${arq} → ${mod.comandos.map(c => c.nome).join(", ")}${COR.reset}`);
      } else {
        console.log(`${TEMA.aviso}⚠️ ${arq} → sem propriedade "comandos"${COR.reset}`);
      }

      if (typeof mod.aoReceberMensagem === "function") {
        hooksMensagem.push(mod.aoReceberMensagem);
      }
    } catch (e) {
      console.log(`${TEMA.erro}❌ Erro ao carregar ${arq}: ${e.message}${COR.reset}`);
    }
  });

  console.log(`\n${TEMA.info}📋 Total de comandos: ${comandos.size}${COR.reset}\n`);
}

// ==============================================
// 💬 PROCESSAR MENSAGENS
// ==============================================
function processarMensagens(sock) {
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const idChat = msg.key.remoteJid;
    if (!idChat || idChat === "status@broadcast") return;

    const texto = extrairTexto(msg);
    const remetente = msg.key.participant || msg.key.remoteJid;

// 👁️ Marca mensagens como lidas (se ativado)
try {
  const ARQ_VIEW = path.join(__dirname, "dados", "config_view.json");
  if (fs.existsSync(ARQ_VIEW)) {
    const cfgView = JSON.parse(fs.readFileSync(ARQ_VIEW, "utf8"));
    if (cfgView.ativo) {
      await sock.readMessages([msg.key]);
    }
  }
} catch {}

    hooksMensagem.forEach(h => {
      try { h({ idChat, remetente, msg, sock }); } catch {}
    });

    // 💤 VOLTA DO AFK
    const afkDados = carregarAFK();
    const numRemAFK = normalizarNumero(remetente);

    if (afkDados[numRemAFK]) {
      const tempo = formatarTempo(Date.now() - afkDados[numRemAFK].desde);
      const motivo = afkDados[numRemAFK].motivo;

      delete afkDados[numRemAFK];
      salvarAFK(afkDados);

      try {
        await sock.sendMessage(idChat, {
          text:
            `👋 *BEM-VINDO DE VOLTA!*\n\n` +
            `> 👤 @${numRemAFK}\n` +
            `> ⏰ Ficou AFK por: *${tempo}*\n` +
            `> 📝 Motivo: _${motivo}_`,
          mentions: [remetente]
        });
      } catch (e) { console.log("Erro aviso volta afk:", e.message); }
    }

    // 💤 DETECTA MENÇÃO A USUÁRIO AFK
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const respondido = msg.message?.extendedTextMessage?.contextInfo?.participant;

    const alvos = [...mentions];
    if (respondido && !alvos.includes(respondido)) alvos.push(respondido);

    if (alvos.length) {
      const afkAtual = carregarAFK();
      const avisos = [];

      for (const alvo of alvos) {
        const numAlvo = normalizarNumero(alvo);
        if (afkAtual[numAlvo]) {
          const tempo = formatarTempo(Date.now() - afkAtual[numAlvo].desde);
          avisos.push(
            `💤 @${numAlvo} está *AFK* há *${tempo}*\n> 📝 Motivo: _${afkAtual[numAlvo].motivo}_`
          );
        }
      }
      if (avisos.length) {
        try {
          await sock.sendMessage(idChat, {
            text: `╭━━━〔 💤 *AFK* 〕━━━╮\n\n${avisos.join("\n\n")}\n\n╰━━━━━━━━━━━━━━━━╯`,
            mentions: alvos
          });
        } catch (e) { console.log("Erro aviso afk:", e.message); }
      }
    }

    const PREFIXO = config.PREFIXO || "!";
    const ehGrupo = idChat.endsWith("@g.us");
    const ehDonoAqui = eDonoOuSub(remetente);

    // Sobrescreve o sendMessage pra sempre incluir o canal
    const sendOriginal = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options = {}) => {
      if (!content?.contextInfo) {
        content = { ...content, ...botaoCanal() };
      }
      return sendOriginal(jid, content, options);
    };

    // BLOQUEIO POR ALUGUEL GLOBAL
    const alugueis = lerJSON(ARQUIVO_ALUGUEIS, { global: false, lista: {} });
    if (alugueis.global && ehGrupo) {
      const reg = alugueis.lista?.[idChat];
      const valido = reg && reg.expira > Date.now();
      if (!valido && !ehDonoAqui) return;
    }

    // Verifica se é admin do grupo
    let ehAdm = false;
    if (ehGrupo) {
      ehAdm = ehDonoAqui;
      if (!ehAdm) {
        try {
          const meta = await sock.groupMetadata(idChat);
          const p = meta.participants.find(x => x.id === remetente);
          ehAdm = !!(p?.admin);
        } catch {}
      }
    }

    // Aplica proteção (só se não for adm)
    const bloqueado = await aplicarProtecao(sock, msg, idChat, remetente, ehAdm);
    if (bloqueado) return;

    // PALAVRA "prefixo"
    if (texto && texto.trim().toLowerCase() === "prefixo") {
      return sock.sendMessage(idChat, {
        text:
          `*🤖 Olá! Meu prefixo*\n` +
          `*atual é: 『 ${PREFIXO} 』*\n\n` +
          `*💡 Exemplo:*\n` +
          `*Use ${PREFIXO}menu*`,
        mentions: [remetente]
      });
    }

    // COMANDOS SEM PREFIXO
    const semPrefixo = listarSemPrefixo();
    const primeiraPalavra = texto ? texto.trim().split(/\s+/)[0].toLowerCase() : "";
    const ehSemPrefixo = semPrefixo.includes(primeiraPalavra);

    let comando = "";
    let resto = "";

    if (texto && texto.trim().startsWith(PREFIXO)) {
      const [comandoRaw, ...restoArr] = texto.trim().split(/\s+/);
      comando = comandoRaw.slice(PREFIXO.length).toLowerCase();
      resto = restoArr.join(" ");
    } else if (ehSemPrefixo) {
      const [, ...restoArr] = texto.trim().split(/\s+/);
      comando = primeiraPalavra;
      resto = restoArr.join(" ");
    } else {
      if (!msg.message?.stickerMessage) return;
    }

    // FIGURINHA COM COMANDO
    if (msg.message?.stickerMessage) {
      try {
        const ARQ_FIGCMD = path.join(__dirname, "dados", "figcmd.json");
        if (fs.existsSync(ARQ_FIGCMD)) {
          const dadosFig = JSON.parse(fs.readFileSync(ARQ_FIGCMD, "utf8"));
          if (dadosFig.comandos && Object.keys(dadosFig.comandos).length) {
            const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
            const stream = await downloadContentFromMessage(msg.message.stickerMessage, "sticker");
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const crypto = require("crypto");
            const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

            const registro = dadosFig.comandos[hash];
            if (registro) {
              const executar = comandos.get(registro.comando);
              if (executar) {
                console.log(`🎨 Figurinha executando: !${registro.comando}`);
                return executar({
                  sock,
                  idChat,
                  resto: "",
                  texto: `!${registro.comando}`,
                  msg,
                  PREFIXO,
                  NOME_BOT,
                  DONO_PRINCIPAL_NOME,
                  DONO_PRINCIPAL_NUMERO,
                  CRIADOR_NOME,
                  CRIADOR_NUMERO,
                  totalComandos: comandos.size,
                  downloadMediaMessage,
                  botaoCanal,
                  eDono,
                  eSubDono,
                  eDonoOuSub,
                  normalizarNumero,
                  lerJSON,
                  salvarJSON,
                  listarSemPrefixo,
                  ARQUIVO_SUBDONOS,
                  ARQUIVO_SEM_PREFIXO,
                  ARQUIVO_ALUGUEIS,
                  hooksMensagem,
                  comandos
                });
              }
            }
          }
        }
      } catch (e) {
        console.log("Erro figcmd hook:", e.message);
      }
    }

    if (!comando) return;

    // BLOQUEIO RPG POR GRUPO
    const ARQ_RPG = path.join(__dirname, "dados", "rpg.json");
    const rpgCfg = lerJSON(ARQ_RPG, { usuarios: {}, grupos: {} });

    const comandosRPG = [
      "menurpg", "saldo", "investir", "roubar", "minerar", "pescar",
      "job", "cassino", "loteria", "raspadinha", "mochila", "loja",
      "comprar", "equipar", "rankrpg", "doar", "pix", "vender",
      "banco", "saldobanco", "sacar",
      "petshop", "buypet", "equiparpet", "nomearpet", "soltarpet",
      "statuspet", "alimentarpet", "treinarpet", "batalharpet",
      "menugame", "ppt", "pais", "quiz", "quemsoueu", "forca",
      "adedonha", "velha", "conecta4", "cacapalavras", "damas",
      "adotar", "aceitaradocao", "recusaradocao", "expulsarfilho",
      "meusfilhos", "minhafamilia", "arvoregenealogica", "mesada",
      "presentear", "casar", "aceitarcasar", "recusarcasar", "divorciar",
      "emprestimo", "pagar", "jardin", "melhorar_jardin", "loja_semente", "comprar_inseticida", 
"inseticida", "plantar", "vender_planta", "doar_planta", "cacar"
    ];

    if (comandosRPG.includes(comando) && ehGrupo) {
      const grupoAtivo = rpgCfg.grupos?.[idChat]?.modorpg === true;

      if (!grupoAtivo) {
        return sock.sendMessage(idChat, {
          text: "❌ *O RPG está desativado nesse grupo!*\n\n> Um admin pode ativar com *!modorpg on*."
        });
      }
    }

    const executar = comandos.get(comando);

// COMANDO NÃO ENCONTRADO
if (!executar) {
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  const listaComandos = Array.from(comandos.keys());
  let sugestao = null;
  let menorDist = Infinity;
  for (const cmd of listaComandos) {
    const d = levenshtein(comando.toLowerCase(), cmd.toLowerCase());
    const limite = Math.max(2, Math.floor(cmd.length * 0.4));
    if (d <= limite && d < menorDist) {
      menorDist = d;
      sugestao = cmd;
    }
  }

  // 👇 Monta o texto do erro
  let textoErro = "";
  if (sugestao) {
    textoErro =
      `🚫 *O comando 『 ${PREFIXO}${comando} 』 não existe por aqui.*\n\n` +
      `⚙️ *Você quis dizer 『 ${PREFIXO}${sugestao} 』?*\n\n` +
      `📜 Use *${PREFIXO}menu* para acessar a lista!`;
  } else {
    textoErro =
      `🚫 *O comando 『 ${PREFIXO}${comando} 』 não existe por aqui.*\n\n` +
      `📜 Use *${PREFIXO}menu* para acessar a lista!`;
  }

  // 👇 Verifica se tem foto de erro salva
  const caminhoFoto = path.join(__dirname, "dados", "foto_erro.jpg");
  
  if (fs.existsSync(caminhoFoto)) {
    return sock.sendMessage(idChat, {
      image: fs.readFileSync(caminhoFoto),
      caption: textoErro
    });
  } else {
    return sock.sendMessage(idChat, { text: textoErro });
  }
}

    // VERIFICAÇÃO DE PERMISSÃO (DONO)
    const comandosDono = [
      "addsubdono", "rmsubdono", "lista_subdonos",
      "rg_prefixo", "meulid", "grupoid",
      "aluguelglobal", "add_aluguel", "rmaluguel", "alugueis", "entrar", "kitar",
      "setmenu", "rm_midiamenu",
      "addcmdp", "rmcmdp", "listacmdp",
      "menudono",
      "setchannel", "channel",
      "setchat", "addmoedas", "delmoedas",
      "addvip", "rmvip",
      "figcmd", "delcmdfig", "listacmdfig", "atualizar", "reiniciar", "view", "apikey", "broadcast", "foto_erro", "checkbots", "bot", "uptime", "enquete"
    ];
    if (comandosDono.includes(comando) && !ehDonoAqui) {
      return sock.sendMessage(idChat, {
        text: "🚫 *Acesso negado!*\n\n> Esse comando é exclusivo do dono e subdonos."
      });
    }

    // VERIFICAÇÃO DE ADMIN DO GRUPO
    const comandosAdm = [
      "ban", "promover", "rebaixar", "mute", "unmute",
      "adv", "veradv", "rmadv", "zeraradv",
      "abrir", "fechar", "fechargp", "abrirgp",
      "cancelarfechargp", "cancelarabrirgp",
      "legendafechar", "legendaabrir", "foto_fechar", "foto_abrir",
      "setnomegp", "set_descricao", "infogrupo", "link", "resetlink",
      "somente_adm", "totag", "r",
      "antiimg", "antifig", "antaudio", "antiaudio", "antivideo", "antilink",
      "modo", "addparceria", "delparceria", "lista_parceria",
      "add_listanegra", "rm_listanegra", "listanegra",
      "ativar_bemvindo", "desativar_bemvindo", "textobemvindo", "midiabemvindo",
      "textosaiu", "midiasaiu",
      "modorpg", "x9_adm", "sorteio", "totag", "antiflood", "enquete"
    ];
    if (comandosAdm.includes(comando)) {
      if (!ehDonoAqui && !ehAdm) {
        return sock.sendMessage(idChat, {
          text: "🚫 *Acesso negado!*\n\n> Esse comando é exclusivo de administradores do grupo."
        });
      }
    }

    try {
      await executar({
        sock,
        idChat,
        resto,
        texto,
        msg,
        PREFIXO,
        NOME_BOT,
        DONO_PRINCIPAL_NOME,
        DONO_PRINCIPAL_NUMERO,
        CRIADOR_NOME,
        CRIADOR_NUMERO,
        totalComandos: comandos.size,
        downloadMediaMessage,
        botaoCanal,
        eDono,
        eSubDono,
        eDonoOuSub,
        normalizarNumero,
        lerJSON,
        salvarJSON,
        listarSemPrefixo,
        ARQUIVO_SUBDONOS,
        ARQUIVO_SEM_PREFIXO,
        ARQUIVO_ALUGUEIS,
        hooksMensagem,
        comandos
      });
    } catch (e) {
      console.log(`${TEMA.erro}❌ Erro em !${comando}: ${e.message}${COR.reset}`);
    }
  });
}

// ==============================================
// 🖥️ INTERFACE TERMINAL
// ==============================================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function perguntar(texto) { return new Promise(res => rl.question(texto, res)); }

function linha(tipo = "linha") {
  const cor = TEMA[tipo] || COR.branco;
  console.log(cor + "═".repeat(52) + COR.reset);
}

function painel() {
  console.clear();
  linha("titulo");
  console.log(`${TEMA.titulo}╭${"─".repeat(50)}╮${COR.reset}`);
  console.log(`${TEMA.titulo}│${COR.reset}${COR.brilhante}${" ".repeat(13)} 🤖 ${NOME_BOT} 🤖 ${" ".repeat(13)}${COR.reset}${TEMA.titulo}│${COR.reset}`);
  console.log(`${TEMA.titulo}╰${"─".repeat(50)}╯${COR.reset}`);
  linha();
  console.log(`${TEMA.destaque}📌 Nome do Bot:   ${COR.reset}${NOME_BOT}`);
  console.log(`${TEMA.destaque}👤 Nome Dono:     ${COR.reset}${DONO_PRINCIPAL_NOME}`);
  console.log(`${TEMA.destaque}📱 Número Dono:   ${COR.reset}${DONO_PRINCIPAL_NUMERO}`);
  console.log(`${TEMA.destaque}🔌 Status:        ${conexaoAtiva ? `${TEMA.sucesso}✅ CONECTADO — ${numeroConectado}${COR.reset}` : `${TEMA.erro}❌ Desconectado${COR.reset}`}`);
  linha();
}

// ==============================================
// 🔌 MENU PRINCIPAL
// ==============================================
async function menuConectar() {
  while (true) {
    painel();
    console.log(`${TEMA.opcao}🔌 MENU DE CONEXÃO${COR.reset}`);
    console.log(`\n  ${TEMA.destaque}1.${COR.reset} 📷 Conectar via QR Code`);
    console.log(`  ${TEMA.destaque}2.${COR.reset} 🆔 Conectar via Código de Emparelhamento`);
    console.log(`  ${TEMA.destaque}0.${COR.reset} 🚪 Sair`);
    console.log(`\n${TEMA.aviso}Escolha uma opção (1, 2 ou 0): ${COR.reset}`);

    const escolha = (await perguntar("")).trim();

    if (escolha === "1") { await iniciarConexao("qrcode"); break; }
    else if (escolha === "2") { await iniciarConexao("codigo"); break; }
    else if (escolha === "0") { console.log(`\n${TEMA.aviso}👋 Até logo!${COR.reset}\n`); process.exit(0); }
    else {
      console.log(`\n${TEMA.erro}❌ Opção inválida! Digite 1, 2 ou 0${COR.reset}`);
      await new Promise(r => setTimeout(r, 1200));
    }
  }
}

// ==============================================
// 🔌 INICIAR CONEXÃO
// ==============================================
async function iniciarConexao(modo) {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    markOnlineOnConnect: true,
    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("group-participants.update", async (update) => {
    processarEntradaSaida(sock, update).catch(e => console.log("Erro update:", e.message));

    try {
      const adm = require("./comandos/adm.js");
      if (typeof adm.verificarX9 === "function") {
        await adm.verificarX9(sock, update);
      }
    } catch (e) { console.log("Erro X9:", e.message); }

    const { id, participants, action } = update;
    if (action === "add" && id.endsWith("@g.us")) {
      try {
        const ARQ_NEGRA = path.join(__dirname, "dados", "listanegra.json");
        if (!fs.existsSync(ARQ_NEGRA)) return;

        const negraDados = JSON.parse(fs.readFileSync(ARQ_NEGRA, "utf8"));
        const listaDoGrupo = negraDados[id]?.lista || [];
        const negros = listaDoGrupo.map(n => String(n).split("@")[0].split(":")[0].replace(/\D/g, ""));

        for (const p of participants) {
          const jid = typeof p === "string" ? p : (p.id || p.jid);
          const num = String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");

          if (negros.includes(num)) {
            console.log(`🚫 Banindo ${num} da lista negra no grupo ${id}`);
            try {
              await sock.groupParticipantsUpdate(id, [jid], "remove");
              await sock.sendMessage(id, {
                text: `⛔ @${num} estava na lista negra e foi banido novamente!`,
                mentions: [jid]
              });
            } catch (e) {
              console.log("Erro banindo da lista negra:", e.message);
            }
          }
        }
      } catch (e) {
        console.log("Erro verificando lista negra:", e.message);
      }
    }
  });

  sock.ev.on("connection.update", async (up) => {
    const { connection, qr, lastDisconnect } = up;

    if (qr && modo === "codigo" && !pairingCodeRequested) {
      pairingCodeRequested = true;

      console.log(`\n${TEMA.destaque}🔢 MODO CÓDIGO DE EMPARELHAMENTO${COR.reset}`);
      console.log(`${TEMA.aviso}Digite o número com DDI+DDD (ex: 5563975965071)${COR.reset}`);
      const numero = (await perguntar(`${TEMA.destaque}📱 Número: ${COR.reset}`)).trim().replace(/\D/g, "");

      if (!numero || numero.length < 10) {
        console.log(`\n${TEMA.erro}❌ Número inválido!${COR.reset}`);
        process.exit(1);
      }

      try {
        const codigo = await sock.requestPairingCode(numero);
        console.log(`\n${TEMA.sucesso}╭──────────────────────────────────────╮${COR.reset}`);
        console.log(`${TEMA.sucesso}│${COR.reset}  ✅ SEU CÓDIGO DE EMPARELHAMENTO:     ${TEMA.sucesso}│${COR.reset}`);
        console.log(`${TEMA.sucesso}│${COR.reset}     ${COR.brilhante}${codigo}${COR.reset}                          ${TEMA.sucesso}│${COR.reset}`);
        console.log(`${TEMA.sucesso}╰──────────────────────────────────────╯${COR.reset}`);
        console.log(`\n${TEMA.aviso}📲 Abra o WhatsApp → Aparelhos conectados → Conectar com número de telefone${COR.reset}\n`);
      } catch (e) {
        console.log(`\n${TEMA.erro}❌ Erro ao gerar código: ${e.message}${COR.reset}`);
        process.exit(1);
      }
    }

    if (qr && modo === "qrcode") {
      console.log(`\n${TEMA.titulo}╭──────────────────────────────────────╮${COR.reset}`);
      console.log(`${TEMA.titulo}│${COR.reset}  📲 ESCANEIE O QR CODE ABAIXO      ${TEMA.titulo}│${COR.reset}`);
      console.log(`${TEMA.titulo}╰──────────────────────────────────────╯${COR.reset}\n`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      conexaoAtiva = true;
      numeroConectado = sock.user.id.split(":")[0].split("@")[0];

      console.log(`\n${TEMA.sucesso}╭────────────────────────────────────────────╮${COR.reset}`);
      console.log(`${TEMA.sucesso}│${COR.reset}        🎉 CONECTADO COM SUCESSO! 🎉        ${TEMA.sucesso}│${COR.reset}`);
      console.log(`${TEMA.sucesso}│${COR.reset}  📱 Número: ${numeroConectado}${" ".repeat(Math.max(0, 30 - numeroConectado.length))}${TEMA.sucesso} │${COR.reset}`);
      console.log(`${TEMA.sucesso}╰────────────────────────────────────────────╯${COR.reset}\n`);

      if (!escutando) {
        processarMensagens(sock);
        escutando = true;
      }

      setInterval(() => {
        processarAgendamentos(sock).catch(e => console.log("Erro agendador:", e.message));
      }, 30000);

      setInterval(async () => {
        try {
          const ARQ_ANIV = path.join(__dirname, "dados", "aniversarios.json");
          if (!fs.existsSync(ARQ_ANIV)) return;

          const ARQ_AVISO = path.join(__dirname, "dados", "aniv_avisados.json");
          const dados = JSON.parse(fs.readFileSync(ARQ_ANIV, "utf8"));
          const avisados = fs.existsSync(ARQ_AVISO) ? JSON.parse(fs.readFileSync(ARQ_AVISO, "utf8")) : {};

          const agora = new Date();
          const hoje = `${String(agora.getDate()).padStart(2, "0")}/${String(agora.getMonth() + 1).padStart(2, "0")}`;
          const horaAtual = agora.getHours();
          const minutoAtual = agora.getMinutes();
          let mudou = false;

          for (const [num, info] of Object.entries(dados)) {
            const dataAniv = `${String(info.dia).padStart(2, "0")}/${String(info.mes).padStart(2, "0")}`;
            if (dataAniv !== hoje) continue;

            const chaveDia = `${num}_${hoje}`;
            if (avisados[chaveDia]) continue;

            const horaAniv = info.hora || 0;
            const minutoAniv = info.minuto || 0;
            const jaPassou =
              horaAtual > horaAniv ||
              (horaAtual === horaAniv && minutoAtual >= minutoAniv);
            if (!jaPassou) continue;

            const idade = agora.getFullYear() - info.ano;

            try {
              const groups = await sock.groupFetchAllParticipating();
              for (const gid of Object.keys(groups)) {
                try {
                  await sock.sendMessage(gid, {
                    text:
                      `🎉🎂 *FELIZ ANIVERSÁRIO!* 🎂🎉\n\n` +
                      `> Hoje é o dia especial de @${num}!\n` +
                      `> 🎈 Parabéns pelos *${idade} anos*!\n\n` +
                      `> Que venham muitos anos de saúde, paz e conquistas!  🥳\n` +
                      `> Todo o grupo te deseja um feliz aniversário! 🎁`,
                    mentions: [`${num}@s.whatsapp.net`]
                  });
                } catch {}
              }
            } catch (e) {
              console.log("Erro enviando aniversário:", e.message);
            }

            avisados[chaveDia] = true;
            mudou = true;
          }

          if (mudou) {
            fs.writeFileSync(ARQ_AVISO, JSON.stringify(avisados, null, 2));
          }
        } catch (e) {
          console.log("Erro verificar aniversários:", e.message);
        }
      }, 30 * 1000);

      setInterval(async () => {
        try {
          const ARQ_RPG = path.join(__dirname, "dados", "rpg.json");
          if (!fs.existsSync(ARQ_RPG)) return;

          const dados = JSON.parse(fs.readFileSync(ARQ_RPG, "utf8"));
          let mudou = false;

          for (const [num, u] of Object.entries(dados.usuarios || {})) {
            if (!u.emprestimo?.ativo) continue;
            if (Date.now() < u.emprestimo.expiraEm) continue;

            const valor = u.emprestimo.valor;
            const jid = u.emprestimo.jid;

            if (u.moedas >= valor) {
              u.moedas -= valor;
            } else {
              const pago = u.moedas;
              u.moedas = -(valor - pago);
            }

            u.emprestimo.ativo = false;
            u.emprestimo.valor = 0;
            mudou = true;

            if (jid) {
              try {
                await sock.sendMessage(jid, {
                  text:
                    `🚨 *EMPRÉSTIMO EXPIRADO!*\n\n` +
                    `> 💵 Cobrei automaticamente: *${valor.toLocaleString("pt-BR")}* moedas\n` +
                    `> 💰 Seu saldo atual: *${u.moedas.toLocaleString("pt-BR")}*\n\n` +
                    (u.moedas < 0
                      ? `> ⚠️ Você ficou com saldo *negativo*! Trabalhe pra quitar.`
                      : `> ✅ Empréstimo quitado.`)
                });
              } catch (e) {
                console.log("Erro avisando empréstimo:", e.message);
              }
            }
          }

          if (mudou) {
            fs.writeFileSync(ARQ_RPG, JSON.stringify(dados, null, 2));
          }
        } catch (e) {
          console.log("Erro verificar empréstimos:", e.message);
        }
      }, 60 * 1000);

      setInterval(async () => {
        const alugueis = lerJSON(ARQUIVO_ALUGUEIS, { global: false, lista: {} });
        if (!alugueis.lista) return;

        for (const [gid, reg] of Object.entries(alugueis.lista)) {
          if (reg.expira > Date.now() || reg.avisado) continue;

          try {
            const meta = await sock.groupMetadata(gid);
            const adms = meta.participants.filter(p => p.admin).map(p => p.id);

            const DONO_NOME = config.DONO_PRINCIPAL_NOME || "Dono";
            const DONO_NUM = config.DONO_PRINCIPAL_NUMERO || "";

            if (adms.length) {
              await sock.sendMessage(gid, {
                text:
                  `⏰ *ALUGUEL EXPIRADO!*\n\n` +
                  `> O aluguel desse grupo acabou.\n` +
                  `> 📞 *Contate o dono pra renovar:*\n` +
                  `> 👤 ${DONO_NOME}\n` +
                  `> 📱 wa.me/${DONO_NUM}\n\n` +
                  adms.map(a => `┃ 👑 @${a.split("@")[0].split(":")[0]}`).join("\n"),
                mentions: adms
              });
            }

            await sock.sendMessage(gid, {
              text:
                `👋 *ATÉ MAIS!*\n\n` +
                `> Meu aluguel aqui acabou e vou sair do grupo.\n` +
                `> 📞 Se quiser renovar, fale com: wa.me/${DONO_NUM}`
            });

            await new Promise(r => setTimeout(r, 3000));
            await sock.groupLeave(gid);

            reg.avisado = true;
            salvarJSON(ARQUIVO_ALUGUEIS, alugueis);

            console.log(`👋 Saí do grupo ${gid} (aluguel expirado)`);
          } catch (e) {
            console.log(`Erro ao sair do grupo ${gid}: ${e.message}`);
          }
        }
      }, 60000);
    }

    if (connection === "close") {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      conexaoAtiva = false;
      escutando = false;

      if (codigo !== DisconnectReason.loggedOut) {
        console.log(`\n${TEMA.aviso}🔄 Reconectando...${COR.reset}`);
        setTimeout(() => iniciarConexao(modo), 3000);
      } else {
        console.log(`\n${TEMA.erro}❌ Sessão expirada! Apague a pasta "auth" e reconecte.${COR.reset}`);
        setTimeout(menuConectar, 3000);
      }
    }
  });
}

// ==============================================
// 🚀 INICIAR
// ==============================================
(async () => {
  const licencaOk = await verificarLicenca();

  if (!licencaOk) {
    console.log("❌ Bot bloqueado por licença inválida.");
    process.exit(1);
  }

  iniciarRevalidacao();

  carregarComandos();
  await menuConectar();
})().catch(err => {
  console.error(`❌ Erro fatal: ${err}`);
  process.exit(1);
});
