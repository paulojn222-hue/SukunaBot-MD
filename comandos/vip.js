const fs = require("fs");
const path = require("path");
const config = require("../config.js");
const axios = require("axios");

// ==============================================
// 📦 ARQUIVOS
// ==============================================
const ARQ_VIP = path.join(__dirname, "..", "dados", "vip.json");
const ARQ_ANOT = path.join(__dirname, "..", "dados", "anotacoes.json");
const ARQ_ANIV = path.join(__dirname, "..", "dados", "aniversarios.json");
const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");
const ARQ_MENU_VIP = path.join(__dirname, "..", "personalize_aqui", "menu_vip.txt");

// ==============================================
// 💾 PERSISTÊNCIA
// ==============================================
function ler(arq, padrao = {}) {
  try {
    if (!fs.existsSync(arq)) return padrao;
    return JSON.parse(fs.readFileSync(arq, "utf8"));
  } catch { return padrao; }
}

function salvar(arq, dados) {
  try {
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, JSON.stringify(dados, null, 2));
  } catch (e) { console.log("Erro salvando:", e.message); }
}

function lerRPG() {
  return ler(ARQ_RPG, { usuarios: {} });
}

function salvarRPG(d) {
  salvar(ARQ_RPG, d);
}

function normalizar(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
}

function formatarTempo(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const p = [];
  if (d > 0) p.push(`${d}d`);
  if (h > 0) p.push(`${h}h`);
  if (m > 0) p.push(`${m}m`);
  if (!p.length) p.push(`${s}s`);
  return p.join(" ");
}

// ==============================================
// 💎 HELPER VIP
// ==============================================
function eVIP(remetente) {
  const num = normalizar(remetente);
  const dados = ler(ARQ_VIP, { vips: {} });
  const v = dados.vips[num];

  // 👇 Atualiza o JID se ainda não tiver (correção pra marcar no listavip)
  if (v && !v.jid && remetente.includes("@")) {
    v.jid = remetente;
    salvar(ARQ_VIP, dados);
  }

  // Dono e subdonos são VIPs automáticos
  const rpgSubs = ler(path.join(__dirname, "..", "dados", "subdonos.json"), { lista: [] });
  const subs = (rpgSubs.lista || []).map(s => typeof s === "string" ? s : s.lid);

  const eDono = num === normalizar(config.DONO_PRINCIPAL_LID) || num === normalizar(config.DONO_PRINCIPAL_NUMERO);
  const eSub = subs.some(s => normalizar(s) === num);

  if (eDono || eSub) return true;

  if (!v) return false;
  if (v.expira && v.expira < Date.now()) {
    // Expirou — remove
    delete dados.vips[num];
    salvar(ARQ_VIP, dados);
    return false;
  }
  return true;
}
// ==============================================
// 📄 MENU VIP
// ==============================================
function carregarMenuVip() {
  try {
    return fs.readFileSync(ARQ_MENU_VIP, "utf8");
  } catch {
    return "❌ Arquivo personalize_aqui/menu_vip.txt não encontrado!";
  }
}

