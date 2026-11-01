const fs = require("fs");
const path = require("path");

// ==============================================
// 📦 CONTADOR DE MENSAGENS (persistente, por tipo)
// ==============================================
const ARQUIVO_MSGS = path.join(__dirname, "..", "dados", "mensagens.json");

function carregarMsgs() {
  try {
    if (!fs.existsSync(ARQUIVO_MSGS)) return {};
    return JSON.parse(fs.readFileSync(ARQUIVO_MSGS, "utf8"));
  } catch { return {}; }
}

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

function salvarMsgs(dados) {
  try {
    fs.mkdirSync(path.dirname(ARQUIVO_MSGS), { recursive: true });
    fs.writeFileSync(ARQUIVO_MSGS, JSON.stringify(dados, null, 2));
  } catch (e) { console.log("Erro salvando msgs:", e.message); }
}

function detectarTipo(msg) {
  const m = msg.message || {};
  if (m.conversation || m.extendedTextMessage) return "texto";
  if (m.imageMessage) return "foto";
  if (m.videoMessage) return "video";
  if (m.stickerMessage) return "figurinha";
  if (m.audioMessage) return "audio";
  if (m.documentMessage) return "documento";
  return "outros";
}

function contarMensagem(idChat, remetente, msg) {
  const dados = carregarMsgs();
  const chave = `${idChat}|${remetente}`;

  if (!dados[chave]) {
    dados[chave] = {
      total: 0,
      texto: 0, foto: 0, video: 0, figurinha: 0,
      audio: 0, documento: 0, outros: 0,
      ultima: null
    };
  }

  const tipo = detectarTipo(msg);
  dados[chave].total++;
  dados[chave][tipo] = (dados[chave][tipo] || 0) + 1;
  dados[chave].ultima = Date.now();

  salvarMsgs(dados);
}
// ⏱️ Marca o momento em que o bot subiu
const INICIO_BOT = Date.now();

