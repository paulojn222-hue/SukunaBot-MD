const fs = require("fs");
const path = require("path");

// ==============================================
// 📦 ARQUIVOS DE ALUGUEL
// ==============================================
const ARQ_PLANOS = path.join(__dirname, "..", "dados", "planos.json");
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
    // 📋 PLANOS (Gerenciamento pelo Dono)
    // ==============================================
    {
      nome: "planos",
      descricao: "Lista os planos de aluguel disponíveis",
      async executar({ sock, idChat }) {
        const dados = ler(ARQ_PLANOS, { lista: [] });
        if (!dados.lista.length) return sock.sendMessage(idChat, { text: "📭 Nenhum plano cadastrado." });

        let txt = `💎 *PLANOS DE ALUGUEL*\n\n`;
        dados.lista.forEach((p, i) => {
          txt += `┃ *${i + 1}.* ⏱️ ${p.tempo} — 💰 R$ ${p.valor}\n`;
        });
        txt += `\n> Para alugar, use: *!alugar <ID>*\n> Ou *!alugar <tempo>* (ex: 1m)`;

        await sock.sendMessage(idChat, { text: txt });
      }
    },
    {
      nome: "addplano",
      descricao: "Adiciona um plano de aluguel (Dono)",
      async executar({ sock, idChat, resto }) {
        const match = (resto || "").trim().match(/^(\d+[smhd])\s+(\d+(?:\.\d+)?)$/i);
        if (!match) return sock.sendMessage(idChat, { text: "❌ Uso: *!addplano 1m 5.00* (tempo e valor)" });

        const tempo = match[1].toLowerCase();
        const valor = match[2];

        const dados = ler(ARQ_PLANOS, { lista: [] });
        dados.lista.push({ tempo, valor });
        salvar(ARQ_PLANOS, dados);

        await sock.sendMessage(idChat, { text: `✅ Plano *${tempo}* por *R$ ${valor}* adicionado!` });
      }
    },
    {
      nome: "delplano",
      descricao: "Remove um plano (Dono)",
      async executar({ sock, idChat, resto }) {
        const id = parseInt(resto) - 1;
        const dados = ler(ARQ_PLANOS, { lista: [] });

        if (isNaN(id) || id < 0 || id >= dados.lista.length) {
          return sock.sendMessage(idChat, { text: "❌ ID inválido." });
        }

        const removido = dados.lista.splice(id, 1)[0];
        salvar(ARQ_PLANOS, dados);

        await sock.sendMessage(idChat, { text: `🗑️ Plano *${removido.tempo}* removido!` });
      }
    },

    // ==============================================
    // 🛒 ALUGAR (Membros)
    // ==============================================
    {
      nome: "alugar",
      descricao: "Aluga o bot para o seu grupo",
      async executar({ sock, idChat, msg, resto, DONO_PRINCIPAL_NOME, DONO_PRINCIPAL_NUMERO }) {
        const opcao = (resto || "").trim().toLowerCase();
        const dadosPlanos = ler(ARQ_PLANOS, { lista: [] });

        // Se não passou nada, lista os planos
        if (!opcao) {
          let txt = `💎 *ALUGAR O BOT*\n\nEscolha um plano:\n\n`;
          dadosPlanos.lista.forEach((p, i) => txt += `┃ *${i + 1}.* ⏱️ ${p.tempo} — 💰 R$ ${p.valor}\n`);
          txt += `\n> *!alugar <ID>* ou *!alugar <tempo>*`;
          return sock.sendMessage(idChat, { text: txt });
        }

        let planoEscolhido = null;
        const id = parseInt(opcao) - 1;

        if (!isNaN(id) && id >= 0 && id < dadosPlanos.lista.length) {
          planoEscolhido = dadosPlanos.lista[id];
        } else {
          // Tenta achar pelo tempo (ex: 1m, 1d)
          planoEscolhido = dadosPlanos.lista.find(p => p.tempo === opcao);
        }

        if (!planoEscolhido) {
          return sock.sendMessage(idChat, { text: "❌ Plano inválido. Use *!alugar* pra ver a lista." });
        }

        // Mensagem com o contato do dono para pagamento
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${DONO_PRINCIPAL_NOME}\nTEL;type=CELL;type=VOICE;waid=${DONO_PRINCIPAL_NUMERO}:+${DONO_PRINCIPAL_NUMERO}\nEND:VCARD`;

        await sock.sendMessage(idChat, {
          text: `✅ *PEDIDO DE ALUGUEL*\n\n> Plano: *${planoEscolhido.tempo}* | Valor: *R$ ${planoEscolhido.valor}*\n\n> 📞 Fale com o dono para realizar o pagamento:`,
          contacts: { displayName: DONO_PRINCIPAL_NOME, contacts: [{ vcard }] }
        });
      }
    },

    // ==============================================
    // 🏢 ALUGADOS (Lista de grupos com aluguel)
    // ==============================================
    {
      nome: "alugados",
      descricao: "Lista todos os grupos alugados (Dono)",
      async executar({ sock, idChat }) {
        const dados = ler(ARQ_ALUGADOS, { lista: [] });
        if (!dados.lista.length) return sock.sendMessage(idChat, { text: "📭 Nenhum grupo alugado no momento." });

        let txt = `🏢 *GRUPOS ALUGADOS*\n\n`;
        const mentions = [];

        dados.lista.forEach((a, i) => {
          const tempoRestante = a.expira > Date.now() ? formatarTempo(a.expira - Date.now()) : "Expirado";
          txt += `┃ *${i + 1}.* ${a.nome}\n`;
          txt += `┃   🆔 ID: \`${a.gid}\`\n`;
          txt += `┃   👤 Cliente: @${a.cliente}\n`;
          txt += `┃   ⏰ Expira em: ${tempoRestante}\n`;
          txt += `┃   🔗 Link: ${a.link || "Sem link"}\n\n`;
          mentions.push(`${a.cliente}@s.whatsapp.net`);
        });

        await sock.sendMessage(idChat, { text: txt, mentions });
      }
    },

    // ==============================================
    // 💼 SETALUGUEL (Ativa o aluguel num grupo)
    // ==============================================
    {
      nome: "setaluguel",
      descricao: "Ativa o aluguel num grupo (Dono)",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const alvoJid = ctx?.mentionedJid?.[0];
        if (!alvoJid) return sock.sendMessage(idChat, { text: "❌ Uso: *!setaluguel <tempo/ID> @cliente*" });

        const clienteNum = normalizarNumero(alvoJid);
        const partes = (resto || "").trim().split(/\s+/);
        const alvoTempo = partes[0].toLowerCase();

        const dadosPlanos = ler(ARQ_PLANOS, { lista: [] });
        const idPlano = parseInt(alvoTempo) - 1;
        let plano = null;

        if (!isNaN(idPlano) && idPlano >= 0 && idPlano < dadosPlanos.lista.length) {
          plano = dadosPlanos.lista[idPlano];
        } else {
          plano = dadosPlanos.lista.find(p => p.tempo === alvoTempo);
        }

        // Se não achou no plano, tenta usar o tempo puro (ex: 1d)
        const tempoStr = plano ? plano.tempo : alvoTempo;
        const match = tempoStr.match(/^(\d+)([smhd])$/);
        if (!match) return sock.sendMessage(idChat, { text: "❌ Tempo inválido ou plano não encontrado." });

        const qtd = parseInt(match[1]);
        const unidade = match[2];
        const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unidade] * qtd;

        // Pega as informações do grupo
        let nomeGrupo = "Grupo";
        let linkGrupo = "";
        try {
          const meta = await sock.groupMetadata(idChat);
          nomeGrupo = meta.subject;
          const codigo = await sock.groupInviteCode(idChat);
          linkGrupo = `https://chat.whatsapp.com/${codigo}`;
        } catch {}

        const dadosAlugados = ler(ARQ_ALUGADOS, { lista: [] });
        const existente = dadosAlugados.lista.findIndex(a => a.gid === idChat);
        
        const novaExpira = Date.now() + ms;

        if (existente >= 0) {
          dadosAlugados.lista[existente].expira = novaExpira;
          dadosAlugados.lista[existente].cliente = clienteNum;
        } else {
          dadosAlugados.lista.push({
            gid: idChat,
            nome: nomeGrupo,
            link: linkGrupo,
            cliente: clienteNum,
            expira: novaExpira,
            avisado: false,
            avisado5min: false
          });
        }
        salvar(ARQ_ALUGADOS, dadosAlugados);

        await sock.sendMessage(idChat, {
          text: `✅ *ALUGUEL ATIVADO!*\n\n> Grupo: *${nomeGrupo}*\n> Cliente: @${clienteNum}\n> Expira em: *${formatarTempo(ms)}*`,
          mentions: [alvoJid]
        });
      }
    }
  ]
};
