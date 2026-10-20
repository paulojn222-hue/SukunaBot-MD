const fs = require("fs");
const path = require("path");

// ⚠️ Refs que o index injeta em runtime
let PREFIXO_GLOBAL = "!";
const ARQUIVO_CONFIG = path.join(__dirname, "..", "config.js");

const ARQ = path.join(__dirname, "..", "personalize_aqui", "menu_dono.txt");

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
// ⏱️ UPTIME (Informações do Sistema)
// ==============================================
{
  nome: "uptime",
  descricao: "Mostra informações do sistema e tempo online",
  async executar({ sock, idChat, NOME_BOT, totalComandos }) {
    // ⏱️ Tempo
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

    // 📅 Data de Início
    const dataInicio = new Date(Date.now() - uptimeMs).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // 💾 Memória
    const mem = process.memoryUsage();
    const rss = (mem.rss / 1024 / 1024).toFixed(1);
    const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
    const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);

    // 🖥️ Sistema
    const plataforma = process.platform;
    const arch = process.arch;
    const versaoNode = process.version;

    // ⚡ Teste de Latência (Ping)
    const inicio = Date.now();
    const msg = await sock.sendMessage(idChat, { text: "⏱️ *Lendo dados do servidor...*" });
    // (O sock.sendMessage já foi enviado, agora calculamos o ping com o return)
    const ping = Date.now() - inicio;

    const texto =
      `╭━━━〔 ⏱️ *UPTIME & SISTEMA* 〕━━━╮\n` +
      `┃\n` +
      `┃ 🤖 *Bot:* ${NOME_BOT}\n` +
      `┃ 📅 *Iniciado em:* ${dataInicio}\n` +
      `┃ 🚀 *Online há:* ${tempoOnline}\n` +
      `┃ 🟢 *Ping da rede:* ${ping}ms\n` +
      `┃\n` +
      `┣━━━〔 💾 *MEMÓRIA (RAM)* 〕━━━╮\n` +
      `┃ 📊 *Total (RSS):* ${rss} MB\n` +
      `┃ 📦 *Heap (Alocado):* ${heapTotal} MB\n` +
      `┃ 🧠 *Heap (Em uso):* ${heapUsed} MB\n` +
      `┃\n` +
      `┣━━━〔 🖥️ *SISTEMA* 〕━━━╮\n` +
      `┃ 🐧 *Plataforma:* ${plataforma} (${arch})\n` +
      `┃ ⚙️ *Node.js:* ${versaoNode}\n` +
      `┃ 📚 *Comandos:* ${totalComandos}\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

    // Edita a mensagem anterior pra mandar o painel completo
    await sock.sendMessage(idChat, { text: texto, edit: msg.key });
  }
},

// ==============================================
// 📢 BROADCAST (Envia mensagem pra todos os grupos)
// ==============================================
{
  nome: "broadcast",
  descricao: "Envia uma mensagem para todos os grupos (marcando admins)",
  async executar({ sock, idChat, msg, resto }) {
    // 1. Verifica se tem texto ou se respondeu uma mensagem
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    
    let textoBroadcast = (resto || "").trim();
    
    // Se respondeu alguém, pega o texto da resposta
    if (!textoBroadcast && quoted) {
      textoBroadcast = quoted.conversation || quoted.extendedTextMessage?.text || "";
    }

    if (!textoBroadcast) {
      return sock.sendMessage(idChat, { 
        text: "❌ *Uso:*\n> *!broadcast <mensagem>*\n> Ou responda uma mensagem com *!broadcast*" 
      });
    }

    // 2. Pega a lista de todos os grupos
    let grupos = [];
    try {
      const groupsObj = await sock.groupFetchAllParticipating();
      grupos = Object.values(groupsObj);
    } catch (e) {
      return sock.sendMessage(idChat, { text: `❌ Erro ao buscar grupos: ${e.message}` });
    }

    if (!grupos.length) return sock.sendMessage(idChat, { text: "❌ O bot não está em nenhum grupo." });

    await sock.sendMessage(idChat, { 
      text: `🚀 *INICIANDO BROADCAST...*\n\n> 📢 Alcançando *${grupos.length}* grupos.\n> ⏳ Enviando...` 
    });

    let enviados = 0;
    let falhas = 0;

    // 3. Loop de envio
    for (const grupo of grupos) {
      try {
        // Filtra os admins do grupo
        const adms = grupo.participants.filter(p => p.admin).map(p => p.id);

        // Se o grupo tiver admins, marca eles. Se não, marca todo mundo.
        const mencoes = adms.length > 0 ? adms : grupo.participants.map(p => p.id);
        
        // Cria uma lista de @numeros pra por no texto (opcional, ajuda a notificar)
        const mencoesTexto = mencoes.map(m => `@${m.split("@")[0]}`).join(" ");

        const textoFinal = `📢 *AVISO DO DONO*\n\n${textoBroadcast}\n\n> 🔔 ${mencoesTexto}`;

        await sock.sendMessage(grupo.id, {
          text: textoFinal,
          mentions: mencoes
        });

        enviados++;
        console.log(`✅ Broadcast enviado: ${grupo.subject || grupo.id}`);
        
        // Pausa de 2 segundos para não tomar ban
        await new Promise(r => setTimeout(r, 2000));

      } catch (e) {
        falhas++;
        console.log(`❌ Falha no broadcast (${grupo.id}): ${e.message}`);
      }
    }

    // 4. Avisa o dono do resultado final
    await sock.sendMessage(idChat, {
      text: `✅ *BROADCAST CONCLUÍDO!*\n\n> 📢 Enviados: *${enviados}*\n> ❌ Falhas: *${falhas}*\n> 📦 Total: *${grupos.length}*`
    });
  }
},

// ==============================================
// 📸 FOTO ERRO (Define a foto que aparece quando o comando não existe)
// ==============================================
{
  nome: "foto_erro",
  descricao: "Define a foto do menu de erro",
  async executar({ sock, idChat, msg, downloadMediaMessage }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted || !quoted.imageMessage) {
      return sock.sendMessage(idChat, {
        text: "❌ Uso: Responda a uma *foto* com *!foto_erro*"
      });
    }

    try {
      // Baixa a foto
      const buffer = await downloadMediaMessage(
        { key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false }, message: quoted },
        "buffer", {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      // Salva na pasta dados
      const caminho = path.join(__dirname, "..", "dados", "foto_erro.jpg");
      fs.mkdirSync(path.dirname(caminho), { recursive: true });
      fs.writeFileSync(caminho, buffer);

      await sock.sendMessage(idChat, {
        text: "✅ *Foto de erro definida!*\n\nAgora quando alguém usar um comando inválido, envio essa imagem."
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }
  }
},

// ==============================================
// 👁️ VIEW ON/OFF (Marca mensagens como lidas)
// ==============================================
{
  nome: "view",
  descricao: "Ativa/desativa a leitura automática de mensagens",
  async executar({ sock, idChat, resto, lerJSON, salvarJSON }) {
    const op = (resto || "").trim().toLowerCase();
    if (!["on", "off"].includes(op)) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!view on* ou *!view off*" });
    }

    const ARQ = path.join(__dirname, "..", "dados", "config_view.json");
    const dados = lerJSON(ARQ, { ativo: false });
    dados.ativo = op === "on";
    salvarJSON(ARQ, dados);

    await sock.sendMessage(idChat, {
      text: op === "on"
        ? "👁️ *VIEW ATIVADO!*\n\n> Vou marcar todas as mensagens como lidas."
        : "❌ *VIEW DESATIVADO!*"
    });
  }
},

// ==============================================
// 🔑 APIKEY (Atualiza a key da Bronxys)
// ==============================================
{
  nome: "apikey",
  descricao: "Atualiza a API Key da Bronxys",
  async executar({ sock, idChat, resto }) {
    const novaKey = (resto || "").trim();
    if (!novaKey) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!apikey <sua_key>*" });
    }

    try {
      const ARQ_CONFIG = path.join(__dirname, "..", "config.js");
      let conteudo = fs.readFileSync(ARQ_CONFIG, "utf8");
      
      // Substitui a linha da API_KEY_BRONXYS
      conteudo = conteudo.replace(/API_KEY_BRONXYS:\s*"[^"]*"/, `API_KEY_BRONXYS: "${novaKey}"`);
      
      fs.writeFileSync(ARQ_CONFIG, conteudo, "utf8");

      await sock.sendMessage(idChat, {
        text: `✅ *API KEY ATUALIZADA!*\n\n> 🔑 Nova Key: \`${novaKey.slice(0, 10)}...\`\n> ♻️ *Reinicie o bot* pra aplicar.`
      });
    } catch (e) {
      await sock.sendMessage(idChat, { text: `❌ Erro ao salvar: ${e.message}` });
    }
  }
},