function tempoOnline() {
  const ms = Date.now() - INICIO_BOT;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

module.exports = {
  // 🧠 Hook chamado em toda mensagem recebida
aoReceberMensagem({ idChat, remetente, msg }) {
  contarMensagem(idChat, remetente, msg);
  },

  comandos: [

// ==============================================
// 📊 ATIVIDADE (Mostra estatísticas do membro)
// ==============================================
{
  nome: "atividade",
  descricao: "Mostra as estatísticas de atividade no grupo",
  async executar({ sock, idChat, msg, normalizarNumero }) {
    if (!idChat.endsWith("@g.us")) return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });

    // Pega o alvo (marcado ou respondido) ou o próprio autor
    const alvoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant
      || msg.key.participant
      || msg.key.remoteJid;

    const alvoNum = normalizarNumero(alvoJid);

    // Puxa os dados do RPG pra pegar as estatísticas
    const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");
    let rpgDados = { usuarios: {} };
    try {
      if (fs.existsSync(ARQ_RPG)) rpgDados = JSON.parse(fs.readFileSync(ARQ_RPG, "utf8"));
    } catch {}

    const u = rpgDados.usuarios?.[alvoNum] || {};
    const msgs = u.msgs || 0;
    const comandosUsados = u.comandos || 0;

    // Pega a foto de perfil
    let foto = null;
    try { foto = await sock.profilePictureUrl(alvoJid, "image"); } catch {}

    // Pega o tempo de grupo e o nome
    let nomeGrupo = "Grupo";
    let entrouEm = null;
    try {
      const meta = await sock.groupMetadata(idChat);
      nomeGrupo = meta.subject;
      const participante = meta.participants.find(p => p.id === alvoJid);
      if (participante && participante.joinTime) {
        entrouEm = new Date(participante.joinTime * 1000).toLocaleDateString("pt-BR");
      }
    } catch {}

    const texto =
      `📊 *ATIVIDADE — ${nomeGrupo}*\n\n` +
      `> 👤 *Usuário:* @${alvoNum}\n` +
      `> 📅 *No grupo desde:* ${entrouEm || "Desconhecido"}\n\n` +
      `┃ 💬 *Mensagens:* ${msgs}\n` +
      `┃ ⚙️ *Comandos:* ${comandosUsados}\n` +
      `┃ 🎯 *Nível RPG:* ${u.nivel || 1}\n` +
      `┃ 💰 *Moedas:* ${u.moedas || 0}\n`;

    if (foto) {
      await sock.sendMessage(idChat, { image: { url: foto }, caption: texto, mentions: [alvoJid] });
    } else {
      await sock.sendMessage(idChat, { text: texto, mentions: [alvoJid] });
    }
  }
},


// ==============================================
// 🌤️ CLIMA (Consulta clima de uma cidade)
// ==============================================
{
  nome: "clima",
  descricao: "Mostra o clima de uma cidade",
  async executar({ sock, idChat, resto }) {
    const cidade = (resto || "").trim();
    if (!cidade) return sock.sendMessage(idChat, { text: "❌ Uso: *!clima São Paulo*" });

    try {
      const axios = require("axios");
      // Usa wttr.in (gratuito e não pede token)
      const r = await axios.get(`https://wttr.in/${encodeURIComponent(cidade)}?format=j1`, { timeout: 10000 });
      const data = r.data;

      const atual = data.current_condition[0];
      const temp = atual.temp_C;
      const sensacao = atual.FeelsLikeC;
      const umidade = atual.humidity;
      const vento = atual.windspeedKmph;
      const desc = atual.weatherDesc[0].value;
      const emoji = desc.toLowerCase().includes("sun") ? "☀️" : desc.toLowerCase().includes("rain") ? "🌧️" : desc.toLowerCase().includes("cloud") ? "☁️" : "🌤️";

      await sock.sendMessage(idChat, {
        text: `🌤️ *CLIMA EM ${cidade.toUpperCase()}*\n\n> ${emoji} Condição: *${desc}*\n> 🌡️ Temperatura: *${temp}°C*\n> 🥶 Sensação: *${sensacao}°C*\n> 💧 Umidade: *${umidade}%*\n> 💨 Vento: *${vento} km/h*`
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Não encontrei essa cidade ou a API falhou.` });
    }
  }
},

// ==============================================
// 🌍 INFOPAÍS (Informações de um país)
// ==============================================
{
  nome: "infopais",
  descricao: "Mostra informações de um país",
  async executar({ sock, idChat, resto }) {
    const pais = (resto || "").trim();
    if (!pais) return sock.sendMessage(idChat, { text: "❌ Uso: *!infopais Brasil*" });

    try {
      const axios = require("axios");
      const r = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(pais)}?fields=name,capital,region,population,flags,currencies,languages,area`, { timeout: 10000 });
      const data = r.data[0];

      const nome = data.name.common;
      const capital = data.capital?.[0] || "N/A";
      const regiao = data.region;
      const populacao = data.population.toLocaleString("pt-BR");
      const bandeira = data.flags?.png;
      const area = data.area.toLocaleString("pt-BR");
      const moeda = Object.values(data.currencies || {})[0]?.name || "N/A";
      const idioma = Object.values(data.languages || {}).join(", ") || "N/A";

      const texto = `🌍 *${nome.toUpperCase()}*\n\n> 🏛️ Capital: *${capital}*\n> 🌎 Região: *${regiao}*\n > 👥 População: *${populacao}*\n> 📐 Área: *${area} km²*\n> 💰 Moeda: *${moeda}*\n> 🗣️ Idioma: *${idioma}*`;

      if (bandeira) {
        await sock.sendMessage(idChat, { image: { url: bandeira }, caption: texto });
      } else {
        await sock.sendMessage(idChat, { text: texto });
      }
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Não encontrei informações sobre *${pais}*.` });
    }
  }
},

// ==============================================
// 💤 AFK — define que o usuário está ausente
// ==============================================
{
  nome: "afk",
  descricao: "Define que você está AFK",
  async executar({ sock, idChat, msg, resto, normalizarNumero }) {
    const motivo = (resto || "").trim() || "Sem motivo";
    const remetente = msg.key.participant || msg.key.remoteJid;
    const num = normalizarNumero(remetente);

    const ARQ = path.join(__dirname, "..", "dados", "afk.json");
    const dados = ler(ARQ, {});

    dados[num] = {
      motivo,
      desde: Date.now(),
      chat: idChat
    };
    salvar(ARQ, dados);

    await sock.sendMessage(idChat, {
      text: `💤 *AFK ATIVADO*\n\n> 👤 @${num}\n> 📝 Motivo: *${motivo}*\n\n> _Voltarei em breve!_`,
      mentions: [remetente]
    });
  }
},

// ==============================================
// 💬 CHAT — manda o link do grupo principal
// ==============================================
{
  nome: "chat",
  descricao: "Manda o link do grupo principal",
  async executar({ sock, idChat, lerJSON }) {
    const ARQ = path.join(__dirname, "..", "dados", "chat_principal.json");
    const dados = lerJSON(ARQ, { jid: null });

    if (!dados.jid) {
      return sock.sendMessage(idChat, {
        text: "❌ O dono ainda não definiu o grupo principal.\n\n> Peça pra ele usar *!setchat* num grupo."
      });
    }

    let link = dados.link;
    // Se o link salvo não existir, tenta gerar agora
    if (!link) {
      try {
        const codigo = await sock.groupInviteCode(dados.jid);
        link = `https://chat.whatsapp.com/${codigo}`;
      } catch {}
    }

    let nomeGrupo = "Grupo";
    try {
      const meta = await sock.groupMetadata(dados.jid);
      nomeGrupo = meta.subject || "Grupo";
    } catch {}

    await sock.sendMessage(idChat, {
      text:
        `╭━〔 💬 *GRUPO PRINCIPAL* 💬 〕━╮\n` +
        `┃\n` +
        `┃ 💬 *Nome:* ${nomeGrupo}\n` +
        `┃ 🔗 *Link:* ${link || "_indisponível_"}\n` +
        `┃\n` +
        `┃ ✨ _Entre e faça parte da nossa comunidade!_\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━╯`
    });
  }
},

    // ==============================================
    // 🏓 PING
    // ==============================================
{
  nome: "ping",
  descricao: "Exibe o status do bot e informações da conexão",
  async executar({ sock, idChat }) {
    const inicio = Date.now();

    const data = new Date();
    const dataFormatada = data.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo"
    });

    const horaFormatada = data.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const usoMemoria = process.memoryUsage();
    const memoriaMB = (usoMemoria.rss / 1024 / 1024).toFixed(2);
    const heapMB = (usoMemoria.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (usoMemoria.heapTotal / 1024 / 1024).toFixed(2);

    const tempoLigado = process.uptime();

    const formatarTempo = (segundos) => {
      const dias = Math.floor(segundos / 86400);
      const horas = Math.floor((segundos % 86400) / 3600);
      const minutos = Math.floor((segundos % 3600) / 60);
      const segs = Math.floor(segundos % 60);

      return [
        dias > 0 ? `${dias}d` : null,
        horas > 0 ? `${horas}h` : null,
        minutos > 0 ? `${minutos}min` : null,
        `${segs}s`
      ].filter(Boolean).join(" ");
    };

    const plataforma = process.platform;
    const versaoNode = process.version;

    const mensagem = await sock.sendMessage(idChat, {
      text:
        `╭━━━〔 ⚡ *SISTEMA DE PING* 〕━━━╮\n` +
        `┃\n` +
        `┃ 👻 *BOT:* Online e operacional\n` +
        `┃ 🟢 *STATUS:* Todos os sistemas ativos\n` +
        `┃ 📡 *CONEXÃO:* WhatsApp conectado\n` +
        `┃\n` +
        `┣━━〔 🚀 DESEMPENHO 〕━━\n` +
        `┃\n` +
        `┃ ⚡ *Resposta:* Calculando...\n` +
        `┃ 🧠 *Memória RAM:* ${memoriaMB} MB\n` +
        `┃ 📊 *Heap utilizado:* ${heapMB} MB\n` +
        `┃ 💾 *Heap total:* ${heapTotalMB} MB\n` +
        `┃ ⏱️ *Tempo ligado:* ${formatarTempo(tempoLigado)}\n` +
        `┃\n` +
        `┣━━〔 ⚙️ AMBIENTE 〕━━\n` +
        `┃\n` +
        `┃ 🖥️ *Plataforma:* ${plataforma}\n` +
        `┃ 🟩 *Node.js:* ${versaoNode}\n` +
        `┃ 🔧 *Processo:* ${process.pid}\n` +
        `┃\n` +
        `┣━━〔 📅 INFORMAÇÕES 〕━━\n` +
        `┃\n` +
        `┃ 📆 *Data:* ${dataFormatada}\n` +
        `┃ 🕒 *Horário:* ${horaFormatada}\n` +
        `┃ 🌎 *Fuso:* Brasília (GMT-3)\n` +
        `┃\n` +
        `╰━━━〔 👻 *SISTEMA ATIVO* 〕━━━╯\n\n` +
        `> ✨ Monitoramento executado com sucesso!`,
      ...(typeof botaoCanal === "function" ? botaoCanal() : {})
    });

    const latencia = Date.now() - inicio;

    // A latência real será calculada antes do envio
    // nas próximas execuções, se você implementar um teste separado.
  }
},
    // ==============================================
    // 🪄 MIDDLE — marca admins e avisa que @user precisa de middle
    // ==============================================
    {
      nome: "middle",
      descricao: "Marca admins pedindo middle pro autor",
      async executar({ sock, idChat, msg }) {
        if (!idChat.endsWith("@g.us")) {
          return sock.sendMessage(idChat, { text: "❌ Esse comando só funciona em grupos." });
        }

        const meta = await sock.groupMetadata(idChat);
        const adms = meta.participants.filter(p => p.admin).map(p => p.id);
        const autor = msg.key.participant;

        if (!adms.length) {
          return sock.sendMessage(idChat, { text: "⚠️ Não encontrei administradores nesse grupo." });
        }

        const texto =
          `🪄 *MIDDLE SOLICITADO*\n\n` +
          `> @${autor.split("@")[0]} precisa de *middle*!\n` +
          `> Admins, por favor ajudem.\n\n` +
          adms.map(a => `┃ 🛡️ @${a.split("@")[0]}`).join("\n");

        await sock.sendMessage(idChat, {
          text: texto,
          mentions: [autor, ...adms]
        });
      }
    },