// ==============================================
// 🌎 LISTA DE DDDs E DDIs
// ==============================================
const DDDS = {
  "11": "São Paulo - SP", "12": "Vale do Paraíba - SP", "13": "Baixada Santista - SP",
  "14": "Bauru - SP", "15": "Sorocaba - SP", "16": "Ribeirão Preto - SP", "17": "São José do Rio Preto - SP",
  "18": "Presidente Prudente - SP", "19": "Campinas - SP", "21": "Rio de Janeiro - RJ",
  "22": "Campos - RJ", "24": "Volta Redonda - RJ", "27": "Vitória - ES", "28": "Cachoeiro - ES",
  "31": "Belo Horizonte - MG", "32": "Juiz de Fora - MG", "33": "Governador Valadares - MG",
  "34": "Uberlândia - MG", "35": "Poços de Caldas - MG", "37": "Divinópolis - MG", "38": "Montes Claros - MG",
  "41": "Curitiba - PR", "42": "Ponta Grossa - PR", "43": "Londrina - PR", "44": "Maringá - PR",
  "45": "Foz do Iguaçu - PR", "46": "Pato Branco - PR", "47": "Joinville - SC", "48": "Florianópolis - SC",
  "49": "Chapecó - SC", "51": "Porto Alegre - RS", "53": "Pelotas - RS", "54": "Caxias do Sul - RS",
  "55": "Santa Maria - RS", "61": "Brasília - DF", "62": "Goiânia - GO", "63": "Palmas - TO",
  "64": "Rio Verde - GO", "65": "Cuiabá - MT", "66": "Rondonópolis - MT", "67": "Campo Grande - MS",
  "68": "Rio Branco - AC", "69": "Porto Velho - RO", "71": "Salvador - BA", "73": "Ilhéus - BA",
  "74": "Juazeiro - BA", "75": "Feira de Santana - BA", "77": "Barreiras - BA", "79": "Aracaju - SE",
  "81": "Recife - PE", "82": "Maceió - AL", "83": "João Pessoa - PB", "84": "Natal - RN",
  "85": "Fortaleza - CE", "86": "Teresina - PI", "87": "Petrolina - PE", "88": "Juazeiro do Norte - CE",
  "89": "Picos - PI", "91": "Belém - PA", "92": "Manaus - AM", "93": "Santarém - PA",
  "94": "Marabá - PA", "95": "Boa Vista - RR", "96": "Macapá - AP", "97": "Tefé - AM",
  "98": "São Luís - MA", "99": "Imperatriz - MA"
};

const DDIS = {
  "1": "Estados Unidos / Canadá", "7": "Rússia / Cazaquistão", "20": "Egito",
  "27": "África do Sul", "30": "Grécia", "31": "Holanda", "32": "Bélgica",
  "33": "França", "34": "Espanha", "36": "Hungria", "39": "Itália",
  "40": "Romênia", "41": "Suíça", "43": "Áustria", "44": "Reino Unido",
  "45": "Dinamarca", "46": "Suécia", "47": "Noruega", "48": "Polônia",
  "49": "Alemanha", "51": "Peru", "52": "México", "53": "Cuba",
  "54": "Argentina", "55": "Brasil", "56": "Chile", "57": "Colômbia",
  "58": "Venezuela", "60": "Malásia", "61": "Austrália", "62": "Indonésia",
  "63": "Filipinas", "64": "Nova Zelândia", "65": "Singapura", "66": "Tailândia",
  "81": "Japão", "82": "Coreia do Sul", "84": "Vietnã", "86": "China",
  "90": "Turquia", "91": "Índia", "92": "Paquistão", "93": "Afeganistão",
  "94": "Sri Lanka", "95": "Mianmar", "98": "Irã", "212": "Marrocos",
  "213": "Argélia", "216": "Tunísia", "218": "Líbia", "220": "Gâmbia",
  "221": "Senegal", "234": "Nigéria", "254": "Quênia", "351": "Portugal",
  "352": "Luxemburgo", "353": "Irlanda", "354": "Islândia", "355": "Albânia",
  "356": "Malta", "357": "Chipre", "358": "Finlândia", "359": "Bulgária",
  "370": "Lituânia", "371": "Letônia", "372": "Estônia", "373": "Moldávia",
  "380": "Ucrânia", "381": "Sérvia", "385": "Croácia", "386": "Eslovênia",
  "420": "República Tcheca", "421": "Eslováquia", "852": "Hong Kong",
  "886": "Taiwan", "962": "Jordânia", "963": "Síria", "964": "Iraque",
  "965": "Kuwait", "966": "Arábia Saudita", "971": "Emirados Árabes",
  "972": "Israel", "973": "Bahrein", "974": "Catar", "975": "Butão",
  "976": "Mongólia", "977": "Nepal", "992": "Tajiquistão", "993": "Turcomenistão",
  "994": "Azerbaijão", "995": "Geórgia", "996": "Quirguistão", "998": "Uzbequistão"
};

// ==============================================
// 🎂 IDADE
// ==============================================
function calcularIdade(dia, mes, ano) {
  const hoje = new Date();
  const nasc = new Date(ano, mes - 1, dia);
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();

  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;

  const totalDias = Math.floor((hoje - nasc) / (1000 * 60 * 60 * 24));
  const totalMeses = Math.floor(totalDias / 30.44);
  const totalSemanas = Math.floor(totalDias / 7);

  // Próximo aniversário
  let proxAniv = new Date(hoje.getFullYear(), mes - 1, dia);
  if (proxAniv < hoje) proxAniv = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  const diasFalta = Math.ceil((proxAniv - hoje) / (1000 * 60 * 60 * 24));

  return { anos, totalMeses, totalSemanas, totalDias, diasFalta };
}