// ==============================================
// ♻️ REINICIAR
// ==============================================
{
  nome: "reiniciar",
  descricao: "Reinicia o bot",
  async executar({ sock, idChat }) {
    await sock.sendMessage(idChat, {
      text: "♻️ *ʀᴇɪɴɪᴄɪᴀɴᴅᴏ ᴏ sᴇʀᴠɪᴅᴏʀ... ᴀɢᴜᴀʀᴅᴇᴍ ᴜɴs sᴇɢᴜɴᴅᴏs...*"
    });
    setTimeout(() => process.exit(0), 2000);
  }
},

// ==============================================
// 🎨 FIGCMD — registra figurinha como comando
// ==============================================
{
  nome: "figcmd",
  descricao: "Registra uma figurinha como comando",
  async executar({ sock, idChat, msg, resto, comandos, downloadMediaMessage }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted || !quoted.stickerMessage) {
      return sock.sendMessage(idChat, {
        text: "❌ Responda uma *figurinha* com *!figcmd <comando>*"
      });
    }

    const comandoNome = (resto || "").trim().toLowerCase().split(/\s+/)[0];
    if (!comandoNome) {
      return sock.sendMessage(idChat, {
        text:
          `❌ Uso: *!figcmd <comando>*\n\n` +
          `> Responda uma figurinha com o comando que ela vai executar.\n` +
          `> Ex: *!figcmd fechar*`
      });
    }

    if (!comandos || !comandos.has(comandoNome)) {
      return sock.sendMessage(idChat, {
        text: `❌ O comando *!${comandoNome}* não existe.\n\n> Veja *!menu* pra ver os comandos.`
      });
    }

    const ARQ = path.join(__dirname, "..", "dados", "figcmd.json");

    function ler() {
      try {
        if (!fs.existsSync(ARQ)) return { comandos: {}, proxId: 1 };
        const d = JSON.parse(fs.readFileSync(ARQ, "utf8"));
        if (!d.comandos) d.comandos = {};
        if (!d.proxId) d.proxId = 1;
        return d;
      } catch { return { comandos: {}, proxId: 1 }; }
    }

    function salvar(d) {
      try {
        fs.mkdirSync(path.dirname(ARQ), { recursive: true });
        fs.writeFileSync(ARQ, JSON.stringify(d, null, 2));
      } catch {}
    }

    const dados = ler();
    const jaRegistrado = Object.values(dados.comandos).find(c => c.comando === comandoNome);
    if (jaRegistrado) {
      return sock.sendMessage(idChat, {
        text: `⚠️ O comando *!${comandoNome}* já tá registrado na figurinha *#${jaRegistrado.id}*.\n\n> Remova com *!delcmdfig ${jaRegistrado.id}*`
      });
    }

    try {
      // Baixa a figurinha
      const alvo = { key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false }, message: quoted };
      let buffer;

      if (typeof downloadMediaMessage === "function") {
        buffer = await downloadMediaMessage(alvo, "buffer", {}, { logger: console, reuploadRequest: sock.updateMediaMessage });
      } else {
        const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
        const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
        buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      }

      const crypto = require("crypto");
      const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

      if (dados.comandos[hash]) {
        return sock.sendMessage(idChat, {
          text: `⚠️ Essa figurinha já executa *!${dados.comandos[hash].comando}*.\n\n> Remova com *!delcmdfig ${dados.comandos[hash].id}*`
        });
      }

      const id = dados.proxId++;
      dados.comandos[hash] = {
        id,
        comando: comandoNome,
        criado: Date.now(),
        criador: msg.key.participant || msg.key.remoteJid
      };
      salvar(dados);

      await sock.sendMessage(idChat, {
        text:
          `✅ *Figurinha registrada!*\n\n` +
          `> 🆔 ID: *#${id}*\n` +
          `> 🎯 Comando: *!${comandoNome}*\n\n` +
          `> Agora quando alguém mandar essa figurinha, executo *!${comandoNome}*.`
      });
    } catch (e) {
      console.log("Erro figcmd:", e.message);
      await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
    }
  }
},