// ==============================================
// 🪄 PERFIL — dados completos
// ==============================================
{
  nome: "perfil",
  descricao: "Mostra dados completos de um usuário",
  async executar({ sock, idChat, msg }) {
    const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant
      || msg.key.participant
      || msg.key.remoteJid;

    // 📸 Foto de perfil
    let foto = null;
    try {
      foto = await sock.profilePictureUrl(alvo, "image");
    } catch { foto = null; }

    // 👤 Nome
    let nome = "";
    try {
      const contato = sock.store?.contacts?.[alvo];
      nome = contato?.name || contato?.notify || contato?.verifiedName || "";
    } catch {}
    if (!nome) {
      try {
        nome = (await sock.getBusinessProfile?.(alvo))?.name || "";
      } catch {}
    }
    if (!nome) {
      try {
        const meta = await sock.groupMetadata(idChat);
        const p = meta.participants.find(x => x.id === alvo);
        nome = p?.name || p?.notify || "";
      } catch {}
    }
    if (!nome) nome = alvo.split("@")[0].split(":")[0];

    // 👑 Cargo no grupo
    let cargo = "👤 𝐌𝐞𝐦𝐛𝐫𝐨";
    if (idChat.endsWith("@g.us")) {
      try {
        const meta = await sock.groupMetadata(idChat);
        const p = meta.participants.find(x => x.id === alvo);
        if (p?.admin === "superadmin") cargo = "👑 𝐃𝐨𝐧𝐨 𝐝𝐨 𝐠𝐫𝐮𝐩𝐨";
        else if (p?.admin === "admin") cargo = "👑 𝐀𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫(𝐚) 𝐝𝐨 𝐠𝐫𝐮𝐩𝐨";
      } catch {}
    }

    // 📊 Estatísticas
    const dados = carregarMsgs();
    const chave = `${idChat}|${alvo}`;
    const s = dados[chave] || {
      total: 0, texto: 0, foto: 0, video: 0,
      figurinha: 0, audio: 0, documento: 0, ultima: null
    };

    const ultimaStr = s.ultima
      ? new Date(s.ultima).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : "Nenhuma ainda";

    // 🎭 Qualidades — geradas a partir do ID (sempre iguais pra mesma pessoa)
    function seed(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
      return Math.abs(h);
    }
    function qual(base, min = 5, max = 99) {
      const h = seed(alvo + base);
      return min + (h % (max - min + 1));
    }

    const qualidades = [
      ["😄 𝐄𝐧𝐠𝐫𝐚𝐜̧𝐚𝐝𝐨(𝐚)",       qual("engracado")],
      ["🧠 𝐈𝐧𝐭𝐞𝐥𝐢𝐠𝐞𝐧𝐭𝐞(𝐚)",     qual("inteligente")],
      ["💪 𝐂𝐨𝐧𝐟𝐢𝐚𝐧𝐭𝐞",           qual("confiante")],
      ["✏️ 𝐂𝐫𝐢𝐚𝐭𝐢𝐯𝐨(𝐚)",         qual("criativo")],
      ["💬 𝐂𝐨𝐦𝐮𝐧𝐢𝐜𝐚𝐭𝐢𝐯𝐨(𝐚)",    qual("comunicativo")],
      ["🎯 𝐃𝐞𝐭𝐞𝐫𝐦𝐢𝐧𝐚𝐝𝐨(𝐚)",     qual("determinado")],
      ["⚔️ 𝐂𝐨𝐫𝐚𝐣𝐨𝐬𝐨(𝐚)",         qual("corajoso")],
      ["💎 𝐒𝐢𝐧𝐜𝐞𝐫𝐨(𝐚)",          qual("sincero")],
      ["🎩 𝐄𝐝𝐮𝐜𝐚𝐝𝐨(𝐚)",          qual("educado")]
    ];

    const texto =
      `╭━━━━━━━━━━━━━━━━━━━━━━━╮\n` +
      `┃ ✨ 𝐏𝐄𝐑𝐅𝐈𝐋 𝐈𝐍𝐓𝐄𝐑𝐄𝐒𝐒𝐀𝐍𝐓𝐄 ✨\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
      `👤 @${alvo.split("@")[0]}\n` +
      `${cargo}\n\n` +
      `╭━━━━━━━━━━━━━━━━━━━━╮\n` +
      `┃ 📊 𝐄𝐒𝐓𝐀𝐓𝐈́𝐒𝐓𝐈𝐂𝐀𝐒\n` +
      `┣━━━━━━━━━━━━━━━━━━━━┫\n` +
      `┃ 💬 𝐓𝐢𝐚𝐥𝐨𝐠𝐨𝐬: ${s.total}\n` +
      `┃ 📝 𝐓𝐞𝐱𝐭𝐨𝐬: ${s.texto}\n` +
      `┃ 🖼️  𝐅𝐨𝐭𝐨𝐬: ${s.foto}\n` +
      `┃ 🎥  𝐕𝐢́𝐝𝐞𝐨𝐬: ${s.video}\n` +
      `┃ 🎨  𝐅𝐢𝐠𝐮𝐫𝐢𝐧𝐡𝐚𝐬: ${s.figurinha}\n` +
      `┃ 🎤  𝐀́𝐮𝐝𝐢𝐨𝐬: ${s.audio}\n` +
      `┃ 📄  𝐃𝐨𝐜𝐮𝐦𝐞𝐧𝐭𝐨𝐬: ${s.documento}\n` +
      `┃ ⏰  𝐔́𝐥𝐭𝐢𝐦𝐚 𝐦𝐞𝐧𝐬𝐬𝐚𝐠𝐞𝐦:\n` +
      `┃    ${ultimaStr}\n` +
      `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
      `╭━━━━━━━━━━━━━━━━━━━━╮\n` +
      `┃ ✨ 𝐐𝐔𝐀𝐋𝐈𝐃𝐀𝐃𝐄𝐒\n` +
      `┣━━━━━━━━━━━━━━━━━━━━┫\n` +
      qualidades.map(([n, v]) => `┃ ${n}: ${String(v).padStart(3, " ")}%`).join("\n") + "\n" +
      `╰━━━━━━━━━━━━━━━━━━━━╯`;

    if (foto) {
      await sock.sendMessage(idChat, {
        image: { url: foto },
        caption: texto,
        mentions: [alvo]
      });
    } else {
      await sock.sendMessage(idChat, {
        text: texto,
        mentions: [alvo]
      });
    }
  }
},
    // ==============================================
    // 🪄 TRADUZIR
    // ==============================================
    {
      nome: "traduzir",
      descricao: "Traduz um texto para outro idioma",
      async executar({ sock, idChat, resto }) {
        if (!resto) {
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!traduzir <idioma> <texto>*\nEx: *!traduzir en Olá mundo*"
          });
        }
        const [idioma, ...palavras] = resto.split(" ");
        const textoTraduzir = palavras.join(" ");
        if (!textoTraduzir) {
          return sock.sendMessage(idChat, { text: "❌ Escreva o texto depois do idioma." });
        }
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idioma}&dt=t&q=${encodeURIComponent(textoTraduzir)}`;
          const r = await fetch(url);
          const j = await r.json();
          const traducao = j[0].map(x => x[0]).join("");
          await sock.sendMessage(idChat, {
            text: `🌐 *Tradução (${idioma}):*\n\n> ${traducao}`
          });
        } catch (e) {
          await sock.sendMessage(idChat, { text: `❌ Erro ao traduzir: ${e.message}` });
        }
      }
    },

// ==============================================
// 💘 CANTADAS (com imagem)
// ==============================================
{
  nome: "cantadas",
  descricao: "Manda uma cantada aleatória com imagem",
  async executar({ sock, idChat }) {
    const local = [
      "Você não é a lua, mas ilumina igual. 🌙",
      "Se beleza fosse crime, você pegava prisão perpétua. 😍",
      "Você é a prova de que Deus caprichou. ✨",
      "Você tem um mapa? Porque me perdi no brilho dos seus olhos. 🗺️",
      "Seu pai é padeiro? Porque você é um sonho. 🥖",
      "Você não é colesterol, mas afetou o meu coração. ❤️",
      "Penso em você 25h por dia. Meu coração faz hora extra. ⏰",
      "Você é a figurinha que falta no meu álbum. Cola em mim? 🏆",
      "Me chama de Sedex que eu me entrego pra você. 📦",
      "Você não é banco, mas tem todo o meu interesse. 🏦",
      "Seu pai é ladrão? Roubou o brilho das estrelas e colocou no seu olhar. ⭐",
      "Você é Wi-Fi? Porque estou sentindo uma conexão. 📶",
      "Você não é chocolate, mas é uma tentação. 🍫",
      "Se eu fosse poeta, só pensaria em você. 📝",
      "Você é a exceção da minha regra. 💫",
      "Gata, você é tão linda que faz um cego acreditar em amor à primeira vista. 👀",
      "Você não é o sol, mas ilumina o meu dia. ☀️",
      "Seu nome é Google? Porque você tem tudo que eu procuro. 🔍",
      "Você é a razão do meu sorriso bobo. 😊",
      "Se beijo fosse remédio, você seria a cura. 💊",
      "Você não é anjo, mas tem asas no meu coração. 😇",
      "Aposto um beijo como você não ficou comigo ainda. 💋",
      "Você é a música que não sai da minha cabeça. 🎵",
      "Seu abraço deve ser o lugar mais seguro do mundo. 🫂",
      "Você não é estrela, mas brilha mais que todas. 🌟",
      "Meu coração bate mais forte quando você aparece. 💓",
      "Você é o 'sim' que eu esperava ouvir. ✅",
      "Se saudade matasse, eu já estaria morto por você. 🥀",
      "Você é a resposta da minha oração. 🙏",
      "Não sou o homem mais rico, mas tenho o coração mais cheio de você. 💎"
    ];

    try {
      let cantada;
      try {
        const r = await fetch("https://raw.githubusercontent.com/David-Trajano/apis/main/cantadas.json");
        const lista = await r.json();
        const c = lista[Math.floor(Math.random() * lista.length)];
        cantada = typeof c === "string" ? c : (c.cantada || c.text || JSON.stringify(c));
      } catch {
        cantada = local[Math.floor(Math.random() * local.length)];
      }

      const imgUrl =
        "https://image.pollinations.ai/prompt/" +
        encodeURIComponent(
          `romantic cute background, soft pink hearts, sweet love card, text: "${cantada}"`
        ) +
        "?width=1080&height=1080&nologo=true&seed=" +
        Math.floor(Math.random() * 999999);

      await sock.sendMessage(idChat, {
        image: { url: imgUrl },
        caption: `💘 ${cantada}`
      });
    } catch (e) {
      const c = local[Math.floor(Math.random() * local.length)];
      await sock.sendMessage(idChat, { text: `💘 ${c}` });
    }
  }
},

// ==============================================
// 🪄 FATOS (traduzido pro português)
// ==============================================
{
  nome: "fatos",
  descricao: "Manda um fato aleatório em português",
  async executar({ sock, idChat }) {
    try {
      const r = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
      const j = await r.json();

      let fato = j.text;
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(j.text)}`;
        const rt = await fetch(url);
        const jt = await rt.json();
        fato = jt[0].map(x => x[0]).join("");
      } catch { /* se falhar, manda em inglês mesmo */ }

      await sock.sendMessage(idChat, { text: `🧠 *Fato aleatório:*\n\n> ${fato}` });
    } catch {
      await sock.sendMessage(idChat, { text: "❌ Não consegui buscar um fato agora." });
    }
  }
},

