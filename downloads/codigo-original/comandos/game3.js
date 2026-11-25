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
function darMoedas(num, qtd) {
  if (!num || num === "bot") return;
  const rpg = lerRPG();
  if (!rpg.usuarios[num]) rpg.usuarios[num] = { moedas: 0 };
  rpg.usuarios[num].moedas = (rpg.usuarios[num].moedas || 0) + qtd;
  try { fs.writeFileSync(ARQ_RPG, JSON.stringify(rpg, null, 2)); } catch {}
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
const jidDe = (jogo, num) => jogo.jids[num] || `${num}@s.whatsapp.net`;

// ==============================================
// ⚽ PÊNALTIS
// ==============================================
const DIRNOMES = ["⬅️ esquerda", "⬆️ meio", "➡️ direita"];

function dirDe(t) {
  const s = limpar(t);
  if (["e", "esq", "esquerda", "1"].includes(s)) return 0;
  if (["m", "meio", "centro", "2"].includes(s)) return 1;
  if (["d", "dir", "direita", "3"].includes(s)) return 2;
  return -1;
}
const nomeP = (jogo, idx) =>
  jogo.jogadores[idx] === "bot" ? "🤖 Bot" : `@${jogo.jogadores[idx]}`;

function mencoesP(jogo) {
  return jogo.jogadores.filter(n => n !== "bot").map(n => jidDe(jogo, n));
}
function placarP(jogo) {
  return `${nomeP(jogo, 0)} *${jogo.placar[0]}* ⚽ *${jogo.placar[1]}* ${nomeP(jogo, 1)}`;
}
function historicoP(jogo) {
  const mk = i => (jogo.hist[i] || []).map(x => (x ? "✅" : "❌")).join(" ") || "—";
  return `${nomeP(jogo, 0)}: ${mk(0)}\n${nomeP(jogo, 1)}: ${mk(1)}`;
}

function resolverPenalti(jogo, chute, defesa) {
  const ch = jogo.rodada % 2;
  const gol = chute !== defesa;
  if (gol) jogo.placar[ch]++;
  jogo.hist[ch].push(gol);
  jogo.rodada++;
  return (
    `${gol ? "⚽ *GOOOOL!*" : "🧤 *DEFENDEU!*"}\n` +
    `> 🦶 Chute: ${DIRNOMES[chute]}\n> 🧤 Goleiro: ${DIRNOMES[defesa]}`
  );
}

function vencedorP(jogo) {
  if (jogo.rodada >= 10 && jogo.rodada % 2 === 0 && jogo.placar[0] !== jogo.placar[1]) {
    return jogo.placar[0] > jogo.placar[1] ? 0 : 1;
  }
  return null;
}

function proximoP(jogo) {
  const ch = jogo.rodada % 2;
  const gk = 1 - ch;
  const n = Math.floor(jogo.rodada / 2) + 1;
  const extra = jogo.rodada >= 10 ? " (💥 MORTE SÚBITA)" : "";
  if (jogo.modo === "bot") {
    return `\n> Cobrança ${n}${extra}: ${ch === 0 ? "*você chuta* 🦶" : "*você defende* 🧤"}\n> Use: *!penalti e/m/d* (esquerda/meio/direita)`;
  }
  return (
    `\n> Cobrança ${n}${extra}: ${nomeP(jogo, ch)} chuta 🦶 e ${nomeP(jogo, gk)} defende 🧤\n` +
    `> Os dois mandam: *!penalti e/m/d*\n> _(se o bot for admin, a escolha é apagada)_`
  );
}

async function finalizarP(sock, idChat, jogo, resultadoTxt) {
  const v = vencedorP(jogo);
  encerrarJogo(idChat);
  const premio = rand(500, 900);
  darMoedas(jogo.jogadores[v], premio);
  const premioTxt = jogo.jogadores[v] === "bot" ? "" : `\n> 💰 +${premio} moedas pra ${nomeP(jogo, v)}`;
  return sock.sendMessage(idChat, {
    text:
      `${resultadoTxt}\n\n${placarP(jogo)}\n${historicoP(jogo)}\n\n` +
      `🏆 *${nomeP(jogo, v)} VENCEU!*${premioTxt}`,
    mentions: mencoesP(jogo)
  });
}

const comandoPenalti = {
  nome: "penalti",
  descricao: "Disputa de pênaltis (bot ou PvP)",
  async executar({ sock, idChat, msg, resto }) {
    const jogo = getJogo(idChat);
    const remetente = quemEnviou(msg);
    const num = normalizar(remetente);
    const args = (resto || "").trim().split(/\s+/);

    // --- iniciar contra o bot ---
    if (args[0] === "bot") {
      if (jogo) return sock.sendMessage(idChat, { text: "⚠️ Já tem um jogo rolando. Use *!desistir*." });
      const novo = {
        modo: "bot", jogadores: [num, "bot"], jids: { [num]: remetente },
        placar: [0, 0], hist: [[], []], rodada: 0, picks: {}
      };
      novoJogo(idChat, "penalti", novo);
      return sock.sendMessage(idChat, {
        text: `⚽ *DISPUTA DE PÊNALTIS*\n\n${placarP(novo)}\n${proximoP(novo)}`,
        mentions: [remetente]
      });
    }

    // --- iniciar PvP ---
    if (args[0] === "pvp") {
      if (jogo) return sock.sendMessage(idChat, { text: "⚠️ Já tem um jogo rolando. Use *!desistir*." });
      const alvo = mencionados(msg)[0];
      if (!alvo) return sock.sendMessage(idChat, { text: "❌ Marque alguém: *!penalti pvp @user*" });
      const n2 = normalizar(alvo);
      if (n2 === num) return sock.sendMessage(idChat, { text: "😂 Marque outra pessoa." });
      const novo = {
        modo: "pvp", jogadores: [num, n2], jids: { [num]: remetente, [n2]: alvo },
        placar: [0, 0], hist: [[], []], rodada: 0, picks: {}
      };
      novoJogo(idChat, "penalti", novo);
      return sock.sendMessage(idChat, {
        text: `⚽ *DISPUTA DE PÊNALTIS*\n\n${placarP(novo)}\n${proximoP(novo)}`,
        mentions: [remetente, alvo]
      });
    }

    // --- jogo em andamento ---
    if (jogo && jogo.tipo === "penalti") {
      const idx = jogo.jogadores.indexOf(num);
      if (idx === -1) return sock.sendMessage(idChat, { text: "❌ Você não está nessa disputa." });

      if (args[0] === "desistir") {
        encerrarJogo(idChat);
        return sock.sendMessage(idChat, { text: `🏳️ @${num} desistiu da disputa!`, mentions: [remetente] });
      }

      const dir = dirDe(args[0]);
      if (dir === -1) {
        return sock.sendMessage(idChat, {
          text: `⚽ ${placarP(jogo)}\n${proximoP(jogo)}`,
          mentions: mencoesP(jogo)
        });
      }

      const ch = jogo.rodada % 2;
      const gk = 1 - ch;

      // contra o bot: só o humano escolhe
      if (jogo.modo === "bot") {
        const chute = ch === 0 ? dir : rand(0, 2);
        const defesa = ch === 0 ? rand(0, 2) : dir;
        const res = resolverPenalti(jogo, chute, defesa);
        if (vencedorP(jogo) !== null) return finalizarP(sock, idChat, jogo, res);
        novoJogo(idChat, "penalti", jogo);
        return sock.sendMessage(idChat, {
          text: `${res}\n\n${placarP(jogo)}\n${historicoP(jogo)}\n${proximoP(jogo)}`,
          mentions: mencoesP(jogo)
        });
      }

      // PvP: guarda a escolha e tenta apagar a mensagem pra ninguém ver
      if (jogo.picks[num] !== undefined) {
        return sock.sendMessage(idChat, { text: "⏳ Você já escolheu, espere o outro." });
      }
      jogo.picks[num] = dir;
      try { await sock.sendMessage(idChat, { delete: msg.key }); } catch {}

      const numCh = jogo.jogadores[ch], numGk = jogo.jogadores[gk];
      if (jogo.picks[numCh] === undefined || jogo.picks[numGk] === undefined) {
        novoJogo(idChat, "penalti", jogo);
        const falta = jogo.picks[numCh] === undefined ? numCh : numGk;
        return sock.sendMessage(idChat, {
          text: `✅ @${num} travou a escolha.\n> Falta @${falta}`,
          mentions: [jidDe(jogo, num), jidDe(jogo, falta)]
        });
      }

      const res = resolverPenalti(jogo, jogo.picks[numCh], jogo.picks[numGk]);
      jogo.picks = {};
      if (vencedorP(jogo) !== null) return finalizarP(sock, idChat, jogo, res);
      novoJogo(idChat, "penalti", jogo);
      return sock.sendMessage(idChat, {
        text: `${res}\n\n${placarP(jogo)}\n${historicoP(jogo)}\n${proximoP(jogo)}`,
        mentions: mencoesP(jogo)
      });
    }

    if (jogo) return sock.sendMessage(idChat, { text: "⚠️ Já tem outro jogo rolando. Use *!desistir*." });

    return sock.sendMessage(idChat, {
      text:
        `⚽ *PÊNALTIS*\n\n` +
        `> *!penalti bot* — vs Bot 🤖\n> *!penalti pvp @user* — vs Amigo 👥\n\n` +
        `Cada um bate 5 pênaltis alternados. Empatou? Morte súbita!\n` +
        `Chute e defenda com *!penalti e/m/d* (esquerda, meio, direita).`
    });
  }
};

// ==============================================
// 🔴 DAMA
// ==============================================
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const dentro = (i, j) => i >= 0 && i < 8 && j >= 0 && j < 8;
const ladoDe = p => (p ? p.toLowerCase() : "");
const ehDama = p => p === "R" || p === "B";
const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];
const EMO = { r: "🔴", R: "🟥", b: "🔵", B: "🟦" };

