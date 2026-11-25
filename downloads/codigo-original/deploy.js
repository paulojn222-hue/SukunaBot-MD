const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const JavaScriptObfuscator = require("javascript-obfuscator");

// ==============================================
// ⚙️ CONFIGURAÇÕES DO GITHUB
// ==============================================
const REPO_URL = "https://github.com/paulojn222-hue/SukunaBot-MD.git";
const PASTA_DEPLOY = path.join(__dirname, "..", "deploy-github");
const PASTA_ZIP = path.join(PASTA_DEPLOY, "downloads");
const NOME_ZIP = "hoshino-atualizacao.zip";
const PASTA_ORIGINAIS = path.join(PASTA_ZIP, "codigo-original");
const PASTA_DIST = path.join(__dirname, "..", "TomiokaBot");

// ==============================================
// 📦 CONFIGURAÇÃO DO BUILD
// ==============================================
const ARQUIVOS_OFUSCAR = ["index.js", "config_visual.js"];
const PASTAS_OFUSCAR = ["comandos"];

// 👇 O que vai LIMPO para o ZIP (o que o cliente precisa para rodar)
const COPIAR = [
  "comandos/atualizar.js",
  "version.js",
  "licenca.js"
];

// 👇 O que NUNCA vai pro ZIP (protege os dados do cliente)
const PROTEGIDOS = [
  ".git", "auth", "dados", "node_modules", "temp_*", 
  "config.js", "package.json", "personalize_aqui"
];

