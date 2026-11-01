const fs = require("fs");
const path = require("path");

const ARQ_ALUGADOS = path.join(__dirname, "..", "dados", "alugados.json");
const ARQ_CFG = path.join(__dirname, "..", "dados", "config_aluguel.json");

function ler(arq, padrao = {}) {
  try { return fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, "utf8")) : padrao; } catch { return padrao; }
}
function salvar(arq, dados) {
  try { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, JSON.stringify(dados, null, 2)); } catch (e) {}
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

module.exports = {
  comandos: [
    // ==============================================
    // 🗑️ DELALUGUEL (Remove o aluguel)
    // ==============================================
    {
      nome: "delaluguel",
      descricao: "Remove o aluguel de um grupo (Dono)",
      async executar({ sock, idChat, msg, resto }) {
        let gidAlvo = idChat;

        // Se mandou link, extrai o código e avisa
        const match = (resto || "").match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]+)/i);
        if (match) {
          return sock.sendMessage(idChat, { text: "⚠️ Por segurança, execute *!delaluguel* diretamente dentro do grupo que deseja remover." });
        }

        const dados = ler(ARQ_ALUGADOS, { lista: [] });
        const index = dados.lista.findIndex(a => a.gid === gidAluguel);

        if (index === -1) return sock.sendMessage(idChat, { text: "⚠️ Este grupo não tem aluguel registrado." });

        dados.lista.splice(index, 1);
        salvar(ARQ_ALUGADOS, dados);

        await sock.sendMessage(idChat, { text: "🗑️ *Aluguel removido deste grupo!*" });
      }
    },

    // ==============================================
    // ℹ️ INFO_ALUGUEL (Tempo restante)
    // ==============================================
    {
      nome: "info_aluguel",
      descricao: "Mostra o tempo restante de aluguel",
      async executar({ sock, idChat }) {
        const dados = ler(ARQ_ALUGADOS, { lista: [] });
        const reg = dados.lista.find(a => a.gid === idChat);

        if (!reg) return sock.sendMessage(idChat, { text: "❌ Este grupo não tem aluguel ativo." });

        if (reg.expira <= Date.now()) {
          return sock.sendMessage(idChat, { text: "🚨 *ALUGUEL EXPIRADO!*\n\n> Por favor, contate o dono para renovar." });
        }

        await sock.sendMessage(idChat, {
          text: `ℹ️ *INFORMAÇÕES DO ALUGUEL*\n\n> ⏰ Expira em: *${formatarTempo(reg.expira - Date.now())}*\n> 👤 Cliente: @${reg.cliente}`,
          mentions: [`${reg.cliente}@s.whatsapp.net`]
        });
      }
    },

    // ==============================================
    // 🔒 ALUGUELGB ON/OFF (Modo Global)
    // ==============================================
    {
      nome: "aluguelgb",
      descricao: "Ativa/desativa o aluguel global (Dono)",
      async executar({ sock, idChat, resto }) {
        const op = (resto || "").trim().toLowerCase();
        if (!["on", "off"].includes(op)) return sock.sendMessage(idChat, { text: "❌ Uso: *!aluguelgb on/off*" });

        const cfg = ler(ARQ_CFG, { global: false });
        cfg.global = op === "on";
        salvar(ARQ_CFG, cfg);

        await sock.sendMessage(idChat, {
          text: op === "on"
            ? "🔒 *ALUGUEL GLOBAL ATIVADO!*\n\n> O bot ignorará membros em grupos sem aluguel."
            : "🔓 *ALUGUEL GLOBAL DESATIVADO!*\n\n> O bot responderá em todos os grupos."
        });
      }
    }
  ]
};