function novoTabuleiro() {
  const t = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if ((i + j) % 2 === 1) {
        if (i < 3) t[i][j] = "b";
        else if (i > 4) t[i][j] = "r";
      }
    }
  }
  return t;
}

function desenharDama(tab) {
  let txt = "🔲" + KEYCAPS.join("") + "\n";
  for (let i = 0; i < 8; i++) {
    txt += KEYCAPS[i];
    for (let j = 0; j < 8; j++) {
      txt += tab[i][j] ? EMO[tab[i][j]] : (i + j) % 2 === 1 ? "🟫" : "⬜";
    }
    txt += "\n";
  }
  return txt;
}

// capturas possíveis de UMA peça
function capturasDe(tab, i, j) {
  const p = tab[i][j];
  const lado = ladoDe(p);
  const res = [];
  for (const [di, dj] of DIRS) {
    if (ehDama(p)) {
      let ni = i + di, nj = j + dj;
      while (dentro(ni, nj) && !tab[ni][nj]) { ni += di; nj += dj; }
      if (!dentro(ni, nj) || ladoDe(tab[ni][nj]) === lado) continue;
      let li = ni + di, lj = nj + dj;
      while (dentro(li, lj) && !tab[li][lj]) {
        res.push({ de: [i, j], para: [li, lj], cap: [ni, nj] });
        li += di; lj += dj;
      }
    } else {
      const ni = i + di, nj = j + dj, li = i + 2 * di, lj = j + 2 * dj;
      if (dentro(li, lj) && tab[ni][nj] && ladoDe(tab[ni][nj]) !== lado && !tab[li][lj]) {
        res.push({ de: [i, j], para: [li, lj], cap: [ni, nj] });
      }
    }
  }
  return res;
}

