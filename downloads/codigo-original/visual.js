// ==============================================
// 🎨 VISUAL NEON — Tomioka Bot
// Coloque este arquivo na MESMA pasta do index.js
// ==============================================
const fs = require("fs");
const path = require("path");

const R = "\x1b[0m";
const B = "\x1b[1m";
const rgb = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;

const C = {
  neon: rgb(0, 210, 255),     // azul néon principal
  neon2: rgb(0, 140, 255),    // azul néon das bordas
  claro: rgb(170, 245, 255),
  branco: rgb(235, 252, 255),
  sombra: rgb(0, 70, 170),    // "lateral" das letras 3D
  dim: rgb(90, 130, 170),
  ok: rgb(0, 255, 170),
  erro: rgb(255, 70, 110),
  aviso: rgb(255, 205, 60)
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
const LARG = Math.min(60, (process.stdout.columns || 80) - 2);

// ==============================================
// 🔠 FONTE 3D
// ==============================================
const FONTE = {
  T: ["████████╗", "╚══██╔══╝", "   ██║   ", "   ██║   ", "   ██║   ", "   ╚═╝   "],
  O: [" ██████╗ ", "██╔═══██╗", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
  M: ["███╗   ███╗", "████╗ ████║", "██╔████╔██║", "██║╚██╔╝██║", "██║ ╚═╝ ██║", "╚═╝     ╚═╝"],
  I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
  K: ["██╗  ██╗", "██║ ██╔╝", "█████╔╝ ", "██╔═██╗ ", "██║  ██╗", "╚═╝  ╚═╝"],
  A: [" █████╗ ", "██╔══██╗", "███████║", "██╔══██║", "██║  ██║", "╚═╝  ╚═╝"],
  B: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██████╔╝", "╚═════╝ "]
};

function montar(texto) {
  const letras = [...texto].map(ch => {
    const g = FONTE[ch];
    const w = Math.max(...g.map(l => l.length));
    return g.map(l => l.padEnd(w, " "));
  });
  return Array.from({ length: 6 }, (_, r) => letras.map(l => l[r]).join(""));
}

// █ = face da letra (gradiente brilhante) | ╗║═ = lateral/sombra (azul escuro) => efeito 3D
function pintar(linha, t) {
  const claro = rgb(Math.round(150 - 150 * t), Math.round(245 - 120 * t), 255);
  let out = "";
  for (const ch of linha) {
    if (ch === "█") out += B + claro + ch;
    else if (ch === " ") out += ch;
    else out += R + C.sombra + ch;
  }
  return out + R;
}

function centralizar(texto, largura = LARG) {
  const pad = Math.max(0, Math.floor((largura - strip(texto).length) / 2));
  return " ".repeat(pad) + texto;
}

async function banner({ animado = false, subtitulo = "" } = {}) {
  const cols = process.stdout.columns || 80;
  console.log();

  if (cols < 62) {
    // terminal estreito: versão compacta
    const txt = "  T O M I O K A   B O T  ";
    console.log(C.neon2 + "╔" + "═".repeat(txt.length) + "╗" + R);
    console.log(C.neon2 + "║" + R + B + C.neon + txt + R + C.neon2 + "║" + R);
    console.log(C.neon2 + "╚" + "═".repeat(txt.length) + "╝" + R);
  } else {
    const linhas = [
      ...montar("TOMIOKA").map(l => centralizar(l)),
      ...montar("BOT").map(l => centralizar(l))
    ];
    for (let i = 0; i < linhas.length; i++) {
      console.log(pintar(linhas[i], i / (linhas.length - 1)));
      if (animado) await sleep(45);
    }
  }

  console.log(C.neon2 + "━".repeat(LARG) + R);
  if (subtitulo) console.log(centralizar(C.dim + subtitulo + R));
  console.log();
}

// ==============================================
// 🧱 COMPONENTES
// ==============================================
function caixa(titulo, linhas, cor = C.neon2) {
  const t = ` ${titulo} `;
  const maxL = Math.max(0, ...linhas.map(l => strip(l).length));
  const W = Math.max(LARG - 2, maxL + 2, t.length + 3);

  console.log(`${cor}╭─${R}${B}${C.neon}${t}${R}${cor}${"─".repeat(W - 1 - t.length)}╮${R}`);
  for (const l of linhas) {
    const pad = Math.max(0, W - 1 - strip(l).length);
    console.log(`${cor}│${R} ${l}${" ".repeat(pad)}${cor}│${R}`);
  }
  console.log(`${cor}╰${"─".repeat(W)}╯${R}`);
}

function titulo(txt) {
  const resto = Math.max(2, LARG - 5 - txt.length);
  console.log(`\n  ${C.neon}◆ ${B}${C.branco}${txt}${R} ${C.neon2}${"─".repeat(resto)}${R}`);
}

const sucesso = t => console.log(`  ${C.ok}✓${R} ${t}`);
const erro = t => console.log(`  ${C.erro}✗${R} ${C.erro}${t}${R}`);
const aviso = t => console.log(`  ${C.aviso}!${R} ${C.aviso}${t}${R}`);
const info = t => console.log(`  ${C.neon}▸${R} ${t}`);
const kv = (k, v) => `${C.dim}${String(k).padEnd(13)}${R}${C.branco}${v}${R}`;
const prompt = t => `\n  ${C.neon}❯${R} ${C.branco}${t}:${R} `;

function barra(atual, total, larg = 24) {
  const cheio = total ? Math.round((atual / total) * larg) : 0;
  return C.neon + "█".repeat(cheio) + C.sombra + "░".repeat(larg - cheio) + R;
}

function spinner(texto) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const logOriginal = console.log;
  const limpar = () => process.stdout.write("\r\x1b[2K");
  const desenhar = () => process.stdout.write(`\r\x1b[2K  ${C.neon}${frames[i++ % frames.length]}${R} ${texto}`);

  process.stdout.write("\x1b[?25l"); // esconde cursor
  // se alguém der console.log enquanto gira, não bagunça a linha
  console.log = (...a) => { limpar(); logOriginal(...a); };
  const timer = setInterval(desenhar, 80);
  desenhar();

  const parar = (simbolo, cor, msg) => {
    clearInterval(timer);
    console.log = logOriginal;
    limpar();
    process.stdout.write("\x1b[?25h"); // mostra cursor
    console.log(`  ${cor}${simbolo}${R} ${msg}`);
  };

  return {
    texto: t => { texto = t; },
    ok: m => parar("✓", C.ok, m || texto),
    falha: m => parar("✗", C.erro, m || texto)
  };
}

// ==============================================
// 🔐 LICENÇA
// ==============================================
async function licenca(verificar) {
  titulo("VERIFICAÇÃO DE LICENÇA");
  const sp = spinner("Validando licença no servidor...");
  const t0 = Date.now();
  let valida = false;
  let motivo = "Licença inválida, expirada ou não autorizada.";

  try { valida = !!(await verificar()); }
  catch (e) { motivo = e?.message || String(e); }

  const ms = Date.now() - t0;
  if (valida) {
    sp.ok(`Licença válida e autenticada ${C.dim}(${ms}ms)${R}`);
    return true;
  }
  sp.falha(`Licença recusada ${C.dim}(${ms}ms)${R}`);
  console.log();
  caixa("ACESSO BLOQUEADO", [
    `${C.erro}${motivo}${R}`,
    `${C.dim}Fale com o criador para regularizar sua licença.${R}`
  ], C.erro);
  return false;
}

// ==============================================
// 📦 CARREGAR MÓDULOS (comandos/)
// ==============================================
async function carregarModulos({ pasta, comandos, hooksMensagem }) {
  titulo("CARREGANDO MÓDULOS");

  if (!fs.existsSync(pasta)) {
    erro('A pasta "comandos/" não existe!');
    return;
  }

  const arquivos = fs.readdirSync(pasta).filter(a => a.endsWith(".js")).sort();
  const total = arquivos.length;
  const larNome = Math.min(20, Math.max(8, ...arquivos.map(a => a.length)) + 1);
  const t0 = Date.now();

  let ok = 0, falhas = 0, hooks = 0, totalCmd = 0;
  const duplicados = [];

  for (let i = 0; i < total; i++) {
    const arq = arquivos[i];
    const idx = `${String(i + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}`;
    const nomeFmt = arq.length > larNome ? arq.slice(0, larNome - 1) + "…" : arq.padEnd(larNome);

    try {
      const mod = require(path.join(pasta, arq));

      if (typeof mod.aoReceberMensagem === "function") {
        hooksMensagem.push(mod.aoReceberMensagem);
        hooks++;
      }

      if (mod.comandos && Array.isArray(mod.comandos)) {
        const nomes = [];
        for (const c of mod.comandos) {
          if (comandos.has(c.nome)) duplicados.push(`${c.nome} (${arq})`);
          comandos.set(c.nome, c.executar);
          nomes.push(c.nome);
        }
        ok++;
        totalCmd += nomes.length;

        const usado = 2 + 5 + 1 + 1 + 1 + larNome + 1 + 3 + 8;
        const disp = LARG - usado;
        let prev = nomes.join(", ");
        if (prev.length > disp) prev = prev.slice(0, Math.max(0, disp - 1)) + "…";
        const previa = disp >= 8 ? `${C.dim}▸ ${prev}${R}` : "";

        console.log(`  ${C.dim}${idx}${R} ${C.ok}✓${R} ${C.branco}${nomeFmt}${R} ${B}${C.neon}${String(nomes.length).padStart(3)}${R} ${previa}`);
      } else {
        console.log(`  ${C.dim}${idx}${R} ${C.aviso}!${R} ${C.aviso}${nomeFmt}${R} ${C.dim}sem propriedade "comandos"${R}`);
      }
    } catch (e) {
      falhas++;
      console.log(`  ${C.dim}${idx}${R} ${C.erro}✗${R} ${C.erro}${nomeFmt}${R} ${C.dim}${String(e.message).split("\n")[0].slice(0, 30)}${R}`);
    }
    await sleep(30);
  }

  console.log();
  if (duplicados.length) {
    aviso(`Comandos repetidos (o último carregado vence): ${duplicados.slice(0, 8).join(", ")}${duplicados.length > 8 ? " …" : ""}`);
    console.log();
  }

  caixa("RESUMO", [
    kv("Módulos", `${ok}/${total}  ${barra(ok, total, 20)}`),
    kv("Comandos", `${B}${C.neon}${comandos.size}${R}`),
    kv("Hooks", hooks),
    kv("Falhas", falhas ? `${C.erro}${falhas}${R}` : `${C.ok}0${R}`),
    kv("Tempo", `${((Date.now() - t0) / 1000).toFixed(2)}s`)
  ], falhas ? C.aviso : C.neon2);
}

// ==============================================
// 🖥️ TELAS DE CONEXÃO
// ==============================================
function painelStatus({ nomeBot, dono, numeroDono, conectado, numero }) {
  const status = conectado
    ? `${C.ok}● CONECTADO${R} ${C.dim}— ${numero}${R}`
    : `${C.erro}○ DESCONECTADO${R}`;
  caixa("STATUS", [
    kv("Bot", nomeBot),
    kv("Dono", dono),
    kv("Número dono", numeroDono),
    kv("Conexão", status)
  ]);
}

function menuOpcoes() {
  console.log();
  caixa("MENU DE CONEXÃO", [
    `${B}${C.neon}[1]${R} Conectar via QR Code`,
    `${B}${C.neon}[2]${R} Conectar via Código de Emparelhamento`,
    `${B}${C.neon}[0]${R} Sair`
  ]);
}

function cabecalhoQR() {
  console.log();
  caixa("ESCANEIE O QR CODE", [`${C.dim}WhatsApp → Aparelhos conectados → Conectar aparelho${R}`]);
  console.log();
}

function codigoPareamento(codigo) {
  console.log();
  caixa("CÓDIGO DE EMPARELHAMENTO", [
    "",
    centralizar(`${B}${C.neon}${codigo}${R}`, LARG - 4),
    "",
    `${C.dim}WhatsApp → Aparelhos conectados → Conectar com número${R}`
  ], C.ok);
  console.log();
}

function conectado(numero) {
  console.log();
  caixa("CONECTADO COM SUCESSO", [
    kv("Status", `${C.ok}● Online${R}`),
    kv("Número", numero),
    `${C.dim}Aguardando mensagens...${R}`
  ], C.ok);
  console.log();
}

module.exports = {
  C, R, B, sleep, banner, caixa, titulo, sucesso, erro, aviso, info,
  kv, prompt, barra, spinner, licenca, carregarModulos,
  painelStatus, menuOpcoes, cabecalhoQR, codigoPareamento, conectado
};

