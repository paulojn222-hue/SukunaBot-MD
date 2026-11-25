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
const V = require("./visual.js"); // 🎨 visual neon (visual.js na mesma pasta)

const CRIADOR_NOME = "ATLAS";
const CRIADOR_NUMERO = "+55 81 9564-7053";

// ==============================================
// ⚙️ VARIÁVEIS GLOBAIS
// ==============================================
const hooksMensagem = [];
const comandos = new Map();

let NOME_BOT = config.NOME_BOT || "TomiokaBot-MD";
let DONO_PRINCIPAL_NOME = config.DONO_PRINCIPAL_NOME || "Não definido";
let DONO_PRINCIPAL_NUMERO = String(config.DONO_PRINCIPAL_NUMERO || "").replace(/\D/g, "");

let sock = null;
let conexaoAtiva = false;
let numeroConectado = null;
let pairingCodeRequested = false;
let escutando = false;
let agendadoresAtivos = false; // evita duplicar os agendadores a cada reconexão

const floodMap = new Map();
const floodAvisos = new Map();

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

  // 👇 TRATA CLIQUE DE BOTÃO E LISTA
  if (mm.buttonsResponseMessage) return mm.buttonsResponseMessage.selectedButtonId;
  if (mm.listResponseMessage) return mm.listResponseMessage.singleSelectReply?.selectedRowId || "";
  if (mm.templateButtonReplyMessage) return mm.templateButtonReplyMessage.selectedId || "";

  // Textos normais
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

  // Verifica se o ANTIFAKE está ativo
  const ARQ_ANTIFAKE = path.join(__dirname, "dados", "antifake.json");
  let antiFakeAtivo = false;
  try {
    if (fs.existsSync(ARQ_ANTIFAKE)) {
      const dadosAF = JSON.parse(fs.readFileSync(ARQ_ANTIFAKE, "utf8"));
      antiFakeAtivo = dadosAF[id] === true;
    }
  } catch {}

  if (antiFakeAtivo) {
    for (const p of participants) {
      const jid = typeof p === "string" ? p : (p.id || p.jid);
      const num = String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");

      // Se não começar com 55 (Brasil), bane
      if (!num.startsWith("55")) {
        try {
          await sock.groupParticipantsUpdate(id, [jid], "remove");
          await sock.sendMessage(id, { text: `⛔ @${num} banido pelo Antifake (número não é brasileiro).`, mentions: [jid] });
        } catch {}
      }
    }
  }

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
// 📝 SISTEMA DE LOG
// ==============================================
async function logMensagem(sock, msg, idChat, remetente, texto) {
  try {
    // Puxa as cores do seu arquivo config_visual.js
    const { COR, TEMA } = require("./config_visual.js");
    const c = TEMA.verdeClaro || "\x1b[92m"; // Fallback caso dê erro
    const b = COR.brilhante || "\x1b[1m";
    const r = COR.reset || "\x1b[0m";

    // 1. Pega o nome do grupo ou do contato
    let nomeLocal = idChat.split("@")[0];
    let isGrupo = idChat.endsWith("@g.us");

    if (isGrupo) {
      try {
        const meta = await sock.groupMetadata(idChat);
        nomeLocal = meta.subject || idChat;
      } catch { nomeLocal = "Grupo Desconhecido"; }
    } else {
      try {
        const contato = sock.store?.contacts?.[idChat];
        nomeLocal = contato?.name || contato?.notify || "Privado";
      } catch {}
    }

    // 2. Identifica o tipo de mensagem
    const m = msg.message || {};
    let tipo = "Texto";
    if (m.imageMessage) tipo = "Imagem";
    else if (m.videoMessage) tipo = "Vídeo";
    else if (m.stickerMessage) tipo = "Figurinha";
    else if (m.audioMessage) tipo = "Áudio";
    else if (m.documentMessage) tipo = "Documento";
    else if (m.buttonsResponseMessage || m.listResponseMessage) tipo = "Botão/Lista";
    else if (!texto) tipo = "Outro";

    // 3. Pega o nome e número do usuário
    let nomeUsuario = "Desconhecido";
    try {
      const contato = sock.store?.contacts?.[remetente];
      nomeUsuario = contato?.name || contato?.notify || contato?.verifiedName || msg.pushName || "Sem Nome";
    } catch {}

    // 👇 AQUI: Pega o número real, ignorando o LID
    // O senderPn é o número real (ex: 558195647053)
    // Se não tiver, tenta o remoteJidAlt (que também tem o número real)
    let numeroReal = "Desconhecido";
    if (msg.key.senderPn) {
      numeroReal = msg.key.senderPn.split("@")[0].split(":")[0];
    } else if (msg.key.remoteJidAlt) {
      numeroReal = msg.key.remoteJidAlt.split("@")[0].split(":")[0];
    } else {
      numeroReal = remetente.split("@")[0].split(":")[0];
    }

    // 4. Formata o horário
    const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // 5. Monta o log verde
    console.log(`\n${c}╭──────────────────────────────────────────────────╮${r}`);
    console.log(`${c}│ ${b}📩 NOVA MENSAGEM${r}`);
    console.log(`${c}├──────────────────────────────────────────────────┤${r}`);
    console.log(`${c}│ 📍 ${b}Local:${r}${c} ${nomeLocal}${r}`);
    console.log(`${c}│ 📄 ${b}Tipo:${r}${c} ${tipo}${r}`);
    console.log(`${c}│ 🕒 ${b}Horário:${r}${c} ${hora}${r}`);
    console.log(`${c}│ 👤 ${b}Usuário:${r}${c} ${nomeUsuario}${r}`); // Removido o número do lado
    console.log(`${c}╰──────────────────────────────────────────────────╯${r}\n`);

  } catch (e) {
    console.log("Erro no sistema de log:", e.message);
  }
}