function garantirPasta(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function ofuscarArquivo(origem, destino) {
  try {
    const codigo = fs.readFileSync(origem, "utf8");
    const resultado = JavaScriptObfuscator.obfuscate(codigo, {
      compact: true, identifierNamesGenerator: "hexadecimal", stringArray: true,
      stringArrayEncoding: ["base64"], stringArrayThreshold: 0.75, stringArrayRotate: true,
      stringArrayShuffle: true, stringArrayWrappersCount: 1, stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 2, stringArrayWrappersType: "variable",
      splitStrings: true, splitStringsChunkLength: 10, numbersToExpressions: true,
      simplify: true, transformObjectKeys: true, unicodeEscapeSequence: false,
      controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false,
      debugProtection: false, disableConsoleOutput: false, renameGlobals: false
    }).getObfuscatedCode();
    garantirPasta(path.dirname(destino));
    fs.writeFileSync(destino, resultado);
    console.log(`🔒 Ofuscado: ${path.relative(__dirname, origem)}`);
  } catch (e) { console.log(`❌ Erro ofuscando ${origem}: ${e.message}`); }
}

function ofuscarPasta(pastaOrigem, pastaDestino) {
  if (!fs.existsSync(pastaOrigem)) return;
  garantirPasta(pastaDestino);
  for (const item of fs.readdirSync(pastaOrigem)) {
    if (item === "atualizar.js") continue;
    const origem = path.join(pastaOrigem, item);
    const destino = path.join(pastaDestino, item);
    if (fs.statSync(origem).isDirectory()) ofuscarPasta(origem, destino);
    else if (item.endsWith(".js")) ofuscarArquivo(origem, destino);
    else { garantirPasta(path.dirname(destino)); fs.copyFileSync(origem, destino); }
  }
}

function copiarLimpo(origem, destino) {
  if (!fs.existsSync(origem)) return;
  if (fs.statSync(origem).isDirectory()) {
    garantirPasta(destino);
    for (const item of fs.readdirSync(origem)) {
      if (PROTEGIDOS.some(p => item.match(new RegExp("^" + p.replace("*", ".*") + "$")))) continue;
      copiarLimpo(path.join(origem, item), path.join(destino, item));
    }
  } else {
    garantirPasta(path.dirname(destino));
    fs.copyFileSync(origem, destino);
    console.log(`📋 Copiado limpo: ${path.relative(__dirname, origem)}`);
  }
}

// 🚀 1. RODA O BUILD
console.log("🔨 1. Ofuscando arquivos...");
if (fs.existsSync(PASTA_DIST)) fs.rmSync(PASTA_DIST, { recursive: true, force: true });
garantirPasta(PASTA_DIST);

for (const arq of ARQUIVOS_OFUSCAR) {
  const origem = path.join(__dirname, arq);
  const destino = path.join(PASTA_DIST, arq);
  if (!fs.existsSync(origem)) continue;
  ofuscarArquivo(origem, destino);
}
for (const pasta of PASTAS_OFUSCAR) ofuscarPasta(path.join(__dirname, pasta), path.join(PASTA_DIST, pasta));
for (const item of COPIAR) copiarLimpo(path.join(__dirname, item), path.join(PASTA_DIST, item));
console.log("🎉 Build concluído!");

// 🚀 2. PREPARA A PASTA DO GITHUB
console.log("📂 2. Preparando pasta do GitHub...");
if (!fs.existsSync(PASTA_DEPLOY)) {
  fs.mkdirSync(PASTA_DEPLOY, { recursive: true });
  execSync(`git clone ${REPO_URL} .`, { stdio: "inherit", cwd: PASTA_DEPLOY });
}
execSync("git fetch origin main && git reset --hard origin/main", { stdio: "inherit", cwd: PASTA_DEPLOY });

// 🚀 3. COPIA OS ARQUIVOS OFUSCADOS
console.log("📦 3. Copiando arquivos ofuscados...");
function copiarRecursivo(origem, destino) {
  if (!fs.existsSync(destino)) fs.mkdirSync(destino, { recursive: true });
  for (const item of fs.readdirSync(origem)) {
    if (item === ".git" || item === "node_modules" || item === "auth" || item === "dados" || item === "config.js" || item === "package.json" || item === "personalize_aqui") continue;
    const src = path.join(origem, item);
    const dest = path.join(destino, item);
    if (fs.statSync(src).isDirectory()) copiarRecursivo(src, dest);
    else fs.copyFileSync(src, dest);
  }
}
copiarRecursivo(PASTA_DIST, PASTA_DEPLOY);


function copiarOriginais(origem, destino) {
  const protegidos = [
    ".git", "auth", "dados", "node_modules", "temp_*",
    "personalize_aqui", "downloads"
  ];

  if (!fs.existsSync(origem)) return;

  garantirPasta(destino);

  for (const item of fs.readdirSync(origem)) {
    if (protegidos.some(p =>
      item === p || (p.includes("*") && item.startsWith(p.replace("*", "")))
    )) continue;

    if (item.startsWith(".env") || /\.(pem|key|session)$/i.test(item)) continue;

    const src = path.join(origem, item);
    const dest = path.join(destino, item);

    if (fs.statSync(src).isDirectory()) {
      copiarOriginais(src, dest);
    } else {
      garantirPasta(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  }
}

console.log("📂 Copiando arquivos originais...");
if (fs.existsSync(PASTA_ORIGINAIS)) {
  fs.rmSync(PASTA_ORIGINAIS, { recursive: true, force: true });
}
garantirPasta(PASTA_ORIGINAIS);
copiarOriginais(__dirname, PASTA_ORIGINAIS);
console.log("✅ Arquivos originais copiados!");

 // 🚀 4. CRIA O ZIP
console.log("🗜️ 4. Criando o ZIP para os clientes...");
if (!fs.existsSync(PASTA_ZIP)) fs.mkdirSync(PASTA_ZIP, { recursive: true });
const caminhoZip = path.join(PASTA_ZIP, NOME_ZIP);
if (fs.existsSync(caminhoZip)) fs.unlinkSync(caminhoZip);
execSync(`cd "${PASTA_DIST}" && zip -r -q -9 "${caminhoZip}" .`, { stdio: "inherit" });
console.log(`✅ ZIP gerado em: downloads/${NOME_ZIP}`);

// 🚀 5. FAZ O PUSH
console.log("🚀 5. Enviando para o GitHub...");
try {
  execSync("git add .", { stdio: "inherit", cwd: PASTA_DEPLOY });
  execSync('git commit -m "Deploy v1.6.5: correcoes no index e novos comandos"', { stdio: "inherit", cwd: PASTA_DEPLOY });
  execSync("git push origin main", { stdio: "inherit", cwd: PASTA_DEPLOY });
  console.log("🎉 SUCESSO! Tudo enviado para o GitHub!");
} catch (e) {
  console.log("⚠️ Aviso: O git commit falhou (talvez não tenha mudanças).");
}