// movimentos sem captura de UMA peça
function simplesDe(tab, i, j) {
  const p = tab[i][j];
  const res = [];
  for (const [di, dj] of DIRS) {
    if (ehDama(p)) {
      let ni = i + di, nj = j + dj;
      while (dentro(ni, nj) && !tab[ni][nj]) { res.push([ni, nj]); ni += di; nj += dj; }
    } else {
      if ((ladoDe(p) === "r" && di !== -1) || (ladoDe(p) === "b" && di !== 1)) continue;
      const ni = i + di, nj = j + dj;
      if (dentro(ni, nj) && !tab[ni][nj]) res.push([ni, nj]);
    }
  }
  return res;
}

function todasCapturas(tab, lado) {
  const r = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    if (ladoDe(tab[i][j]) === lado) r.push(...capturasDe(tab, i, j));
  }
  return r;
}
function todasSimples(tab, lado) {
  const r = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    if (ladoDe(tab[i][j]) === lado) simplesDe(tab, i, j).forEach(p => r.push({ de: [i, j], para: p }));
  }
  return r;
}

// executa um lance; muda jogo.tab / jogo.continuar / jogo.vez
function aplicarLance(jogo, lado, de, para) {
  const tab = jogo.tab;
  const [i, j] = de, [x, y] = para;
  if (!dentro(i, j) || !dentro(x, y)) return { erro: "Posição inválida." };
  const p = tab[i][j];
  if (ladoDe(p) !== lado) return { erro: "Essa casa não tem uma peça sua." };
  if (jogo.continuar && (jogo.continuar[0] !== i || jogo.continuar[1] !== j)) {
    return { erro: `Continue capturando com a peça em ${i + 1}${j + 1}.` };
  }

  const caps = jogo.continuar ? capturasDe(tab, i, j) : todasCapturas(tab, lado);
  let mov = null;
  if (caps.length) {
    mov = caps.find(c => c.de[0] === i && c.de[1] === j && c.para[0] === x && c.para[1] === y);
    if (!mov) return { erro: "Captura obrigatória! Você precisa capturar uma peça." };
  } else if (!simplesDe(tab, i, j).some(m => m[0] === x && m[1] === y)) {
    return { erro: "Movimento inválido." };
  }

  tab[i][j] = "";
  tab[x][y] = p;
  if (mov) tab[mov.cap[0]][mov.cap[1]] = "";
  if (p === "r" && x === 0) tab[x][y] = "R";
  if (p === "b" && x === 7) tab[x][y] = "B";

  jogo.continuar = null;
  if (mov && capturasDe(tab, x, y).length) jogo.continuar = [x, y];
  else jogo.vez = lado === "r" ? "b" : "r";
  return { ok: true, capturou: !!mov };
}