// ==============================================
// 💰 MOEDAS — cotação (Fawaz Ahmed API - sem chave)
// ==============================================
{
  nome: "moedas",
  descricao: "Mostra cotação de moedas",
  async executar({ sock, idChat }) {
    try {
      // Fawaz Ahmed API (gratuita, sem chave, via CDN jsDelivr)
      const url = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/brl.json";
      const r = await fetch(url);

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const dados = await r.json();
      const taxas = dados.brl; // 1 BRL = X (em cada moeda)

      // Lista de moedas que queremos exibir
      const moedas = [
        { code: "usd", emoji: "💵", nome: "Dólar Americano" },
        { code: "eur", emoji: "💶", nome: "Euro" },
        { code: "gbp", emoji: "💷", nome: "Libra Esterlina" },
        { code: "jpy", emoji: "🇯🇵", nome: "Iene Japonês" },
        { code: "cad", emoji: "🇨🇦", nome: "Dólar Canadense" },
        { code: "aud", emoji: "🇦🇺", nome: "Dólar Australiano" },
        { code: "chf", emoji: "🇨🇭", nome: "Franco Suíço" },
        { code: "cny", emoji: "🇨🇳", nome: "Yuan Chinês" },
        { code: "ars", emoji: "🇦🇷", nome: "Peso Argentino" },
        { code: "clp", emoji: "🇨🇱", nome: "Peso Chileno" },
        { code: "mxn", emoji: "🇲🇽", nome: "Peso Mexicano" },
        { code: "pyg", emoji: "🇵🇾", nome: "Guarani Paraguaio" },
        // Criptomoedas
        { code: "btc", emoji: "₿", nome: "Bitcoin" },
        { code: "eth", emoji: "🪙", nome: "Ethereum" },
        { code: "ltc", emoji: "🪙", nome: "Litecoin" },
        { code: "xrp", emoji: "🪙", nome: "Ripple" }
      ];

      const linhas = [];
      for (const m of moedas) {
        const taxa = taxas[m.code];
        if (taxa === undefined) continue;

        // A API retorna "1 BRL = X moeda". Invertemos para "1 moeda = Y BRL"
        const valorEmBrl = 1 / taxa;

        // Formata: valores pequenos (cripto, pesos) com mais casas decimais
        let formatado;
        if (valorEmBrl >= 1000) {
          formatado = valorEmBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else if (valorEmBrl >= 1) {
          formatado = valorEmBrl.toFixed(2);
        } else {
          formatado = valorEmBrl.toFixed(4);
        }

        linhas.push(`${m.emoji} *${m.code.toUpperCase()}* (${m.nome}) → R$ ${formatado}`);
      }

      if (linhas.length === 0) {
        return sock.sendMessage(idChat, {
          text: "⚠️ Nenhuma cotação retornou. Tente novamente mais tarde."
        });
      }

      await sock.sendMessage(idChat, {
        text:
          `💰 *COTAÇÕES — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}*\n\n` +
          linhas.join("\n") +
          `\n\n> 📊 Fonte: Fawaz Ahmed Currency API`
      });

    } catch (e) {
      await sock.sendMessage(idChat, {
        text: `❌ Erro ao buscar cotações: ${e.message}`
      });
    }
  }
},

    // ==============================================
    // 🪄 CONTAR LETRAS
    // ==============================================
    {
      nome: "contar_letras",
      descricao: "Analisa letras de um texto",
      async executar({ sock, idChat, resto }) {
        if (!resto) {
          return sock.sendMessage(idChat, { text: "❌ Uso: *!contar_letras <texto>*" });
        }
        const semEspaco = resto.replace(/\s/g, "");
        const vogais = (resto.match(/[aeiouáéíóúâêîôûãõàèìòùäëïöü]/gi) || []).length;
        const consoantes = (resto.match(/[bcdfghjklmnpqrstvwxyzç]/gi) || []).length;
        const palavras = resto.trim().split(/\s+/).length;

        await sock.sendMessage(idChat, {
          text:
            `🔤 *ANÁLISE DO TEXTO*\n\n` +
            `> 📝 Texto: _${resto}_\n` +
            `> 🔡 Letras (sem espaço): *${semEspaco.length}*\n` +
            `> 🅰️ Vogais: *${vogais}*\n` +
            `> 🅱️ Consoantes: *${consoantes}*\n` +
            `> 📖 Palavras: *${palavras}*`
        });
      }
    },

    // ==============================================
    // 🪄 CALCULAR
    // ==============================================
    {
      nome: "calcular",
      descricao: "Calcula uma expressão matemática",
      async executar({ sock, idChat, resto }) {
        if (!resto) {
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!calcular <expressão>*\nEx: *!calcular 2+2*3*\n\nOperadores: + - * / % ( ) **"
          });
        }
        const expr = resto.replace(/[^0-9+\-*/%().\s*]/g, "");
        if (!expr.trim()) {
          return sock.sendMessage(idChat, { text: "❌ Expressão inválida." });
        }
        try {
          // eslint-disable-next-line no-new-func
          const resultado = Function(`"use strict"; return (${expr});`)();
          if (typeof resultado !== "number" || !isFinite(resultado)) throw new Error("resultado inválido");
          await sock.sendMessage(idChat, {
            text: `🧮 *CÁLCULO*\n\n> 📥 \`${expr}\`\n> 📤 = *${resultado}*`
          });
        } catch {
          await sock.sendMessage(idChat, { text: "❌ Não consegui calcular isso. Verifique a expressão." });
        }
      }
    },

    // ==============================================
    // 🪄 ALUGAR — passa contato do dono
    // ==============================================
    {
      nome: "alugar",
      descricao: "Envia o contato do dono pra aluguel",
      async executar({ sock, idChat, DONO_PRINCIPAL_NOME, DONO_PRINCIPAL_NUMERO }) {
        if (!DONO_PRINCIPAL_NUMERO) {
          return sock.sendMessage(idChat, { text: "❌ Número do dono não configurado no config.js." });
        }
        const vcard =
          `BEGIN:VCARD\n` +
          `VERSION:3.0\n` +
          `FN:${DONO_PRINCIPAL_NOME || "Dono"}\n` +
          `TEL;type=CELL;type=VOICE;waid=${DONO_PRINCIPAL_NUMERO}:+${DONO_PRINCIPAL_NUMERO}\n` +
          `END:VCARD`;

        await sock.sendMessage(idChat, {
          text: `📞 *ALUGAR O BOT*\n\n> Fale direto com o dono: *${DONO_PRINCIPAL_NOME}*\n> Wa.me: https://wa.me/${DONO_PRINCIPAL_NUMERO}`
        });

        await sock.sendMessage(idChat, {
          contacts: {
            displayName: DONO_PRINCIPAL_NOME || "Dono",
            contacts: [{ vcard }]
          }
        });
      }
    },

