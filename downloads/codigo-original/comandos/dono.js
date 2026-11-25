const fs = require("fs");
const path = require("path");
const config = require("../config.js");

const ARQUIVO_CONFIG = path.join(__dirname, "..", "config.js"); 
const ARQ = path.join(__dirname, "..", "personalize_aqui", "menu_dono.txt");

// Função para verificar se é o dono (via LID do config)
function isDonoReal(msg) {
  if (!msg || !msg.key) return false;
  const remetente = msg.key.participant || msg.key.remoteJid;
  if (!remetente) return false;
  const remetenteLimpo = remetente.split("@")[0].split(":")[0].replace(/\D/g, "");
  const donoLid = String(config.DONO_PRINCIPAL_LID).replace(/\D/g, "");
  return remetenteLimpo === donoLid;
}

function salvarPrefixo(novo) {
  try {
    const conteudo = fs.readFileSync(ARQUIVO_CONFIG, "utf8");
    const atualizado = conteudo.replace(/PREFIXO:\s*"[^"]*"/, `PREFIXO: "${novo}"`);
    fs.writeFileSync(ARQUIVO_CONFIG, atualizado, "utf8");
  } catch (e) { console.log("Erro salvando prefixo:", e.message); }
}

module.exports = {
  comandos: [

// ==============================================
// 🚫 BAN SYSTEM
// ==============================================
{
  nome: "ban_user",
  descricao: "Bane um usuário do bot (dono)",
  async executar({ sock, idChat, msg, normalizarNumero }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (!alvo) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!ban_user @usuario* (ou responda uma mensagem dele)" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "banidos.json");
    let dados = { lista: [] };
    try { if (fs.existsSync(ARQ)) dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}

    const lid = normalizarNumero(alvo);
    if (dados.lista.some(b => b.lid === lid)) {
      return sock.sendMessage(idChat, { text: `⚠️ @${lid} já tá banido.`, mentions: [alvo] });
    }

    dados.lista.push({ lid, jid: alvo, quando: Date.now() });
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, {
      text: `🚫 *USUÁRIO BANIDO DO BOT*\n\n> 👤 @${lid}\n> 📅 ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      mentions: [alvo]
    });
  }
},

{
  nome: "unban_user",
  descricao: "Desbane um usuário do bot",
  async executar({ sock, idChat, msg, resto, normalizarNumero }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const ARQ = path.join(__dirname, "..", "dados", "banidos.json");
    if (!fs.existsSync(ARQ)) return sock.sendMessage(idChat, { text: "📭 Nenhum banido registrado." });

    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    let lista = dados.lista || [];

    const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant;

    let removido = null;
    const digitado = (resto || "").trim();

    if (alvo) {
      const lid = normalizarNumero(alvo);
      const idx = lista.findIndex(b => b.lid === lid);
      if (idx !== -1) { removido = lista[idx]; lista.splice(idx, 1); }
    } else if (/^\d+$/.test(digitado)) {
      const idx = parseInt(digitado) - 1;
      if (idx >= 0 && idx < lista.length) { removido = lista[idx]; lista.splice(idx, 1); }
    }

    if (!removido) {
      return sock.sendMessage(idChat, { text: "❌ Não encontrei esse usuário na lista. Veja *!listaban*." });
    }

    dados.lista = lista;
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, {
      text: `✅ *Usuário desbanido!*\n\n> 👤 @${removido.lid}`,
      mentions: removido.jid ? [removido.jid] : []
    });
  }
},

{
  nome: "listaban",
  descricao: "Lista usuários banidos do bot",
  async executar({ sock, idChat, msg }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const ARQ = path.join(__dirname, "..", "dados", "banidos.json");
    if (!fs.existsSync(ARQ)) return sock.sendMessage(idChat, { text: "📭 *Nenhum usuário banido.*" });

    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    const lista = dados.lista || [];
    if (!lista.length) return sock.sendMessage(idChat, { text: "📭 *Nenhum usuário banido.*" });

    const linhas = lista.map((b, i) =>
      `┃ *[${String(i + 1).padStart(2, "0")}]* @${b.lid}`
    ).join("\n");

    await sock.sendMessage(idChat, {
      text: `🚫 *USUÁRIOS BANIDOS*\n\n> Total: *${lista.length}*\n\n${linhas}\n\n> Use *!unban_user @user* ou *!unban_user <id>* pra remover`,
      mentions: lista.filter(b => b.jid).map(b => b.jid)
    });
  }
},

// ==============================================
// 🌐 GRUPOS
// ==============================================
{
  nome: "grupos",
  descricao: "Lista todos os grupos que o bot está",
  async executar({ sock, idChat, msg }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    let groupsObj;
    try {
      groupsObj = await sock.groupFetchAllParticipating();
    } catch (e) {
      return sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }

    const grupos = Object.values(groupsObj);
    if (!grupos.length) return sock.sendMessage(idChat, { text: "📭 O bot não está em nenhum grupo." });

    let texto = `🌐 *GRUPOS DO BOT*\n\n> Total: *${grupos.length}*\n\n`;

    grupos.slice(0, 30).forEach((g, i) => {
      texto += `┃ *${i + 1}.* ${g.subject}\n`;
      texto += `┃ 🆔 \`${g.id}\`\n`;
      texto += `┃ 👥 ${g.participants.length} membros\n\n`;
    });

    if (grupos.length > 30) texto += `_...e mais ${grupos.length - 30} grupos_\n`;

    await sock.sendMessage(idChat, { text: texto });
  }
},

{
  nome: "sair_todos",
  descricao: "Sai de todos os grupos exceto o principal",
  async executar({ sock, idChat, msg, lerJSON }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const ARQ_CHAT = path.join(__dirname, "..", "dados", "chat_principal.json");
    const principal = lerJSON(ARQ_CHAT, { jid: null });
    const jidPrincipal = principal.jid;

    if (!jidPrincipal) {
      return sock.sendMessage(idChat, {
        text: "⚠️ Nenhum grupo principal definido!\n\n> Use *!setchat* primeiro."
      });
    }

    await sock.sendMessage(idChat, {
      text: "⚠️ *CONFIRMAÇÃO NECESSÁRIA*\n\n> Vou sair de TODOS os grupos exceto o principal.\n> Isso é *irreversível*.\n\n> Responda *sim* em 30s pra confirmar."
    });

    // Espera confirmação — simplificado: pega a próxima msg do dono em 30s
    // (Se você tiver event handler, pode melhorar)
    const aguardar = new Promise((resolve) => {
      const handler = (m) => {
        if (m.key.remoteJid === idChat && m.key.participant === msg.key.participant) {
          const t = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
          if (t.trim().toLowerCase() === "sim") {
            sock.ev.off("messages.upsert", handler);
            resolve(true);
          }
        }
      };
      sock.ev.on("messages.upsert", handler);
      setTimeout(() => { sock.ev.off("messages.upsert", handler); resolve(false); }, 30000);
    });

    const confirmado = await aguardar();
    if (!confirmado) {
      return sock.sendMessage(idChat, { text: "❌ Cancelado (sem confirmação)." });
    }

    let groupsObj;
    try { groupsObj = await sock.groupFetchAllParticipating(); } catch (e) {
      return sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }

    const grupos = Object.values(groupsObj).filter(g => g.id !== jidPrincipal);

    await sock.sendMessage(idChat, {
      text: `🚪 *Saindo de ${grupos.length} grupos...*\n\n> Mantendo só: *${jidPrincipal}*`
    });

    let ok = 0, falhas = 0;
    for (const g of grupos) {
      try {
        await sock.groupLeave(g.id);
        ok++;
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) { falhas++; }
    }

    await sock.sendMessage(idChat, {
      text: `✅ *CONCLUÍDO!*\n\n> Saiu de: *${ok}*\n> Falhas: *${falhas}*`
    });
  }
},

{
  nome: "bloquear_gp",
  descricao: "Bloqueia o bot de funcionar num grupo",
  async executar({ sock, idChat, msg, resto }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const id = (resto || "").trim();
    if (!id || !id.endsWith("@g.us")) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!bloquear_gp 123456789-123@g.us*" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "grupos_bloqueados.json");
    let dados = { lista: [] };
    try { if (fs.existsSync(ARQ)) dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}
    if (!dados.lista) dados.lista = [];

    if (dados.lista.includes(id)) {
      return sock.sendMessage(idChat, { text: "⚠️ Esse grupo já está bloqueado." });
    }

    dados.lista.push(id);
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, { text: `🔒 *Grupo bloqueado!*\n\n> 🆔 \`${id}\`` });
  }
},