// quem está na vez não tem peças ou não tem lances = perdeu
function perdeuDama(jogo) {
  const lado = jogo.vez;
  return !todasCapturas(jogo.tab, lado).length && !todasSimples(jogo.tab, lado).length;
}

// o bot joga a vez inteira (inclui capturas múltiplas)
function botJogarDama(jogo) {
  const lances = [];
  let guard = 0;
  do {
    let opts;
    if (jogo.continuar) opts = capturasDe(jogo.tab, jogo.continuar[0], jogo.continuar[1]);
    else {
      opts = todasCapturas(jogo.tab, "b");
      if (!opts.length) opts = todasSimples(jogo.tab, "b");
    }
    if (!opts.length) break;
    const o = pick(opts);
    aplicarLance(jogo, "b", o.de, o.para);
    lances.push(`${o.de[0] + 1}${o.de[1] + 1}➡️${o.para[0] + 1}${o.para[1] + 1}`);
  } while (jogo.vez === "b" && jogo.continuar && ++guard < 12);
  return lances;
}

const nomeD = (jogo, lado) =>
  jogo.jogadores[lado] === "bot" ? "🤖 Bot" : `@${jogo.jogadores[lado]}`;
const mencoesD = jogo =>
  Object.values(jogo.jogadores).filter(n => n !== "bot").map(n => jidDe(jogo, n));

function statusD(jogo) {
  const cor = jogo.vez === "r" ? "🔴" : "🔵";
  let t = `> Vez de ${nomeD(jogo, jogo.vez)} ${cor}`;
  if (jogo.continuar) t += `\n> ⚔️ Continue capturando com a peça em *${jogo.continuar[0] + 1}${jogo.continuar[1] + 1}*`;
  return t;
}

