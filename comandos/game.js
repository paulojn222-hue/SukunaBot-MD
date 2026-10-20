const fs = require("fs");
const path = require("path");

const ARQ_GAMES = path.join(__dirname, "..", "dados", "games.json");
const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");
const ARQ_MENU_GAME = path.join(__dirname, "..", "personalize_aqui", "menu_game.txt");

// ==============================================
// 💾 PERSISTÊNCIA
// ==============================================
function lerGames() {
  try {
    if (!fs.existsSync(ARQ_GAMES)) return { jogos: {} };
    return JSON.parse(fs.readFileSync(ARQ_GAMES, "utf8"));
  } catch { return { jogos: {} }; }
}

function salvarGames(d) {
  try {
    fs.mkdirSync(path.dirname(ARQ_GAMES), { recursive: true });
    fs.writeFileSync(ARQ_GAMES, JSON.stringify(d, null, 2));
  } catch (e) { console.log("Erro games:", e.message); }
}

function lerRPG() {
  try {
    if (!fs.existsSync(ARQ_RPG)) return { usuarios: {} };
    return JSON.parse(fs.readFileSync(ARQ_RPG, "utf8"));
  } catch { return { usuarios: {} }; }
}

function salvarRPG(d) {
  try { fs.writeFileSync(ARQ_RPG, JSON.stringify(d, null, 2)); } catch {}
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function darMoedas(num, quantia) {
  const rpg = lerRPG();
  if (!rpg.usuarios[num]) rpg.usuarios[num] = { moedas: 0 };
  rpg.usuarios[num].moedas = (rpg.usuarios[num].moedas || 0) + quantia;
  salvarRPG(rpg);
}

// 👇 Normaliza número — remove tudo que não for dígito
function normalizar(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
}

// 👇 Retorna o JID completo pra mencionar (usa @lid se for LID)
function jidMencao(remetente) {
  if (!remetente) return "";
  // Se já é um JID completo (@lid ou @s.whatsapp.net), usa como tá
  if (remetente.includes("@")) return remetente;
  // Senão, monta com @s.whatsapp.net
  return `${remetente}@s.whatsapp.net`;
}

// ==============================================
// 🎮 BANCO DE DADOS DOS JOGOS
// ==============================================
const PALAVRAS_FORCA = [
  { p: "ELEFANTE", dica: "Animal grande com tromba" },
  { p: "GIRAFA", dica: "Animal de pescoço longo" },
  { p: "MONTANHA", dica: "Elevação natural de terreno" },
  { p: "BICICLETA", dica: "Veículo de duas rodas" },
  { p: "CHOCOLATE", dica: "Doce feito de cacau" },
  { p: "PRAIA", dica: "Lugar com areia e mar" },
  { p: "PIPOCA", dica: "Petisco de cinema" },
  { p: "BORBOLETA", dica: "Inseto colorido que voa" },
  { p: "ASTRONAUTA", dica: "Viaja pro espaço" },
  { p: "COMPUTADOR", dica: "Máquina eletrônica" },
  { p: "TARTARUGA", dica: "Animal lento com casco" },
  { p: "SORVETE", dica: "Sobremesa gelada" },
  { p: "BIBLIOTECA", dica: "Lugar cheio de livros" },
  { p: "GIRASSOL", dica: "Flor que segue o sol" },
  { p: "DINOSSAURO", dica: "Animal pré-histórico" }
];

const QUIZ = [
  { p: "Qual é a capital do Brasil?", r: "brasilia" },
  { p: "Quanto é 7 x 8?", r: "56" },
  { p: "Qual animal é conhecido como rei da selva?", r: "leao" },
  { p: "Qual é o maior planeta do sistema solar?", r: "jupiter" },
  { p: "Quantos lados tem um triângulo?", r: "3" },
  { p: "Qual é a cor do céu em um dia limpo?", r: "azul" },
  { p: "Quantos continentes existem?", r: "7" },
  { p: "Qual é o maior oceano do mundo?", r: "pacifico" },
  { p: "Quem pintou a Mona Lisa?", r: "davinci" },
  { p: "Qual é a moeda do Japão?", r: "iene" }
];

const PAISES = [
  { nome: "Brasil", bandeira: "🇧🇷" },
  { nome: "Estados Unidos", bandeira: "🇺🇸" },
  { nome: "Japão", bandeira: "🇯🇵" },
  { nome: "França", bandeira: "🇫🇷" },
  { nome: "Itália", bandeira: "🇮🇹" },
  { nome: "Alemanha", bandeira: "🇩🇪" },
  { nome: "Argentina", bandeira: "🇦🇷" },
  { nome: "Portugal", bandeira: "🇵🇹" },
  { nome: "Canadá", bandeira: "🇨🇦" },
  { nome: "Austrália", bandeira: "🇦🇺" },
  { nome: "México", bandeira: "🇲🇽" },
  { nome: "China", bandeira: "🇨🇳" }
];

const QUIZ_SOU_EU = [
  { dica: "Sou conhecido por ser o rei da selva.", resp: "leao" },
  { dica: "Tenho tromba e orelhas grandes.", resp: "elefante" },
  { dica: "Sou o maior animal do mundo.", resp: "baleia" },
  { dica: "Vivo na água e tenho 8 tentáculos.", resp: "polvo" },
  { dica: "Sou famoso por ser o melhor amigo do homem.", resp: "cachorro" },
  { dica: "Tenho pescoço longo e manchas.", resp: "girafa" },
  { dica: "Sou o animal mais rápido do mundo.", resp: "guepardo" },
  { dica: "Sou conhecido por roubar queijo.", resp: "rato" },
  { dica: "Sou o único mamífero que voa.", resp: "morcego" },
  { dica: "Tenho listras e sou da família dos felinos.", resp: "tigre" }
];

const PALAVRAS_CACA = [
  "GATO", "CASA", "BOLA", "MESA", "PATO", "LIVRO", "CARRO", "FLOR",
  "PEIXE", "SOL", "LUA", "MAR", "PAO", "UVA", "MOTO", "AVIAO",
  "PORTA", "JANELA", "CHUVA", "NUVEM", "ARVORE", "FACA", "COPO", "SAPO"
];

// ==============================================
// 📄 MENU GAME
// ==============================================
function carregarMenuGame() {
  try {
    return fs.readFileSync(ARQ_MENU_GAME, "utf8");
  } catch {
    return "❌ Arquivo personalize_aqui/menu_game.txt não encontrado!";
  }
}

// ==============================================
// 🎯 HELPERS DE JOGO
// ==============================================
function novoJogo(idChat, tipo, dados = {}) {
  const games = lerGames();
  games.jogos[idChat] = { tipo, criado: Date.now(), ...dados };
  salvarGames(games);
}

function getJogo(idChat) {
  const games = lerGames();
  return games.jogos[idChat] || null;
}

function encerrarJogo(idChat) {
  const games = lerGames();
  delete games.jogos[idChat];
  salvarGames(games);
}

function gerarCacaPalavras() {
  const TAM = 10;
  const tab = Array.from({ length: TAM }, () => Array(TAM).fill("·"));
  const palavras = [];

  const pool = [...PALAVRAS_CACA].sort(() => Math.random() - 0.5);
  const escolhidas = pool.slice(0, 5);

  for (const palavra of escolhidas) {
    let colocada = false;
    let tentativas = 0;

    while (!colocada && tentativas < 50) {
      tentativas++;
      const direcao = Math.random() < 0.5 ? "H" : "V";
      const linha = Math.floor(Math.random() * TAM);
      const col = Math.floor(Math.random() * TAM);

      if (direcao === "H") {
        if (col + palavra.length > TAM) continue;
        let ok = true;
        for (let i = 0; i < palavra.length; i++) {
          if (tab[linha][col + i] !== "·") { ok = false; break; }
        }
        if (ok) {
          for (let i = 0; i < palavra.length; i++) tab[linha][col + i] = palavra[i];
          palavras.push({ p: palavra, linha, col, direcao });
          colocada = true;
        }
      } else {
        if (linha + palavra.length > TAM) continue;
        let ok = true;
        for (let i = 0; i < palavra.length; i++) {
          if (tab[linha + i][col] !== "·") { ok = false; break; }
        }
        if (ok) {
          for (let i = 0; i < palavra.length; i++) tab[linha + i][col] = palavra[i];
          palavras.push({ p: palavra, linha, col, direcao });
          colocada = true;
        }
      }
    }
  }

  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < TAM; i++) {
    for (let j = 0; j < TAM; j++) {
      if (tab[i][j] === "·") {
        tab[i][j] = letras[Math.floor(Math.random() * letras.length)];
      }
    }
  }

  return { tab, palavras: palavras.map(p => p.p) };
}