// ==============================================
// 📥 CARREGAR COMANDOS (visual neon em visual.js)
// ==============================================
async function carregarComandos() {
  await V.carregarModulos({
    pasta: path.join(__dirname, "comandos"),
    comandos,
    hooksMensagem
  });
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

    const ehCanal = idChat.endsWith("@newsletter");

    const texto = extrairTexto(msg);
    const remetente = msg.key.participant || msg.key.remoteJid;

    await logMensagem(sock, msg, idChat, remetente, texto);

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

    if (idChat.endsWith("@g.us")) {
      // 1. Verifica se o anti-flood está ativo no grupo
      const ARQ_ANTI = path.join(__dirname, "dados", "antiflood.json");
      let antiAtivo = false;
      try {
        if (fs.existsSync(ARQ_ANTI)) {
          const antiDados = JSON.parse(fs.readFileSync(ARQ_ANTI, "utf8"));
          antiAtivo = antiDados[idChat] === true;
        }
      } catch {}

      if (antiAtivo) {
        // 2. Conta as mensagens
        const agora = Date.now();
        const chave = `${idChat}|${remetente}`;
        const historico = floodMap.get(chave) || [];

        // Remove mensagens com mais de 5 segundos
        const recentes = historico.filter(t => agora - t < 5000);
        recentes.push(agora);
        floodMap.set(chave, recentes);

        // Se mandou mais de 5 mensagens em 5s, avisa
        if (recentes.length > 5) {
          if (!floodAvisos.has(chave)) {
            floodAvisos.set(chave, true);
            await sock.sendMessage(idChat, {
              text: `⚠️ *@${remetente.split("@")[0]}*, pare de floodar!\n\n> Aguarde 5 segundos antes de mandar outra mensagem.`,
              mentions: [remetente]
            });

            // Libera o aviso depois de 10s
            setTimeout(() => floodAvisos.delete(chave), 10000);
          }

          // Ignora a mensagem (não processa comandos)
          return;
        }
      }
    }

    // 👇 VERIFICAÇÃO DO MODO PV 👇
    const ehPV = !idChat.endsWith("@g.us") && !ehCanal;

    if (ehPV) {
      // Verifica se é o dono
      const donoLid = String(config.DONO_PRINCIPAL_LID).replace(/\D/g, "");
      const numConfig = String(config.DONO_PRINCIPAL_NUMERO).replace(/\D/g, "");
      const remLimpo = remetente.split("@")[0].split(":")[0].replace(/\D/g, "");
      const ehDonoPV = (remLimpo === donoLid) || (remLimpo === numConfig);

      // Se NÃO for o dono, verifica se o PV está desativado
      if (!ehDonoPV) {
        const ARQ_PV = path.join(__dirname, "dados", "config_pv.json");
        let pvAtivo = true; // Se o arquivo não existir, o padrão é ativo
        try {
          if (fs.existsSync(ARQ_PV)) {
            const dadosPV = JSON.parse(fs.readFileSync(ARQ_PV, "utf8"));
            pvAtivo = dadosPV.ativo !== false;
          }
        } catch {}

        if (!pvAtivo) {
          // Se o PV estiver desativado, bloqueia o contato e ignora a mensagem
          try {
            await sock.updateBlockStatus(remetente, "block");
          } catch {}
          return; // O bot ignora a mensagem completamente
        }
      }
    }
    // 👆 FIM DA VERIFICAÇÃO DO MODO PV 👆

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

    // (O sendMessage com botão de canal agora é configurado UMA vez em
    //  iniciarConexao(), em vez de ser reembrulhado a cada mensagem.)

    // BLOQUEIO POR ALUGUEL GLOBAL
    const ARQ_ALUGUEIS = path.join(__dirname, "dados", "alugueis.json");
    const cfgAluguel = lerJSON(ARQ_ALUGUEIS, { global: false, lista: {} });
    if (cfgAluguel.global && ehGrupo && !ehDonoAqui) {
      const agora = Date.now();
      // Verifica se o grupo atual está na lista e se ainda não expirou
      const reg = cfgAluguel.lista ? cfgAluguel.lista[idChat] : null;

      if (!reg || reg.expira <= agora) {
        return; // Ignora a mensagem se o grupo não tiver aluguel ativo
      }
    }

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

    // ... após verificar se é admin e antes de executar o comando ...
    // 👇 VERIFICAÇÃO ANTI-BOTS 👇
    if (ehGrupo && !ehAdm && !ehDonoAqui) {
      const ARQ_ANTIBOTS = path.join(__dirname, "dados", "antibots.json");
      let antiBotsAtivo = false;
      try {
        if (fs.existsSync(ARQ_ANTIBOTS)) {
          const dadosAnti = JSON.parse(fs.readFileSync(ARQ_ANTIBOTS, "utf8"));
          antiBotsAtivo = dadosAnti[idChat] === true;
        }
      } catch {}

      if (antiBotsAtivo) {
        let ehBot = false;
        let motivo = "";

        // 1. Detecta botões (só bots mandam)
        if (msg.message?.buttonsMessage || msg.message?.templateMessage || msg.message?.listMessage || msg.message?.interactiveMessage) {
          ehBot = true;
          motivo = "Mensagem com botões nativos (típico de bot).";
        }

        // 2. Detecta mensagens de visualização única (muito comum em bots)
        if (!ehBot && (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2)) {
          ehBot = true;
          motivo = "Mensagem de visualização única (típico de bot).";
        }

        // 3. Detecta texto se identificando como bot
        if (!ehBot && texto) {
          const textoLower = texto.toLowerCase();
          const palavrasBot = ["sou um bot", "eu sou o bot", "meu prefixo", "meus comandos", "sou o assistente", "bot online"];
          if (palavrasBot.some(p => textoLower.includes(p))) {
            ehBot = true;
            motivo = "Se identificou como bot no texto.";
          }
        }

        // 3. Se for bot, apaga, xinga e bane
        if (ehBot) {
          try {
            await sock.sendMessage(idChat, { delete: msg.key }); // Apaga a mensagem
          } catch {}

          await sock.sendMessage(idChat, {
            text: `🤖 *OUTRO BOT DETECTADO!*\n\n> @${remetente.split("@")[0]}, aqui só tem espaço pra mim! 😎\n> Motivo: _${motivo}_\n\n> Tchau, tchau! 👋`,
            mentions: [remetente]
          });

          // Dá ban na hora
          try {
            await sock.groupParticipantsUpdate(idChat, [remetente], "remove");
          } catch (e) {
            console.log("Erro ao banir bot:", e.message);
          }

          return; // Para de processar
        }
      }
    }
    // 👆 FIM DO ANTI-BOTS 👆

    // 👇 VERIFICAÇÃO ANTI-PORN 👇
    if (ehGrupo) {
      const ARQ_ANTIPORN = path.join(__dirname, "dados", "antiporn.json");
      let antiPornAtivo = false;
      try {
        if (fs.existsSync(ARQ_ANTIPORN)) {
          const dadosAnti = JSON.parse(fs.readFileSync(ARQ_ANTIPORN, "utf8"));
          antiPornAtivo = dadosAnti[idChat] === true;
        }
      } catch {}

      if (antiPornAtivo && !ehAdm && !ehDonoAqui) {
        let suspeito = false;
        let motivo = "";

        // 1. Verifica se é Imagem
        if (msg.message?.imageMessage) {
          try {
            const { Moderator } = require("@desert-ant-labs/moderator/native");
            const sharp = require("sharp");
            const moderator = await Moderator.load(); // Carrega o modelo (pode ser lento na primeira vez)

            // Baixa a imagem
            const buffer = await downloadMediaMessage(msg, "buffer", {});

            // Converte para o formato que a lib aceita (RGB)
            const { data, info } = await sharp(buffer).rotate().raw().toBuffer({ resolveWithObject: true });
            const resultado = await moderator.analyze({ data, width: info.width, height: info.height });

            if (resultado.isNSFW) {
              suspeito = true;
              motivo = "Imagem com conteúdo adulto detectada.";
            }
            moderator.dispose();
          } catch (e) {
            console.log("Erro na análise de imagem:", e.message);
          }
        }

        // 2. Verifica se é Texto com palavras proibidas
        if (!suspeito && texto) {
          const palavrasProibidas = ["porn", "xxx", "sexo", "nude", "nudes", "putaria", "onlyfans"]; // Adicione mais
          const textoLower = texto.toLowerCase();
          if (palavrasProibidas.some(p => textoLower.includes(p))) {
            suspeito = true;
            motivo = "Texto com palavras proibidas.";
          }
        }

        // 3. Se for suspeito, apaga e avisa
        if (suspeito) {
          try {
            await sock.sendMessage(idChat, { delete: msg.key });
          } catch {}

          await sock.sendMessage(idChat, {
            text: `🚫 *CONTEÚDO PROIBIDO DETECTADO!*\n\n> @${remetente.split("@")[0]} — ${motivo}\n> Admins, por favor, banam este usuário.`,
            mentions: [remetente]
          });

          return; // Para de processar a mensagem
        }
      }
    }
    // 👆 FIM DO ANTI-PORN 👆

    // 👇 VERIFICAÇÃO DO MODO "SÓ ADM" 👇
    if (ehGrupo) {
      const ARQ_SOADM = path.join(__dirname, "dados", "so_adm.json");
      let soAdmAtivo = false;
      try {
        if (fs.existsSync(ARQ_SOADM)) {
          const dadosSoAdm = JSON.parse(fs.readFileSync(ARQ_SOADM, "utf8"));
          soAdmAtivo = dadosSoAdm[idChat] === true;
        }
      } catch {}

      // Se o modo estiver ligado e o usuário NÃO for admin e NÃO for o dono...
      if (soAdmAtivo && !ehAdm && !ehDonoAqui) {
        return; // O bot ignora a mensagem completamente
      }
    }
    // 👆 FIM DA VERIFICAÇÃO 👆

    // 👇 VERIFICAÇÃO DO ANTI-STATUS 👇
    if (ehGrupo) {
      const ARQ_ANTISTATUS = path.join(__dirname, "dados", "antistatus.json");
      let antiStatusAtivo = false;
      try {
        if (fs.existsSync(ARQ_ANTISTATUS)) {
          const dadosAnti = JSON.parse(fs.readFileSync(ARQ_ANTISTATUS, "utf8"));
          antiStatusAtivo = dadosAnti[idChat] === true;
        }
      } catch {}

      // Detecta se a mensagem é um Status postado no grupo
      const ehStatus =
        msg.message?.groupStatusMessageV2 ||
        msg.message?.groupStatusMessage ||
        msg.message?.statusMessage ||
        (msg.message?.extendedTextMessage?.contextInfo?.isGroupStatus === true);

      // Se for status no grupo, o modo estiver ON e quem mandou NÃO for admin/dono...
      if (antiStatusAtivo && ehStatus && !ehAdm && !ehDonoAqui) {
        // 1. Manda a mensagem xingando (antes de dar ban)
        try {
          await sock.sendMessage(idChat, {
            text: `🚫 *STATUS NO GRUPO NÃO É PERMITIDO!*\n\n> Bye bye, @${remetente.split("@")[0]}! Tchau tchau! 👋`,
            mentions: [remetente]
          });
        } catch {}

        // 2. Dá ban na pessoa
        try {
          await sock.groupParticipantsUpdate(idChat, [remetente], "remove");
        } catch (e) {
          console.log("Erro ao banir por status:", e.message);
        }

        return; // Ignora o resto do processamento dessa mensagem
      }
    }
    // 👆 FIM DO ANTI-STATUS 👆

    // Aplica proteção (só se não for adm)
    const bloqueado = await aplicarProtecao(sock, msg, idChat, remetente, ehAdm);
    if (bloqueado) return;

    // PALAVRA "prefixo"
    if (texto && texto.trim().toLowerCase() === "prefixo") {
      return sock.sendMessage(idChat, {
        text: `•.̇𖠵⃯🌹 𝗢𝗹𝗮́, 𝗺𝗲𝘂 𝗽𝗿𝗲𝗳𝗶𝘅𝗼 𝗮𝘁𝘂𝗮𝗹 𝗲́ 『 ${PREFIXO} 』`,
        mentions: [remetente]
      });
    }

    // 👇 AQUI: Verifica se o usuário mandou SÓ o prefixo (ex: "/" ou "!")
    if (texto && texto.trim() === PREFIXO) {
      return sock.sendMessage(idChat, {
        text: "*👋 𝗢𝗽𝗮, 𝗲𝘀𝘁𝗼𝘂 𝗮𝗾𝘂𝗶 𝗼𝗻𝗹𝗶𝗻𝗲 𝗲 𝗳𝘂𝗻𝗰𝗶𝗼𝗻𝗮𝗻𝗱𝗼!*"
      }, { quoted: msg });
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
      "menurpg", "saldo", "investir", "roubar", "minerar", "pescar", "crime", // 👈 ADICIONA
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

      // Monta o texto do erro
      let textoErro = "";

      if (sugestao) {
        const semelhanca = Math.max(0, Math.round((1 - menorDist / Math.max(comando.length, sugestao.length)) * 100));
        textoErro =
          `> 🚫 *𝗖𝗢𝗠𝗔𝗡𝗗𝗢 𝗡𝗔̃𝗢 𝗘𝗡𝗖𝗢𝗡𝗧𝗥𝗔𝗗𝗢*\n` +
          `🌹 *Não encontrei o comando 『${PREFIXO}${comando}』 no meu sistema. Você quis dizer 『${PREFIXO}${sugestao}』? Encontrei ${semelhanca}% de semelhança!*`;
      } else {
        textoErro =
          `> 🚫 *𝗖𝗢𝗠𝗔𝗡𝗗𝗢 𝗡𝗔̃𝗢 𝗘𝗡𝗖𝗢𝗡𝗧𝗥𝗔𝗗𝗢*\n` +
          `🌹 *Não encontrei o comando 『${PREFIXO}${comando}』 no meu sistema.*`;
      }

      // Verifica se tem foto de erro salva
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
      "rg_prefixo", "grupoid",
      "aluguelglobal", "add_aluguel", "rmaluguel", "alugueis", "entrar", "kitar",
      "setmenu", "rm_midiamenu",
      "addcmdp", "rmcmdp", "listacmdp",
      "menudono",
      "setchannel", "channel",
      "setchat", "addmoedas", "delmoedas",
      "addvip", "rmvip",
      "figcmd", "delcmdfig", "listacmdfig", "atualizar", "reiniciar", "view", "apikey", "broadcast", "foto_erro", "checkbots", "bot", "uptime", "botao", "nuke", "ban_user", "unban_user", "listaban",
      "grupos", "sair_todos", "bloquear_gp", "desbloquear_gp",
      "listagp_bloq", "entrar_todos",
      "setnome", "setdono", "setlid",
      "antispam", "bloquear_cmd", "liberar_cmd", "panic"
    ];
    if (comandosDono.includes(comando) && !ehDonoAqui) {
      return sock.sendMessage(idChat, {
        text: "🚫 *Acesso negado!*\n\n> Esse comando é exclusivo do dono e subdonos."
      });
    }

    // VERIFICAÇÃO DE ADMIN DO GRUPO
    const comandosAdm = [
      "ban", "promover", "rebaixar", "mute", "unmute", "limite_adv", // 👈 ADICIONA
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
      "modorpg", "x9_adm", "sorteio", "totag", "antiflood", "enquete", "addstatus", "enquete", "antiflood", "so_adm"
    ];
    if (comandosAdm.includes(comando)) {
      if (!ehDonoAqui && !ehAdm) {
        return sock.sendMessage(idChat, {
          text: "🚫 *Acesso negado!*\n\n> Esse comando é exclusivo de administradores do grupo."
        });
      }
    }

    const donoLid = String(config.DONO_PRINCIPAL_LID).replace(/\D/g, "");
    const remetenteLimpo = remetente.split("@")[0].split(":")[0].replace(/\D/g, "");
    const ehDono = remetenteLimpo === donoLid;

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

async function painel({ limpar = false, comBanner = false } = {}) {
  if (limpar) console.clear();
  if (comBanner) await V.banner({ subtitulo: `Criado por ${CRIADOR_NOME}` });
  V.painelStatus({
    nomeBot: NOME_BOT,
    dono: DONO_PRINCIPAL_NOME,
    numeroDono: DONO_PRINCIPAL_NUMERO,
    conectado: conexaoAtiva,
    numero: numeroConectado
  });
}

// ==============================================
// 🔌 MENU PRINCIPAL
// ==============================================
async function menuConectar() {
  // 1. Verifica se já existe uma sessão salva na pasta auth
  const pastaAuth = path.join(__dirname, "auth");
  const arquivoCreds = path.join(pastaAuth, "creds.json");

  if (fs.existsSync(arquivoCreds)) {
    // Se tem credenciais, tenta conectar direto
    V.titulo("CONEXÃO");
    V.info("Sessão encontrada! Conectando automaticamente...");
    await iniciarConexao("auto");
    return;
  }

  // 2. Se não tem, mostra o menu normal
  let primeira = true;
  while (true) {
    await painel({ limpar: !primeira, comBanner: !primeira });
    primeira = false;
    V.menuOpcoes();

    const escolha = (await perguntar(V.prompt("Escolha uma opção"))).trim();

    if (escolha === "1") { await iniciarConexao("qrcode"); break; }
    else if (escolha === "2") { await iniciarConexao("codigo"); break; }
    else if (escolha === "0") { console.log(); V.aviso("Até logo!"); process.exit(0); }
    else {
      V.erro("Opção inválida! Digite 1, 2 ou 0");
      await V.sleep(1200);
    }
  }
}

// ==============================================
// 🔌 INICIAR CONEXÃO
// ==============================================
async function iniciarConexao(modo) {
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      sock.end(undefined);
    } catch (e) {}
  }

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

  // Sobrescreve o sendMessage UMA vez por conexão pra sempre incluir o botão do canal
  const sendOriginal = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, content, options = {}) => {
    if (!content?.contextInfo) {
      content = { ...content, ...botaoCanal() };
    }
    return sendOriginal(jid, content, options);
  };

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

    // 👇 NOVA VERIFICAÇÃO: Se o modo for auto e pedir QR, é porque a sessão expirou
    if (qr && modo === "auto") {
      console.log();
      V.erro("A sessão antiga expirou ou foi desconectada!");
      V.aviso('Apague a pasta "auth" e reconecte pelo menu.');
      process.exit(1);
    }

    // Se for modo código e ainda não pediu o número
    if (qr && modo === "codigo" && !pairingCodeRequested) {
      pairingCodeRequested = true;

      V.titulo("MODO CÓDIGO DE EMPARELHAMENTO");
      V.info("Digite o número com DDI+DDD (ex: 5563975965071)");
      const numero = (await perguntar(V.prompt("Número"))).trim().replace(/\D/g, "");

      if (!numero || numero.length < 10) {
        console.log();
        V.erro("Número inválido!");
        process.exit(1);
      }

      try {
        const codigo = await sock.requestPairingCode(numero);
        V.codigoPareamento(codigo);
      } catch (e) {
        console.log();
        V.erro(`Erro ao gerar código: ${e.message}`);
        process.exit(1);
      }
    }

    // Mostra o QR Code apenas se estiver no modo manual
    if (qr && modo === "qrcode") {
      V.cabecalhoQR();
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      conexaoAtiva = true;
      numeroConectado = sock.user.id.split(":")[0].split("@")[0];

      V.conectado(numeroConectado);

      if (!escutando) {
        processarMensagens(sock);
        escutando = true;
      }

      // Os agendadores abaixo só são criados UMA vez (antes eram duplicados a cada reconexão).
      // Eles usam a variável global `sock`, então continuam funcionando após reconectar.
      if (!agendadoresAtivos) {
        agendadoresAtivos = true;

        const cron = require('node-cron');

        // Frases do dia
        const FRASES_DIA = [
          "Acredite em si mesmo e tudo será possível.",
          "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
          "Não espere por oportunidades, crie-as.",
          "A jornada de mil milhas começa com um simples passo.",
          "Seja a mudança que você deseja ver no mundo.",
          "A melhor hora para plantar uma árvore foi há 20 anos. A segunda melhor é agora.",
          "A persistência é o caminho do êxito."
        ];

        // Agenda para rodar todo dia às 08:00 (horário de Brasília)
        cron.schedule('0 8 * * *', async () => {
          try {
            const ARQ_CHAT = path.join(__dirname, "dados", "chat_principal.json");
            if (!fs.existsSync(ARQ_CHAT)) return;

            const dados = JSON.parse(fs.readFileSync(ARQ_CHAT, "utf8"));
            if (!dados.jid) return; // Se não tiver grupo principal setado, não faz nada

            const fraseAleatoria = FRASES_DIA[Math.floor(Math.random() * FRASES_DIA.length)];

            await sock.sendMessage(dados.jid, {
              text: `🌅 *BOM DIA, GALERA!*\n\n📜 _Frase do dia:_\n\n💬 *"${fraseAleatoria}"*`
            });
          } catch (e) {
            console.log("Erro na frase do dia:", e.message);
          }
        }, {
          scheduled: true,
          timezone: "America/Sao_Paulo"
        });

        setInterval(async () => {
          try {
            await processarAgendamentos(sock);
          } catch (e) {
            // Se for erro de permissão do WhatsApp, ignora silenciosamente
            if (["locked", "forbidden", "rate-overlimit"].includes(e.message)) return;
            console.log("Erro agendador:", e.message);
          }
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

        // ⏰ Verificador de aluguéis expirados
        setInterval(async () => {
          const ARQ_ALUGADOS = path.join(__dirname, "dados", "alugados.json");
          if (!fs.existsSync(ARQ_ALUGADOS)) return;

          const dados = JSON.parse(fs.readFileSync(ARQ_ALUGADOS, "utf8"));
          if (!dados.lista) return;

          const agora = Date.now();
          let mudou = false;

          for (const reg of dados.lista) {
            // 1. Faltando 5 minutos (Aviso Prévio)
            if (reg.expira > agora && (reg.expira - agora) < 300000 && !reg.avisado5min) {
              reg.avisado5min = true;
              mudou = true;
              try {
                await sock.sendMessage(reg.gid, {
                  text: `⚠️ *ALUGUEL EXPIRANDO!*\n\n> Faltam *5 minutos* para o aluguel acabar.\n> Contate o dono para renovar.`
                });
              } catch {}
            }

            // 2. Expirou de vez
            if (reg.expira <= agora && !reg.avisado) {
              reg.avisado = true;
              mudou = true;

              // Avisa o grupo e espera 5 min
              try {
                await sock.sendMessage(reg.gid, {
                  text: `⏰ *ALUGUEL EXPIRADO!*\n\n> O aluguel deste grupo acabou.\n> Vou sair em 5 minutos. Contate o dono para renovar.`
                });
              } catch {}

              // Avisa o dono
              try {
                const DONO = config.DONO_PRINCIPAL_NUMERO || "";
                if (DONO) {
                  await sock.sendMessage(`${DONO}@s.whatsapp.net`, {
                    text: `🚨 *ALUGUEL EXPIRADO*\n\n> Grupo: *${reg.nome}*\n> ID: ${reg.gid}\n> Cliente: @${reg.cliente}`,
                    mentions: [`${reg.cliente}@s.whatsapp.net`]
                  });
                }
              } catch {}

              // Agenda a saída do grupo em 5 minutos (300000 ms)
              setTimeout(async () => {
                try {
                  await sock.groupLeave(reg.gid);
                  console.log(`🚪 Saí do grupo ${reg.gid} (aluguel expirado)`);
                } catch (e) { console.log("Erro ao sair do grupo:", e.message); }
              }, 300000);
            }
          }

          if (mudou) {
            fs.writeFileSync(ARQ_ALUGADOS, JSON.stringify(dados, null, 2));
          }
        }, 60000); // Roda a cada 1 minuto
      }
    }

    if (connection === "close") {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      conexaoAtiva = false;
      escutando = false;

      if (codigo !== DisconnectReason.loggedOut) {
        console.log(`\n${TEMA.aviso}🔄 Reconectando em 15 segundos...${COR.reset}`);
        setTimeout(() => iniciarConexao(modo), 15000); // 👈 Mude aqui
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
  await V.banner({ animado: true, subtitulo: `Criado por ${CRIADOR_NOME}` });

  const licencaOk = await V.licenca(verificarLicenca);
  if (!licencaOk) process.exit(1);

  iniciarRevalidacao();
  V.sucesso("Revalidação automática de licença ativada");

  await carregarComandos();
  await menuConectar(); // Agora ele verifica sozinho
})().catch(err => {
  console.error(`❌ Erro fatal: ${err}`);
  process.exit(1);
});