{
  nome: "desbloquear_gp",
  descricao: "Desbloqueia um grupo",
  async executar({ sock, idChat, msg, resto }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const id = (resto || "").trim();
    if (!id) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!desbloquear_gp 123456789-123@g.us*" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "grupos_bloqueados.json");
    if (!fs.existsSync(ARQ)) return sock.sendMessage(idChat, { text: "📭 Nenhum grupo bloqueado." });

    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    const antes = (dados.lista || []).length;
    dados.lista = (dados.lista || []).filter(g => g !== id);

    if (dados.lista.length === antes) {
      return sock.sendMessage(idChat, { text: "⚠️ Esse grupo não tava bloqueado." });
    }

    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));
    await sock.sendMessage(idChat, { text: `🔓 *Grupo desbloqueado!*\n\n> 🆔 \`${id}\`` });
  }
},

{
  nome: "listagp_bloq",
  descricao: "Lista grupos bloqueados",
  async executar({ sock, idChat, msg }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const ARQ = path.join(__dirname, "..", "dados", "grupos_bloqueados.json");
    if (!fs.existsSync(ARQ)) return sock.sendMessage(idChat, { text: "📭 Nenhum grupo bloqueado." });

    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    const lista = dados.lista || [];
    if (!lista.length) return sock.sendMessage(idChat, { text: "📭 Nenhum grupo bloqueado." });

    let texto = `🔒 *GRUPOS BLOQUEADOS*\n\n> Total: *${lista.length}*\n\n`;
    for (let i = 0; i < lista.length; i++) {
      let nome = lista[i];
      try {
        const meta = await sock.groupMetadata(lista[i]);
        nome = meta.subject || lista[i];
      } catch {}
      texto += `┃ *${i + 1}.* ${nome}\n┃ 🆔 \`${lista[i]}\`\n\n`;
    }

    await sock.sendMessage(idChat, { text: texto });
  }
},

{
  nome: "entrar_todos",
  descricao: "Entra em vários grupos por links (respondendo .txt)",
  async executar({ sock, idChat, msg, downloadMediaMessage }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted || !quoted.documentMessage) {
      return sock.sendMessage(idChat, {
        text: "❌ Uso: Responda um arquivo *.txt* com os links (um por linha) usando *!entrar_todos*"
      });
    }

    if (!quoted.documentMessage.fileName?.toLowerCase().endsWith(".txt")) {
      return sock.sendMessage(idChat, { text: "❌ O arquivo precisa ser *.txt*." });
    }

    try {
      const buffer = await downloadMediaMessage(
        { key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false }, message: quoted },
        "buffer", {}, { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      const conteudo = buffer.toString("utf8");
      const links = conteudo
        .split("\n")
        .map(l => l.trim())
        .filter(l => /chat\.whatsapp\.com\//i.test(l))
        .map(l => l.match(/([A-Za-z0-9_-]+)\/?$/)?.[1])
        .filter(Boolean);

      if (!links.length) {
        return sock.sendMessage(idChat, { text: "❌ Nenhum link válido no arquivo." });
      }

      await sock.sendMessage(idChat, {
        text: `🚪 *Entrando em ${links.length} grupos...*\n\n> Isso pode demorar.`
      });

      let ok = 0, falhas = 0;
      for (const codigo of links) {
        try {
          await sock.groupAcceptInvite(codigo);
          ok++;
          await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
          falhas++;
          console.log(`Erro ao entrar em ${codigo}:`, e.message);
        }
      }

      await sock.sendMessage(idChat, {
        text: `✅ *CONCLUÍDO!*\n\n> Entrou: *${ok}*\n> Falhas: *${falhas}*`
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }
  }
},

// ==============================================
// ⚙️ CONFIG DO BOT
// ==============================================
{
  nome: "setnome",
  descricao: "Muda o nome do bot no config",
  async executar({ sock, idChat, msg, resto }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const novo = (resto || "").trim();
    if (!novo) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!setnome Novo Nome*" });
    }

    try {
      let conteudo = fs.readFileSync(ARQUIVO_CONFIG, "utf8");
      conteudo = conteudo.replace(/NOME_BOT:\s*["'][^"']*["']/, `NOME_BOT: "${novo}"`);
      fs.writeFileSync(ARQUIVO_CONFIG, conteudo, "utf8");
      await sock.sendMessage(idChat, {
        text: `✅ *Nome do bot alterado!*\n\n> 🤖 Novo nome: *${novo}*\n> ♻️ Reinicie o bot pra aplicar.`
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }
  }
},

{
  nome: "setdono",
  descricao: "Muda o número do dono no config",
  async executar({ sock, idChat, msg, resto }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const num = (resto || "").replace(/\D/g, "");
    if (!num || num.length < 10) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!setdono 5581999999999*" });
    }

    try {
      let conteudo = fs.readFileSync(ARQUIVO_CONFIG, "utf8");
      conteudo = conteudo.replace(/DONO_PRINCIPAL_NUMERO:\s*["'][^"']*["']/, `DONO_PRINCIPAL_NUMERO: "${num}"`);
      fs.writeFileSync(ARQUIVO_CONFIG, conteudo, "utf8");
      await sock.sendMessage(idChat, {
        text: `✅ *Dono alterado!*\n\n> 👤 Novo número: *${num}*\n> ♻️ Reinicie o bot pra aplicar.`
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }
  }
},

{
  nome: "setlid",
  descricao: "Muda o LID do dono no config",
  async executar({ sock, idChat, msg, resto }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const lid = (resto || "").replace(/\D/g, "");
    if (!lid) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!setlid 123456789012345*" });
    }

    try {
      let conteudo = fs.readFileSync(ARQUIVO_CONFIG, "utf8");
      if (/DONO_PRINCIPAL_LID:/.test(conteudo)) {
        conteudo = conteudo.replace(/DONO_PRINCIPAL_LID:\s*["'][^"']*["']/, `DONO_PRINCIPAL_LID: "${lid}"`);
      } else {
        conteudo = conteudo.replace(/DONO_PRINCIPAL_NUMERO:/, `DONO_PRINCIPAL_LID: "${lid}",\n  DONO_PRINCIPAL_NUMERO:`);
      }
      fs.writeFileSync(ARQUIVO_CONFIG, conteudo, "utf8");
      await sock.sendMessage(idChat, {
        text: `✅ *LID do dono alterado!*\n\n> 🆔 Novo LID: \`${lid}\`\n> ♻️ Reinicie o bot pra aplicar.`
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }
  }
},

// ==============================================
// 🛡️ SEGURANÇA
// ==============================================
{
  nome: "antispam",
  descricao: "Liga/desliga antispam global",
  async executar({ sock, idChat, msg, resto }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const op = (resto || "").trim().toLowerCase();
    if (!["on", "off"].includes(op)) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!antispam on* ou *!antispam off*" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "antispam_global.json");
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify({ ativo: op === "on" }, null, 2));

    await sock.sendMessage(idChat, {
      text: op === "on"
        ? "🛡️ *ANTISPAM GLOBAL ATIVADO!*\n\n> Bots e spam serão ignorados em todos os grupos."
        : "🔓 *ANTISPAM GLOBAL DESATIVADO!*"
    });
  }
},

{
  nome: "bloquear_cmd",
  descricao: "Bloqueia um comando globalmente",
  async executar({ sock, idChat, msg, resto, comandos }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const cmd = (resto || "").trim().toLowerCase().split(/\s+/)[0];
    if (!cmd) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!bloquear_cmd <comando>*" });
    }

    if (!comandos || !comandos.has(cmd)) {
      return sock.sendMessage(idChat, { text: `❌ O comando *!${cmd}* não existe.` });
    }

    const ARQ = path.join(__dirname, "..", "dados", "comandos_bloqueados.json");
    let dados = { lista: [] };
    try { if (fs.existsSync(ARQ)) dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}
    if (!dados.lista) dados.lista = [];

    if (dados.lista.includes(cmd)) {
      return sock.sendMessage(idChat, { text: `⚠️ *!${cmd}* já está bloqueado.` });
    }

    dados.lista.push(cmd);
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, {
      text: `🚫 *Comando bloqueado!*\n\n> Comando: *!${cmd}*\n> Agora ninguém pode usar ele.`
    });
  }
},

{
  nome: "liberar_cmd",
  descricao: "Libera um comando bloqueado",
  async executar({ sock, idChat, msg, resto }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    const cmd = (resto || "").trim().toLowerCase().split(/\s+/)[0];
    if (!cmd) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!liberar_cmd <comando>*" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "comandos_bloqueados.json");
    if (!fs.existsSync(ARQ)) return sock.sendMessage(idChat, { text: "📭 Nenhum comando bloqueado." });

    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    const antes = (dados.lista || []).length;
    dados.lista = (dados.lista || []).filter(c => c !== cmd);

    if (dados.lista.length === antes) {
      return sock.sendMessage(idChat, { text: `⚠️ *!${cmd}* não estava bloqueado.` });
    }

    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));
    await sock.sendMessage(idChat, { text: `✅ *!${cmd}* liberado!` });
  }
},

{
  nome: "panic",
  descricao: "Desliga o bot imediatamente",
  async executar({ sock, idChat, msg }) {
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o dono pode usar." });
    }

    await sock.sendMessage(idChat, {
      text: "🚨 *PANIC ATIVADO!*\n\n> Bot desligando em 2 segundos...\n> Todos os dados estão seguros.\n\n> Pra ligar de novo: *npm start* no servidor."
    });

    setTimeout(() => {
      console.log("🚨 PANIC — bot encerrado manualmente pelo dono");
      process.exit(1);
    }, 2000);
  }
},

