const fs = require("fs");
const path = require("path");
const axios = require("axios");

const ARQ_SISTEMAS = path.join(__dirname, "..", "dados", "sistemas_grupos.json");
const ARQ_LEMBRETES = path.join(__dirname, "..", "dados", "lembretes.json");
const ARQ_MENSAGENS = path.join(__dirname, "..", "dados", "historico_msgs.json");

function ler(arq, padrao = {}) {
  try { return fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, "utf8")) : padrao; } catch { return padrao; }
}
function salvar(arq, dados) {
  try { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, JSON.stringify(dados, null, 2)); } catch (e) {}
}

// Cache do anti-flood em memória pra ser rápido
const floodCache = {};

module.exports = {
  comandos: [
    // ==============================================
    // 🛡️ ANTI-FLOOD ON/OFF
    // ==============================================
    {
      nome: "antiflood",
      descricao: "Ativa/desativa anti-flood no grupo",
      async executar({ sock, idChat, resto }) {
        if (!idChat.endsWith("@g.us")) return;
        const op = (resto || "").trim().toLowerCase();
        if (!["on", "off"].includes(op)) return sock.sendMessage(idChat, { text: "❌ Uso: *!antiflood on/off*" });

        const dados = ler(ARQ_SISTEMAS);
        if (!dados[idChat]) dados[idChat] = {};
        dados[idChat].antiflood = op === "on";
        salvar(ARQ_SISTEMAS, dados);

        await sock.sendMessage(idChat, { text: op === "on" ? "🛡️ *Anti-flood ATIVADO!*" : "❌ *Anti-flood DESATIVADO!*" });
      }
    },

    // ==============================================
    // 📊 ENQUETE
    // ==============================================
    {
      nome: "enquete",
      descricao: "Cria uma enquete no grupo",
      async executar({ sock, idChat, resto }) {
        if (!idChat.endsWith("@g.us")) return;
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Uso: *!enquete Pergunta | Opção 1 | Opção 2*" });

        const partes = resto.split("|").map(p => p.trim());
        if (partes.length < 3) return sock.sendMessage(idChat, { text: "❌ Precisa de 1 pergunta e pelo menos 2 opções." });

        const pergunta = partes[0];
        const opcoes = partes.slice(1);

        try {
          await sock.sendMessage(idChat, {
            poll: {
              name: pergunta,
              values: opcoes,
              selectableCount: 1
            }
          });
        } catch (e) {
          await sock.sendMessage(idChat, { text: `❌ Erro ao criar enquete: ${e.message}` });
        }
      }
    },

    // ==============================================
    // ⏰ LEMBRETE (VIP)
    // ==============================================
    {
      nome: "lembrar",
      descricao: "Cria um lembrete (VIP)",
      async executar({ sock, idChat, msg, resto, normalizarNumero, eVIP }) {
        const remetente = msg.key.participant || msg.key.remoteJid;
        if (typeof eVIP === "function" && !eVIP(remetente)) {
          return sock.sendMessage(idChat, { text: "❌ *Comando VIP!*\n\n> Use *!menuvip* pra ver os benefícios." });
        }

        // Formato: !lembrar 30m Tomar água
        const match = resto.match(/^(\d+)([smhd])\s+(.+)$/i);
        if (!match) return sock.sendMessage(idChat, { text: "❌ Uso: *!lembrar 30m Tomar água*\n> s=seg, m=min, h=hora, d=dia" });

        const tempo = parseInt(match[1]);
        const unidade = match[2].toLowerCase();
        const mensagem = match[3];
        const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unidade] * tempo;

        const dados = ler(ARQ_LEMBRETES, { proximoId: 1, lembretes: [] });
        const id = dados.proximoId++;
        dados.lembretes.push({ id, jid: remetente, chat: idChat, msg: mensagem, tempo: Date.now() + ms });
        salvar(ARQ_LEMBRETES, dados);

        await sock.sendMessage(idChat, { text: `⏰ *LEMBRETE CRIADO!*\n\n> Vou te avisar em *${tempo}${unidade}*:\n> _"${mensagem}"_`, mentions: [remetente] });
      }
    },

    // ==============================================
    // 📝 RESUMIR GRUPO
    // ==============================================
    {
      nome: "resumir",
      descricao: "Resume as últimas mensagens do grupo usando IA",
      async executar({ sock, idChat, resto }) {
        if (!idChat.endsWith("@g.us")) return;
        const qtd = parseInt(resto) || 50;
        if (qtd > 100) return sock.sendMessage(idChat, { text: "❌ Máximo de 100 mensagens pra resumir." });

        const historico = ler(ARQ_MENSAGENS, {});
        const msgsDoGrupo = historico[idChat] || [];
        const ultimas = msgsDoGrupo.slice(-qtd);

        if (ultimas.length < 10) return sock.sendMessage(idChat, { text: "❌ Não tem mensagens suficientes pra resumir." });

        await sock.sendMessage(idChat, { text: `📝 *RESUMINDO ${ultimas.length} MENSAGENS...*` });

        // Monta o texto pra IA (usando a API do Bronxys)
        const textoBruto = ultimas.map(m => `${m.nome}: ${m.texto}`).join("\n");
        const prompt = `Resuma a conversa abaixo de forma engraçada e direta em um parágrafo. Destaque os principais assuntos e quem falou o quê:\n\n${textoBruto}`;

        try {
          const API_KEY = require("../config.js").API_KEY_BRONXYS || "";
          const r = await axios.get(`https://api.bronxyshost.com.br/api-bronxys/PERGUNTE_E_EU_RESPONDO?q=${encodeURIComponent(prompt)}&apikey=${API_KEY}`);
          
          if (r.data && r.data.msg) {
            await sock.sendMessage(idChat, { text: `📝 *RESUMO DO GRUPO:*\n\n${r.data.msg}` });
          } else {
            throw new Error("Sem resposta da IA");
          }
        } catch (e) {
          await sock.sendMessage(idChat, { text: `❌ Erro ao resumir: a API de IA falhou.` });
        }
      }
    }
  ],

  // ==============================================
  // ⚙️ HOOK: ANTI-FLOOD E HISTÓRICO
  // ==============================================
  async aoReceberMensagem({ idChat, remetente, msg, sock }) {
    try {
      if (!idChat.endsWith("@g.us")) return;
      const num = String(remetente).split("@")[0].split(":")[0].replace(/\D/g, "");
      if (!num) return;

      const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      const nome = msg.pushName || "Alguém";

      // 1. Salva no histórico (máx 100 por grupo)
      if (texto) {
        const historico = ler(ARQ_MENSAGENS, {});
        if (!historico[idChat]) historico[idChat] = [];
        historico[idChat].push({ nome, texto, hora: Date.now() });
        if (historico[idChat].length > 100) historico[idChat].shift(); // mantém só os últimos 100
        salvar(ARQ_MENSAGENS, historico);
      }

      // 2. Anti-Flood
      const dados = ler(ARQ_SISTEMAS);
      if (dados[idChat]?.antiflood) {
        // Checa se é admin (admins não são mutados pelo anti-flood)
        let ehAdm = false;
        try {
          const meta = await sock.groupMetadata(idChat);
          const p = meta.participants.find(x => x.id === remetente);
          ehAdm = !!p?.admin;
        } catch {}

        if (!ehAdm) {
          const agora = Date.now();
          const chave = `${idChat}|${num}`;
          
          if (!floodCache[chave]) floodCache[chave] = [];
          floodCache[chave] = floodCache[chave].filter(t => agora - t < 3000); // filtra últimos 3s
          floodCache[chave].push(agora);

          if (floodCache[chave].length > 5) {
            // Baniu temporariamente (deleta as mensagens)
            try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}
            
            // Avisa a cada 10s pra não floodar o aviso
            if (!floodCache[`aviso_${chave}`] || agora - floodCache[`aviso_${chave}`] > 10000) {
              floodCache[`aviso_${chave}`] = agora;
              await sock.sendMessage(idChat, { text: `🚫 *@${num}*, pare de floodar!`, mentions: [remetente] });
            }
          }
        }
      }
    } catch {}
  }
};