function desenharCaca(tab) {
  let txt = "```\n   " + "ABCDEFGHIJ".split("").map(c => c + " ").join("") + "\n";
  for (let i = 0; i < tab.length; i++) {
    txt += String(i + 1).padStart(2, " ") + " ";
    for (let j = 0; j < tab[i].length; j++) {
      txt += tab[i][j] + " ";
    }
    txt += "\n";
  }
  txt += "```";
  return txt;
}

function desenharForca(erros) {
  const estagios = [
    "```\n  +---+\n      |\n      |\n      |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n      |\n      |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n  |   |\n      |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|   |\n      |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|\\  |\n      |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|\\  |\n /    |\n      |\n      |\n=========```",
    "```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n      |\n=========```"
  ];
  return estagios[Math.min(erros, 6)];
}

function verificarVelha(tab) {
  const linhas = [
    [[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]],
    [[0,0],[1,0],[2,0]], [[0,1],[1,1],[2,1]], [[0,2],[1,2],[2,2]],
    [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
  ];
  for (const l of linhas) {
    const [a, b, c] = l;
    if (tab[a[0]][a[1]] !== "⬜" && tab[a[0]][a[1]] === tab[b[0]][b[1]] && tab[b[0]][b[1]] === tab[c[0]][c[1]]) {
      return tab[a[0]][a[1]];
    }
  }
  if (tab.flat().every(c => c !== "⬜")) return "empate";
  return null;
}

function verificarConecta4(tab) {
  const l = 6, c = 7;
  for (let i = 0; i < l; i++) {
    for (let j = 0; j < c - 3; j++) {
      const v = tab[i][j];
      if (v !== "⬜" && v === tab[i][j+1] && v === tab[i][j+2] && v === tab[i][j+3]) return v;
    }
  }
  for (let i = 0; i < l - 3; i++) {
    for (let j = 0; j < c; j++) {
      const v = tab[i][j];
      if (v !== "⬜" && v === tab[i+1][j] && v === tab[i+2][j] && v === tab[i+3][j]) return v;
    }
  }
  for (let i = 0; i < l - 3; i++) {
    for (let j = 0; j < c - 3; j++) {
      const v = tab[i][j];
      if (v !== "⬜" && v === tab[i+1][j+1] && v === tab[i+2][j+2] && v === tab[i+3][j+3]) return v;
    }
  }
  for (let i = 3; i < l; i++) {
    for (let j = 0; j < c - 3; j++) {
      const v = tab[i][j];
      if (v !== "⬜" && v === tab[i-1][j+1] && v === tab[i-2][j+2] && v === tab[i-3][j+3]) return v;
    }
  }
  return null;
}

module.exports = {
  comandos: [
    // ==============================================
    // 📋 MENU GAME
    // ==============================================
    {
      nome: "menugame",
      descricao: "Mostra o menu de jogos",
      async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME }) {
        const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

        let texto = carregarMenuGame()
          .replace(/{PREFIXO}/g, PREFIXO || "!")
          .replace(/{BOT}/g, NOME_BOT || "Bot")
          .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
          .replace(/{DATA}/g, data);

        const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menugame.json");
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
    },

    // ==============================================
    // ✊ PPT
    // ==============================================
    {
      nome: "ppt",
      descricao: "Pedra, papel e tesoura",
      async executar({ sock, idChat, msg, resto }) {
        const opcoes = ["pedra", "papel", "tesoura"];
        const escolha = (resto || "").trim().toLowerCase();

        if (!opcoes.includes(escolha)) {
          return sock.sendMessage(idChat, { text: "✊ Uso: *!ppt pedra* / *papel* / *tesoura*" });
        }

        const bot = opcoes[Math.floor(Math.random() * 3)];
        let resultado = "";

        if (escolha === bot) resultado = "🤝 *EMPATE!*";
        else if (
          (escolha === "pedra" && bot === "tesoura") ||
          (escolha === "papel" && bot === "pedra") ||
          (escolha === "tesoura" && bot === "papel")
        ) resultado = "🏆 *VOCÊ GANHOU!*";
        else resultado = "😢 *VOCÊ PERDEU!*";

        const emoji = { pedra: "✊", papel: "✋", tesoura: "✌️" };
        const remetente = msg.key.participant || msg.key.remoteJid;

        if (resultado.includes("GANHOU")) {
          const premio = rand(300, 600);
          darMoedas(normalizar(remetente), premio);
          resultado += `\n> 💰 +${premio} moedas`;
        }

        await sock.sendMessage(idChat, {
          text:
            `🎮 *PEDRA PAPEL TESOURA*\n\n` +
            `> 👤 Você: ${emoji[escolha]} ${escolha}\n` +
            `> 🤖 Bot: ${emoji[bot]} ${bot}\n\n` +
            resultado,
          mentions: [remetente]
        });
      }
    },

    // ==============================================
    // 🌍 PAÍS
    // ==============================================
    {
      nome: "pais",
      descricao: "Adivinhe o país pela bandeira",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);

        if (jogo && jogo.tipo === "pais") {
          const resp = (resto || "").trim().toLowerCase();
          const correto = jogo.pais.nome.toLowerCase();

          if (resp === correto) {
            encerrarJogo(idChat);
            const premio = rand(300, 600);
            darMoedas(num, premio);
            return sock.sendMessage(idChat, {
              text: `🎉 *ACERTOU!*\n\n> Era *${jogo.pais.nome}* ${jogo.pais.bandeira}\n> 💰 +${premio} moedas pra @${num}`,
              mentions: [remetente]
            });
          }
          return sock.sendMessage(idChat, { text: `❌ Errou! Tenta de novo: ${jogo.pais.bandeira}` });
        }

        const pais = PAISES[Math.floor(Math.random() * PAISES.length)];
        novoJogo(idChat, "pais", { pais });

        await sock.sendMessage(idChat, {
          text: `🌍 *ADIVINHE O PAÍS*\n\n> Bandeira: *${pais.bandeira}*\n\n> Use: *!pais <nome>*`
        });
      }
    },

    // ==============================================
    // ❓ QUIZ
    // ==============================================
    {
      nome: "quiz",
      descricao: "Quiz de perguntas",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);

        if (jogo && jogo.tipo === "quiz") {
          const resp = (resto || "").trim().toLowerCase().replace(/\s+/g, "");
          const correto = jogo.pergunta.r.toLowerCase();

          if (resp === correto) {
            encerrarJogo(idChat);
            const premio = rand(300, 600);
            darMoedas(num, premio);
            return sock.sendMessage(idChat, {
              text: `🎉 *ACERTOU!*\n\n> 💰 +${premio} moedas pra @${num}`,
              mentions: [remetente]
            });
          }
          return sock.sendMessage(idChat, { text: `❌ Errou!\n\n> ❓ ${jogo.pergunta.p}` });
        }

        const pergunta = QUIZ[Math.floor(Math.random() * QUIZ.length)];
        novoJogo(idChat, "quiz", { pergunta });

        await sock.sendMessage(idChat, {
          text: `❓ *QUIZ*\n\n> ${pergunta.p}\n\n> Use: *!quiz <resposta>*`
        });
      }
    },

    // ==============================================
    // 🕵️ QUEM SOU EU
    // ==============================================
    {
      nome: "quemsoueu",
      descricao: "Adivinhe quem sou eu",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);

        if (jogo && jogo.tipo === "quemsoueu") {
          const resp = (resto || "").trim().toLowerCase();
          const correto = jogo.enigma.resp.toLowerCase();

          if (resp === correto) {
            encerrarJogo(idChat);
            const premio = rand(300, 600);
            darMoedas(num, premio);
            return sock.sendMessage(idChat, {
              text: `🎉 *ACERTOU!*\n\n> Era *${jogo.enigma.resp}*\n> 💰 +${premio} moedas pra @${num}`,
              mentions: [remetente]
            });
          }
          return sock.sendMessage(idChat, { text: `❌ Errou!\n\n> 💭 Dica: ${jogo.enigma.dica}` });
        }

        const enigma = QUIZ_SOU_EU[Math.floor(Math.random() * QUIZ_SOU_EU.length)];
        novoJogo(idChat, "quemsoueu", { enigma });

        await sock.sendMessage(idChat, {
          text: `🕵️ *QUEM SOU EU?*\n\n> 💭 ${enigma.dica}\n\n> Use: *!quemsoueu <resposta>*`
        });
      }
    },

    // ==============================================
    // 🔤 FORCA
    // ==============================================
    {
      nome: "forca",
      descricao: "Jogo da forca",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const letra = (resto || "").trim().toUpperCase();
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);

        if (jogo && jogo.tipo === "forca") {
          if (!/^[A-Z]$/.test(letra)) {
            return sock.sendMessage(idChat, {
              text: `🔤 Digite *uma letra*.\n\n${desenharForca(jogo.erros)}\n> 💭 Dica: _${jogo.dica}_\n> Palavra: \`${jogo.mostrando}\`\n> Erros: ${jogo.erros}/6`
            });
          }

          if (jogo.chutadas.includes(letra)) {
            return sock.sendMessage(idChat, { text: `⚠️ Você já chutou *${letra}*.` });
          }

          jogo.chutadas.push(letra);

          if (jogo.palavra.includes(letra)) {
            let mostrar = "";
            for (const c of jogo.palavra) {
              mostrar += jogo.chutadas.includes(c) ? c : "_";
            }
            jogo.mostrando = mostrar;

            if (!mostrar.includes("_")) {
              const premio = rand(300, 600);
              darMoedas(num, premio);
              encerrarJogo(idChat);
              return sock.sendMessage(idChat, {
                text: `🎉 *GANHOU!*\n\n> Palavra: *${jogo.palavra}*\n> 💰 +${premio} moedas pra @${num}`,
                mentions: [remetente]
              });
            }

            novoJogo(idChat, "forca", jogo);
            return sock.sendMessage(idChat, {
              text: `✅ Acertou *${letra}*!\n\n${desenharForca(jogo.erros)}\n> 💭 Dica: _${jogo.dica}_\n> Palavra: \`${mostrar}\`\n> Erros: ${jogo.erros}/6`
            });
          } else {
            jogo.erros++;
            if (jogo.erros >= 6) {
              encerrarJogo(idChat);
              return sock.sendMessage(idChat, {
                text: `💀 *PERDEU!*\n\n${desenharForca(6)}\n> A palavra era: *${jogo.palavra}*`
              });
            }
            novoJogo(idChat, "forca", jogo);
            return sock.sendMessage(idChat, {
              text: `❌ Errou *${letra}*!\n\n${desenharForca(jogo.erros)}\n> 💭 Dica: _${jogo.dica}_\n> Palavra: \`${jogo.mostrando}\`\n> Erros: ${jogo.erros}/6`
            });
          }
        }

        const item = PALAVRAS_FORCA[Math.floor(Math.random() * PALAVRAS_FORCA.length)];
        const mostrando = item.p.split("").map(() => "_").join("");
        novoJogo(idChat, "forca", { palavra: item.p, dica: item.dica, chutadas: [], erros: 0, mostrando });

        await sock.sendMessage(idChat, {
          text:
            `🔤 *JOGO DA FORCA*\n\n` +
            `${desenharForca(0)}\n` +
            `> 💭 Dica: _${item.dica}_\n` +
            `> Palavra: \`${mostrando}\` (${item.p.length} letras)\n` +
            `> Erros: 0/6\n\n` +
            `> Use: *!forca <letra>*`
        });
      }
    },

    // ==============================================
    // 🔠 ADEDONHA (inicia jogo)
    // ==============================================
    {
      nome: "adedonha",
      descricao: "Adedonha",
      async executar({ sock, idChat }) {
        const jogo = getJogo(idChat);
        if (jogo && jogo.tipo === "adedonha") return;

        const letras = "ABCDEFGHIJLMNOPQRSTUV".split("");
        const letra = letras[Math.floor(Math.random() * letras.length)];

        novoJogo(idChat, "adedonha", {
          letra,
          palavras: {},
          jids: {},
          usadas: [],
          fim: Date.now() + 20000
        });

        await sock.sendMessage(idChat, {
          text:
            `🔠 *ADEDONHA!*\n\n` +
            `> Letra: *${letra}*\n` +
            `> ⏰ Você tem *20 segundos*!\n\n` +
            `> Mande palavras que começam com *${letra}*`
        });

        setTimeout(async () => {
          const jogoFinal = getJogo(idChat);
          if (!jogoFinal || jogoFinal.tipo !== "adedonha" || jogoFinal.letra !== letra) return;

          const vencedores = Object.entries(jogoFinal.palavras || {}).sort((a, b) => b[1] - a[1]);
          encerrarJogo(idChat);

          if (!vencedores.length) {
            return sock.sendMessage(idChat, {
              text: `⏰ *Tempo esgotado!*\n\n> Ninguém participou... 😢`
            });
          }

          let txt = `⏰ *FIM DO TEMPO!*\n\n> Letra: *${letra}*\n\n`;
          const mentions = [];

          for (const [num, qtd] of vencedores.slice(0, 3)) {
            const premio = Math.min(600, 300 + qtd * 30);
            darMoedas(num, premio);
            // 👇 Usa o JID salvo no jogo
            const jid = jogoFinal.jids[num] || `${num}@s.whatsapp.net`;
            mentions.push(jid);
            txt += `┃ @${num} — *${qtd}* palavras → 💰 +${premio}\n`;
          }

          await sock.sendMessage(idChat, { text: txt, mentions });
        }, 20000);
      }
    },

    // ==============================================
    // ❌ VELHA
    // ==============================================
    {
      nome: "velha",
      descricao: "Jogo da velha",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);
        const args = (resto || "").trim().split(/\s+/);

        if (args[0] === "bot") {
          const tab = Array.from({ length: 3 }, () => Array(3).fill("⬜"));
          novoJogo(idChat, "velha", { tab, modo: "bot", vez: num, jids: { [num]: remetente } });
          return sock.sendMessage(idChat, {
            text:
              `${tab.map(l => l.join(" ")).join("\n")}\n\n` +
              `> Você é ❌\n> Use: *!velha <1-9>*\n\n` +
              `1️⃣ 2️⃣ 3️⃣\n4️⃣ 5️⃣ 6️⃣\n7️⃣ 8️⃣ 9️⃣`
          });
        }

        if (args[0] === "pvp") {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const desafiadoJid = ctx?.mentionedJid?.[0];
          if (!desafiadoJid) return sock.sendMessage(idChat, { text: "❌ Marque alguém: *!velha pvp @user*" });

          const desafiadoNum = normalizar(desafiadoJid);
          const tab = Array.from({ length: 3 }, () => Array(3).fill("⬜"));
          novoJogo(idChat, "velha", {
            tab,
            modo: "pvp",
            jogador1: num,
            jogador2: desafiadoNum,
            vez: num,
            jids: { [num]: remetente, [desafiadoNum]: desafiadoJid }
          });

          return sock.sendMessage(idChat, {
            text:
              `${tab.map(l => l.join(" ")).join("\n")}\n\n` +
              `> @${num} é ❌\n> @${desafiadoNum} é ⭕\n\n` +
              `> Vez de @${num}`,
            mentions: [remetente, desafiadoJid]
          });
        }

        if (jogo && jogo.tipo === "velha") {
          const pos = parseInt(args[0]);
          if (isNaN(pos) || pos < 1 || pos > 9) {
            return sock.sendMessage(idChat, { text: "❌ Use: *!velha <1-9>*" });
          }

          if (jogo.vez !== num) {
            return sock.sendMessage(idChat, { text: "⏰ Não é sua vez!" });
          }

          const linha = Math.floor((pos - 1) / 3);
          const col = (pos - 1) % 3;

          if (jogo.tab[linha][col] !== "⬜") {
            return sock.sendMessage(idChat, { text: "❌ Posição ocupada!" });
          }

          // Salva jid
          jogo.jids = jogo.jids || {};
          jogo.jids[num] = remetente;

          const simbolo = jogo.modo === "pvp"
            ? (num === jogo.jogador1 ? "❌" : "⭕")
            : "❌";
          jogo.tab[linha][col] = simbolo;

          let venc = verificarVelha(jogo.tab);
          if (venc) {
            encerrarJogo(idChat);
            const txt = jogo.tab.map(l => l.join(" ")).join("\n");
            if (venc === "empate") return sock.sendMessage(idChat, { text: `${txt}\n\n🤝 *EMPATE!*` });
            const premio = rand(300, 600);
            const vencedorNum = venc === "❌"
              ? (jogo.modo === "pvp" ? jogo.jogador1 : num)
              : jogo.jogador2;
            const vencedorJid = jogo.jids[vencedorNum] || `${vencedorNum}@s.whatsapp.net`;
            darMoedas(vencedorNum, premio);
            return sock.sendMessage(idChat, {
              text: `${txt}\n\n🏆 *${venc} GANHOU!*\n> 💰 +${premio} moedas`,
              mentions: [vencedorJid]
            });
          }

          if (jogo.modo === "bot") {
            const livres = [];
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (jogo.tab[i][j] === "⬜") livres.push([i, j]);
            if (livres.length) {
              const [bi, bj] = livres[Math.floor(Math.random() * livres.length)];
              jogo.tab[bi][bj] = "⭕";
            }

            venc = verificarVelha(jogo.tab);
            if (venc) {
              encerrarJogo(idChat);
              const txt = jogo.tab.map(l => l.join(" ")).join("\n");
              const premio = rand(300, 600);
              darMoedas(num, premio);
              if (venc === "empate") return sock.sendMessage(idChat, { text: `${txt}\n\n🤝 *EMPATE!*` });
              return sock.sendMessage(idChat, {
                text: `${txt}\n\n🏆 *${venc} GANHOU!*\n> 💰 +${premio} moedas`,
                mentions: [remetente]
              });
            }
          } else {
            jogo.vez = num === jogo.jogador1 ? jogo.jogador2 : jogo.jogador1;
          }

          novoJogo(idChat, "velha", jogo);
          const txt = jogo.tab.map(l => l.join(" ")).join("\n");
          const vezNum = jogo.modo === "pvp" ? jogo.vez : num;
          const vezJid = jogo.jids[vezNum] || `${vezNum}@s.whatsapp.net`;
          return sock.sendMessage(idChat, {
            text: `${txt}\n\n> Vez de @${vezNum}`,
            mentions: [vezJid]
          });
        }

        return sock.sendMessage(idChat, {
          text:
            `❌ *JOGO DA VELHA*\n\n` +
            `> *!velha bot* — vs Bot 🤖\n` +
            `> *!velha pvp @user* — vs Amigo 👥\n\n` +
            `> Use *!velha <1-9>* pra jogar\n\n` +
            `1️⃣ 2️⃣ 3️⃣\n4️⃣ 5️⃣ 6️⃣\n7️⃣ 8️⃣ 9️⃣`
        });
      }
    },

    // ==============================================
    // 🧩 CONECTA 4
    // ==============================================
    {
      nome: "conecta4",
      descricao: "Conecta 4",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);
        const args = (resto || "").trim().split(/\s+/);

        if (args[0] === "bot") {
          const tab = Array.from({ length: 6 }, () => Array(7).fill("⬜"));
          novoJogo(idChat, "conecta4", { tab, modo: "bot", vez: num, jids: { [num]: remetente } });
          return sock.sendMessage(idChat, {
            text: `${tab.map(l => l.join("")).join("\n")}\n\n> Você é 🔴\n> Use: *!conecta4 <coluna>* (1 a 7)`
          });
        }

        if (args[0] === "pvp") {
          const ctx = msg.message?.extendedTextMessage?.contextInfo;
          const desafiadoJid = ctx?.mentionedJid?.[0];
          if (!desafiadoJid) return sock.sendMessage(idChat, { text: "❌ Marque alguém: *!conecta4 pvp @user*" });

          const desafiadoNum = normalizar(desafiadoJid);
          const tab = Array.from({ length: 6 }, () => Array(7).fill("⬜"));
          novoJogo(idChat, "conecta4", {
            tab,
            modo: "pvp",
            jogador1: num,
            jogador2: desafiadoNum,
            vez: num,
            jids: { [num]: remetente, [desafiadoNum]: desafiadoJid }
          });

          return sock.sendMessage(idChat, {
            text: `${tab.map(l => l.join("")).join("\n")}\n\n> @${num} é 🔴\n> @${desafiadoNum} é 🟡\n\n> Vez de @${num}`,
            mentions: [remetente, desafiadoJid]
          });
        }

        if (jogo && jogo.tipo === "conecta4") {
          const col = parseInt(args[0]);
          if (isNaN(col) || col < 1 || col > 7) {
            return sock.sendMessage(idChat, { text: "❌ Use: *!conecta4 <coluna>* (1 a 7)" });
          }

          if (jogo.vez !== num) {
            return sock.sendMessage(idChat, { text: "⏰ Não é sua vez!" });
          }

          jogo.jids = jogo.jids || {};
          jogo.jids[num] = remetente;

          const c = col - 1;
          let linha = -1;
          for (let i = 5; i >= 0; i--) {
            if (jogo.tab[i][c] === "⬜") { linha = i; break; }
          }
          if (linha === -1) return sock.sendMessage(idChat, { text: "❌ Coluna cheia!" });

          const simbolo = jogo.modo === "pvp"
            ? (num === jogo.jogador1 ? "🔴" : "🟡")
            : "🔴";
          jogo.tab[linha][c] = simbolo;

          let venc = verificarConecta4(jogo.tab);
          if (venc) {
            encerrarJogo(idChat);
            const txt = jogo.tab.map(l => l.join("")).join("\n");
            const premio = rand(300, 600);
            const vencedorNum = venc === "🔴" ? (jogo.modo === "pvp" ? jogo.jogador1 : num) : jogo.jogador2;
            const vencedorJid = jogo.jids[vencedorNum] || `${vencedorNum}@s.whatsapp.net`;
            darMoedas(vencedorNum, premio);
            return sock.sendMessage(idChat, {
              text: `${txt}\n\n🏆 *${venc} GANHOU!*\n> 💰 +${premio} moedas`,
              mentions: [vencedorJid]
            });
          }

          if (jogo.modo === "bot") {
            const colunas = [];
            for (let j = 0; j < 7; j++) {
              for (let i = 5; i >= 0; i--) {
                if (jogo.tab[i][j] === "⬜") { colunas.push(j); break; }
              }
            }
            if (colunas.length) {
              const bj = colunas[Math.floor(Math.random() * colunas.length)];
              for (let i = 5; i >= 0; i--) {
                if (jogo.tab[i][bj] === "⬜") { jogo.tab[i][bj] = "🟡"; break; }
              }
            }
            venc = verificarConecta4(jogo.tab);
            if (venc) {
              encerrarJogo(idChat);
              const txt = jogo.tab.map(l => l.join("")).join("\n");
              const premio = rand(300, 600);
              darMoedas(num, premio);
              return sock.sendMessage(idChat, {
                text: `${txt}\n\n🏆 *${venc} GANHOU!*\n> 💰 +${premio} moedas`,
                mentions: [remetente]
              });
            }
          } else {
            jogo.vez = num === jogo.jogador1 ? jogo.jogador2 : jogo.jogador1;
          }

          novoJogo(idChat, "conecta4", jogo);
          const txt = jogo.tab.map(l => l.join("")).join("\n");
          const vezNum = jogo.modo === "pvp" ? jogo.vez : num;
          const vezJid = jogo.jids[vezNum] || `${vezNum}@s.whatsapp.net`;
          return sock.sendMessage(idChat, {
            text: `${txt}\n\n> Vez de @${vezNum}`,
            mentions: [vezJid]
          });
        }

        return sock.sendMessage(idChat, {
          text:
            `🧩 *CONECTA 4*\n\n` +
            `> *!conecta4 bot* — vs Bot 🤖\n` +
            `> *!conecta4 pvp @user* — vs Amigo 👥\n\n` +
            `> Use *!conecta4 <coluna>* pra jogar`
        });
      }
    },

    // ==============================================
    // 🔎 CAÇA PALAVRAS
    // ==============================================
    {
      nome: "cacapalavras",
      descricao: "Caça palavras em grade",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const remetente = msg.key.participant || msg.key.remoteJid;
        const num = normalizar(remetente);

        if (jogo && jogo.tipo === "caca") {
          const palavra = (resto || "").trim().toUpperCase();
          const idx = jogo.palavras.indexOf(palavra);

          if (idx >= 0) {
            jogo.encontradas.push(palavra);
            jogo.palavras.splice(idx, 1);

            if (!jogo.palavras.length) {
              const premio = rand(300, 600);
              darMoedas(num, premio);
              encerrarJogo(idChat);
              return sock.sendMessage(idChat, {
                text: `🎉 *PARABÉNS!*\n\n> Achou todas!\n> 💰 +${premio} moedas pra @${num}`,
                mentions: [remetente]
              });
            }

            novoJogo(idChat, "caca", jogo);
            return sock.sendMessage(idChat, {
              text:
                `✅ *${palavra}* encontrada!\n\n` +
                desenharCaca(jogo.tab) + `\n` +
                `> Faltam: *${jogo.palavras.length}*`
            });
          }
          return sock.sendMessage(idChat, { text: `❌ *${palavra}* não tá na lista.` });
        }

        const { tab, palavras } = gerarCacaPalavras();
        novoJogo(idChat, "caca", { tab, palavras: [...palavras], encontradas: [] });

        await sock.sendMessage(idChat, {
          text:
            `🔎 *CAÇA PALAVRAS*\n\n` +
            desenharCaca(tab) + `\n\n` +
            `> Encontre *${palavras.length}* palavras!\n` +
            `> Use: *!cacapalavras <palavra>*`
        });
      }
    }
  ],

  // ==============================================
  // 🔄 HOOK: DETECTA PALAVRAS DA ADEDONHA
  // ==============================================
  async aoReceberMensagem({ idChat, remetente, msg, sock }) {
    try {
      const jogo = getJogo(idChat);
      if (!jogo || jogo.tipo !== "adedonha") return;

      const texto = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || "";
      if (!texto) return;

      const prefixo = require("../config.js").PREFIXO || "!";
      if (texto.startsWith(prefixo)) return;

      if (Date.now() > jogo.fim) return;

      const num = normalizar(remetente);
      const upper = texto.trim().toUpperCase();

      const palavras = upper.split(/\s+/).filter(p =>
        p.startsWith(jogo.letra) && p.length > 2 && !jogo.usadas.includes(p)
      );

      if (!palavras.length) return;

      jogo.palavras[num] = (jogo.palavras[num] || 0) + palavras.length;
      jogo.usadas.push(...palavras);
      jogo.jids = jogo.jids || {};
      jogo.jids[num] = remetente;
      novoJogo(idChat, "adedonha", jogo);

      await sock.sendMessage(idChat, {
        text: `✅ *${palavras.length}* palavra(s) pra @${num}!\n> Total: *${jogo.palavras[num]}*`,
        mentions: [remetente]
      });
    } catch (e) {
      console.log("Erro hook adedonha:", e.message);
    }
  }
};
