const fs = require("fs");
const path = require("path");

const ARQ_GAMES = path.join(__dirname, "..", "dados", "games.json");
const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");

// ==============================================
// 💾 AUXILIARES (mesmo formato do game.js)
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
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function normalizar(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
}
function limpar(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
function getUser(num) {
  const rpg = lerRPG();
  if (!rpg.usuarios[num]) rpg.usuarios[num] = { moedas: 0 };
  return { rpg, user: rpg.usuarios[num] };
}
function saldo(num) { return getUser(num).user.moedas || 0; }
function darMoedas(num, qtd) {
  const { rpg, user } = getUser(num);
  user.moedas = Math.max(0, (user.moedas || 0) + qtd);
  salvarRPG(rpg);
}
function novoJogo(idChat, tipo, dados = {}) {
  const g = lerGames();
  g.jogos[idChat] = { tipo, criado: Date.now(), ...dados };
  salvarGames(g);
}
function getJogo(idChat) { return lerGames().jogos[idChat] || null; }
function encerrarJogo(idChat) {
  const g = lerGames();
  delete g.jogos[idChat];
  salvarGames(g);
}
function quemEnviou(msg) { return msg.key.participant || msg.key.remoteJid; }
function mencionados(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}
function hashNota(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h % 101);
}

// ==============================================
// 🏭 FÁBRICA DE JOGOS "PERGUNTA E RESPOSTA"
// gerar() devolve { pergunta, aceitas: [...], exibir }
// ==============================================
function jogoResposta({ nome, descricao, titulo, emoji, gerar }) {
  return {
    nome,
    descricao,
    async executar({ sock, idChat, msg, resto }) {
      const jogo = getJogo(idChat);
      const remetente = quemEnviou(msg);
      const num = normalizar(remetente);

      if (jogo && jogo.tipo === nome) {
        const resp = limpar(resto);
        if (!resp) {
          return sock.sendMessage(idChat, {
            text: `${emoji} *${titulo}*\n\n> ${jogo.pergunta}\n\n> Use: *!${nome} <resposta>*`
          });
        }
        if (jogo.aceitas.includes(resp)) {
          encerrarJogo(idChat);
          const premio = rand(300, 600);
          darMoedas(num, premio);
          return sock.sendMessage(idChat, {
            text: `🎉 *ACERTOU!*\n\n> Resposta: *${jogo.exibir}*\n> 💰 +${premio} moedas pra @${num}`,
            mentions: [remetente]
          });
        }
        return sock.sendMessage(idChat, { text: `❌ Errou! Tenta de novo.\n\n> ${jogo.pergunta}` });
      }

      if (jogo) {
        return sock.sendMessage(idChat, {
          text: "⚠️ Já tem um jogo rolando aqui. Termine ou use *!desistir*."
        });
      }

      const j = gerar();
      novoJogo(idChat, nome, { pergunta: j.pergunta, aceitas: j.aceitas.map(limpar), exibir: j.exibir });
      await sock.sendMessage(idChat, {
        text: `${emoji} *${titulo}*\n\n> ${j.pergunta}\n\n> Use: *!${nome} <resposta>*`
      });
    }
  };
}

// ==============================================
// 📚 BANCOS DE DADOS
// ==============================================
const CHARADAS = [
  { p: "O que é, o que é? Quanto mais se tira, maior fica.", r: ["buraco"] },
  { p: "O que é, o que é? Tem dentes mas não morde.", r: ["pente", "alho"] },
  { p: "O que é, o que é? Anda com os pés na cabeça.", r: ["piolho"] },
  { p: "O que é, o que é? Cai em pé e corre deitada.", r: ["chuva", "a chuva"] },
  { p: "O que é, o que é? Quanto mais seca, mais molhada fica.", r: ["toalha", "a toalha"] },
  { p: "O que é, o que é? Tem coroa mas não é rei.", r: ["abacaxi"] },
  { p: "O que é, o que é? Tem cidades sem casas e rios sem água.", r: ["mapa", "o mapa"] },
  { p: "O que é, o que é? Passa pela porta mas nunca entra.", r: ["rua", "a rua"] },
  { p: "O que é, o que é? Está sempre na sua frente mas não pode ser visto.", r: ["futuro", "o futuro"] },
  { p: "O que é, o que é? Pula de galho em galho e não é macaco.", r: ["passaro", "o passaro"] }
];

