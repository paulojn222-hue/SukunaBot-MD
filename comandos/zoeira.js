const fs = require("fs");
const path = require("path");

const DIR_PERSONALIZE = path.join(__dirname, "..", "personalize_aqui");
const DIR_DADOS = path.join(__dirname, "..", "dados");
const ARQ_MENU = path.join(DIR_PERSONALIZE, "menuzoeiro.txt");
const DIR_GIFS = path.join(DIR_PERSONALIZE, "gifs_zoeira");

// ==============================================
// 🎞️ GIFS
// Opção 1: coloque arquivos .mp4 em personalize_aqui/gifs_zoeira/
//          com o nome da ação: tomate.mp4, tomate2.mp4, tomate3.mp4 ...
//          (o bot sorteia um deles)
// Opção 2: coloque links DIRETOS de .mp4 aqui embaixo:
// ==============================================
const URLS_GIFS = {
  // tomate: ["https://site.com/tomate1.mp4", "https://site.com/tomate2.mp4"],
  // bicuda: [],
};

// ==============================================
// 🎭 AÇÕES  ({A} = quem fez, {B} = alvo)
// ==============================================
const GRUPO_ALVO = {
  tomate: { emoji: "🍅", frases: [
    "{A} tacou um tomate podre em {B} 🍅💥",
    "🍅 SPLASH! {A} arremessou um tomate podre bem na fuça de {B}",
    "{B} virou molho de tomate depois do arremesso de {A} 🍝"
  ]},
  bicuda: { emoji: "🦶", frases: [
    "{A} deu uma bicuda digna de Copa do Mundo em {B} ⚽💀",
    "{B} saiu voando depois da bicuda de {A} 🚀",
    "{A} bicou {B} pro meio do campo e ainda comemorou 🏟️"
  ]},
  tapa: { emoji: "👋", frases: [
    "{A} deu um tapa estalado em {B}, até o grupo ouviu 👋😳",
    "{B} ficou com a cara virada depois do tapa de {A} 🙃",
    "O tapa de {A} em {B} ecoou por 3 dias 📢"
  ]},
  soco: { emoji: "👊", frases: [
    "{A} socou {B} com a força de mil búfalos 🦬👊",
    "{A} deu um soco em {B} e a vizinhança sentiu 🥊",
    "{B} levou um soco de {A} e viu estrelinhas ⭐😵"
  ]},
  chute: { emoji: "🦵", frases: [
    "{A} chutou {B} quase pra fora do grupo 🦵",
    "{A} deu uma voadora em {B} 🥋",
    "{B} levou um chute de {A} e rodou 3 vezes no ar 🌀"
  ]},
  empurrar: { emoji: "🫸", frases: [
    "{A} empurrou {B} sem dó nem piedade 🫸",
    "{B} foi empurrado por {A} e caiu de cara no chão 😵",
    "{A} deu um empurrão em {B} e fingiu que não foi nada 😇"
  ]},
  puxar: { emoji: "🫷", frases: [
    "{A} puxou {B} pelo braço pra uma conversa séria 🫷",
    "{A} puxou {B} e não soltou mais 😳",
    "{A} puxou {B} pra dentro da confusão 🌪️"
  ]},
  cutucar: { emoji: "👉", frases: [
    "{A} cutucou {B}. Cutuca, cutuca, cutuca... 👉",
    "{A} não para de cutucar {B}, tenha paciência 😅",
    "{B} foi cutucado por {A} e já está perdendo a paciência 😤"
  ]},
  beliscar: { emoji: "🤏", frases: [
    "{A} deu um beliscão em {B} e deixou roxo 🤏😖",
    "{B} levou um beliscão de {A} e gritou até em Marte 👽",
    "{A} beliscou {B} sem avisar, covardia! 😭"
  ]},
  cosquinha: { emoji: "🤣", frases: [
    "{A} fez cosquinha em {B} até faltar o ar 🤣",
    "{B} não aguentou as cosquinhas de {A} e rolou de rir 😂",
    "{A} atacou {B} com cosquinhas sem piedade 🫨"
  ]},
  morder: { emoji: "🧛", frases: [
    "{A} deu uma mordida em {B} 🧛",
    "{B} foi mordido por {A}. Alguém chama a vacina da raiva! 🐶💉",
    "{A} mordeu {B} e disse que tava com fome 🍖"
  ]},
  assustar: { emoji: "👻", frases: [
    "{A} deu um susto em {B} que quase perdeu a alma 👻",
    "BUUU! {A} assustou {B} e ele pulou três metros 😱",
    "{B} levou um susto de {A} e ainda tá tremendo 🫨"
  ]},
  zoar: { emoji: "🤡", frases: [
    "{A} zoou {B} sem dó, cuidado que ele vai chorar 🤡😂",
    "{A} tá zoando {B} no maior nível e ninguém salva 💀",
    "{B} virou o assunto da zoeira de {A} 😹"
  ]},
  ignorar: { emoji: "📵", frases: [
    "{A} ignorou {B} totalmente. Visualizou e deixou no vácuo 👀📵",
    "{B} mandou mensagem e {A} só visualizou. Ouch 💔",
    "{A} fingiu que não viu {B} passando 🙈"
  ]},
  jogar: { emoji: "🏀", frases: [
    "{A} jogou {B} pra longe, foi parar em outro estado ✈️",
    "{A} agarrou {B} e arremessou como bola de basquete 🏀",
    "{B} foi arremessado por {A} e ainda tá voando 🚀"
  ]},
  esconder: { emoji: "🙈", frases: [
    "{A} escondeu {B} onde ninguém acha. Cadê? Cadê? 🙈",
    "{A} sumiu com {B} e disse que não viu nada 🤫",
    "{B} foi escondido por {A} dentro do armário 🚪"
  ]}
};