{
  nome: "nuke",
  descricao: "Remove todos do grupo (Apenas Dono)",
  async executar({ sock, idChat, msg, isDono }) {
    // Verifica se é dono (usa a função isDonoReal que você já tem no arquivo)
    if (!isDonoReal(msg)) {
      return sock.sendMessage(idChat, { text: "❌ Apenas o Dono Principal pode usar este comando." });
    }

    if (!idChat.endsWith("@g.us")) {
      return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });
    }

    // Pega os metadados do grupo
    let meta;
    try {
      meta = await sock.groupMetadata(idChat);
    } catch (e) {
      return sock.sendMessage(idChat, { text: "❌ Não consegui obter os dados do grupo." });
    }

    const botJid = sock.user.id; // JID do bot
    const donoJid = msg.key.participant || msg.key.remoteJid;
    const autorNome = msg.pushName || donoJid.split("@")[0];

    // Filtra quem vai ser removido (todos, menos o bot e o dono)
    const membrosParaRemover = meta.participants
      .filter(p => p.id !== botJid && p.id !== donoJid)
      .map(p => p.id);

    await sock.sendMessage(idChat, { 
      text: `💣 *INICIANDO NUKE...*\n\n> Removendo *${membrosParaRemover.length}* membros.\n> Isso pode demorar.` 
    });

    // 1. Muda o nome do grupo
    try {
      await sock.groupUpdateSubject(idChat, "🗑 Grupo Excluído");
    } catch {}

    // 2. Muda a descrição com data e autor
    const dataAgora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    try {
      await sock.groupUpdateDescription(idChat, `Este grupo foi excluído por @${autorNome} em ${dataAgora}.`);
    } catch {}

    // 3. Remove os membros em lotes de 5 (para reduzir risco de ban)
    const LOTE = 5;
    for (let i = 0; i < membrosParaRemover.length; i += LOTE) {
      const lote = membrosParaRemover.slice(i, i + LOTE);
      try {
        await sock.groupParticipantsUpdate(idChat, lote, "remove");
      } catch (e) {
        console.log("Erro ao remover lote:", e.message);
      }
      // Delay de 2 segundos entre cada lote (humaniza a operação)
      await new Promise(r => setTimeout(r, 2000));
    }

    // 4. Avisa que vai sair
    await sock.sendMessage(idChat, { 
      text: "✅ *Grupo limpo!*\n\n> O bot vai sair agora." 
    });
    await new Promise(r => setTimeout(r, 2000));

    // 5. Sai do grupo
    try {
      await sock.groupLeave(idChat);
    } catch (e) {
      console.log("Erro ao sair:", e.message);
    }
  }
},