// ==============================================
// 🪄 VERSÍCULO COM IMAGEM (em português)
// ==============================================
{
  nome: "versiculo",
  descricao: "Manda um versículo aleatório em português com imagem",
  async executar({ sock, idChat }) {
    try {
      // 1) Busca o versículo
      let referencia, texto;
      try {
        const r = await fetch("https://bible-api.com/data/almeida/random");
        const j = await r.json();
        const v = j.random_verse;
        referencia = `${v.book} ${v.chapter}:${v.verse}`;
        texto = v.text.trim();
      } catch {
        const r = await fetch("https://bible-api.com/joao%203:16?translation=almeida");
        const j = await r.json();
        referencia = j.reference;
        texto = j.text.trim();
      }

      // 2) Gera a imagem com o versículo (via API de texto em imagem)
      // Usamos a API pública do "textpro" / "nekos" style. Aqui vai uma opção estável:
      const imgUrl =
        "https://image.pollinations.ai/prompt/" +
        encodeURIComponent(
          `Beautiful serene background, soft light, nature, inspirational bible verse card, text: "${referencia} - ${texto}"`
        ) +
        "?width=1080&height=1080&nologo=true&seed=" +
        Math.floor(Math.random() * 999999);

      // 3) Envia imagem + legenda
      await sock.sendMessage(idChat, {
        image: { url: imgUrl },
        caption: `📖 *${referencia}*\n\n_"${texto}"_`
      });

    } catch (e) {
      // Fallback: só texto
      try {
        const r = await fetch("https://bible-api.com/joao%203:16?translation=almeida");
        const j = await r.json();
        await sock.sendMessage(idChat, {
          text: `📖 *${j.reference}*\n\n_"${j.text.trim()}"_`
        });
      } catch {
        await sock.sendMessage(idChat, {
          text: "❌ Não consegui buscar um versículo agora."
        });
      }
    }
  }
},

    // ==============================================
    {
      nome: "dono",
      descricao: "Mostra o contato do dono do bot",
      async executar({ sock, idChat, DONO_PRINCIPAL_NOME, DONO_PRINCIPAL_NUMERO }) {
        if (!DONO_PRINCIPAL_NUMERO) {
          return sock.sendMessage(idChat, { text: "❌ Número do dono não configurado." });
        }

        const vcard =
          `BEGIN:VCARD\n` +
          `VERSION:3.0\n` +
          `FN:${DONO_PRINCIPAL_NOME || "Dono"}\n` +
          `TEL;type=CELL;type=VOICE;waid=${DONO_PRINCIPAL_NUMERO}:+${DONO_PRINCIPAL_NUMERO}\n` +
          `END:VCARD`;

        await sock.sendMessage(idChat, {
          text:
            `👑 *MEU DONO*\n\n` +
            `> _A pessoa que me controla!_\n` +
            `> 🔥 Se precisar, fala com ele:\n\n` +
            `> 👤 *Nome:* ${DONO_PRINCIPAL_NOME}\n` +
            `> 📱 *contato:* ${DONO_PRINCIPAL_NUMERO}`
        });

        await sock.sendMessage(idChat, {
          contacts: {
            displayName: DONO_PRINCIPAL_NOME || "Dono",
            contacts: [{ vcard }]
          }
        });
      }
    },

    // ==============================================
    // ✨️ CRIADOR — frase + número fixo do index
    // ==============================================
    {
      nome: "criador",
      descricao: "Mostra o contato do criador do bot",
      async executar({ sock, idChat, CRIADOR_NOME, CRIADOR_NUMERO }) {
        const numeroLimpo = String(CRIADOR_NUMERO || "").replace(/\D/g, "");
        if (!numeroLimpo) {
          return sock.sendMessage(idChat, { text: "❌ Número do criador não configurado no index.js." });
        }

        const vcard =
          `BEGIN:VCARD\n` +
          `VERSION:3.0\n` +
          `FN:${CRIADOR_NOME || "Criador"}\n` +
          `TEL;type=CELL;type=VOICE;waid=${numeroLimpo}:+${numeroLimpo}\n` +
          `END:VCARD`;

        await sock.sendMessage(idChat, {
          text:
            `⚡ *CRIADOR DO BOT*\n\n` +
            `> _O gênio por trás do ${"HoshinoBot-MD v2"}!_\n` +
            `> 💡 Ideias, sugestões ou suporte? Chama ele:\n\n` +
            `┃ 👤 *Nome:* ${CRIADOR_NOME}\n` +
            `┃ 📱 *Wa.me:* https://wa.me/${numeroLimpo}`
        });

        await sock.sendMessage(idChat, {
          contacts: {
            displayName: CRIADOR_NOME || "Criador",
            contacts: [{ vcard }]
          }
        });
      }
    },

    // ==============================================
    // ✨️ ADMS — marca todos os admins do grupo
    // ==============================================
    {
      nome: "adms",
      descricao: "Marca todos os administradores do grupo",
      async executar({ sock, idChat }) {
        if (!idChat.endsWith("@g.us")) {
          return sock.sendMessage(idChat, { text: "❌ Esse comando só funciona em grupos." });
        }

        const meta = await sock.groupMetadata(idChat);
        const adms = meta.participants.filter(p => p.admin).map(p => p.id);

        if (!adms.length) {
          return sock.sendMessage(idChat, { text: "⚠️ Não encontrei administradores nesse grupo." });
        }

        const texto =
          `🛡️ *ADMINISTRADORES DO GRUPO*\n\n` +
          `> Total: *${adms.length}*\n\n` +
          adms.map(a => `┃ 👑 @${a.split("@")[0]}`).join("\n");

        await sock.sendMessage(idChat, {
          text: texto,
          mentions: adms
        });
      }
    },

    // ==============================================
    // ✨️ INFOBOT — informações gerais do bot
    // ==============================================
    {
      nome: "infobot",
      descricao: "Mostra informações do bot",
      async executar({ sock, idChat, NOME_BOT, DONO_PRINCIPAL_NOME, PREFIXO, totalComandos }) {
        const texto =
          `🤖 *INFORMAÇÕES DO BOT*\n\n` +
          `┃ ✧ *Nome:* ${NOME_BOT}\n` +
          `┃ ✧ *Prefixo:* ${PREFIXO}\n` +
          `┃ ✧ *Dono:* ${DONO_PRINCIPAL_NOME}\n` +
          `┃ ✧ *Comandos:* ${totalComandos || 0}\n` +
          `┃ ✧ *Online há:* ${tempoOnline()}\n` +
          `┃ ✧ *Plataforma:* Baileys\n` +
          `┃ ✧ *Node:* ${process.version}\n` +
          `╰━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(idChat, { text: texto });
      }
    }
  ]
};