// ==============================================
// 🗑️ DELCMDFIG
// ==============================================
{
  nome: "delcmdfig",
  descricao: "Remove uma figurinha do registro",
  async executar({ sock, idChat, resto }) {
    const id = parseInt((resto || "").trim());
    if (!id) return sock.sendMessage(idChat, { text: "❌ Uso: *!delcmdfig <id>*" });

    const ARQ = path.join(__dirname, "..", "dados", "figcmd.json");
    if (!fs.existsSync(ARQ)) return sock.sendMessage(idChat, { text: "📭 Nenhuma figurinha registrada." });

    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    const hash = Object.keys(dados.comandos || {}).find(h => dados.comandos[h].id === id);

    if (!hash) return sock.sendMessage(idChat, { text: `❌ Nenhuma figurinha com ID *#${id}*.` });

    const cmd = dados.comandos[hash].comando;
    delete dados.comandos[hash];
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, {
      text: `🗑️ Figurinha *#${id}* removida!\n\n> Comando: *!${cmd}*`
    });
  }
},

// ==============================================
// 📋 LISTACMDFIG
// ==============================================
{
  nome: "listacmdfig",
  descricao: "Lista as figurinhas registradas",
  async executar({ sock, idChat }) {
    const ARQ = path.join(__dirname, "..", "dados", "figcmd.json");
    if (!fs.existsSync(ARQ)) return sock.sendMessage(idChat, { text: "📭 Nenhuma figurinha registrada." });

    const dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    const lista = Object.entries(dados.comandos || {});

    if (!lista.length) return sock.sendMessage(idChat, { text: "📭 Nenhuma figurinha registrada." });

    const linhas = lista.map(([hash, c]) => `┃ *#${c.id}* — !${c.comando}`).join("\n");

    await sock.sendMessage(idChat, {
      text:
        `🎨 *FIGURINHAS COM COMANDO*\n\n` +
        `> Total: *${lista.length}*\n\n` +
        linhas + `\n\n` +
        `> Use *!delcmdfig <id>* pra remover`
    });
  }
},