const FRASES_SOZINHO = [
  "{A} fez isso consigo mesmo... precisa de ajuda? 🤡",
  "{A} se atacou sozinho, ninguém merece 💀",
  "{A} resolveu se zoar sozinho, o grupo só observa 👀"
];

// Aqui o alvo é opcional
const GRUPO_DIA = {
  louca: { emoji: "🍽️",
    alvo: ["{A} obrigou {B} a lavar toda a louça da casa 🍽️🧽"],
    solo: ["{A} está lavando a louça, herói sem capa 🍽️✨"] },
  varrer: { emoji: "🧹",
    alvo: ["{A} entregou a vassoura pra {B} e mandou varrer tudo 🧹"],
    solo: ["{A} está varrendo a casa toda, já é de casa 🧹"] },
  cozinhar: { emoji: "🍳",
    alvo: ["{A} cozinhou um banquete pra {B}, que carinho 🍳❤️"],
    solo: ["{A} está cozinhando, o cheirinho já chegou aqui 🍳😋"] },
  lavar: { emoji: "🧼",
    alvo: ["{A} lavou as roupas de {B}, até as meias fedidas 🧦🧼"],
    solo: ["{A} está lavando roupa, que montanha de roupa suja 👕🫧"] },
  passar: { emoji: "👔",
    alvo: ["{A} passou a roupa de {B} e queimou a camisa 🔥👔"],
    solo: ["{A} está passando roupa, sem queimar nada (até agora) 👔♨️"] },
  limpar: { emoji: "✨",
    alvo: ["{A} limpou a bagunça de {B}, até o rodapé brilhou ✨"],
    solo: ["{A} está limpando a casa toda, quem diria 🧽✨"] },
  regar: { emoji: "🌱",
    alvo: ["{A} regou {B} achando que era planta 🌱💦"],
    solo: ["{A} está regando as plantinhas com carinho 🌿💧"] },
  estudar: { emoji: "📚",
    alvo: ["{A} obrigou {B} a estudar até a mente fritar 📚🔥"],
    solo: ["{A} está estudando. Milagre, alguém tira print 📸📚"] },
  dormir: { emoji: "😴",
    alvo: ["{A} colocou {B} pra dormir com uma canção de ninar 😴🎶"],
    solo: ["{A} foi dormir e já está roncando 💤😴"] },
  acordar: { emoji: "⏰",
    alvo: ["{A} acordou {B} com um balde de água fria 🪣⏰"],
    solo: ["{A} acordou com cara de poucos amigos ☕😵"] },
  trabalhar: { emoji: "💼",
    alvo: ["{A} mandou {B} trabalhar, segunda-feira chegou 💼😩"],
    solo: ["{A} está trabalhando duro (ou fingindo) 💼💻"] },
  cochilar: { emoji: "🛌",
    alvo: ["{A} cochilou no ombro de {B}. Que fofura 🛌🥱"],
    solo: ["{A} deu uma cochilada básica, volta já 😪💤"] }
};

// ==============================================
// 🔧 AUXILIARES
// ==============================================
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function normalizar(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
}

// procura gif local (acao.mp4, acao2.mp4...) ou url configurada
function pegarGif(acao) {
  const opcoes = [];
  try {
    if (fs.existsSync(DIR_GIFS)) {
      const re = new RegExp(`^${acao}\\d*\\.mp4$`, "i");
      for (const f of fs.readdirSync(DIR_GIFS)) {
        if (re.test(f)) opcoes.push({ video: fs.readFileSync(path.join(DIR_GIFS, f)) });
      }
    }
  } catch {}
  for (const url of URLS_GIFS[acao] || []) opcoes.push({ video: { url } });
  return opcoes.length ? pick(opcoes) : null;
}

async function enviarAcao(sock, idChat, acao, texto, mentions) {
  const gif = pegarGif(acao);
  if (gif) {
    try {
      return await sock.sendMessage(idChat, { ...gif, gifPlayback: true, caption: texto, mentions });
    } catch (e) {
      console.log(`Erro ao enviar gif de ${acao}:`, e.message);
    }
  }
  return sock.sendMessage(idChat, { text: texto, mentions });
}

