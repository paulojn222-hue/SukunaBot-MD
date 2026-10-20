const fs = require("fs");
const path = require("path");
const config = require("../config.js");

const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");

function lerRPG() {
  try {
    if (!fs.existsSync(ARQ_RPG)) return { usuarios: {}, grupos: {} };
    const d = JSON.parse(fs.readFileSync(ARQ_RPG, "utf8"));
    if (!d.usuarios) d.usuarios = {};
    if (!d.grupos) d.grupos = {};
    return d;
  } catch { return { usuarios: {}, grupos: {} }; }
}

function salvarRPG(dados) {
  try {
    fs.mkdirSync(path.dirname(ARQ_RPG), { recursive: true });
    fs.writeFileSync(ARQ_RPG, JSON.stringify(dados, null, 2));
  } catch (e) { console.log("Erro salvando RPG:", e.message); }
}

function normalizarNumero(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
}

function getUsuario(dados, num) {
  if (!dados.usuarios[num]) {
    dados.usuarios[num] = {
      moedas: 0, xp: 0, nivel: 1, msgs: 0, comandos: 0, jid: null,
      inventario: { picareta: 0, vara_pesca: 0, isca: 0, ficha: 0, bilhete: 0, raspadinha: 0, racao: 0, escudo: 0 },
      escudoEquipado: false,
      banco: { bancoId: null, deposito: 0, totalRendido: 0, ultimoRendimento: Date.now() },
      pets: [], petAtivo: null,
      familia: { pais: [], filhos: [], conjuge: null, pedidos: [], pedidosCasar: [] },
      emprestimo: { ativo: false, valor: 0, pedidoEm: 0, expiraEm: 0, ultimoPedido: 0, jid: null },
      conquistas: { desbloqueadas: [], monstros: 0 },
      ultimoInvestir: 0, ultimoMinerar: 0, ultimoPescar: 0, ultimoJob: 0,
      ultimoCassino: 0, ultimoLoteria: 0, raspadinhasHoje: 0, ultimoDiaRaspadinha: "",
      ultimoMsgsDia: "", ultimoMsgsTotal: 0, roubos: []
    };
  }
  const u = dados.usuarios[num];
  if (!u.inventario) u.inventario = {};
  if (u.inventario.racao === undefined) u.inventario.racao = 0;
  if (!u.banco) u.banco = { bancoId: null, deposito: 0, totalRendido: 0, ultimoRendimento: Date.now() };
  if (!u.pets) u.pets = [];
  if (u.petAtivo === undefined) u.petAtivo = null;
  if (!u.familia) u.familia = { pais: [], filhos: [], conjuge: null, pedidos: [], pedidosCasar: [] };
  if (!u.emprestimo) u.emprestimo = { ativo: false, valor: 0, pedidoEm: 0, expiraEm: 0, ultimoPedido: 0, jid: null };
  if (!u.conquistas) u.conquistas = { desbloqueadas: [], monstros: 0 };
  return u;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function formatarTempo(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const p = [];
  if (h > 0) p.push(`${h}h`);
  if (m > 0) p.push(`${m}m`);
  if (seg > 0 || p.length === 0) p.push(`${seg}s`);
  return p.join(" ");
}

function cooldownRestante(ultimo, cooldownMs) {
  const passou = Date.now() - ultimo;
  if (passou >= cooldownMs) return null;
  return cooldownMs - passou;
}

function xpNecessario(nivel) { return Math.floor(100 * Math.pow(1.15, nivel - 1)); }
function pegarValor(resto) { return parseInt((resto || "").trim().split(/\s+/)[0].replace(/[^\d]/g, "")) || 0; }

const MINERIOS = [
  { nome: "Pedra", valor: 5, raridade: 30 }, { nome: "Carvão", valor: 15, raridade: 25 },
  { nome: "Ferro", valor: 30, raridade: 20 }, { nome: "Ouro", valor: 80, raridade: 12 },
  { nome: "Diamante", valor: 200, raridade: 7 }, { nome: "Esmeralda", valor: 350, raridade: 4 },
  { nome: "Rubi", valor: 600, raridade: 1.5 }, { nome: "Safira", valor: 1200, raridade: 0.4 },
  { nome: "Lendário", valor: 5000, raridade: 0.1 }
];

const PEIXES = [
  { nome: "Sardinha", valor: 8, raridade: 30 }, { nome: "Tilápia", valor: 20, raridade: 25 },
  { nome: "Bagre", valor: 40, raridade: 20 }, { nome: "Tucunaré", valor: 90, raridade: 12 },
  { nome: "Dourado", valor: 250, raridade: 7 }, { nome: "Pintado", valor: 450, raridade: 4 },
  { nome: "Polvo Gigante", valor: 800, raridade: 1.5 }, { nome: "Kraken Baby", valor: 1500, raridade: 0.4 },
  { nome: "Lendário do Mar", valor: 6000, raridade: 0.1 }
];

const JOBS = [
  { nome: "Entregador", valor: [80, 150] }, { nome: "Cozinheiro", valor: [120, 200] },
  { nome: "Programador", valor: [200, 350] }, { nome: "Pintor", valor: [100, 180] },
  { nome: "Músico", valor: [150, 300] }, { nome: "Piloto", valor: [250, 500] }
];

const IMG_MINERAR = ["https://picsum.photos/seed/mine1/600/400", "https://picsum.photos/seed/mine2/600/400"];
const IMG_PESCAR = ["https://picsum.photos/seed/fish1/600/400", "https://picsum.photos/seed/fish2/600/400"];
const IMG_TRABALHO = ["https://picsum.photos/seed/work1/600/400", "https://picsum.photos/seed/work2/600/400"];

function sortearItem(lista) {
  const total = lista.reduce((s, i) => s + i.raridade, 0);
  let r = Math.random() * total;
  for (const item of lista) { r -= item.raridade; if (r <= 0) return item; }
  return lista[0];
}

module.exports = {
  comandos: [

// ==============================================
// 👹 CAÇAR MONSTROS
// ==============================================
{
  nome: "cacar",
  descricao: "Caça monstros no RPG",
  async executar({ sock, idChat, msg, normalizarNumero }) {
    const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
    const dados = lerRPG();
    const u = getUsuario(dados, num);
    
    // Cooldown de 5 minutos (opcional, mas evita spam)
    const ULTIMO_CACAR = u.ultimoCacar || 0;
    const AGORA = Date.now();
    const COOLDOWN = 5 * 60 * 1000;
    
    if (AGORA - ULTIMO_CACAR < COOLDOWN) {
      const falta = COOLDOWN - (AGORA - ULTIMO_CACAR);
      const m = Math.floor(falta / 60000);
      const s = Math.floor((falta % 60000) / 1000);
      return sock.sendMessage(idChat, { text: `⏰ Descanse um pouco! Espere *${m}m ${s}s* pra caçar de novo.` });
    }

    // Sorteio do monstro
    const monstros = [
      { nome: "Slime", xp: 10, moedas: 50 },
      { nome: "Goblin", xp: 20, moedas: 100 },
      { nome: "Lobo", xp: 35, moedas: 200 },
      { nome: "Esqueleto", xp: 50, moedas: 300 },
      { nome: "Troll", xp: 80, moedas: 500 },
      { nome: "Dragão", xp: 200, moedas: 1500 }
    ];
    
    const monstro = monstros[Math.floor(Math.random() * monstros.length)];

    // Dá recompensa
    u.xp = (u.xp || 0) + monstro.xp;
    u.moedas = (u.moedas || 0) + monstro.moedas;
    u.ultimoCacar = AGORA;
    
    // Adiciona na conquista de monstros
    if (!u.conquistas) u.conquistas = { desbloqueadas: [], monstros: 0 };
    u.conquistas.monstros = (u.conquistas.monstros || 0) + 1;

    // Sobe de nível se bater o XP
    const xpNecessario = (n) => Math.floor(100 * Math.pow(1.15, n - 1));
    let xpProx = xpNecessario(u.nivel || 1);
    let subiu = false;
    while (u.xp >= xpProx && (u.nivel || 1) < 70) {
      u.xp -= xpProx;
      u.nivel = (u.nivel || 1) + 1;
      u.moedas += 500;
      xpProx = xpNecessario(u.nivel);
      subiu = true;
    }

    salvarRPG(dados);

    let texto = `⚔️ *CAÇADA!*\n\n> Você lutou contra um *${monstro.nome}* e venceu!\n> ✨ +${monstro.xp} XP\n> 💰 +${monstro.moedas} moedas\n> 👹 Total de monstros: *${u.conquistas.monstros}*`;
    
    if (subiu) texto += `\n\n🎉 *Você subiu para o nível ${u.nivel}!*`;

    await sock.sendMessage(idChat, { text: texto, mentions: [msg.key.participant || msg.key.remoteJid] });
  }
},

// ==============================================
// 📋 MENU RPG
// ==============================================
{
  nome: "menurpg",
  descricao: "Mostra o menu RPG",
  async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME }) {
    const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // 👇 Pega o remetente pra usar no {USER}
    const remetente = msg.key.participant || msg.key.remoteJid;
    const userNumero = String(remetente).split("@")[0].split(":")[0];
    const userMencao = `@${userNumero}`;

    // Carrega o menu_rpg.txt
    let texto = "";
    try {
      texto = fs.readFileSync(path.join(__dirname, "..", "personalize_aqui", "menu_rpg.txt"), "utf8");
    } catch {
      texto = "❌ Arquivo personalize_aqui/menu_rpg.txt não encontrado!";
    }

    // 👇 Substitui as variáveis (agora com {USER})
    texto = texto
      .replace(/{USER}/g, userMencao)
      .replace(/{PREFIXO}/g, PREFIXO || "!")
      .replace(/{BOT}/g, NOME_BOT || "Bot")
      .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
      .replace(/{DATA}/g, data);

    // Verifica se tem mídia salva
    const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menurpg.json");
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
    // MODORPG
    {
      nome: "modorpg",
      descricao: "Ativa/desativa o RPG nesse grupo",
      async executar({ sock, idChat, resto }) {
        if (!idChat.endsWith("@g.us")) return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });
        const op = (resto || "").trim().toLowerCase();
        if (!["on", "off"].includes(op)) return sock.sendMessage(idChat, { text: "❌ Uso: *!modorpg on/off*" });
        const dados = lerRPG();
        if (!dados.grupos[idChat]) dados.grupos[idChat] = {};
        dados.grupos[idChat].modorpg = op === "on";
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: op === "on" ? "✅ *RPG ATIVADO nesse grupo!*" : "❌ *RPG DESATIVADO nesse grupo!*" });
      }
    },

    // SALDO
    {
      nome: "saldo",
      descricao: "Mostra suas moedas",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        salvarRPG(dados);
        const xpProx = xpNecessario(u.nivel);
        await sock.sendMessage(idChat, {
          text: `╭━〔 💰 *SALDO* 〕━╮\n┃\n┃ 👤 @${num}\n┃ 💰 Moedas: *${u.moedas}*\n┃ 🎯 Nível: *${u.nivel}*\n┃ ✨ XP: *${u.xp}* / ${xpProx}\n┃ 💬 Msgs: *${u.msgs}*\n┃ ⚙️ Comandos: *${u.comandos}*\n┃\n╰━━━━━━━━━━━━━━━╯`,
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
      const jid = u.jid || `${num}@s.whatsapp.net`;
      mentions.push(jid);
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
      const jid = u.jid || `${num}@s.whatsapp.net`;
      mentions.push(jid);
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
      const jid = u.jid || `${num}@s.whatsapp.net`;
      mentions.push(jid);
      return `┃ ${medalha} @${num} — 💰 ${u.moedas}`;
    }).join("\n");

    await sock.sendMessage(idChat, { text: `💰 *TOP RICOS*\n\n${linhas}`, mentions });
  }
},

    // INVESTIR
    {
      nome: "investir",
      descricao: "Investe uma quantia",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const valor = pegarValor(resto);
        if (!valor || valor < 50) return sock.sendMessage(idChat, { text: "❌ Uso: *!investir <valor>* (mín 50)" });
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (u.moedas < valor) return sock.sendMessage(idChat, { text: `❌ Você só tem *${u.moedas}* moedas.` });
        const cd = cooldownRestante(u.ultimoInvestir, 3600000);
        if (cd) return sock.sendMessage(idChat, { text: `⏰ Espere *${formatarTempo(cd)}*.` });
        const chance = Math.random();
        let variacao;
        if (chance < 0.4) variacao = rand(-50, 0) / 100;
        else if (chance < 0.75) variacao = rand(0, 40) / 100;
        else variacao = rand(40, 80) / 100;
        const lucro = Math.floor(valor * variacao);
        u.moedas += lucro;
        u.ultimoInvestir = Date.now();
        u.comandos++;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `📈 *INVESTIMENTO*\n\n> Investiu: *${valor}*\n> Resultado: *${lucro >= 0 ? "+" : ""}${lucro}*\n> Saldo: *${u.moedas}*` });
      }
    },

    // ROUBAR
    {
      nome: "roubar",
      descricao: "Tenta roubar alguém",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Marque alguém: *!roubar @user*" });
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const alvoNum = normalizarNumero(alvo);
        if (num === alvoNum) return sock.sendMessage(idChat, { text: "❌ Não pode se roubar." });
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        const v = getUsuario(dados, alvoNum);
        const roubos = (u.roubos || []).filter(r => Date.now() - r < 18000000);
        if (roubos.length >= 5) return sock.sendMessage(idChat, { text: "⏰ Você já roubou 5 pessoas nas últimas 5h." });
        const chanceFalha = v.escudoEquipado ? 0.75 : 0.6;
        if (Math.random() < chanceFalha) {
          const perda = Math.floor(u.moedas * 0.1);
          u.moedas -= perda;
          u.roubos.push(Date.now());
          salvarRPG(dados);
          return sock.sendMessage(idChat, { text: `🚨 *VOCÊ FOI PEGO!*\n\n> Perdeu *${perda}* moedas.`, mentions: [alvo] });
        }
        const roubado = Math.min(v.moedas, rand(50, 500));
        v.moedas -= roubado;
        u.moedas += roubado;
        u.roubos.push(Date.now());
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `🥷 *ROUBO OK!*\n\n> Roubou *${roubado}* de @${alvoNum}`, mentions: [alvo] });
      }
    },

    // MINERAR
    {
      nome: "minerar",
      descricao: "Minera recursos",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.inventario.picareta) return sock.sendMessage(idChat, { text: "❌ Precisa de *picareta*. Compre com *!comprar picareta 1*." });
        const cd = cooldownRestante(u.ultimoMinerar, 1800000);
        if (cd) return sock.sendMessage(idChat, { text: `⏰ Espere *${formatarTempo(cd)}*.` });
        const item = sortearItem(MINERIOS);
        u.inventario[`min_${item.nome}`] = (u.inventario[`min_${item.nome}`] || 0) + 1;
        u.ultimoMinerar = Date.now();
        u.xp += 5;
        salvarRPG(dados);
        try {
          await sock.sendMessage(idChat, { image: { url: IMG_MINERAR[0] }, caption: `⛏️ *MINERAÇÃO*\n\n> Encontrou: *${item.nome}*\n> Valor: *${item.valor}*\n> +5 XP` });
        } catch {
          await sock.sendMessage(idChat, { text: `⛏️ Encontrou *${item.nome}* (valor: ${item.valor})` });
        }
      }
    },

    // PESCAR
    {
      nome: "pescar",
      descricao: "Pesca recursos",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.inventario.vara_pesca) return sock.sendMessage(idChat, { text: "❌ Precisa de *vara*. Compre com *!comprar vara_pesca 1*." });
        if (u.inventario.isca <= 0) return sock.sendMessage(idChat, { text: "❌ Precisa de *isca*. Compre com *!comprar isca 10*." });
        const cd = cooldownRestante(u.ultimoPescar, 3600000);
        if (cd) return sock.sendMessage(idChat, { text: `⏰ Espere *${formatarTempo(cd)}*.` });
        const item = sortearItem(PEIXES);
        u.inventario[`peixe_${item.nome}`] = (u.inventario[`peixe_${item.nome}`] || 0) + 1;
        u.inventario.isca -= 1;
        u.ultimoPescar = Date.now();
        u.xp += 8;
        salvarRPG(dados);
        try {
          await sock.sendMessage(idChat, { image: { url: IMG_PESCAR[0] }, caption: `🎣 *PESCARIA*\n\n> Pescoou: *${item.nome}*\n> Valor: *${item.valor}*\n> Iscas: *${u.inventario.isca}*\n> +8 XP` });
        } catch {
          await sock.sendMessage(idChat, { text: `🎣 Pescoou *${item.nome}* (valor: ${item.valor})` });
        }
      }
    },

    // JOB
    {
      nome: "job",
      descricao: "Trabalha e ganha moedas",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        const cd = cooldownRestante(u.ultimoJob, 5400000);
        if (cd) return sock.sendMessage(idChat, { text: `⏰ Espere *${formatarTempo(cd)}*.` });
        const job = JOBS[Math.floor(Math.random() * JOBS.length)];
        const ganho = rand(job.valor[0], job.valor[1]);
        u.moedas += ganho;
        u.ultimoJob = Date.now();
        u.xp += 10;
        salvarRPG(dados);
        try {
          await sock.sendMessage(idChat, { image: { url: IMG_TRABALHO[0] }, caption: `💼 *TRABALHO*\n\n> Profissão: *${job.nome}*\n> Ganhou: *${ganho}*\n> +10 XP` });
        } catch {
          await sock.sendMessage(idChat, { text: `💼 Trabalhou como *${job.nome}* e ganhou *${ganho}*!` });
        }
      }
    },

    // CASSINO
    {
      nome: "cassino",
      descricao: "Aposta no cassino",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const valor = pegarValor(resto);
        if (!valor || valor < 10) return sock.sendMessage(idChat, { text: "❌ Uso: *!cassino <valor>* (mín 10)" });
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (u.inventario.ficha <= 0) return sock.sendMessage(idChat, { text: "❌ Precisa de *ficha*. Compre com *!comprar ficha 1*." });
        if (u.moedas < valor) return sock.sendMessage(idChat, { text: `❌ Você só tem *${u.moedas}*.` });
        const cd = cooldownRestante(u.ultimoCassino, 7200000);
        if (cd) return sock.sendMessage(idChat, { text: `⏰ Espere *${formatarTempo(cd)}*.` });
        u.inventario.ficha -= 1;
        u.ultimoCassino = Date.now();
        if (Math.random() < 0.1) {
          const premio = Math.floor(valor * 2.5);
          u.moedas += premio;
          salvarRPG(dados);
          await sock.sendMessage(idChat, { text: `🎰 *CASSINO*\n\n> 🎉 *GANHOU!*\n> Recebeu: *${premio}*\n> Saldo: *${u.moedas}*` });
        } else {
          u.moedas -= valor;
          salvarRPG(dados);
          await sock.sendMessage(idChat, { text: `🎰 *CASSINO*\n\n> 😢 *PERDEU!*\n> Perdeu: *${valor}*\n> Saldo: *${u.moedas}*` });
        }
      }
    },

    // LOTERIA
    {
      nome: "loteria",
      descricao: "Aposta na loteria",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const nums = (resto || "").trim().split(/\s+/).map(n => parseInt(n)).filter(n => n >= 1 && n <= 10);
        if (nums.length !== 3) return sock.sendMessage(idChat, { text: "🎟️ Escolha 3 números de 1 a 10.\nEx: *!loteria 3 7 10*" });
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (u.inventario.bilhete <= 0) return sock.sendMessage(idChat, { text: "❌ Precisa de *bilhete*. Compre com *!comprar bilhete 1*." });
        const cd = cooldownRestante(u.ultimoLoteria, 43200000);
        if (cd) return sock.sendMessage(idChat, { text: `⏰ Espere *${formatarTempo(cd)}*.` });
        u.inventario.bilhete -= 1;
        u.ultimoLoteria = Date.now();
        const sorteados = [rand(1, 10), rand(1, 10), rand(1, 10)];
        const acertos = nums.filter(n => sorteados.includes(n)).length;
        let premio = 0;
        if (acertos === 3) premio = 50000;
        else if (acertos === 2) premio = 5000;
        else if (acertos === 1) premio = 500;
        u.moedas += premio;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `🎟️ *LOTERIA*\n\n> Seus: *${nums.join(", ")}*\n> Sorteados: *${sorteados.join(", ")}*\n> Acertos: *${acertos}/3*\n\n> Prêmio: *${premio}*\n> Saldo: *${u.moedas}*` });
      }
    },

    // RASPADINHA
    {
      nome: "raspadinha",
      descricao: "Raspa uma raspadinha",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (u.inventario.raspadinha <= 0) return sock.sendMessage(idChat, { text: "❌ Precisa de *raspadinha*. Compre com *!comprar raspadinha 1*." });
        const hoje = new Date().toDateString();
        if (u.ultimoDiaRaspadinha !== hoje) { u.ultimoDiaRaspadinha = hoje; u.raspadinhasHoje = 0; }
        if (u.raspadinhasHoje >= 3) return sock.sendMessage(idChat, { text: "⏰ Já raspou 3 hoje. Volte amanhã." });
        u.inventario.raspadinha -= 1;
        u.raspadinhasHoje += 1;
        const premio = rand(100, 1000);
        u.moedas += premio;
        u.xp += 3;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `🎫 *RASPADINHA*\n\n> 🎉 Ganhou *${premio}* moedas!\n> Hoje: *${u.raspadinhasHoje}/3*` });
      }
    },

