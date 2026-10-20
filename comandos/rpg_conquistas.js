const fs = require("fs");
const path = require("path");

const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");

function lerRPG() {
  try {
    if (!fs.existsSync(ARQ_RPG)) return { usuarios: {}, grupos: {} };
    const d = JSON.parse(fs.readFileSync(ARQ_RPG, "utf8"));
    if (!d.usuarios) d.usuarios = {};
    return d;
  } catch { return { usuarios: {}, grupos: {} }; }
}

function salvarRPG(dados) {
  try {
    fs.writeFileSync(ARQ_RPG, JSON.stringify(dados, null, 2));
  } catch (e) { console.log("Erro salvando RPG:", e.message); }
}

function getUsuario(dados, num) {
  if (!dados.usuarios[num]) {
    dados.usuarios[num] = { moedas: 0, xp: 0, nivel: 1, conquistas: { desbloqueadas: [], monstros: 0 }, jid: null };
  }
  const u = dados.usuarios[num];
  if (!u.conquistas) u.conquistas = { desbloqueadas: [], monstros: 0 };
  return u;
}

// ==============================================
// 🏆 LISTA DE CONQUISTAS
// ==============================================
const CONQUISTAS = [
  { id: "monstros_10", nome: "Caçador Iniciante", desc: "Vença 10 monstros", tipo: "monstros", meta: 10, premio: 1000 },
  { id: "monstros_100", nome: "Caçador Veterano", desc: "Vença 100 monstros", tipo: "monstros", meta: 100, premio: 10000 },
  { id: "nivel_10", nome: "Aprendiz", desc: "Alcance o nível 10", tipo: "nivel", meta: 10, premio: 5000 },
  { id: "nivel_50", nome: "Mestre", desc: "Alcance o nível 50", tipo: "nivel", meta: 50, premio: 50000 },
  { id: "rico_100k", nome: "Milionário", desc: "Acumule 100.000 moedas", tipo: "moedas", meta: 100000, premio: 20000 }
];

module.exports = {
  comandos: [
    // ==============================================
    // 🏆 CONQUISTAS
    // ==============================================
    {
      nome: "conquistas",
      descricao: "Mostra suas conquistas",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        salvarRPG(dados);

        const linhas = CONQUISTAS.map(c => {
          const desbloqueada = u.conquistas.desbloqueadas.includes(c.id);
          return `┃ ${desbloqueada ? "✅" : "🔒"} *${c.nome}*\n┃    _${c.desc}_\n┃    💰 +${c.premio}`;
        }).join("\n\n");

        await sock.sendMessage(idChat, {
          text: `🏆 *SUAS CONQUISTAS*\n\n${linhas}`,
          mentions: [msg.key.participant || msg.key.remoteJid]
        });
      }
    },

    // ==============================================
    // 🏅 RANK NÍVEL
    // ==============================================
    {
      nome: "ranknivel",
      descricao: "Ranking por nível",
      async executar({ sock, idChat }) {
        const dados = lerRPG();
        const lista = Object.entries(dados.usuarios || {}).sort((a, b) => (b[1].nivel || 0) - (a[1].nivel || 0));
        const top = lista.slice(0, 10);
        
        if (!top.length) return sock.sendMessage(idChat, { text: "📭 Sem dados ainda." });
        
        const mentions = [];
        const linhas = top.map(([num, u], i) => {
          const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
          mentions.push(`${num}@s.whatsapp.net`);
          return `┃ ${medalha} @${num} — 🎯 Nível ${u.nivel}`;
        }).join("\n");

        await sock.sendMessage(idChat, { text: `🏅 *TOP NÍVEIS*\n\n${linhas}`, mentions });
      }
    },

    // ==============================================
    // 👹 RANK MONSTROS
    // ==============================================
    {
      nome: "rankmonstros",
      descricao: "Ranking por monstros vencidos",
      async executar({ sock, idChat }) {
        const dados = lerRPG();
        const lista = Object.entries(dados.usuarios || {}).sort((a, b) => (b[1].conquistas?.monstros || 0) - (a[1].conquistas?.monstros || 0));
        const top = lista.slice(0, 10);
        
        if (!top.length) return sock.sendMessage(idChat, { text: "📭 Sem dados ainda." });
        
        const mentions = [];
        const linhas = top.map(([num, u], i) => {
          const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
          mentions.push(`${num}@s.whatsapp.net`);
          return `┃ ${medalha} @${num} — 👹 ${u.conquistas?.monstros || 0} mortos`;
        }).join("\n");

        await sock.sendMessage(idChat, { text: `👹 *TOP CAÇADORES*\n\n${linhas}`, mentions });
      }
    },

    // ==============================================
    // 💰 RANK RIQUEZA
    // ==============================================
    {
      nome: "rankriqueza",
      descricao: "Ranking por moedas",
      async executar({ sock, idChat }) {
        const dados = lerRPG();
        const lista = Object.entries(dados.usuarios || {}).sort((a, b) => (b[1].moedas || 0) - (a[1].moedas || 0));
        const top = lista.slice(0, 10);
        
        if (!top.length) return sock.sendMessage(idChat, { text: "📭 Sem dados ainda." });
        
        const mentions = [];
        const linhas = top.map(([num, u], i) => {
          const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
          mentions.push(`${num}@s.whatsapp.net`);
          return `┃ ${medalha} @${num} — 💰 ${u.moedas}`;
        }).join("\n");

        await sock.sendMessage(idChat, { text: `💰 *TOP RICOS*\n\n${linhas}`, mentions });
      }
    },

    // ==============================================
    // 🎖️ TÍTULO RPG
    // ==============================================
    {
      nome: "titulorpg",
      descricao: "Mostra seu título atual",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        salvarRPG(dados);

        const total = u.conquistas.desbloqueadas.length;
        let titulo = "🌱 Iniciante";
        
        if (total >= 5) titulo = "🏆 Lendário";
        else if (total >= 3) titulo = "👑 Mestre";
        else if (total >= 1) titulo = "⚔️ Aventureiro";

        await sock.sendMessage(idChat, {
          text: `🎖️ *SEU TÍTULO*\n\n> 👤 @${num}\n> 🏷️ Título: *${titulo}*\n> 🏆 Conquistas: *${total}/${CONQUISTAS.length}*`,
          mentions: [msg.key.participant || msg.key.remoteJid]
        });
      }
    }
  ]
};