function pegarAlvo(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  return ctx?.mentionedJid?.[0] || ctx?.participant || null;
}

function montar(frase, a, b) {
  return frase.replace(/{A}/g, `@${normalizar(a)}`).replace(/{B}/g, b ? `@${normalizar(b)}` : "");
}

// ==============================================
// 📋 MENU
// ==============================================
function carregarMenu() {
  try { return fs.readFileSync(ARQ_MENU, "utf8"); }
  catch { return "❌ Arquivo personalize_aqui/menuzoeiro.txt não encontrado!"; }
}

// imagem/vídeo do menu:
// 1) personalize_aqui/menuzoeira.(jpg|jpeg|png|webp|mp4)
// 2) dados/menu_midia_menuzoeira.json  3) dados/menu_midia_menu.json (igual ao menugame)
function carregarMidiaMenu() {
  const exts = { jpg: "image", jpeg: "image", png: "image", webp: "image", mp4: "video" };
  for (const [ext, tipo] of Object.entries(exts)) {
    const p = path.join(DIR_PERSONALIZE, `menuzoeira.${ext}`);
    try { if (fs.existsSync(p)) return { tipo, buffer: fs.readFileSync(p) }; } catch {}
  }
  for (const nomeMeta of ["menu_midia_menuzoeira.json", "menu_midia_menu.json"]) {
    try {
      const caminhoMeta = path.join(DIR_DADOS, nomeMeta);
      if (!fs.existsSync(caminhoMeta)) continue;
      const meta = JSON.parse(fs.readFileSync(caminhoMeta, "utf8"));
      if (meta && typeof meta.arquivo === "string") {
        const arq = path.join(DIR_DADOS, meta.arquivo);
        if (fs.existsSync(arq)) return { tipo: meta.tipo, buffer: fs.readFileSync(arq) };
      }
    } catch {}
  }
  return null;
}

async function executarMenu({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME }) {
  const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const texto = carregarMenu()
    .replace(/{PREFIXO}/g, PREFIXO || "!")
    .replace(/{BOT}/g, NOME_BOT || "Bot")
    .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
    .replace(/{DATA}/g, data);

  const midia = carregarMidiaMenu();
  const remetente = msg.key.participant || msg.key.remoteJid;

  if (midia?.tipo === "image") {
    await sock.sendMessage(idChat, { image: midia.buffer, caption: texto, mentions: [remetente] });
  } else if (midia?.tipo === "video") {
    await sock.sendMessage(idChat, { video: midia.buffer, caption: texto, mentions: [remetente], gifPlayback: true });
  } else {
    await sock.sendMessage(idChat, { text: texto, mentions: [remetente] });
  }
}

// ==============================================
// 🎮 COMANDOS
// ==============================================
const comandosAlvo = Object.entries(GRUPO_ALVO).map(([nome, cfg]) => ({
  nome,
  descricao: `${cfg.emoji} Ação: ${nome} (marque ou responda alguém)`,
  async executar({ sock, idChat, msg, PREFIXO }) {
    const remetente = msg.key.participant || msg.key.remoteJid;
    const alvo = pegarAlvo(msg);

    if (!alvo) {
      return sock.sendMessage(idChat, {
        text: `${cfg.emoji} Marque alguém ou responda a mensagem dele!\n> Ex: *${PREFIXO || "!"}${nome} @fulano*`
      });
    }

    const mesmo = normalizar(alvo) === normalizar(remetente);
    const frase = mesmo ? pick(FRASES_SOZINHO) : pick(cfg.frases);
    await enviarAcao(sock, idChat, nome, montar(frase, remetente, alvo), [remetente, alvo]);
  }
}));

const comandosDia = Object.entries(GRUPO_DIA).map(([nome, cfg]) => ({
  nome,
  descricao: `${cfg.emoji} Ação do dia a dia: ${nome} (alvo opcional)`,
  async executar({ sock, idChat, msg }) {
    const remetente = msg.key.participant || msg.key.remoteJid;
    const alvo = pegarAlvo(msg);
    const comAlvo = alvo && normalizar(alvo) !== normalizar(remetente);

    const frase = comAlvo ? pick(cfg.alvo) : pick(cfg.solo);
    await enviarAcao(sock, idChat, nome, montar(frase, remetente, comAlvo ? alvo : null),
      comAlvo ? [remetente, alvo] : [remetente]);
  }
}));

module.exports = {
  comandos: [
    { nome: "menuzoeira", descricao: "Menu de zoeira", executar: executarMenu },
    { nome: "menuzoeiro", descricao: "Menu de zoeira", executar: executarMenu },
    ...comandosAlvo,
    ...comandosDia
  ]
};