// MOCHILA (Adaptada com Sementes e Jardim)
{
  nome: "mochila",
  descricao: "Mostra seu inventário",
  async executar({ sock, idChat, msg, normalizarNumero }) {
    const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
    const dados = lerRPG();
    const u = getUsuario(dados, num);
    salvarRPG(dados);
    const inv = u.inventario;
    
    const itens = [];
    const sementes = [];
    
    // 🔹 Itens Básicos
    if (inv.picareta) itens.push(`⛏️ Picareta: ${inv.picareta}`);
    if (inv.vara_pesca) itens.push(`🎣 Vara: ${inv.vara_pesca}`);
    if (inv.isca) itens.push(`🪱 Isca: ${inv.isca}`);
    if (inv.ficha) itens.push(`🎰 Ficha: ${inv.ficha}`);
    if (inv.bilhete) itens.push(`🎟️ Bilhete: ${inv.bilhete}`);
    if (inv.raspadinha) itens.push(`🎫 Raspadinha: ${inv.raspadinha}`);
    if (inv.racao) itens.push(`🍖 Ração: ${inv.racao}`);
    if (inv.escudo) itens.push(`🛡️ Escudo: ${inv.escudo}`);
    
    // 🔹 Minérios e Peixes
    for (const [k, v] of Object.entries(inv)) {
      if (k.startsWith("min_")) itens.push(`⛏️ ${k.replace("min_", "")}: ${v}`);
      if (k.startsWith("peixe_")) itens.push(`🐟 ${k.replace("peixe_", "")}: ${v}`);
    }

// 🔹 Sementes (Jardinagem)
for (const [k, v] of Object.entries(inv)) {
  if (k.startsWith("semente_") && v > 0) {
    sementes.push(`🌱 ${k.replace("semente_", "")}: ${v}`);
  }
}

// 🔹 Plantas Colhidas (Jardinagem)
for (const [k, v] of Object.entries(inv)) {
  if (k.startsWith("colheita_") && v > 0) {
    // Troca o underline por espaço pra ficar bonito (ex: Dourada_Melancia -> Dourada Melancia)
    const nomeBonito = k.replace("colheita_", "").replace(/_/g, " ");
    sementes.push(`🧺 ${nomeBonito}: ${v}`);
  }
}
    let texto = `🎒 *MOCHILA*\n\n> 👤 @${num}\n> 💰 Moedas: *${u.moedas}*\n\n`;
    
    if (itens.length > 0) {
      texto += `*🎒 ITENS GERAIS:*\n${itens.join("\n")}\n\n`;
    }
    
    if (sementes.length > 0) {
      texto += `*🌱 SEMENTES:*\n${sementes.join("\n")}\n\n`;
    }
    
    // Verifica se o jardim tem plantas crescendo
    const plantasJardim = Object.keys(u.jardim?.plantas || {});
    if (plantasJardim.length > 0) {
      texto += `*🪴 NO JARDIM:*\n`;
      plantasJardim.forEach(p => texto += `- ${p} (usar *!jardin*)\n`);
    }

    if (itens.length === 0 && sementes.length === 0 && plantasJardim.length === 0) {
      texto += "_Mochila Vazia_";
    }

    await sock.sendMessage(idChat, { text: texto, mentions: [msg.key.participant || msg.key.remoteJid] });
  }
},
    // LOJA
    {
      nome: "loja",
      descricao: "Mostra a loja",
      async executar({ sock, idChat }) {
        await sock.sendMessage(idChat, { text: `╭━〔 🛒 *LOJA RPG* 〕━╮\n┃\n┃ ⛏️ Picareta — *50*\n┃ 🎣 Vara de pesca — *50*\n┃ 🪱 Isca — *2* cada\n┃ 🎰 Ficha — *30*\n┃ 🎟️ Bilhete — *20*\n┃ 🎫 Raspadinha — *25*\n┃ 🍖 Ração — *10*\n┃ 🛡️ Escudo — *200*\n┃\n┃ Use: *!comprar <item> <qtd>*\n╰━━━━━━━━━━━━━━━╯` });
      }
    },

    // COMPRAR
    {
      nome: "comprar",
      descricao: "Compra itens da loja",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const partes = (resto || "").trim().toLowerCase().split(/\s+/);
        const item = partes[0];
        const qtd = parseInt(partes[1]) || 1;
        const PRECOS = { picareta: 50, vara: 50, vara_pesca: 50, isca: 2, iscas: 2, ficha: 30, fichas: 30, bilhete: 20, bilhetes: 20, raspadinha: 25, raspadinhas: 25, racao: 10, racoes: 10, escudo: 200 };
        const preco = PRECOS[item];
        if (!preco) return sock.sendMessage(idChat, { text: "❌ Item inválido. Veja *!loja*." });
        const total = preco * qtd;
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (u.moedas < total) return sock.sendMessage(idChat, { text: `❌ Precisa de *${total}*. Só tem *${u.moedas}*.` });
        let chave = item;
        if (item === "vara" || item === "vara_pesca") chave = "vara_pesca";
        if (item === "iscas") chave = "isca";
        if (item === "fichas") chave = "ficha";
        if (item === "bilhetes") chave = "bilhete";
        if (item === "raspadinhas") chave = "raspadinha";
        if (item === "racoes") chave = "racao";
        u.moedas -= total;
        u.inventario[chave] = (u.inventario[chave] || 0) + qtd;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `✅ Comprou *${qtd}x ${chave}* por *${total}*.\nSaldo: *${u.moedas}*` });
      }
    },

    // EQUIPAR
    {
      nome: "equipar",
      descricao: "Equipa um item",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const item = (resto || "").trim().toLowerCase();
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (item === "escudo") {
          if (u.inventario.escudo <= 0) return sock.sendMessage(idChat, { text: "❌ Não tem escudo." });
          u.escudoEquipado = true;
          salvarRPG(dados);
          return sock.sendMessage(idChat, { text: "🛡️ *Escudo equipado!* (25% proteção)" });
        }
        return sock.sendMessage(idChat, { text: "❌ Use: *!equipar escudo*" });
      }
    },

    // VENDER
    {
      nome: "vender",
      descricao: "Vende recursos",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const nome = (resto || "").trim();
        if (!nome) return sock.sendMessage(idChat, { text: "❌ Uso: *!vender <nome>*" });
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        const itemMin = MINERIOS.find(m => m.nome.toLowerCase() === nome.toLowerCase());
        const itemPeixe = PEIXES.find(p => p.nome.toLowerCase() === nome.toLowerCase());
        let chave, valorTotal, quantidade;
        if (itemMin) { chave = `min_${itemMin.nome}`; quantidade = u.inventario[chave] || 0; valorTotal = itemMin.valor; }
        else if (itemPeixe) { chave = `peixe_${itemPeixe.nome}`; quantidade = u.inventario[chave] || 0; valorTotal = itemPeixe.valor; }
        else return sock.sendMessage(idChat, { text: "❌ Item não encontrado." });
        if (quantidade <= 0) return sock.sendMessage(idChat, { text: `❌ Não tem *${nome}*.` });
        const ganho = valorTotal * quantidade;
        u.moedas += ganho;
        u.inventario[chave] = 0;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `💎 Vendeu *${quantidade}x ${nome}* por *${ganho}*!\nSaldo: *${u.moedas}*` });
      }
    },

    // DOAR
    {
      nome: "doar",
      descricao: "Doa moedas",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Uso: *!doar <valor> @user*" });
        const valor = pegarValor(resto);
        if (!valor) return sock.sendMessage(idChat, { text: "❌ Valor inválido." });
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const alvoNum = normalizarNumero(alvo);
        if (num === alvoNum) return sock.sendMessage(idChat, { text: "❌ Não pode doar pra si." });
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        const v = getUsuario(dados, alvoNum);
        if (u.moedas < valor) return sock.sendMessage(idChat, { text: `❌ Só tem *${u.moedas}*.` });
        u.moedas -= valor;
        v.moedas += valor;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `🎁 @${num} doou *${valor}* pra @${alvoNum}!`, mentions: [msg.key.participant || msg.key.remoteJid, alvo] });
      }
    },

    // PIX
    {
      nome: "pix",
      descricao: "Faz um pix",
      async executar({ sock, idChat, msg, resto, normalizarNumero, NOME_BOT }) {
        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Uso: *!pix <valor> @user*" });
        const valor = pegarValor(resto);
        if (!valor) return sock.sendMessage(idChat, { text: "❌ Valor inválido." });
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const alvoNum = normalizarNumero(alvo);
        if (num === alvoNum) return sock.sendMessage(idChat, { text: "❌ Não pode fazer pix pra si." });
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        const v = getUsuario(dados, alvoNum);
        if (u.moedas < valor) return sock.sendMessage(idChat, { text: `❌ Só tem *${u.moedas}*.` });
        u.moedas -= valor;
        v.moedas += valor;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `💸 *COMPROVANTE PIX*\n\n> De: @${num}\n> Para: @${alvoNum}\n> Valor: *${valor}*\n> Status: *CONCLUÍDO*\n\n> 🏦 ${NOME_BOT}`, mentions: [msg.key.participant || msg.key.remoteJid, alvo] });
      }
    },

    // ADDMOEDAS (DONO)
    {
      nome: "addmoedas",
      descricao: "Adiciona moedas a alguém",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Uso: *!addmoedas <valor> @user*" });
        const valor = pegarValor(resto);
        if (!valor) return sock.sendMessage(idChat, { text: "❌ Valor inválido." });
        const alvoNum = normalizarNumero(alvo);
        const dados = lerRPG();
        const v = getUsuario(dados, alvoNum);
        v.moedas += valor;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `👑 Adicionado *${valor}* pra @${alvoNum}.\nSaldo: *${v.moedas}*`, mentions: [alvo] });
      }
    },

    // DELMOEDAS (DONO)
    {
      nome: "delmoedas",
      descricao: "Remove moedas de alguém",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Uso: *!delmoedas <valor> @user*" });
        const valor = pegarValor(resto);
        if (!valor) return sock.sendMessage(idChat, { text: "❌ Valor inválido." });
        const alvoNum = normalizarNumero(alvo);
        const dados = lerRPG();
        const v = getUsuario(dados, alvoNum);
        v.moedas = Math.max(0, v.moedas - valor);
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `👑 Removido *${valor}* de @${alvoNum}.\nSaldo: *${v.moedas}*`, mentions: [alvo] });
      }
    }
  ],