module.exports = {
  comandos: [

{
  nome: "revelar",
  descricao: "Revela imagens de visualização única",
  async executar({ sock, idChat, msg, downloadMediaMessage }) {
    const remetente = msg.key.participant || msg.key.remoteJid;
    
    // Verifica VIP
    if (!eVIP(remetente)) {
      return sock.sendMessage(idChat, {
        text: "❌ *ᴄᴏᴍᴀɴᴅᴏ ᴠɪᴘ!*\n\n> Use *!menuvip* pra ver os benefícios."
      });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted) {
      return sock.sendMessage(idChat, { text: "❌ Responda a uma *imagem de visualização única*." });
    }

    // Pega a mídia de visualização única
    const viewOnce = quoted.viewOnceMessageV2?.message?.imageMessage
      || quoted.viewOnceMessage?.message?.imageMessage
      || quoted.imageMessage;

    if (!viewOnce) {
      return sock.sendMessage(idChat, { text: "❌ Isso não é uma imagem de visualização única." });
    }

    try {
      const buffer = await downloadMediaMessage(
        { key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false }, message: { imageMessage: viewOnce } },
        "buffer", {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      await sock.sendMessage(idChat, {
        image: buffer,
        caption: `👁️ *IMAGEM REVELADA*\n\n> Revelado por: @${remetente.split("@")[0]}`,
        mentions: [remetente]
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }
  }
},

// ==============================================
// 🤖 AXIS — IA
// ==============================================
{
  nome: "axis",
  descricao: "Converse com a IA Axis",
  async executar({ sock, idChat, msg, resto }) {
    const remetente = msg.key.participant || msg.key.remoteJid;
    if (!eVIP(remetente)) {
      return sock.sendMessage(idChat, {
        text: "❌ *ᴄᴏᴍᴀɴᴅᴏ ᴠɪᴘ!*\n\n> Use *!menuvip* pra ver os benefícios."
      });
    }

    const q = (resto || "").trim();
    if (!q) return sock.sendMessage(idChat, { text: `❌ *ᴜsᴏ:* !axis <pergunta>` });

    try {
      const r = await axios.get(
        `https://obanai-apis.eu.cc/api/ias/axis?q=${encodeURIComponent(q)}&apitoken=rj8SpI`
      );
      const data = r.data;

      if (!data?.success) {
        return sock.sendMessage(idChat, { text: "❌ *ᴇʀʀᴏ ᴀᴏ ᴀᴄᴇssᴀʀ ᴀ ɪᴀ.*" });
      }

      await sock.sendMessage(idChat, { text: data.data.texto });
    } catch (e) {
      console.error(e.message);
      await sock.sendMessage(idChat, { text: "❌ *ᴇʀʀᴏ ᴀᴏ ᴀᴄᴇssᴀʀ ᴀ ɪᴀ.*" });
    }
  }
},

// ==============================================
// 📍 CEP
// ==============================================
{
  nome: "cep",
  descricao: "Consulta CEP",
  async executar({ sock, idChat, msg, resto }) {
    const remetente = msg.key.participant || msg.key.remoteJid;
    if (!eVIP(remetente)) {
      return sock.sendMessage(idChat, {
        text: "❌ *ᴄᴏᴍᴀɴᴅᴏ ᴠɪᴘ!*\n\n> Use *!menuvip* pra ver os benefícios."
      });
    }

    const cep = (resto || "").replace(/\D/g, "");
    if (cep.length !== 8) {
      return sock.sendMessage(idChat, { text: `❌ • *ᴜsᴏ:* !cep 01310930` });
    }

    try {
      const r = await axios.get(
        `https://obanai-apis.eu.cc/api/outros/cep?cep=${cep}&apitoken=rj8SpI`
      );
      const data = r.data;

      if (!data?.success || !data.data?.cep) {
        return sock.sendMessage(idChat, { text: "❌ • *ᴄᴇᴘ ɴᴀ̃ᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ.*" });
      }

      const d = data.data;
      await sock.sendMessage(idChat, {
        text:
          `📍 • *ᴄᴇᴘ:* ${d.cep}\n\n` +
          `🛣️ • *ʀᴜᴀ:* ${d.logradouro || "—"}${d.complemento ? ` (${d.complemento})` : ""}\n` +
          `🏘️ • *ʙᴀɪʀʀᴏ:* ${d.bairro || "—"}\n` +
          `🏙️ • *ᴄɪᴅᴀᴅᴇ:* ${d.localidade} - ${d.uf}\n` +
          `🗺️ • *ᴇsᴛᴀᴅᴏ:* ${d.estado} (${d.regiao})\n` +
          `📞 • *ᴅᴅᴅ:* ${d.ddd}\n` +
          `🔢 • *ɪʙɢᴇ:* ${d.ibge}`
      });
    } catch (e) {
      console.error(e.message);
      await sock.sendMessage(idChat, { text: "❌ • *ᴇʀʀᴏ ᴀᴏ ʙᴜsᴄᴀʀ ᴏ ᴄᴇᴘ.*" });
    }
  }
},

// ==============================================
// 🎬 SORA — Gera vídeo com IA
// ==============================================
{
  nome: "sora",
  descricao: "Gera um vídeo com IA",
  async executar({ sock, idChat, msg, resto }) {
    const remetente = msg.key.participant || msg.key.remoteJid;
    if (!eVIP(remetente)) {
      return sock.sendMessage(idChat, {
        text: "❌ *ᴄᴏᴍᴀɴᴅᴏ ᴠɪᴘ!*\n\n> Use *!menuvip* pra ver os benefícios."
      });
    }

    const q = (resto || "").trim();
    if (!q) return sock.sendMessage(idChat, { text: `❌ • *ᴜsᴏ:* !sora <descrição do vídeo>` });

    await sock.sendMessage(idChat, { text: "🎬 *ɢᴇʀᴀɴᴅᴏ ᴠɪ́ᴅᴇᴏ... ᴀɢᴜᴀʀᴅᴇ*" });

    try {
      const r = await axios.get(
        `https://obanai-apis.eu.cc/api/ias/sora?prompt=${encodeURIComponent(q)}&apitoken=rj8SpI`,
        { timeout: 120000 }
      );
      const data = r.data;

      if (!data?.success || !data.data?.url) {
        return sock.sendMessage(idChat, {
          text: `❌ • *ᴇʀʀᴏ:* ${data?.message || "ɴᴀ̃ᴏ ꜰᴏɪ ᴘᴏssɪ́ᴠᴇʟ ɢᴇʀᴀʀ ᴏ ᴠɪ́ᴅᴇᴏ."}`
        });
      }

      const video = await axios.get(data.data.url, {
        responseType: "arraybuffer",
        timeout: 60000
      });

      await sock.sendMessage(idChat, {
        video: Buffer.from(video.data),
        caption: "👾 *• ᴠɪ́ᴅᴇᴏ ɢᴇʀᴀᴅᴏ ᴄᴏᴍ sᴜᴄᴇssᴏ!*"
      });
    } catch (e) {
      console.error(e.message);
      await sock.sendMessage(idChat, { text: "❌ • *ᴇʀʀᴏ ᴀᴏ ɢᴇʀᴀʀ ᴏ ᴠɪ́ᴅᴇᴏ.*" });
    }
  }
},

// ==============================================
// 📰 G1 — Notícias
// ==============================================
{
  nome: "g1",
  descricao: "Manda uma notícia aleatória do G1",
  async executar({ sock, idChat, msg }) {
    const remetente = msg.key.participant || msg.key.remoteJid;
    if (!eVIP(remetente)) {
      return sock.sendMessage(idChat, {
        text: "❌ *ᴄᴏᴍᴀɴᴅᴏ ᴠɪᴘ!*\n\n> Use *!menuvip* pra ver os benefícios."
      });
    }

    try {
      const r = await axios.get(
        `https://obanai-apis.eu.cc/api/noticias/g1?apitoken=rj8SpI`
      );
      const data = r.data;

      if (!data?.status || !data.data?.resultado?.length) {
        return sock.sendMessage(idChat, { text: "❌ • *ᴇʀʀᴏ ᴀᴏ ʙᴜsᴄᴀʀ ɴᴏᴛɪ́ᴄɪᴀs.*" });
      }

      const n = data.data.resultado[Math.floor(Math.random() * data.data.resultado.length)];

      await sock.sendMessage(idChat, {
        text:
          `📰 • *${n.noticia}*\n` +
          `📁 ${n.secao} • 🕒 ${n.data}\n\n` +
          `${n.desc}\n\n` +
          `🔗 ${n.link}`
      });
    } catch (e) {
      console.error(e.message);
      await sock.sendMessage(idChat, { text: "❌ • *ᴇʀʀᴏ ᴀᴏ ʙᴜsᴄᴀʀ ɴᴏᴛɪ́ᴄɪᴀs.*" });
    }
  }
},

    // ==============================================
    // 📋 MENU VIP
    // ==============================================
    {
      nome: "menuvip",
      descricao: "Mostra o menu VIP",
      async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME, DONO_PRINCIPAL_NUMERO }) {
        const remetente = msg.key.participant || msg.key.remoteJid;

// Se NÃO for VIP → mostra benefícios + contato do dono
if (!eVIP(remetente)) {
  return sock.sendMessage(idChat, {
    text:
      `╭━━━〔 💎 *SEJA VIP!* 〕━━━╮\n┃\n` +
      `┃ ✨ *BENEFÍCIOS:*\n┃\n` +
      `┃ ⏱️ Ações mais rápidas (cooldown reduzido)\n` +
      `┃ 💰 1300 moedas diárias\n` +
      `┃ 🐾 Pets mais baratos\n` +
      `┃ 🔓 Comandos exclusivos\n` +
      `┃ 💸 Multiplicador 2x de moedas\n` +
      `┃ ✨ Multiplicador 2x de XP\n┃\n` +
      `┃ 📞 *CONTATO DO DONO:*\n` +
      `┃ 👤 ${DONO_PRINCIPAL_NOME || "Moon"}\n` +
      `┃ 📱 wa.me/${DONO_PRINCIPAL_NUMERO || ""}\n┃\n` +
      `┃ 💬 Fale com o dono pra saber os valores!\n┃\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━╯`
  });
}
        // É VIP → mostra menu
        const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

        let texto = carregarMenuVip()
          .replace(/{PREFIXO}/g, PREFIXO || "!")
          .replace(/{BOT}/g, NOME_BOT || "Bot")
          .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
          .replace(/{DATA}/g, data);

        const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menuvip.json");
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
    // 👑 ADDVIP
    // ==============================================
    {
      nome: "addvip",
      descricao: "Adiciona VIP pra alguém",
      async executar({ sock, idChat, msg, resto }) {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const alvo = ctx?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Uso: *!addvip @user <tempo>*\nEx: *!addvip @user 30d*" });

        const tempoStr = (resto || "").trim().split(/\s+/).pop() || "";
        const match = tempoStr.match(/^(\d+)([dhm])$/i);
        if (!match) return sock.sendMessage(idChat, { text: "❌ Tempo inválido! Use: 30d, 12h, 60m" });

        const qtd = parseInt(match[1]);
        const unidade = match[2].toLowerCase();
        const ms = { d: 86400000, h: 3600000, m: 60000 }[unidade];

        const num = normalizar(alvo);
        const dados = ler(ARQ_VIP, { vips: {} });
        const v = dados.vips[num];

        const agora = Date.now();
        const base = v && v.expira > agora ? v.expira : agora;
        const novaExpira = base + qtd * ms;

dados.vips[num] = {
  expira: novaExpira,
  adicionado: agora,
  jid: alvo  // 👈 salva o JID real
};
        salvar(ARQ_VIP, dados);

        await sock.sendMessage(idChat, {
          text:
            `👑 *VIP ADICIONADO!*\n\n` +
            `> 👤 @${num}\n` +
            `> ⏱️ +${qtd}${unidade}\n` +
            `> 📅 Expira em: *${new Date(novaExpira).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}*`,
          mentions: [alvo]
        });
      }
    },

    // ==============================================
    // ❌ RMVIP
    // ==============================================
    {
      nome: "rmvip",
      descricao: "Remove VIP",
      async executar({ sock, idChat, msg }) {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const alvo = ctx?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Uso: *!rmvip @user*" });

        const num = normalizar(alvo);
        const dados = ler(ARQ_VIP, { vips: {} });

        if (!dados.vips[num]) {
          return sock.sendMessage(idChat, { text: `⚠️ @${num} não é VIP.`, mentions: [alvo] });
        }

        delete dados.vips[num];
        salvar(ARQ_VIP, dados);

        await sock.sendMessage(idChat, {
          text: `🗑️ VIP de @${num} removido!`,
          mentions: [alvo]
        });
      }
    },

    // ==============================================
    // 📋 LISTAVIP
    // ==============================================
{
  nome: "listavip",
  descricao: "Lista os VIPs",
  async executar({ sock, idChat }) {
    const dados = ler(ARQ_VIP, { vips: {} });
    const ativos = Object.entries(dados.vips || {}).filter(([, v]) => v.expira > Date.now());

    if (!ativos.length) {
      return sock.sendMessage(idChat, { text: "📭 *Nenhum VIP ativo.*" });
    }

    const mentions = [];
    const linhas = ativos.map(([num, v], i) => {
      // 👇 Usa o JID salvo, senão cai pro padrão
      const jid = v.jid || `${num}@s.whatsapp.net`;
      mentions.push(jid);
      const falta = v.expira - Date.now();
      return `┃ ${i + 1}. @${num} — ⏱️ ${formatarTempo(falta)}`;
    }).join("\n");

    await sock.sendMessage(idChat, {
      text: `💎 *LISTA DE VIPS*\n\n> Total: *${ativos.length}*\n\n${linhas}`,
      mentions
    });
  }
},
    // ==============================================
    // 💠 VIP (tempo restante)
    // ==============================================
    {
      nome: "vip",
      descricao: "Mostra seu tempo de VIP",
      async executar({ sock, idChat, msg }) {
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);

        if (!eVIP(remetente)) {
          return sock.sendMessage(idChat, {
            text: "❌ Você não é VIP! Use *!menuvip* pra ver os benefícios."
          });
        }

        // Verifica se é dono/subdono
        const subDados = ler(path.join(__dirname, "..", "dados", "subdonos.json"), { lista: [] });
        const subs = (subDados.lista || []).map(s => typeof s === "string" ? s : s.lid);
        const eDono = num === normalizar(config.DONO_PRINCIPAL_LID) || num === normalizar(config.DONO_PRINCIPAL_NUMERO);
        const eSub = subs.some(s => normalizar(s) === num);

        if (eDono) {
          return sock.sendMessage(idChat, {
            text: `💎 *VOCÊ É O DONO!*\n\n> 👑 VIP permanente automático`,
            mentions: [remetente]
          });
        }
        if (eSub) {
          return sock.sendMessage(idChat, {
            text: `💎 *VOCÊ É SUBDONO!*\n\n> ✨ VIP permanente automático`,
            mentions: [remetente]
          });
        }

        const dados = ler(ARQ_VIP, { vips: {} });
        const v = dados.vips[num];
        const falta = v.expira - Date.now();

        await sock.sendMessage(idChat, {
          text:
            `💎 *SEU VIP*\n\n` +
            `> ⏱️ Tempo restante: *${formatarTempo(falta)}*\n` +
            `> 📅 Expira em: *${new Date(v.expira).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}*`,
          mentions: [remetente]
        });
      }
    },

    // ==============================================
    // 📍 INFO_DDD
    // ==============================================
    {
      nome: "info_ddd",
      descricao: "Consulta DDD",
      async executar({ sock, idChat, resto }) {
        const ddd = (resto || "").trim().replace(/\D/g, "");
        if (!ddd) return sock.sendMessage(idChat, { text: "❌ Uso: *!info_ddd 11*" });

        const estado = DDDS[ddd];
        if (!estado) return sock.sendMessage(idChat, { text: `❌ DDD *${ddd}* não encontrado.` });

        await sock.sendMessage(idChat, {
          text: `📍 *DDD ${ddd}*\n\n> 🌎 Estado: *${estado}*`
        });
      }
    },

    // ==============================================
    // 🌐 INFO_DDI
    // ==============================================
    {
      nome: "info_ddi",
      descricao: "Consulta DDI",
      async executar({ sock, idChat, resto }) {
        const ddi = (resto || "").trim().replace(/\D/g, "");
        if (!ddi) return sock.sendMessage(idChat, { text: "❌ Uso: *!info_ddi 55*" });

        const pais = DDIS[ddi];
        if (!pais) return sock.sendMessage(idChat, { text: `❌ DDI *${ddi}* não encontrado.` });

        await sock.sendMessage(idChat, {
          text: `🌐 *DDI ${ddi}*\n\n> 🌍 País: *${pais}*`
        });
      }
    },

    // ==============================================
    // ✏️ ANOTAR
    // ==============================================
    {
      nome: "anotar",
      descricao: "Salva uma anotação",
      async executar({ sock, idChat, msg, resto }) {
        const texto = (resto || "").trim();
        if (!texto) return sock.sendMessage(idChat, { text: "❌ Uso: *!anotar <texto>*" });

        const num = normalizar(msg.key.participant || msg.key.remoteJid);
        const dados = ler(ARQ_ANOT, {});
        if (!dados[num]) dados[num] = { lista: [], proxId: 1 };

        const id = dados[num].proxId++;
        dados[num].lista.push({ id, texto, criado: Date.now() });
        salvar(ARQ_ANOT, dados);

        await sock.sendMessage(idChat, {
          text: `📝 *Anotação #${id} salva!*\n\n> "${texto}"`
        });
      }
    },

    // ==============================================
    // 📋 ANOTAÇÕES
    // ==============================================
    {
      nome: "anotações",
      descricao: "Lista suas anotações",
      async executar({ sock, idChat, msg }) {
        const num = normalizar(msg.key.participant || msg.key.remoteJid);
        const dados = ler(ARQ_ANOT, {});
        const lista = dados[num]?.lista || [];

        if (!lista.length) return sock.sendMessage(idChat, { text: "📭 Você não tem anotações." });

        const linhas = lista.map(a => `┃ *#${a.id}* — ${a.texto}`).join("\n");

        await sock.sendMessage(idChat, {
          text: `📋 *SUAS ANOTAÇÕES*\n\n${linhas}\n\n> Use *!rm_anotação <id>* pra remover`
        });
      }
    },

    // ==============================================
    // 🗑️ RM_ANOTAÇÃO
    // ==============================================
    {
      nome: "rm_anotação",
      descricao: "Remove uma anotação",
      async executar({ sock, idChat, msg, resto }) {
        const id = parseInt((resto || "").trim());
        if (!id) return sock.sendMessage(idChat, { text: "❌ Uso: *!rm_anotação <id>*" });

        const num = normalizar(msg.key.participant || msg.key.remoteJid);
        const dados = ler(ARQ_ANOT, {});
        if (!dados[num]?.lista) return sock.sendMessage(idChat, { text: "📭 Você não tem anotações." });

        const idx = dados[num].lista.findIndex(a => a.id === id);
        if (idx < 0) return sock.sendMessage(idChat, { text: `❌ Anotação #${id} não encontrada.` });

        const removida = dados[num].lista.splice(idx, 1)[0];
        salvar(ARQ_ANOT, dados);

        await sock.sendMessage(idChat, { text: `🗑️ Anotação #${id} removida!\n\n> "${removida.texto}"` });
      }
    },

    // ==============================================
    // 👁️ AURA
    // ==============================================
    {
      nome: "aura",
      descricao: "Mede sua aura",
      async executar({ sock, idChat, msg }) {
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);

        // Sigma 30%, Beta 70%
        const sigma = Math.random() < 0.3;
        const tipo = sigma ? "SIGMA" : "BETA";
        const emoji = sigma ? "🐺" : "😐";
        const porcentagem = sigma
          ? 70 + Math.floor(Math.random() * 30) // 70-100%
          : Math.floor(Math.random() * 70);      // 0-70%

        const frases = sigma
          ? ["Você tem uma aura imponente!", "Os sigmas te respeitam.", "Aura de líder detectada."]
          : ["Aura comum detectada.", "Você é um beta normal.", "Nada de especial na aura."];

        const frase = frases[Math.floor(Math.random() * frases.length)];

        await sock.sendMessage(idChat, {
          text:
            `👁️ *SISTEMA DE AURA*\n\n` +
            `> 👤 @${num}\n` +
            `> ${emoji} Tipo: *${tipo}*\n` +
            `> 📊 Nível: *${porcentagem}%*\n\n` +
            `> _${frase}_`,
          mentions: [remetente]
        });
      }
    },

    // ==============================================
    // 🎂 IDADE
    // ==============================================
{
  nome: "idade",
  descricao: "Calcula sua idade",
  async executar({ sock, idChat, msg, resto }) {
    const dataStr = (resto || "").trim();
    const match = dataStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return sock.sendMessage(idChat, { text: "❌ Uso: *!idade dd/mm/aaaa*\nEx: *!idade 15/08/2000*" });

    const dia = parseInt(match[1]);
    const mes = parseInt(match[2]);
    const ano = parseInt(match[3]);

    if (dia > 31 || mes > 12 || ano < 1900 || ano > new Date().getFullYear()) {
      return sock.sendMessage(idChat, { text: "❌ Data inválida!" });
    }

    const r = calcularIdade(dia, mes, ano);
    const remetente = msg.key.participant || msg.key.remoteJid;
    const num = normalizar(remetente);

    await sock.sendMessage(idChat, {
      text:
        `🎂 *SUA IDADE*\n\n` +
        `> 👤 @${num}\n` +
        `> 📅 Nascimento: *${dia}/${mes}/${ano}*\n\n` +
        `> 🎯 Anos: *${r.anos}*\n` +
        `> 📆 Meses: *${r.totalMeses}*\n` +
        `> 📅 Semanas: *${r.totalSemanas}*\n` +
        `> 🗓️ Dias: *${r.totalDias}*\n\n` +
        `> 🎉 Próximo aniversário em: *${r.diasFalta} dias*`,
      mentions: [remetente]
    });
  }
},
    // ==============================================
    // 🎉 DEFINIR_ANIVERSÁRIO
    // ==============================================
    {
      nome: "definir_aniversário",
      descricao: "Define seu aniversário",
      async executar({ sock, idChat, msg, resto }) {
        const args = (resto || "").trim().split(/\s+/);
        if (args.length < 2) {
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!definir_aniversário dd/mm/aaaa hh:mm*\nEx: *!definir_aniversário 15/08/2000 14:30*"
          });
        }

        const matchD = args[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!matchD) return sock.sendMessage(idChat, { text: "❌ Data inválida. Use dd/mm/aaaa" });

        const dia = parseInt(matchD[1]);
        const mes = parseInt(matchD[2]);
        const ano = parseInt(matchD[3]);

        let hora = 0, minuto = 0;
        const matchH = args[1].match(/^(\d{1,2}):(\d{2})$/);
        if (matchH) {
          hora = parseInt(matchH[1]);
          minuto = parseInt(matchH[2]);
        }

        const num = normalizar(msg.key.participant || msg.key.remoteJid);
        const dados = ler(ARQ_ANIV, {});
        dados[num] = { dia, mes, ano, hora, minuto };
        salvar(ARQ_ANIV, dados);

        await sock.sendMessage(idChat, {
          text:
            `🎉 *ANIVERSÁRIO SALVO!*\n\n` +
            `> 📅 Data: *${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}*\n` +
            `> ⏰ Hora: *${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}*`
        });
      }
    },

    // ==============================================
    // 🗑️ RM_ANIVERSÁRIO
    // ==============================================
    {
      nome: "rm_aniversário",
      descricao: "Remove seu aniversário",
      async executar({ sock, idChat, msg }) {
        const num = normalizar(msg.key.participant || msg.key.remoteJid);
        const dados = ler(ARQ_ANIV, {});

        if (!dados[num]) return sock.sendMessage(idChat, { text: "❌ Você não tem aniversário salvo." });

        delete dados[num];
        salvar(ARQ_ANIV, dados);

        await sock.sendMessage(idChat, { text: "🗑️ Aniversário removido!" });
      }
    }
  ],

  // ==============================================
  // 🎂 HOOK: AVISA ANIVERSÁRIOS
  // ==============================================
  async aoReceberMensagem({ idChat, remetente, msg, sock }) {
    // Silencioso — só roda em background pelo setInterval abaixo
  }
};