// ==============================================
// 💬 SETCHAT — define o grupo principal do bot
// ==============================================
{
  nome: "setchat",
  descricao: "Define o grupo principal do bot",
  async executar({ sock, idChat, lerJSON, salvarJSON }) {
    if (!idChat.endsWith("@g.us")) {
      return sock.sendMessage(idChat, { text: "❌ Esse comando só funciona em grupos." });
    }

    const ARQ = path.join(__dirname, "..", "dados", "chat_principal.json");
    const dados = lerJSON(ARQ, { jid: null, definido: null });

    if (dados.jid === idChat) {
      return sock.sendMessage(idChat, {
        text: `⚠️ Esse grupo *já é* o principal do bot.`
      });
    }

    // Pega o link do grupo
    let link = null;
    try {
      const codigo = await sock.groupInviteCode(idChat);
      link = `https://chat.whatsapp.com/${codigo}`;
    } catch {}

    salvarJSON(ARQ, { jid: idChat, definido: Date.now(), link });

    await sock.sendMessage(idChat, {
      text: `✅ *Grupo principal definido!*\n\n> 💬 Grupo: *este*\n> 🔗 Link: ${link || "_não disponível_"}\n\n> Use *!chat* pra mandar o link.`
    });
  }
},

// ==============================================
// 📢 SETCHANNEL — define o canal do bot
// Créditos: @Nk Petrøv (adaptado)
// ==============================================
{
  nome: "setchannel",
  descricao: "Define o canal do bot via link",
  async executar({ sock, idChat, resto }) {
    const ARQ_CANAL = path.join(__dirname, "..", "dados", "canal.json");

    // Sem argumento → mostra o canal atual
    if (!resto) {
      const atual = (() => {
        try {
          if (!fs.existsSync(ARQ_CANAL)) return null;
          return JSON.parse(fs.readFileSync(ARQ_CANAL, "utf8"));
        } catch { return null; }
      })();

      if (!atual?.jid) {
        return sock.sendMessage(idChat, {
          text:
            `📢 *CANAL NÃO CONFIGURADO*\n\n` +
            `> Use: *!setchannel <link>*\n` +
            `> Ex: \`!setchannel https://whatsapp.com/channel/xxxxx\`\n\n` +
            `> 💡 Pra remover: *!setchannel 0*`
        });
      }

      return sock.sendMessage(idChat, {
        text:
          `📢 *CANAL ATUAL*\n\n` +
          `> 🆔 JID: \`${atual.jid}\`\n` +
          `> 🔗 Link: ${atual.link}`
      });
    }

    // Remove canal
    if (resto.trim() === "0") {
      fs.mkdirSync(path.dirname(ARQ_CANAL), { recursive: true });
      fs.writeFileSync(ARQ_CANAL, JSON.stringify({ jid: null, link: null }, null, 2));
      return sock.sendMessage(idChat, {
        text: "🗑️ *Canal removido!*"
      });
    }

    // Extrai o código do link
    const codigoCanal = resto.trim()
      .replace(/.*whatsapp\.com\/channel\//, "")
      .replace(/.*wa\.me\/channel\//, "")
      .split(/[\/?\s]/)[0];

    if (!codigoCanal) {
      return sock.sendMessage(idChat, {
        text: "❌ Link inválido! Manda o link completo do canal."
      });
    }

    try {
      const meta = await sock.newsletterMetadata("invite", codigoCanal);
      const jidReal = meta?.jid || meta?.id;

      if (!jidReal) {
        return sock.sendMessage(idChat, {
          text: "❌ Não consegui encontrar o canal. Verifica o link."
        });
      }

      const linkCanal = `https://whatsapp.com/channel/${codigoCanal}`;
      fs.mkdirSync(path.dirname(ARQ_CANAL), { recursive: true });
      fs.writeFileSync(
        ARQ_CANAL,
        JSON.stringify({ jid: jidReal, link: linkCanal }, null, 2)
      );

      await sock.sendMessage(idChat, {
        text:
          `✅ *CANAL DEFINIDO!*\n\n` +
          `> 🆔 JID: \`${jidReal}\`\n` +
          `> 🔗 Link: ${linkCanal}`
      });
    } catch (e) {
      console.log("Erro setchannel:", e);
      await sock.sendMessage(idChat, {
        text: `❌ Erro: ${e.message}`
      });
    }
  }
},

// ==============================================
// 📢 CHANNEL — alias do setchannel
// ==============================================
{
  nome: "channel",
  descricao: "Alias de setchannel",
  async executar(ctx) {
    // Reaproveita a lógica do setchannel
    const mod = require("./dono.js");
    const setCmd = mod.comandos.find(c => c.nome === "setchannel");
    return setCmd.executar(ctx);
  }
},

{
  nome: "kitar",
  descricao: "Faz o bot sair do grupo atual",
  async executar({ sock, idChat }) {
    if (!idChat.endsWith("@g.us")) {
      return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });
    }

    await sock.sendMessage(idChat, {
      text: "👋 *Até mais!*\n\n> Tô saindo do grupo agora..."
    });

    // Pequena pausa pra mensagem chegar antes de sair
    await new Promise(r => setTimeout(r, 1500));

    try {
      await sock.groupLeave(idChat);
    } catch (e) {
      console.log("Erro ao sair do grupo:", e.message);
    }
  }
},
    // ==============================================
    // 💭 SUBDONOS
    // ==============================================
{
  nome: "addsubdono",
  descricao: "Adiciona um subdono",
  async executar({ sock, idChat, msg, lerJSON, salvarJSON, ARQUIVO_SUBDONOS, normalizarNumero }) {
    const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (!alvo) {
      return sock.sendMessage(idChat, {
        text: "❌ Uso: *!addsubdono @usuario* (ou responda uma mensagem dele)"
      });
    }

    const dados = lerJSON(ARQUIVO_SUBDONOS, { lista: [] });
    if (!dados.lista) dados.lista = [];

    const lid = normalizarNumero(alvo);
    // Se já existir, não adiciona
    if (dados.lista.some(s => (typeof s === "string" ? s : s.lid) === lid)) {
      return sock.sendMessage(idChat, { text: `⚠️ @${lid} já é subdono.`, mentions: [alvo] });
    }

    // Salva o JID completo + LID
    dados.lista.push({ lid, jid: alvo });
    salvarJSON(ARQUIVO_SUBDONOS, dados);

    await sock.sendMessage(idChat, {
      text: `✅ *Novo subdono adicionado!*\n\n> 👤 @${lid} agora tem permissões de dono.`,
      mentions: [alvo]
    });
  }
},