// HOOK DE XP/BÔNUS DIÁRIO
async aoReceberMensagem({ idChat, remetente, msg, sock }) {
  try {
    if (!idChat.endsWith("@g.us")) return;
    
    const dados = lerRPG();
    // Só roda se o RPG tiver ativo no grupo
    if (!dados.grupos?.[idChat]?.modorpg) return;
    
    const num = normalizarNumero(remetente);
    if (!num) return;
    
    const u = getUsuario(dados, num);
    u.jid = remetente;
    
    const hoje = new Date().toDateString();

    // 🎁 BÔNUS DIÁRIO (1x por dia)
    if (!u.ultimoMsgsDia || u.ultimoMsgsDia !== hoje) {
      const ganhoMoedas = Math.floor(Math.random() * (500 - 300 + 1)) + 300; // 300 a 500
      const ganhoXP = Math.floor(Math.random() * (15 - 5 + 1)) + 5;          // 5 a 15
      
      u.moedas += ganhoMoedas;
      u.xp += ganhoXP;
      u.ultimoMsgsDia = hoje;
      
      try {
        await sock.sendMessage(idChat, {
          text: `🎁 *BÔNUS DIÁRIO!*\n\n> +*${ganhoMoedas}* moedas\n> +*${ganhoXP}* XP\n\n> 👤 @${num}`,
          mentions: [remetente]
        });
      } catch {}
    }

    u.msgs++;
    // XP por mensagem normal (sem ser o bônus diário)
    u.xp += 2; 
    
    // Verifica level up
    let xpProx = xpNecessario(u.nivel);
    let subiu = false;
    while (u.xp >= xpProx && u.nivel < 70) {
      u.xp -= xpProx;
      u.nivel++;
      u.moedas += 500; // Bônus de level up
      xpProx = xpNecessario(u.nivel);
      subiu = true;
    }
    
    salvarRPG(dados);
    
    if (subiu) {
      try {
        await sock.sendMessage(idChat, {
          text: `🎉 @${num} subiu pro *nível ${u.nivel}*!\n💰 +500 moedas de bônus!`,
          mentions: [remetente]
        });
      } catch {}
    }
  } catch (e) {
    console.log("Erro hook RPG:", e.message);
  }
}
};