const comandoDama = {
  nome: "dama",
  descricao: "Jogo de damas (bot ou PvP)",
  async executar({ sock, idChat, msg, resto }) {
    const jogo = getJogo(idChat);
    const remetente = quemEnviou(msg);
    const num = normalizar(remetente);
    const args = (resto || "").trim().split(/\s+/);

    const ajuda =
      `🔴 *DAMA*\n\n> *!dama bot* — vs Bot 🤖\n> *!dama pvp @user* — vs Amigo 👥\n\n` +
      `Jogue digitando *linha+coluna* da peça e do destino.\n` +
      `Ex: *!dama 63 54* move a peça da linha 6 coluna 3 para a linha 5 coluna 4.\n` +
      `Captura é obrigatória. Chegou no fim do tabuleiro? Vira dama (🟥/🟦) e anda várias casas!\n` +
      `Para sair: *!dama desistir*`;

    if (args[0] === "bot") {
      if (jogo) return sock.sendMessage(idChat, { text: "⚠️ Já tem um jogo rolando. Use *!desistir*." });
      const novo = {
        tab: novoTabuleiro(), modo: "bot", vez: "r", continuar: null,
        jogadores: { r: num, b: "bot" }, jids: { [num]: remetente }
      };
      novoJogo(idChat, "dama", novo);
      return sock.sendMessage(idChat, {
        text: `${desenharDama(novo.tab)}\n> Você é 🔴 (embaixo)\n${statusD(novo)}\n\n> Ex: *!dama 63 54*`,
        mentions: [remetente]
      });
    }

    if (args[0] === "pvp") {
      if (jogo) return sock.sendMessage(idChat, { text: "⚠️ Já tem um jogo rolando. Use *!desistir*." });
      const alvo = mencionados(msg)[0];
      if (!alvo) return sock.sendMessage(idChat, { text: "❌ Marque alguém: *!dama pvp @user*" });
      const n2 = normalizar(alvo);
      if (n2 === num) return sock.sendMessage(idChat, { text: "😂 Marque outra pessoa." });
      const novo = {
        tab: novoTabuleiro(), modo: "pvp", vez: "r", continuar: null,
        jogadores: { r: num, b: n2 }, jids: { [num]: remetente, [n2]: alvo }
      };
      novoJogo(idChat, "dama", novo);
      return sock.sendMessage(idChat, {
        text: `${desenharDama(novo.tab)}\n> @${num} é 🔴 (embaixo)\n> @${n2} é 🔵 (em cima)\n${statusD(novo)}`,
        mentions: [remetente, alvo]
      });
    }

    if (!jogo || jogo.tipo !== "dama") {
      if (jogo) return sock.sendMessage(idChat, { text: "⚠️ Já tem outro jogo rolando. Use *!desistir*." });
      return sock.sendMessage(idChat, { text: ajuda });
    }

    // --- jogo em andamento ---
    const lado = jogo.jogadores.r === num ? "r" : jogo.jogadores.b === num ? "b" : null;
    if (!lado) return sock.sendMessage(idChat, { text: "❌ Você não está nesse jogo." });

    async function vitoria(ladoVenc, motivo) {
      encerrarJogo(idChat);
      const premio = rand(500, 900);
      darMoedas(jogo.jogadores[ladoVenc], premio);
      const premioTxt = jogo.jogadores[ladoVenc] === "bot" ? "" : `\n> 💰 +${premio} moedas pra ${nomeD(jogo, ladoVenc)}`;
      return sock.sendMessage(idChat, {
        text: `${desenharDama(jogo.tab)}\n${motivo ? motivo + "\n" : ""}🏆 *${nomeD(jogo, ladoVenc)} VENCEU!*${premioTxt}`,
        mentions: mencoesD(jogo)
      });
    }

    if (args[0] === "desistir") return vitoria(lado === "r" ? "b" : "r", `🏳️ ${nomeD(jogo, lado)} desistiu.`);

    if (jogo.vez !== lado) return sock.sendMessage(idChat, { text: "⏰ Não é sua vez!" });

    const d = (resto || "").replace(/\D/g, "");
    if (d.length !== 4) return sock.sendMessage(idChat, { text: "❌ Use: *!dama 63 54* (linha e coluna de origem e destino)" });

    const r = aplicarLance(jogo, lado, [+d[0] - 1, +d[1] - 1], [+d[2] - 1, +d[3] - 1]);
    if (r.erro) return sock.sendMessage(idChat, { text: `❌ ${r.erro}` });

    let extra = r.capturou ? "⚔️ Capturou uma peça!\n" : "";

    if (jogo.vez !== lado) {
      if (perdeuDama(jogo)) return vitoria(lado, extra);

      if (jogo.modo === "bot" && jogo.vez === "b") {
        const lances = botJogarDama(jogo);
        extra += `🤖 Bot jogou: ${lances.join(" ")}\n`;
        if (perdeuDama(jogo)) return vitoria("b", extra);
      }
    }

    novoJogo(idChat, "dama", jogo);
    return sock.sendMessage(idChat, {
      text: `${desenharDama(jogo.tab)}\n${extra}${statusD(jogo)}`,
      mentions: mencoesD(jogo)
    });
  }
};

module.exports = { comandos: [comandoPenalti, comandoDama] };