{
  nome: "rmsubdono",
  descricao: "Remove um subdono",
  async executar({ sock, idChat, msg, lerJSON, salvarJSON, ARQUIVO_SUBDONOS, normalizarNumero }) {
    const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      || msg.message?.extendedTextMessage?.contextInfo?.participant;

    if (!alvo) {
      return sock.sendMessage(idChat, { text: "❌ Uso: *!rmsubdono @usuario*" });
    }

    const dados = lerJSON(ARQUIVO_SUBDONOS, { lista: [] });
    const lid = normalizarNumero(alvo);
    const antes = dados.lista.length;

    dados.lista = dados.lista.filter(s => {
      const sLid = typeof s === "string" ? s : s.lid;
      return sLid !== lid;
    });

    if (dados.lista.length === antes) {
      return sock.sendMessage(idChat, {
        text: `⚠️ @${lid} não era subdono.`,
        mentions: [alvo]
      });
    }

    salvarJSON(ARQUIVO_SUBDONOS, dados);
    await sock.sendMessage(idChat, {
      text: `🗑️ *Subdono removido!*\n\n> 👤 @${lid} perdeu as permissões.`,
      mentions: [alvo]
    });
  }
},

{
  nome: "lista_subdonos",
  descricao: "Lista os subdonos",
  async executar({ sock, idChat, lerJSON, ARQUIVO_SUBDONOS }) {
    const dados = lerJSON(ARQUIVO_SUBDONOS, { lista: [] });
    const lista = dados.lista || [];

    if (!lista.length) {
      return sock.sendMessage(idChat, { text: "📭 *Nenhum subdono cadastrado ainda.*" });
    }

    // Normaliza: aceita formato antigo (string) e novo (objeto)
    const subs = lista.map(s => {
      if (typeof s === "string") return { lid: s, jid: null };
      return { lid: s.lid || s, jid: s.jid || null };
    });

    // Separa quem tem JID (pode marcar) e quem só tem LID
    const comJid = subs.filter(s => s.jid);
    const soLid = subs.filter(s => !s.jid);

    const linhas = subs.map((s, i) => {
      const num = String(i + 1).padStart(2, " ");
      if (s.jid) return `┃ ${num}. @${s.lid}`;
      return `┃ ${num}. \`${s.lid}\` _(sem JID)_`;
    }).join("\n");

    const mentions = comJid.map(s => s.jid);

    const texto =
      `💭 *SUBDONOS DO BOT*\n\n` +
      `> Total: *${subs.length}*\n` +
      (soLid.length ? `> ⚠️ Sem JID: *${soLid.length}* (não marca)\n` : "") +
      `\n` + linhas + `\n\n` +
      `> 💡 Sem JID = adicionado antes da atualização.`;

    await sock.sendMessage(idChat, { text: texto, mentions });
  }
},
    // ==============================================
    // 💌 CONFIGURAÇÕES
    // ==============================================
    {
      nome: "rg_prefixo",
      descricao: "Troca o prefixo do bot",
      async executar({ sock, idChat, resto }) {
        const novo = (resto || "").trim();
        if (!novo || novo.length > 3) {
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!rg_prefixo <novo>*\nEx: `!rg_prefixo /` (máx 3 caracteres)"
          });
        }

        salvarPrefixo(novo);
        await sock.sendMessage(idChat, {
          text: `✅ *Prefixo alterado!*\n\n> 🔤 Novo prefixo: *${novo}*\n> ♻️ Reinicie o bot pra aplicar.`
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
        `> • \`!addsubdono\` (se for outro usuário)`,
      mentions: [alvo]
    });
  }
},
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

    // ==============================================
    // 💰 ALUGUÉIS
    // ==============================================
    {
      nome: "aluguelglobal",
      descricao: "Ativa/desativa modo aluguel global",
      async executar({ sock, idChat, resto, lerJSON, salvarJSON, ARQUIVO_ALUGUEIS }) {
        const op = (resto || "").trim().toLowerCase();
        if (!["on", "off"].includes(op)) {
          return sock.sendMessage(idChat, { text: "❌ Uso: *!aluguelglobal on* ou *!aluguelglobal off*" });
        }

        const dados = lerJSON(ARQUIVO_ALUGUEIS, { global: false, lista: {} });
        dados.global = op === "on";
        salvarJSON(ARQUIVO_ALUGUEIS, dados);

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
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!add_aluguel 1m* | *1h* | *1d*\n\n> m = minutos, h = horas, d = dias"
          });
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
            text:
              `📭 *Nenhum aluguel ativo.*\n\n` +
              `> Global: *${dados.global ? "🔒 ON" : "🔓 OFF"}*`
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

            try {
              const codigo = await sock.groupInviteCode(gid);
              link = `https://chat.whatsapp.com/${codigo}`;
            } catch {}

            const dono = meta.participants?.find(p => p.admin === "superadmin");
            if (dono) criador = `@${dono.id.split("@")[0].split(":")[0]}`;
          } catch {}

          const expira = new Date(reg.expira).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo"
          });

          blocos.push(
            `┃ 📌 *Nome:* ${nomeGrupo}\n` +
            `┃ 🆔 *ID:* \`${gid}\`\n` +
            `┃ 👥 *Membros:* ${membros}\n` +
            `┃ 👑 *Criador:* ${criador}\n` +
            `┃ 🔗 *Link:* ${link || "_indisponível_"}\n` +
            `┃ ⏰ *Expira em:* ${expira}`
          );
        }

        const texto =
          `💰 *ALUGUÉIS ATIVOS*\n\n` +
          `> Global: *${dados.global ? "🔒 ON" : "🔓 OFF"}*\n` +
          `> Total: *${entradas.length}*\n\n` +
          blocos.join("\n\n━━━━━━━━━━━━━━━\n\n");

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
          await sock.sendMessage(idChat, { text: "✅ *Entre no grupo!* 🎉" });
        } catch (e) {
          await sock.sendMessage(idChat, {
            text: `❌ *Não consegui entrar!*\n\n> ${e.message}`
          });
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
    if (!alvoMenu) {
      return sock.sendMessage(idChat, {
        text: "❌ Uso: responda foto/vídeo com *!setmenu <menu>*\nEx: `!setmenu menudono`"
      });
    }

    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted || !ctx) {
      return sock.sendMessage(idChat, {
        text: "❌ Responda a uma *foto* ou *vídeo* com *!setmenu <menu>*"
      });
    }

    const tipo = quoted.imageMessage ? "image"
               : quoted.videoMessage ? "video"
               : null;

    if (!tipo) {
      return sock.sendMessage(idChat, { text: "❌ Só aceito foto ou vídeo." });
    }

    try {
      const buffer = await downloadMediaMessage(
        {
          key: { remoteJid: ctx.remoteJid || idChat, id: ctx.stanzaId, fromMe: false },
          message: quoted
        },
        "buffer",
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      const pastaDados = path.join(__dirname, "..", "dados");
      fs.mkdirSync(pastaDados, { recursive: true });

      const ext = tipo === "image" ? "jpg" : "mp4";
      const nomeArq = `menu_midia_${alvoMenu}.${ext}`;
      fs.writeFileSync(path.join(pastaDados, nomeArq), buffer);

      const meta = { tipo, arquivo: nomeArq, menu: alvoMenu, salvo: Date.now() };
      fs.writeFileSync(
        path.join(pastaDados, `menu_midia_${alvoMenu}.json`),
        JSON.stringify(meta, null, 2)
      );

      await sock.sendMessage(idChat, {
        text: `✅ *Mídia do menu "${alvoMenu}" salva!* (${tipo})`
      });
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
    for (const f of [
      `menu_midia_${alvoMenu}.json`,
      `menu_midia_${alvoMenu}.jpg`,
      `menu_midia_${alvoMenu}.mp4`
    ]) {
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
    // 🌀 SEM PREFIXO
    // ==============================================
    {
      nome: "addcmdp",
      descricao: "Adiciona comando sem prefixo",
      async executar({ sock, idChat, resto, lerJSON, salvarJSON, ARQUIVO_SEM_PREFIXO }) {
        const nome = (resto || "").trim().toLowerCase();
        if (!nome) {
          return sock.sendMessage(idChat, {
            text: "❌ Uso: *!addcmdp <comando>*\nEx: `!addcmdp ping` → aí `ping` funciona sem prefixo."
          });
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
          text:
            `⚡ *COMANDOS SEM PREFIXO*\n\n` +
            `> Total: *${lista.length}*\n\n` +
            lista.map((c, i) => `┃ ${i + 1}. \`${c}\``).join("\n")
        });
      }
    },

// ==============================================
// 👑 MENU DONO (editável via personalize_aqui/menu_dono.txt)
// ==============================================
{
  nome: "menudono",
  descricao: "Mostra o menu exclusivo do dono",
  async executar({ sock, idChat, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME, msg }) {
    const ARQ = path.join(__dirname, "..", "personalize_aqui", "menu_dono.txt");

    if (!fs.existsSync(ARQ)) {
      return sock.sendMessage(idChat, {
        text: "❌ Arquivo *personalize_aqui/menu_dono.txt* não encontrado!"
      });
    }

    const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    let texto;
    try {
      texto = fs.readFileSync(ARQ, "utf8")
        .replace(/{PREFIXO}/g, PREFIXO || "!")
        .replace(/{BOT}/g, NOME_BOT || "Bot")
        .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
        .replace(/{DATA}/g, data);
    } catch (e) {
      return sock.sendMessage(idChat, { text: `❌ Erro lendo menu: ${e.message}` });
    }

    // 📎 Mídia do menudono
    const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menudono.json");
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
      await sock.sendMessage(idChat, {
        image: midia.buffer,
        caption: texto,
        mentions: [remetente]
      });
    } else if (midia?.meta?.tipo === "video") {
      await sock.sendMessage(idChat, {
        video: midia.buffer,
        caption: texto,
        mentions: [remetente],
        gifPlayback: true
      });
    } else {
      await sock.sendMessage(idChat, { text: texto, mentions: [remetente] });
    }
  }
}
]                    // fecha o array comandos
};                   // fecha o module.exports