const CAPITAIS = [
  ["Brasil", "Brasília"], ["Argentina", "Buenos Aires"], ["França", "Paris"],
  ["Itália", "Roma"], ["Japão", "Tóquio"], ["Alemanha", "Berlim"],
  ["Portugal", "Lisboa"], ["Espanha", "Madri"], ["Canadá", "Ottawa"],
  ["Austrália", "Camberra"], ["Egito", "Cairo"], ["Chile", "Santiago"],
  ["Peru", "Lima"], ["Rússia", "Moscou"], ["México", "Cidade do México"],
  ["Reino Unido", "Londres"], ["China", "Pequim"], ["Uruguai", "Montevidéu"]
];

const EMOJIS = [
  { e: "🦁👑", r: ["rei leao", "o rei leao"] },
  { e: "🐟🔍", r: ["procurando nemo", "nemo"] },
  { e: "🕷️🧑", r: ["homem aranha", "o homem aranha"] },
  { e: "🧊👸", r: ["frozen"] },
  { e: "🚢🧊💔", r: ["titanic"] },
  { e: "🦇🧑", r: ["batman", "homem morcego"] },
  { e: "🍎🐍🌳", r: ["adao e eva", "adao"] },
  { e: "🌙🐺", r: ["lobisomem"] },
  { e: "⚽🏆🇧🇷", r: ["copa do mundo", "copa"] },
  { e: "🍕🐢🥷", r: ["tartarugas ninja", "tartaruga ninja"] }
];

const AFIRMACOES = [
  { t: "O Sol é uma estrela.", v: true },
  { t: "A Grande Muralha da China é visível da Lua a olho nu.", v: false },
  { t: "O morcego é um mamífero.", v: true },
  { t: "O Brasil tem 30 estados.", v: false },
  { t: "A água ferve a 100°C ao nível do mar.", v: true },
  { t: "O polvo tem 3 corações.", v: true },
  { t: "O ser humano usa só 10% do cérebro.", v: false },
  { t: "A Austrália é um continente e um país.", v: true },
  { t: "Os tubarões são mamíferos.", v: false },
  { t: "O Rio Amazonas fica na África.", v: false },
  { t: "Mel nunca estraga se bem armazenado.", v: true },
  { t: "O Sol gira em volta da Terra.", v: false }
];

const BOLA8 = [
  "Com certeza! ✅", "Sim, pode apostar. 👍", "Tudo indica que sim. 🔮",
  "Talvez... 🤔", "Pergunta de novo mais tarde. ⏳", "Não conte com isso. ❌",
  "Minhas fontes dizem que não. 🚫", "Nem pensar! 😂", "Os astros dizem que sim. ✨"
];