{
  nome: "pv",
  descricao: "Ativa/desativa o bot no privado",
  async executar({ sock, idChat, resto, msg }) {
    // Apenas o dono pode usar (ele já é barrado se não for dono no index, mas por segurança:)
    if (!idChat.endsWith("@g.us")) {
       // Se for no PV, o idChat é o número da pessoa
    }

    const op = (resto || "").trim().toLowerCase();
    if (!["on", "off"].includes(op)) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!pv on* ou *!pv off*" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "config_pv.json");
    let dados = { ativo: true }; // Padrão é ativo
    try { if (fs.existsSync(ARQ)) dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}

    dados.ativo = op === "on";
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, { 
      text: op === "on" 
        ? "✅ *BOT NO PV ATIVADO!*\n\n> Agora respondo as pessoas no privado." 
        : "🚫 *BOT NO PV DESATIVADO!*\n\n> A partir de agora, ignoro e bloqueio qualquer pessoa no privado." 
    });
  }
},

    // ==============================================
    // 📝 EDITAR MENUS
    // ==============================================
    {
      nome: "editar_menu",
      descricao: "Edita o texto dos menus via WhatsApp",
      async executar({ sock, idChat, msg, resto }) {
        if (!isDonoReal(msg)) {
          return sock.sendMessage(idChat, { text: "❌ Apenas o dono do bot pode usar este comando." });
        }

        const partes = (resto || "").trim().split(/\s+/);
        const menuNome = partes[0]?.toLowerCase();
        
        if (!menuNome) {
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!editar_menu <nome>*\n\n> Exemplos válidos:\n> • menuadm\n> • menugame\n> • menufig\n> • menubaixar"
          });
        }

        const textoNovo = resto.substring(resto.indexOf(menuNome) + menuNome.length).trim();

        const menusPermitidos = {
          "adm": "menu_adm.txt", "menuadm": "menu_adm.txt",
          "game": "menu_game.txt", "menugame": "menu_game.txt",
          "fig": "menu_fig.txt", "menufig": "menu_fig.txt",
          "baixar": "menu_pesquisas.txt", "menubaixar": "menu_pesquisas.txt"
        };

        const arquivoDestino = menusPermitidos[menuNome];
        if (!arquivoDestino) {
          return sock.sendMessage(idChat, {
            text: `❌ O menu *${menuNome}* não existe.\n\n> Use um destes: menuadm, menugame, menufig, menubaixar.`
          });
        }

        const caminhoFinal = path.join(__dirname, "..", "personalize_aqui", arquivoDestino);

        if (!textoNovo) {
          let textoAtual = "_(Arquivo vazio ou não encontrado)_";
          try {
            if (fs.existsSync(caminhoFinal)) textoAtual = fs.readFileSync(caminhoFinal, "utf8");
          } catch (e) {}

          return sock.sendMessage(idChat, {
            text:
              `📝 *EDITAR MENU: ${menuNome.toUpperCase()}*\n\n` +
              `*COMO USAR:*\n` +
              `Envie: *${config.PREFIXO}editar_menu ${menuNome} <seu texto aqui>*\n` +
              `Ou responda esta mensagem com o texto novo.\n\n` +
              `*VARIÁVEIS DISPONÍVEIS:*\n` +
              `> {PREFIXO} - Prefixo do bot\n> {BOT} - Nome do bot\n> {DONO} - Nome do dono\n> {DATA} - Data de hoje\n\n` +
              `*TEXTO ATUAL:*\n\`\`\`\n${textoAtual}\n\`\`\``
          });
        }

        try {
          fs.mkdirSync(path.dirname(caminhoFinal), { recursive: true });
          fs.writeFileSync(caminhoFinal, textoNovo, "utf8");
          await sock.sendMessage(idChat, {
            text: `✅ *MENU ATUALIZADO!*\n\n> O arquivo \`${arquivoDestino}\` foi modificado com sucesso.\n\n> 💡 Envie *${config.PREFIXO || "!"}${menuNome}* para ver como ficou.`
          });
        } catch (e) {
          console.log("Erro ao editar menu:", e);
          await sock.sendMessage(idChat, { text: `❌ Erro ao salvar o arquivo: ${e.message}` });
        }
      }
    },

    // ==============================================
    // 💭 SUBDONO (Adicionar) - Apenas Dono
    // ==============================================
    {
      nome: "subdono",
      descricao: "Adiciona um subdono (Apenas Dono)",
      async executar({ sock, idChat, msg, lerJSON, salvarJSON, ARQUIVO_SUBDONOS, normalizarNumero }) {
        if (!isDonoReal(msg)) {
          return sock.sendMessage(idChat, { text: "❌ Apenas o Dono Principal pode adicionar subdonos." });
        }

        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
          || msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (!alvo) {
          return sock.sendMessage(idChat, { text: "❌ Uso: *!subdono @usuario* (ou responda uma mensagem dele)" });
        }

        if (isDonoReal({ key: { participant: alvo, remoteJid: alvo } })) {
          return sock.sendMessage(idChat, { text: "⚠️ Você já é o Dono Principal!" });
        }

        const dados = lerJSON(ARQUIVO_SUBDONOS, { lista: [] });
        if (!dados.lista) dados.lista = [];
        const lid = normalizarNumero(alvo);
        
        if (dados.lista.some(s => (typeof s === "string" ? s : s.lid) === lid)) {
          return sock.sendMessage(idChat, { text: `⚠️ @${lid} já é subdono.`, mentions: [alvo] });
        }

        dados.lista.push({ lid, jid: alvo });
        salvarJSON(ARQUIVO_SUBDONOS, dados);
        await sock.sendMessage(idChat, { text: `✅ *Novo subdono adicionado!*\n\n> 👤 @${lid} agora tem permissões de dono.`, mentions: [alvo] });
      }
    },

    // ==============================================
    // 🗑️ RMSUB (Remover) - Apenas Dono
    // ==============================================
    {
      nome: "rmsub",
      descricao: "Remove um subdono (Apenas Dono)",
      async executar({ sock, idChat, msg, resto, lerJSON, salvarJSON, ARQUIVO_SUBDONOS, normalizarNumero }) {
        if (!isDonoReal(msg)) {
          return sock.sendMessage(idChat, { text: "❌ Apenas o Dono Principal pode remover subdonos." });
        }

        const dados = lerJSON(ARQUIVO_SUBDONOS, { lista: [] });
        const lista = dados.lista || [];
        if (!lista.length) return sock.sendMessage(idChat, { text: "📭 Não há subdonos para remover." });

        const alvoMencao = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
          || msg.message?.extendedTextMessage?.contextInfo?.participant;
        
        let removido = null;
        const idDigitado = (resto || "").trim();

        if (/^\d+$/.test(idDigitado)) {
          const index = parseInt(idDigitado) - 1;
          if (index >= 0 && index < lista.length) { removido = lista[index]; lista.splice(index, 1); }
          else return sock.sendMessage(idChat, { text: `❌ ID *${idDigitado}* inválido. A lista tem apenas ${lista.length} subdonos.` });
        } else if (alvoMencao) {
          const lid = normalizarNumero(alvoMencao);
          const index = lista.findIndex(s => (typeof s === "string" ? s : s.lid) === lid);
          if (index !== -1) { removido = lista[index]; lista.splice(index, 1); }
          else return sock.sendMessage(idChat, { text: `⚠️ @${lid} não é subdono.`, mentions: [alvoMencao] });
        } else {
          return sock.sendMessage(idChat, { text: "❌ Uso: *!rmsub <ID>* (veja o ID na lista)\nOu marque a pessoa: *!rmsub @usuario*" });
        }

        dados.lista = lista;
        salvarJSON(ARQUIVO_SUBDONOS, dados);
        const lidRemovido = typeof removido === "string" ? removido : removido.lid;
        const jidRemovido = typeof removido === "string" ? null : removido.jid;
        
        await sock.sendMessage(idChat, { text: `🗑️ *Subdono removido!*\n\n> 👤 @${lidRemovido} perdeu as permissões.`, mentions: jidRemovido ? [jidRemovido] : [] });
      }
    },

    // ==============================================
    // 📋 SUBDONOS (Lista)
    // ==============================================
    {
      nome: "subdonos",
      descricao: "Lista os subdonos com visual bonito",
      async executar({ sock, idChat, lerJSON, ARQUIVO_SUBDONOS }) {
        const dados = lerJSON(ARQUIVO_SUBDONOS, { lista: [] });
        const lista = dados.lista || [];
        if (!lista.length) return sock.sendMessage(idChat, { text: "📭 *Nenhum subdono cadastrado ainda.*" });

        const subs = lista.map(s => typeof s === "string" ? { lid: s, jid: null } : { lid: s.lid || s, jid: s.jid || null });
        const comJid = subs.filter(s => s.jid);
        const soLid = subs.filter(s => !s.jid);
        const linhas = subs.map((s, i) => {
          const id = String(i + 1).padStart(2, "0");
          return s.jid ? `┃ 👑 *[${id}]* @${s.lid}` : `┃ 👤 *[${id}]* \`${s.lid}\` _(sem JID)_`;
        }).join("\n");

        const texto = `╭━━━〔 💭 *SUBDONOS* 〕━━━╮\n┃\n┃ 📊 *Total:* ${subs.length}\n` + (soLid.length ? `┃ ⚠️ *Sem JID:* ${soLid.length}\n` : "") + `┃\n┣━━━〔 📋 *LISTA* 〕━━━\n┃\n${linhas}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n> 💡 Para remover, use: *!rmsub <ID>*`;
        await sock.sendMessage(idChat, { text: texto, mentions: comJid.map(s => s.jid) });
      }
    },

    // ==============================================
    // 💌 CONFIGURAÇÕES (PREFIXO, SETCHAT, SETCHANNEL)
    // ==============================================
    {
      nome: "rg_prefixo",
      descricao: "Troca o prefixo do bot",
      async executar({ sock, idChat, resto }) {
        const novo = (resto || "").trim();
        if (!novo || novo.length > 3) return sock.sendMessage(idChat, { text: "❌ Uso: *!rg_prefixo <novo>*\nEx: `!rg_prefixo /` (máx 3 caracteres)" });
        salvarPrefixo(novo);
        await sock.sendMessage(idChat, { text: `✅ *Prefixo alterado!*\n\n> 🔤 Novo prefixo: *${novo}*\n> ♻️ Reinicie o bot pra aplicar.` });
      }
    },
    {
      nome: "setchat",
      descricao: "Define o grupo principal do bot",
      async executar({ sock, idChat, lerJSON, salvarJSON }) {
        if (!idChat.endsWith("@g.us")) return sock.sendMessage(idChat, { text: "❌ Esse comando só funciona em grupos." });
        const ARQ_CHAT = path.join(__dirname, "..", "dados", "chat_principal.json");
        const dados = lerJSON(ARQ_CHAT, { jid: null, definido: null });
        if (dados.jid === idChat) return sock.sendMessage(idChat, { text: `⚠️ Esse grupo *já é* o principal do bot.` });

        let link = null;
        try { link = `https://chat.whatsapp.com/${await sock.groupInviteCode(idChat)}`; } catch {}
        salvarJSON(ARQ_CHAT, { jid: idChat, definido: Date.now(), link });
        await sock.sendMessage(idChat, { text: `✅ *Grupo principal definido!*\n\n> 💬 Grupo: *este*\n> 🔗 Link: ${link || "_não disponível_"}\n\n> Use *!chat* pra mandar o link.` });
      }
    },
    {
      nome: "setchannel",
      descricao: "Define o canal do bot via link",
      async executar({ sock, idChat, resto }) {
        const ARQ_CANAL = path.join(__dirname, "..", "dados", "canal.json");
        if (!resto) {
          const atual = (() => { try { return JSON.parse(fs.readFileSync(ARQ_CANAL, "utf8")); } catch { return null; } })();
          if (!atual?.jid) return sock.sendMessage(idChat, { text: `📢 *CANAL NÃO CONFIGURADO*\n\n> Use: *!setchannel <link>*\n> Ex: \`!setchannel https://whatsapp.com/channel/xxxxx\`\n\n> 💡 Pra remover: *!setchannel 0*` });
          return sock.sendMessage(idChat, { text: `📢 *CANAL ATUAL*\n\n> 🆔 JID: \`${atual.jid}\`\n> 🔗 Link: ${atual.link}` });
        }
        if (resto.trim() === "0") {
          fs.mkdirSync(path.dirname(ARQ_CANAL), { recursive: true });
          fs.writeFileSync(ARQ_CANAL, JSON.stringify({ jid: null, link: null }, null, 2));
          return sock.sendMessage(idChat, { text: "🗑️ *Canal removido!*" });
        }
        const codigoCanal = resto.trim().replace(/.*whatsapp\.com\/channel\//, "").replace(/.*wa\.me\/channel\//, "").split(/[\/?\s]/)[0];
        if (!codigoCanal) return sock.sendMessage(idChat, { text: "❌ Link inválido! Manda o link completo do canal." });
        try {
          const meta = await sock.newsletterMetadata("invite", codigoCanal);
          const jidReal = meta?.jid || meta?.id;
          if (!jidReal) return sock.sendMessage(idChat, { text: "❌ Não consegui encontrar o canal. Verifica o link." });
          const linkCanal = `https://whatsapp.com/channel/${codigoCanal}`;
          fs.mkdirSync(path.dirname(ARQ_CANAL), { recursive: true });
          fs.writeFileSync(ARQ_CANAL, JSON.stringify({ jid: jidReal, link: linkCanal }, null, 2));
          await sock.sendMessage(idChat, { text: `✅ *CANAL DEFINIDO!*\n\n> 🆔 JID: \`${jidReal}\`\n> 🔗 Link: ${linkCanal}` });
        } catch (e) { await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` }); }
      }
    },
    {
      nome: "channel",
      descricao: "Alias de setchannel",
      async executar(ctx) {
        const setCmd = module.exports.comandos.find(c => c.nome === "setchannel");
        return setCmd.executar(ctx);
      }
    },

    // ==============================================
    // ⏱️ UPTIME
    // ==============================================
    {
      nome: "uptime",
      descricao: "Mostra informações do sistema e tempo online",
      async executar({ sock, idChat, NOME_BOT, totalComandos }) {
        const uptimeMs = process.uptime() * 1000;
        const seg = Math.floor(uptimeMs / 1000) % 60;
        const min = Math.floor(uptimeMs / (1000 * 60)) % 60;
        const hora = Math.floor(uptimeMs / (1000 * 60 * 60)) % 24;
        const dias = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
        
        const partes = [];
        if (dias > 0) partes.push(`${dias}d`);
        if (hora > 0) partes.push(`${hora}h`);
        if (min > 0) partes.push(`${min}m`);
        partes.push(`${seg}s`);
        const tempoOnline = partes.join(" ");
        const dataInicio = new Date(Date.now() - uptimeMs).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

        const mem = process.memoryUsage();
        const rss = (mem.rss / 1024 / 1024).toFixed(1);
        const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
        const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);

        const inicio = Date.now();
        const msgTemp = await sock.sendMessage(idChat, { text: "⏱️ *Lendo dados do servidor...*" });
        const ping = Date.now() - inicio;

        const texto =
          `╭━━━〔 ⏱️ *UPTIME & SISTEMA* 〕━━━╮\n` +
          `┃\n┃ 🤖 *Bot:* ${NOME_BOT}\n┃ 📅 *Iniciado em:* ${dataInicio}\n` +
          `┃ 🚀 *Online há:* ${tempoOnline}\n┃ 🟢 *Ping da rede:* ${ping}ms\n┃\n` +
          `┣━━━〔 💾 *MEMÓRIA (RAM)* 〕━━━╮\n` +
          `┃ 📊 *Total (RSS):* ${rss} MB\n┃ 📦 *Heap (Alocado):* ${heapTotal} MB\n┃ 🧠 *Heap (Em uso):* ${heapUsed} MB\n┃\n` +
          `┣━━━〔 🖥️ *SISTEMA* 〕━━━╮\n` +
          `┃ 🐧 *Plataforma:* ${process.platform} (${process.arch})\n┃ ⚙️ *Node.js:* ${process.version}\n┃ 📚 *Comandos:* ${totalComandos}\n┃\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(idChat, { text: texto, edit: msgTemp.key });
      }
    },

    // ==============================================
    // 📢 BROADCAST
    // ==============================================
    {
      nome: "broadcast",
      descricao: "Envia uma mensagem para todos os grupos (marcando admins)",
      async executar({ sock, idChat, msg, resto }) {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        let textoBroadcast = (resto || "").trim();

        if (!textoBroadcast && quoted) textoBroadcast = quoted.conversation || quoted.extendedTextMessage?.text || "";
        if (!textoBroadcast) return sock.sendMessage(idChat, { text: "❌ *Uso:*\n> *!broadcast <mensagem>*\n> Ou responda uma mensagem com *!broadcast*" });

        let grupos = [];
        try {
          const groupsObj = await sock.groupFetchAllParticipating();
          grupos = Object.values(groupsObj);
        } catch (e) { return sock.sendMessage(idChat, { text: `❌ Erro ao buscar grupos: ${e.message}` }); }

        if (!grupos.length) return sock.sendMessage(idChat, { text: "❌ O bot não está em nenhum grupo." });
        await sock.sendMessage(idChat, { text: `🚀 *INICIANDO BROADCAST...*\n\n> 📢 Alcançando *${grupos.length}* grupos.\n> ⏳ Enviando...` });

        let enviados = 0, falhas = 0;
        for (const grupo of grupos) {
          try {
            const adms = grupo.participants.filter(p => p.admin).map(p => p.id);
            const mencoes = adms.length > 0 ? adms : grupo.participants.map(p => p.id);
            const mencoesTexto = mencoes.map(m => `@${m.split("@")[0]}`).join(" ");
            const textoFinal = `📢 *AVISO DO DONO*\n\n${textoBroadcast}\n\n> 🔔 ${mencoesTexto}`;

            await sock.sendMessage(grupo.id, { text: textoFinal, mentions: mencoes });
            enviados++;
            await new Promise(r => setTimeout(r, 2000));
          } catch (e) { falhas++; console.log(`❌ Falha no broadcast (${grupo.id}): ${e.message}`); }
        }

        await sock.sendMessage(idChat, { text: `✅ *BROADCAST CONCLUÍDO!*\n\n> 📢 Enviados: *${enviados}*\n> ❌ Falhas: *${falhas}*\n> 📦 Total: *${grupos.length}*` });
      }
    },

    // ==============================================
    // 📸 FOTO ERRO
    // ==============================================
    {
      nome: "foto_erro",
      descricao: "Define a foto do menu de erro",
      async executar({ sock, idChat, msg, downloadMediaMessage }) {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        if (!quoted || !quoted.imageMessage) return sock.sendMessage(idChat, { text: "❌ Uso: Responda a uma *foto* com *!foto_erro*" });

        try {
          const buffer = await downloadMediaMessage({ key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false }, message: quoted }, "buffer", {}, { logger: console, reuploadRequest: sock.updateMediaMessage });
          const caminho = path.join(__dirname, "..", "dados", "foto_erro.jpg");
          fs.mkdirSync(path.dirname(caminho), { recursive: true });
          fs.writeFileSync(caminho, buffer);
          await sock.sendMessage(idChat, { text: "✅ *Foto de erro definida!*\n\nAgora quando alguém usar um comando inválido, envio essa imagem." });
        } catch (e) { await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` }); }
      }
    },

    // ==============================================
    // 👁️ VIEW ON/OFF
    // ==============================================
    {
      nome: "view",
      descricao: "Ativa/desativa a leitura automática de mensagens",
      async executar({ sock, idChat, resto, lerJSON, salvarJSON }) {
        const op = (resto || "").trim().toLowerCase();
        if (!["on", "off"].includes(op)) return sock.sendMessage(idChat, { text: "❌ Uso: *!view on* ou *!view off*" });

        const ARQ_VIEW = path.join(__dirname, "..", "dados", "config_view.json");
        const dados = lerJSON(ARQ_VIEW, { ativo: false });
        dados.ativo = op === "on";
        salvarJSON(ARQ_VIEW, dados);

        await sock.sendMessage(idChat, { text: op === "on" ? "👁️ *VIEW ATIVADO!*\n\n> Vou marcar todas as mensagens como lidas." : "❌ *VIEW DESATIVADO!*" });
      }
    },

    // ==============================================
    // 🔑 APIKEY
    // ==============================================
    {
      nome: "apikey",
      descricao: "Atualiza a API Key da Bronxys",
      async executar({ sock, idChat, resto }) {
        const novaKey = (resto || "").trim();
        if (!novaKey) return sock.sendMessage(idChat, { text: "❌ Uso: *!apikey <sua_key>*" });

        try {
          let conteudo = fs.readFileSync(ARQUIVO_CONFIG, "utf8");
          conteudo = conteudo.replace(/API_KEY_BRONXYS:\s*"[^"]*"/, `API_KEY_BRONXYS: "${novaKey}"`);
          fs.writeFileSync(ARQUIVO_CONFIG, conteudo, "utf8");
          await sock.sendMessage(idChat, { text: `✅ *API KEY ATUALIZADA!*\n\n> 🔑 Nova Key: \`${novaKey.slice(0, 10)}...\`\n> ♻️ *Reinicie o bot* pra aplicar.` });
        } catch (e) { await sock.sendMessage(idChat, { text: `❌ Erro ao salvar: ${e.message}` }); }
      }
    },

    // ==============================================
    // ♻️ REINICIAR
    // ==============================================
    {
      nome: "reiniciar",
      descricao: "Reinicia o bot",
      async executar({ sock, idChat }) {
        await sock.sendMessage(idChat, { text: "♻️ *ʀᴇɪɴɪᴄɪᴀɴᴅᴏ ᴏ sᴇʀᴠɪᴅᴏʀ... ᴀɢᴜᴀʀᴅᴇᴍ ᴜɴꜱ ꜱᴇɢᴜɴᴅᴏꜱ...*" });
        setTimeout(() => process.exit(0), 2000);
      }
    },

    // ==============================================
    // 🎨 FIGCMD (Figurinha como comando)
    // ==============================================
    {
      nome: "figcmd",
      descricao: "Registra uma figurinha como comando",
      async executar({ sock, idChat, msg, resto, comandos, downloadMediaMessage }) {
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        if (!quoted || !quoted.stickerMessage) return sock.sendMessage(idChat, { text: "❌ Responda uma *figurinha* com *!figcmd <comando>*" });

        const comandoNome = (resto || "").trim().toLowerCase().split(/\s+/)[0];
        if (!comandoNome) return sock.sendMessage(idChat, { text: `❌ Uso: *!figcmd <comando>*\n\n> Responda uma figurinha com o comando que ela vai executar.\n> Ex: *!figcmd fechar*` });

        if (!comandos || !comandos.has(comandoNome)) return sock.sendMessage(idChat, { text: `❌ O comando *!${comandoNome}* não existe.\n\n> Veja *!menu* pra ver os comandos.` });

        const ARQ_FIGCMD = path.join(__dirname, "..", "dados", "figcmd.json");
        function lerFig() {
          try {
            if (!fs.existsSync(ARQ_FIGCMD)) return { comandos: {}, proxId: 1 };
            const d = JSON.parse(fs.readFileSync(ARQ_FIGCMD, "utf8"));
            if (!d.comandos) d.comandos = {};
            if (!d.proxId) d.proxId = 1;
            return d;
          } catch { return { comandos: {}, proxId: 1 }; }
        }
        function salvarFig(d) {
          try { fs.mkdirSync(path.dirname(ARQ_FIGCMD), { recursive: true }); fs.writeFileSync(ARQ_FIGCMD, JSON.stringify(d, null, 2)); } catch {}
        }

        const dados = lerFig();
        const jaRegistrado = Object.values(dados.comandos).find(c => c.comando === comandoNome);
        if (jaRegistrado) return sock.sendMessage(idChat, { text: `⚠️ O comando *!${comandoNome}* já tá registrado na figurinha *#${jaRegistrado.id}*.\n\n> Remova com *!delcmdfig ${jaRegistrado.id}*` });

        try {
          const alvo = { key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false }, message: quoted };
          let buffer;
          if (typeof downloadMediaMessage === "function") buffer = await downloadMediaMessage(alvo, "buffer", {}, { logger: console, reuploadRequest: sock.updateMediaMessage });
          else {
            const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
            const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
            buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          }

          const crypto = require("crypto");
          const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
          if (dados.comandos[hash]) return sock.sendMessage(idChat, { text: `⚠️ Essa figurinha já executa *!${dados.comandos[hash].comando}*.\n\n> Remova com *!delcmdfig ${dados.comandos[hash].id}*` });

          const id = dados.proxId++;
          dados.comandos[hash] = { id, comando: comandoNome, criado: Date.now(), criador: msg.key.participant || msg.key.remoteJid };
          salvarFig(dados);

          await sock.sendMessage(idChat, { text: `✅ *Figurinha registrada!*\n\n> 🆔 ID: *#${id}*\n> 🎯 Comando: *!${comandoNome}*\n\n> Agora quando alguém mandar essa figurinha, executo *!${comandoNome}*.` });
        } catch (e) { console.log("Erro figcmd:", e.message); await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` }); }
      }
    },
    {
      nome: "delcmdfig",
      descricao: "Remove uma figurinha do registro",
      async executar({ sock, idChat, resto }) {
        const id = parseInt((resto || "").trim());
        if (!id) return sock.sendMessage(idChat, { text: "❌ Uso: *!delcmdfig <id>*" });

        const ARQ_FIGCMD = path.join(__dirname, "..", "dados", "figcmd.json");
        if (!fs.existsSync(ARQ_FIGCMD)) return sock.sendMessage(idChat, { text: "📭 Nenhuma figurinha registrada." });

        const dados = JSON.parse(fs.readFileSync(ARQ_FIGCMD, "utf8"));
        const hash = Object.keys(dados.comandos || {}).find(h => dados.comandos[h].id === id);
        if (!hash) return sock.sendMessage(idChat, { text: `❌ Nenhuma figurinha com ID *#${id}*.` });

        const cmd = dados.comandos[hash].comando;
        delete dados.comandos[hash];
        fs.writeFileSync(ARQ_FIGCMD, JSON.stringify(dados, null, 2));

        await sock.sendMessage(idChat, { text: `🗑️ Figurinha *#${id}* removida!\n\n> Comando: *!${cmd}*` });
      }
    },
    {
      nome: "listacmdfig",
      descricao: "Lista as figurinhas registradas",
      async executar({ sock, idChat }) {
        const ARQ_FIGCMD = path.join(__dirname, "..", "dados", "figcmd.json");
        if (!fs.existsSync(ARQ_FIGCMD)) return sock.sendMessage(idChat, { text: "📭 Nenhuma figurinha registrada." });

        const dados = JSON.parse(fs.readFileSync(ARQ_FIGCMD, "utf8"));
        const lista = Object.entries(dados.comandos || {});
        if (!lista.length) return sock.sendMessage(idChat, { text: "📭 Nenhuma figurinha registrada." });

        const linhas = lista.map(([hash, c]) => `┃ *#${c.id}* — !${c.comando}`).join("\n");
        await sock.sendMessage(idChat, { 
          text: `🎨 *FIGURINHAS COM COMANDO*\n\n> Total: *${lista.length}*\n\n${linhas}\n\n> Use *!delcmdfig <id>* pra remover`
        });
      }
    },

    // ==============================================
    // 👋 KITAR (Sair do grupo)
    // ==============================================
    {
      nome: "kitar",
      descricao: "Faz o bot sair do grupo atual",
      async executar({ sock, idChat }) {
        if (!idChat.endsWith("@g.us")) {
          return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });
        }

        await sock.sendMessage(idChat, { text: "👋 *Até mais!*\n\n> Tô saindo do grupo agora..." });
        await new Promise(r => setTimeout(r, 1500));

        try {
          await sock.groupLeave(idChat);
        } catch (e) {
          console.log("Erro ao sair do grupo:", e.message);
        }
      }
    },

    // ==============================================
    // 🆔 GRUPOID / MEULID
    // ==============================================
    {
      nome: "grupoid",
      descricao: "Manda o ID do grupo",
      async executar({ sock, idChat }) {
        if (!idChat.endsWith("@g.us")) {
          return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });
        }
        await sock.sendMessage(idChat, {
          text: `🆔 *ID DO GRUPO*\n\n> \`${idChat}\`\n\n> 💡 Copie e use nos aluguéis.`
        });
      }
    },
    {
      nome: "meulid",
      descricao: "Manda o LID do usuário pra cadastro",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
          || msg.message?.extendedTextMessage?.contextInfo?.participant
          || msg.key.participant
          || msg.key.remoteJid;

        const lid = normalizarNumero(alvo);
        
        await sock.sendMessage(idChat, {
          text:
            `🆔 *LID DO USUÁRIO*\n\n` +
            `> 🔗 *LID:* \`${lid}\`\n` +
            `> 👤 *Nome:* ${msg.pushName || "Sem nome"}\n\n` +
            `> 💡 Copie esse LID e use em:\n` +
            `> • \`DONO_PRINCIPAL_LID\` (config.js)\n` +
            `> • \`!subdono\` (se for outro usuário)`,
          mentions: [alvo]
        });
      }
    },