// ==============================================
// 🎮 COMANDOS
// ==============================================
module.exports = {
  comandos: [

    // ---------- JOGOS DE PERGUNTA E RESPOSTA ----------
    jogoResposta({
      nome: "charada", descricao: "Adivinhe a charada", titulo: "CHARADA", emoji: "🧠",
      gerar: () => { const c = pick(CHARADAS); return { pergunta: c.p, aceitas: c.r, exibir: c.r[0] }; }
    }),

    jogoResposta({
      nome: "conta", descricao: "Conta de matemática rápida", titulo: "MATEMÁTICA", emoji: "➕",
      gerar: () => {
        const op = pick(["+", "-", "*"]);
        let a = rand(2, 50), b = rand(2, 50);
        if (op === "*") { a = rand(2, 12); b = rand(2, 12); }
        if (op === "-" && b > a) [a, b] = [b, a];
        const r = op === "+" ? a + b : op === "-" ? a - b : a * b;
        return { pergunta: `Quanto é ${a} ${op === "*" ? "x" : op} ${b}?`, aceitas: [String(r)], exibir: String(r) };
      }
    }),

    jogoResposta({
      nome: "embaralhado", descricao: "Desembaralhe a palavra", titulo: "PALAVRA EMBARALHADA", emoji: "🔀",
      gerar: () => {
        const palavra = pick(["ELEFANTE", "CHOCOLATE", "BICICLETA", "MONTANHA", "BORBOLETA",
          "COMPUTADOR", "TARTARUGA", "SORVETE", "GIRASSOL", "DINOSSAURO", "FUTEBOL", "CELULAR"]);
        let emb = palavra;
        while (emb === palavra) emb = palavra.split("").sort(() => Math.random() - 0.5).join("");
        return { pergunta: `Qual é a palavra? *${emb}*`, aceitas: [palavra], exibir: palavra };
      }
    }),

    jogoResposta({
      nome: "capital", descricao: "Adivinhe a capital do país", titulo: "CAPITAIS", emoji: "🏙️",
      gerar: () => { const [p, c] = pick(CAPITAIS); return { pergunta: `Qual é a capital de *${p}*?`, aceitas: [c], exibir: c }; }
    }),

    jogoResposta({
      nome: "emojiquiz", descricao: "Adivinhe pelos emojis", titulo: "ADIVINHE PELOS EMOJIS", emoji: "🎬",
      gerar: () => { const e = pick(EMOJIS); return { pergunta: e.e, aceitas: e.r, exibir: e.r[0] }; }
    }),

    jogoResposta({
      nome: "vof", descricao: "Verdadeiro ou falso", titulo: "VERDADEIRO OU FALSO", emoji: "⚖️",
      gerar: () => {
        const a = pick(AFIRMACOES);
        return {
          pergunta: a.t,
          aceitas: a.v ? ["verdadeiro", "v", "true", "sim"] : ["falso", "f", "false", "nao"],
          exibir: a.v ? "Verdadeiro" : "Falso"
        };
      }
    }),

    // ---------- ADIVINHE O NÚMERO ----------
    {
      nome: "adivinhe",
      descricao: "Adivinhe o número de 1 a 100",
      async executar({ sock, idChat, msg, resto }) {
        const jogo = getJogo(idChat);
        const remetente = quemEnviou(msg);
        const num = normalizar(remetente);

        if (jogo && jogo.tipo === "adivinhe") {
          const n = parseInt(resto);
          if (isNaN(n)) return sock.sendMessage(idChat, { text: `🔢 Use: *!adivinhe <número>*\n> Tentativas: ${jogo.tentativas}/7` });

          jogo.tentativas++;
          if (n === jogo.numero) {
            encerrarJogo(idChat);
            const premio = rand(300, 600) + (7 - jogo.tentativas) * 50;
            darMoedas(num, premio);
            return sock.sendMessage(idChat, {
              text: `🎉 *ACERTOU!* Era *${jogo.numero}*\n> Em ${jogo.tentativas} tentativa(s)\n> 💰 +${premio} moedas pra @${num}`,
              mentions: [remetente]
            });
          }
          if (jogo.tentativas >= 7) {
            encerrarJogo(idChat);
            return sock.sendMessage(idChat, { text: `💀 *FIM!* O número era *${jogo.numero}*.` });
          }
          novoJogo(idChat, "adivinhe", jogo);
          return sock.sendMessage(idChat, {
            text: `${n < jogo.numero ? "⬆️ É *MAIOR*" : "⬇️ É *MENOR*"}!\n> Tentativas: ${jogo.tentativas}/7`
          });
        }

        if (jogo) return sock.sendMessage(idChat, { text: "⚠️ Já tem um jogo rolando aqui. Use *!desistir*." });

        novoJogo(idChat, "adivinhe", { numero: rand(1, 100), tentativas: 0 });
        await sock.sendMessage(idChat, {
          text: `🔢 *ADIVINHE O NÚMERO*\n\n> Pensei em um número de *1 a 100*.\n> Você tem *7 tentativas*!\n\n> Use: *!adivinhe <número>*`
        });
      }
    },

    // ---------- DESISTIR ----------
    {
      nome: "desistir",
      descricao: "Encerra o jogo atual do chat",
      async executar({ sock, idChat }) {
        const jogo = getJogo(idChat);
        if (!jogo) return sock.sendMessage(idChat, { text: "❌ Não tem jogo rolando." });
        encerrarJogo(idChat);
        const resp = jogo.exibir || jogo.numero || jogo.palavra || jogo.pais?.nome || jogo.pergunta?.r || jogo.enigma?.resp;
        await sock.sendMessage(idChat, {
          text: `🏳️ Jogo encerrado.${resp ? `\n> A resposta era: *${resp}*` : ""}`
        });
      }
    },

    // ---------- SORTE / DIVERSÃO ----------
    {
      nome: "dado",
      descricao: "Rola um dado (padrão 6 lados)",
      async executar({ sock, idChat, resto }) {
        const lados = Math.min(1000, Math.max(2, parseInt(resto) || 6));
        await sock.sendMessage(idChat, { text: `🎲 Dado de ${lados} lados: *${rand(1, lados)}*` });
      }
    },

    {
      nome: "bola8",
      descricao: "Pergunte à bola 8 mágica",
      async executar({ sock, idChat, resto }) {
        if (!(resto || "").trim()) return sock.sendMessage(idChat, { text: "🎱 Use: *!bola8 <pergunta>*" });
        await sock.sendMessage(idChat, { text: `🎱 *${resto.trim()}*\n\n> ${pick(BOLA8)}` });
      }
    },

    {
      nome: "escolher",
      descricao: "Escolhe entre opções",
      async executar({ sock, idChat, resto }) {
        const opcoes = (resto || "").split(/,|\||\sou\s/i).map(s => s.trim()).filter(Boolean);
        if (opcoes.length < 2) return sock.sendMessage(idChat, { text: "🤔 Use: *!escolher pizza, hambúrguer, sushi*" });
        await sock.sendMessage(idChat, { text: `🤔 Eu escolho: *${pick(opcoes)}*` });
      }
    },

    {
      nome: "chance",
      descricao: "Chance de algo acontecer",
      async executar({ sock, idChat, resto }) {
        if (!(resto || "").trim()) return sock.sendMessage(idChat, { text: "📊 Use: *!chance <algo>*" });
        await sock.sendMessage(idChat, { text: `📊 Chance de *${resto.trim()}*:\n\n> *${rand(0, 100)}%*` });
      }
    },

    {
      nome: "ship",
      descricao: "Compatibilidade entre duas pessoas",
      async executar({ sock, idChat, msg }) {
        const m = mencionados(msg);
        const remetente = quemEnviou(msg);
        const a = m.length >= 2 ? m[0] : remetente;
        const b = m.length >= 2 ? m[1] : m[0];
        if (!b) return sock.sendMessage(idChat, { text: "💘 Use: *!ship @pessoa* ou *!ship @a @b*" });

        const na = normalizar(a), nb = normalizar(b);
        const nota = hashNota([na, nb].sort().join("-"));
        const barra = "█".repeat(Math.round(nota / 10)) + "░".repeat(10 - Math.round(nota / 10));
        const frase = nota >= 80 ? "Casamento marcado! 💍" : nota >= 50 ? "Tem futuro! 😏" : nota >= 25 ? "Só amizade... 😅" : "Nem tenta! 💀";

        await sock.sendMessage(idChat, {
          text: `💘 *SHIP*\n\n> @${na} + @${nb}\n> ${barra} *${nota}%*\n\n> ${frase}`,
          mentions: [a, b]
        });
      }
    },

    {
      nome: "casal",
      descricao: "Sorteia um casal do grupo",
      async executar({ sock, idChat }) {
        if (!idChat.endsWith("@g.us")) return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });
        try {
          const meta = await sock.groupMetadata(idChat);
          const ids = meta.participants.map(p => p.id);
          if (ids.length < 2) return sock.sendMessage(idChat, { text: "❌ Faltam membros." });
          const a = pick(ids);
          const b = pick(ids.filter(i => i !== a));
          await sock.sendMessage(idChat, {
            text: `💑 *CASAL DO DIA*\n\n> @${normalizar(a)} ❤️ @${normalizar(b)}\n\n> Combinam demais! 😍`,
            mentions: [a, b]
          });
        } catch (e) {
          await sock.sendMessage(idChat, { text: "❌ Erro ao sortear o casal." });
        }
      }
    },

    {
      nome: "roletarussa",
      descricao: "Roleta russa (1 em 6)",
      async executar({ sock, idChat, msg }) {
        const remetente = quemEnviou(msg);
        const num = normalizar(remetente);
        const morreu = rand(1, 6) === 1;
        await sock.sendMessage(idChat, {
          text: morreu ? `🔫 *BANG!* 💀\n> @${num} se foi...` : `🔫 *click...* 😮‍💨\n> @${num} sobreviveu!`,
          mentions: [remetente]
        });
      }
    },

    // ---------- ECONOMIA ----------
    {
      nome: "saldo",
      descricao: "Mostra suas moedas",
      async executar({ sock, idChat, msg }) {
        const remetente = quemEnviou(msg);
        const num = normalizar(remetente);
        await sock.sendMessage(idChat, {
          text: `💰 Saldo de @${num}: *${saldo(num)}* moedas`,
          mentions: [remetente]
        });
      }
    },

    {
      nome: "daily",
      descricao: "Bônus diário de moedas",
      async executar({ sock, idChat, msg }) {
        const remetente = quemEnviou(msg);
        const num = normalizar(remetente);
        const { rpg, user } = getUser(num);
        const agora = Date.now();
        const espera = 24 * 60 * 60 * 1000;

        if (user.ultimoDaily && agora - user.ultimoDaily < espera) {
          const falta = espera - (agora - user.ultimoDaily);
          const h = Math.floor(falta / 3600000);
          const min = Math.floor((falta % 3600000) / 60000);
          return sock.sendMessage(idChat, { text: `⏳ Já pegou hoje! Volte em *${h}h ${min}min*.` });
        }

        const premio = rand(500, 1500);
        user.moedas = (user.moedas || 0) + premio;
        user.ultimoDaily = agora;
        salvarRPG(rpg);

        await sock.sendMessage(idChat, {
          text: `🎁 *BÔNUS DIÁRIO*\n\n> 💰 +${premio} moedas pra @${num}`,
          mentions: [remetente]
        });
      }
    },

    {
      nome: "rankmoedas",
      descricao: "Top 5 mais ricos do bot",
      async executar({ sock, idChat }) {
        const rpg = lerRPG();
        const top = Object.entries(rpg.usuarios)
          .map(([num, u]) => ({ num, m: u.moedas || 0 }))
          .filter(u => u.m > 0)
          .sort((a, b) => b.m - a.m)
          .slice(0, 5);

        if (!top.length) return sock.sendMessage(idChat, { text: "💸 Ninguém tem moedas ainda." });

        const emojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
        let txt = "💰 *TOP 5 MAIS RICOS*\n\n";
        top.forEach((u, i) => { txt += `${emojis[i]} @${u.num} — *${u.m}* moedas\n`; });

        await sock.sendMessage(idChat, { text: txt, mentions: top.map(u => `${u.num}@s.whatsapp.net`) });
      }
    },

    {
      nome: "moeda",
      descricao: "Cara ou coroa (com aposta opcional)",
      async executar({ sock, idChat, msg, resto }) {
        const remetente = quemEnviou(msg);
        const num = normalizar(remetente);
        const [lado, apostaStr] = (resto || "").trim().toLowerCase().split(/\s+/);
        const resultado = pick(["cara", "coroa"]);

        if (!lado) return sock.sendMessage(idChat, { text: `🪙 Deu *${resultado}*!\n\n> Aposte: *!moeda cara 100*` });
        if (!["cara", "coroa"].includes(lado)) return sock.sendMessage(idChat, { text: "🪙 Use: *!moeda cara 100* ou *!moeda coroa 100*" });

        const aposta = parseInt(apostaStr) || 0;
        if (aposta <= 0) return sock.sendMessage(idChat, { text: `🪙 Deu *${resultado}*!` });
        if (saldo(num) < aposta) return sock.sendMessage(idChat, { text: "💸 Você não tem moedas suficientes." });

        const ganhou = lado === resultado;
        darMoedas(num, ganhou ? aposta : -aposta);
        await sock.sendMessage(idChat, {
          text: `🪙 Deu *${resultado}*!\n\n${ganhou ? `🏆 Ganhou 💰 +${aposta}` : `😢 Perdeu 💸 -${aposta}`} moedas, @${num}`,
          mentions: [remetente]
        });
      }
    },

    {
      nome: "slot",
      descricao: "Caça-níquel com aposta",
      async executar({ sock, idChat, msg, resto }) {
        const remetente = quemEnviou(msg);
        const num = normalizar(remetente);
        const aposta = parseInt(resto);

        if (isNaN(aposta) || aposta < 50) return sock.sendMessage(idChat, { text: "🎰 Use: *!slot <aposta>* (mínimo 50)" });
        if (saldo(num) < aposta) return sock.sendMessage(idChat, { text: "💸 Você não tem moedas suficientes." });

        const simbolos = ["🍒", "🍋", "🍇", "🔔", "💎", "7️⃣"];
        const r = [pick(simbolos), pick(simbolos), pick(simbolos)];
        const iguais = new Set(r).size;

        let ganho = -aposta, texto = "😢 *Perdeu!*";
        if (iguais === 1) {
          const mult = r[0] === "7️⃣" ? 10 : 5;
          ganho = aposta * (mult - 1);
          texto = `🎉 *JACKPOT x${mult}!*`;
        } else if (iguais === 2) {
          ganho = Math.floor(aposta * 0.5);
          texto = "😏 *Duas iguais!* (x1.5)";
        }

        darMoedas(num, ganho);
        await sock.sendMessage(idChat, {
          text: `🎰 *CAÇA-NÍQUEL*\n\n> ${r.join(" | ")}\n\n${texto}\n> ${ganho >= 0 ? "💰 +" : "💸 "}${ganho} moedas, @${num}`,
          mentions: [remetente]
        });
      }
    },

    {
      nome: "duelo",
      descricao: "Duelo aleatório contra alguém (aposta opcional)",
      async executar({ sock, idChat, msg, resto }) {
        const m = mencionados(msg);
        const remetente = quemEnviou(msg);
        const alvo = m[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "⚔️ Use: *!duelo @user 100*" });

        const n1 = normalizar(remetente), n2 = normalizar(alvo);
        if (n1 === n2) return sock.sendMessage(idChat, { text: "😂 Você não pode duelar contra si mesmo." });

        const aposta = parseInt((resto || "").replace(/@\d+/g, "").trim()) || 0;
        if (aposta > 0 && (saldo(n1) < aposta || saldo(n2) < aposta)) {
          return sock.sendMessage(idChat, { text: "💸 Os dois precisam ter moedas suficientes pra essa aposta." });
        }

        const venceu1 = Math.random() < 0.5;
        const [vNum, vJid, pNum] = venceu1 ? [n1, remetente, n2] : [n2, alvo, n1];
        if (aposta > 0) { darMoedas(vNum, aposta); darMoedas(pNum, -aposta); }

        await sock.sendMessage(idChat, {
          text: `⚔️ *DUELO*\n\n> @${n1} 🆚 @${n2}\n\n🏆 Vencedor: @${vNum}${aposta ? `\n> 💰 +${aposta} moedas` : ""}`,
          mentions: [remetente, alvo]
        });
      }
    }
  ]
};