// ==============================================
// 💰 ALUGUÉIS
// ==============================================
{
  nome: "aluguelglobal",
  descricao: "Ativa/desativa modo aluguel global",
  async executar({ sock, idChat, resto }) {
    const op = (resto || "").trim().toLowerCase();
    if (!["on", "off"].includes(op)) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!aluguelglobal on* ou *!aluguelglobal off*" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "alugueis.json");
    const fs = require("fs");
    
    let dados = { global: false, lista: {} };
    try { if (fs.existsSync(ARQ)) dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}
    
    dados.global = op === "on";
    if (!dados.lista) dados.lista = {};
    
    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, {
      text: dados.global
        ? "🔒 *ALUGUEL GLOBAL ATIVADO!*\n\n> O bot só funciona em grupos com aluguel registrado."
        : "🔓 *ALUGUEL GLOBAL DESATIVADO!*\n\n> O bot funciona em qualquer grupo."
    });
  }
},
{
  nome: "add_aluguel",
  descricao: "Adiciona tempo de aluguel num grupo",
  async executar({ sock, idChat, resto, lerJSON, salvarJSON, ARQUIVO_ALUGUEIS }) {
    const tempo = (resto || "").trim().toLowerCase();
    const match = tempo.match(/^(\d+)([mhd])$/);
    if (!match) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!add_aluguel 1m* | *1h* | *1d*\n\n> m = minutos, h = horas, d = dias" });
    }
    if (!idChat.endsWith("@g.us")) {
      return sock.sendMessage(idChat, { text: "❌ Execute isso dentro do grupo alvo." });
    }

    const qtd = parseInt(match[1]);
    const unidade = match[2];
    const ms = { m: 60000, h: 3600000, d: 86400000 }[unidade];

    const dados = lerJSON(ARQUIVO_ALUGUEIS, { global: false, lista: {} });
    if (!dados.lista) dados.lista = {};

    const agora = Date.now();
    const atual = dados.lista[idChat]?.expira || agora;
    const nova = Math.max(agora, atual) + qtd * ms;

    dados.lista[idChat] = { expira: nova, adicionado: agora, avisado: false };
    salvarJSON(ARQUIVO_ALUGUEIS, dados);

    await sock.sendMessage(idChat, {
      text: `✅ *Aluguel adicionado!*\n\n> ⏱️ +${qtd}${unidade}\n> 📅 Expira em: *${new Date(nova).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}*`
    });
  }
},
{
  nome: "rmaluguel",
  descricao: "Remove o aluguel do grupo atual",
  async executar({ sock, idChat, lerJSON, salvarJSON, ARQUIVO_ALUGUEIS }) {
    if (!idChat.endsWith("@g.us")) {
      return sock.sendMessage(idChat, { text: "❌ Execute dentro do grupo." });
    }
    const dados = lerJSON(ARQUIVO_ALUGUEIS, { global: false, lista: {} });
    if (!dados.lista?.[idChat]) {
      return sock.sendMessage(idChat, { text: "⚠️ Esse grupo não tem aluguel registrado." });
    }
    delete dados.lista[idChat];
    salvarJSON(ARQUIVO_ALUGUEIS, dados);
    await sock.sendMessage(idChat, { text: "🗑️ *Aluguel removido!*" });
  }
},
{
  nome: "alugueis",
  descricao: "Lista todos os aluguéis com detalhes do grupo",
  async executar({ sock, idChat, lerJSON, ARQUIVO_ALUGUEIS }) {
    const dados = lerJSON(ARQUIVO_ALUGUEIS, { global: false, lista: {} });
    const lista = dados.lista || {};
    const entradas = Object.entries(lista).filter(([, v]) => v.expira > Date.now());

    if (!entradas.length) {
      return sock.sendMessage(idChat, {
        text: `📭 *Nenhum aluguel ativo.*\n\n> Global: *${dados.global ? "🔒 ON" : "🔓 OFF"}*`
      });
    }

    const blocos = [];
    for (const [gid, reg] of entradas) {
      let nomeGrupo = gid;
      let link = null;
      let membros = "?";
      let criador = "?";

      try {
        const meta = await sock.groupMetadata(gid);
        nomeGrupo = meta.subject || gid;
        membros = meta.participants?.length || "?";
        try { link = `https://chat.whatsapp.com/${await sock.groupInviteCode(gid)}`; } catch {}
        const dono = meta.participants?.find(p => p.admin === "superadmin");
        if (dono) criador = `@${dono.id.split("@")[0].split(":")[0]}`;
      } catch {}

      const expira = new Date(reg.expira).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      blocos.push(
        `┃ 📌 *Nome:* ${nomeGrupo}\n` +
        `┃ 🆔 *ID:* \`${gid}\`\n` +
        `┃ 👥 *Membros:* ${membros}\n` +
        `┃ 👑 *Criador:* ${criador}\n` +
        `┃ 🔗 *Link:* ${link || "_indisponível_"}\n` +
        `┃ ⏰ *Expira em:* ${expira}`
      );
    }

    const texto = `💰 *ALUGUÉIS ATIVOS*\n\n> Global: *${dados.global ? "🔒 ON" : "🔓 OFF"}*\n> Total: *${entradas.length}*\n\n${blocos.join("\n\n━━━━━━━━━━━━━━━\n\n")}`;
    await sock.sendMessage(idChat, { text: texto });
  }
},

    {
      nome: "entrar",
      descricao: "Entra num grupo pelo link",
      async executar({ sock, idChat, resto }) {
        const match = (resto || "").match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]+)/i);
        if (!match) {
          return sock.sendMessage(idChat, { text: "❌ Uso: *!entrar chat.whatsapp.com/xxxxx*" });
        }
        try {
          await sock.groupAcceptInvite(match[1]);
          await sock.sendMessage(idChat, { text: "✅ *Entrei no grupo com Sucesso!🎉*\n\n> *Utilize comando !add_aluguel no grupo para adicionar aluguel*!" });
        } catch (e) {
          await sock.sendMessage(idChat, { text: `❌ *Não consegui entrar!*\n\n> ${e.message}` });
        }
      }
    },

    // ==============================================
    // 🍹 PERSONALIZAÇÃO DO MENU
    // ==============================================
    {
      nome: "setmenu",
      descricao: "Define foto/vídeo de um menu",
      async executar({ sock, idChat, msg, resto, downloadMediaMessage }) {
        const alvoMenu = (resto || "menu").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        const ctx = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        
        if (!quoted || !ctx) {
          return sock.sendMessage(idChat, { text: "❌ Responda a uma *foto* ou *vídeo* com *!setmenu <menu>*" });
        }

        const tipo = quoted.imageMessage ? "image" : quoted.videoMessage ? "video" : null;
        if (!tipo) return sock.sendMessage(idChat, { text: "❌ Só aceito foto ou vídeo." });

        try {
          const buffer = await downloadMediaMessage(
            { key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false }, message: quoted },
            "buffer", {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
          );

          if (!buffer || buffer.length === 0) throw new Error("Buffer vazio");
          
          const pastaDados = path.join(__dirname, "..", "dados");
          fs.mkdirSync(pastaDados, { recursive: true });

          const ext = tipo === "image" ? "jpg" : "mp4";
          const nomeArq = `menu_midia_${alvoMenu}.${ext}`;
          const caminho = path.join(pastaDados, nomeArq);

          fs.writeFileSync(caminho, buffer);
          
          const meta = { tipo, arquivo: nomeArq, menu: alvoMenu, salvo: Date.now() };
          fs.writeFileSync(path.join(pastaDados, `menu_midia_${alvoMenu}.json`), JSON.stringify(meta, null, 2));

          await sock.sendMessage(idChat, { text: `✅ *Mídia do menu "${alvoMenu}" salva!* (${tipo})` });
        } catch (e) {
          await sock.sendMessage(idChat, { text: `❌ Erro baixando mídia: ${e.message}` });
        }
      }
    },
    {
      nome: "rm_midiamenu",
      descricao: "Remove a mídia de um menu",
      async executar({ sock, idChat, resto }) {
        const alvoMenu = (resto || "menu").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        const pasta = path.join(__dirname, "..", "dados");
        let removeu = false;

        for (const f of [`menu_midia_${alvoMenu}.json`, `menu_midia_${alvoMenu}.jpg`, `menu_midia_${alvoMenu}.mp4`]) {
          const p = path.join(pasta, f);
          if (fs.existsSync(p)) { fs.unlinkSync(p); removeu = true; }
        }
        
        await sock.sendMessage(idChat, {
          text: removeu 
            ? `🗑️ *Mídia do menu "${alvoMenu}" removida!*` 
            : `⚠️ Nenhuma mídia cadastrada pro menu "${alvoMenu}".`
        });
      }
    },

    // ==============================================
    // 🌀 COMANDOS SEM PREFIXO
    // ==============================================
    {
      nome: "addcmdp",
      descricao: "Adiciona comando sem prefixo",
      async executar({ sock, idChat, resto, lerJSON, salvarJSON, ARQUIVO_SEM_PREFIXO }) {
        const nome = (resto || "").trim().toLowerCase();
        if (!nome) {
          return sock.sendMessage(idChat, { text: "❌ Uso: *!addcmdp <comando>*\nEx: `!addcmdp ping` → aí `ping` funciona sem prefixo." });
        }
        const dados = lerJSON(ARQUIVO_SEM_PREFIXO, { lista: [] });
        if (!dados.lista) dados.lista = [];
        if (dados.lista.includes(nome)) {
          return sock.sendMessage(idChat, { text: `⚠️ *${nome}* já tá na lista.` });
        }
        dados.lista.push(nome);
        salvarJSON(ARQUIVO_SEM_PREFIXO, dados);
        await sock.sendMessage(idChat, { text: `✅ *${nome}* agora funciona sem prefixo!` });
      }
    },
    {
      nome: "rmcmdp",
      descricao: "Remove comando sem prefixo",
      async executar({ sock, idChat, resto, lerJSON, salvarJSON, ARQUIVO_SEM_PREFIXO }) {
        const nome = (resto || "").trim().toLowerCase();
        if (!nome) {
          return sock.sendMessage(idChat, { text: "❌ Uso: *!rmcmdp <comando>*" });
        }
        const dados = lerJSON(ARQUIVO_SEM_PREFIXO, { lista: [] });
        const antes = dados.lista.length;
        dados.lista = dados.lista.filter(c => c !== nome);
        if (dados.lista.length === antes) {
          return sock.sendMessage(idChat, { text: `⚠️ *${nome}* não estava na lista.` });
        }
        salvarJSON(ARQUIVO_SEM_PREFIXO, dados);
        await sock.sendMessage(idChat, { text: `🗑️ *${nome}* removido da lista.` });
      }
    },
    {
      nome: "listacmdp",
      descricao: "Lista comandos sem prefixo",
      async executar({ sock, idChat, lerJSON, ARQUIVO_SEM_PREFIXO }) {
        const dados = lerJSON(ARQUIVO_SEM_PREFIXO, { lista: [] });
        const lista = dados.lista || [];
        if (!lista.length) {
          return sock.sendMessage(idChat, { text: "📭 *Nenhum comando sem prefixo.*" });
        }
        await sock.sendMessage(idChat, {
          text: `⚡ *COMANDOS SEM PREFIXO*\n\n> Total: *${lista.length}*\n\n${lista.map((c, i) => `┃ ${i + 1}. \`${c}\``).join("\n")}`
        });
      }
    },

    // ==============================================
    // 👑 MENU DONO
    // ==============================================
    {
      nome: "menudono",
      descricao: "Mostra o menu exclusivo do dono",
      async executar({ sock, idChat, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME, msg }) {
        const ARQ_MENU = path.join(__dirname, "..", "personalize_aqui", "menu_dono.txt");

        if (!fs.existsSync(ARQ_MENU)) {
          return sock.sendMessage(idChat, { text: "❌ Arquivo *personalize_aqui/menu_dono.txt* não encontrado!" });
        }

        const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        let texto;
        
        try {
          texto = fs.readFileSync(ARQ_MENU, "utf8")
            .replace(/{PREFIXO}/g, PREFIXO || "!")
            .replace(/{BOT}/g, NOME_BOT || "Bot")
            .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
            .replace(/{DATA}/g, data);
        } catch (e) {
          return sock.sendMessage(idChat, { text: `❌ Erro lendo menu: ${e.message}` });
        }

        const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menu.json");
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
    }
  ]
};
