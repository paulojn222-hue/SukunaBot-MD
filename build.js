const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

// ==============================================
// 🔧 CONFIGURAÇÃO
// ==============================================
const ORIGEM = path.join(__dirname);                          // ~/HoshinoBot-MD-v2
const PASTA_DIST = path.join(__dirname, "..", "hoshino-novo"); // ~/hoshino-novo

// ==============================================
// 📦 O QUE OFUSCAR
// ==============================================
const ARQUIVOS_OFUSCAR = [
  "index.js",
  "config_visual.js",
  "package.json"
];

const PASTAS_OFUSCAR = [
  "comandos"
];

// ==============================================
// 📋 O QUE COPIAR LIMPO (cliente edita)
// ==============================================
const COPIAR = [
  "config.js",
  "personalize_aqui",
  "package.json",
  "comandos/atualizar.js",
  "version.js",
  "licenca.js"
];

// ==============================================
// 🛡️ NUNCA TOCAR (preserva do cliente)
// ==============================================
const PROTEGIDOS = [
  ".git",
  "auth",
  "dados",
  "node_modules",
  "temp_*"
];

// ==============================================
// 🛠️ FUNÇÕES
// ==============================================
function garantirPasta(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function ofuscarArquivo(origem, destino) {
  try {
    const codigo = fs.readFileSync(origem, "utf8");
    const resultado = JavaScriptObfuscator.obfuscate(codigo, {
      compact: true,
      identifierNamesGenerator: "hexadecimal",
      stringArray: true,
      stringArrayEncoding: ["base64"],
      stringArrayThreshold: 0.75,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 1,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 2,
      stringArrayWrappersType: "variable",
      splitStrings: true,
      splitStringsChunkLength: 10,
      numbersToExpressions: true,
      simplify: true,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      selfDefending: false,
      debugProtection: false,
      disableConsoleOutput: false,
      renameGlobals: false
    }).getObfuscatedCode();

    garantirPasta(path.dirname(destino));
    fs.writeFileSync(destino, resultado);
    console.log(`🔒 Ofuscado: ${path.relative(ORIGEM, origem)}`);
  } catch (e) {
    console.log(`❌ Erro ofuscando ${origem}: ${e.message}`);
  }
}

function ofuscarPasta(pastaOrigem, pastaDestino) {
  if (!fs.existsSync(pastaOrigem)) return;
  garantirPasta(pastaDestino);

  const itens = fs.readdirSync(pastaOrigem);
  for (const item of itens) {
    // Pula o atualizar.js (fica limpo)
    if (item === "atualizar.js") continue;

    const origem = path.join(pastaOrigem, item);
    const destino = path.join(pastaDestino, item);

    const stat = fs.statSync(origem);
    if (stat.isDirectory()) {
      ofuscarPasta(origem, destino);
    } else if (item.endsWith(".js")) {
      ofuscarArquivo(origem, destino);
    } else {
      // Arquivos não-js copia normal
      garantirPasta(path.dirname(destino));
      fs.copyFileSync(origem, destino);
    }
  }
}

function copiarLimpo(origem, destino) {
  if (!fs.existsSync(origem)) return;
  const stat = fs.statSync(origem);

  if (stat.isDirectory()) {
    garantirPasta(destino);
    for (const item of fs.readdirSync(origem)) {
      // Ignora os protegidos
      if (PROTEGIDOS.some(p => item.match(new RegExp("^" + p.replace("*", ".*") + "$")))) continue;
      copiarLimpo(path.join(origem, item), path.join(destino, item));
    }
  } else {
    garantirPasta(path.dirname(destino));
    fs.copyFileSync(origem, destino);
    console.log(`📋 Copiado limpo: ${path.relative(ORIGEM, origem)}`);
  }
}

// ==============================================
// 🚀 BUILD
// ==============================================
console.log("🔨 Iniciando build...\n");
console.log("📂 Origem:", ORIGEM);
console.log("📂 Destino:", PASTA_DIST);
console.log("");

// 1. Limpa o destino (preservando o .git e node_modules)
if (fs.existsSync(PASTA_DIST)) {
  const itens = fs.readdirSync(PASTA_DIST);
  for (const item of itens) {
    if (PROTEGIDOS.some(p => item.match(new RegExp("^" + p.replace("*", ".*") + "$")))) continue;
    const caminho = path.join(PASTA_DIST, item);
    try {
      fs.rmSync(caminho, { recursive: true, force: true });
    } catch (e) {
      console.log(`⚠️ Erro limpando ${item}: ${e.message}`);
    }
  }
}
garantirPasta(PASTA_DIST);

// 2. Ofusca arquivos soltos
for (const arq of ARQUIVOS_OFUSCAR) {
  const origem = path.join(ORIGEM, arq);
  const destino = path.join(PASTA_DIST, arq);

  if (!fs.existsSync(origem)) {
    console.log(`⚠️ Não existe: ${arq}`);
    continue;
  }

  // package.json não ofusca (JSON)
  if (arq === "package.json") {
    fs.copyFileSync(origem, destino);
    console.log(`📋 Copiado: ${arq}`);
  } else {
    ofuscarArquivo(origem, destino);
  }
}

// 3. Ofusca pastas
for (const pasta of PASTAS_OFUSCAR) {
  const origem = path.join(ORIGEM, pasta);
  const destino = path.join(PASTA_DIST, pasta);
  if (fs.existsSync(origem)) {
    ofuscarPasta(origem, destino);
  }
}

// 4. Copia limpo
console.log("");
for (const item of COPIAR) {
  copiarLimpo(path.join(ORIGEM, item), path.join(PASTA_DIST, item));
}

console.log("\n🎉 Build concluído!");
console.log("📂 Arquivos em:", PASTA_DIST);
console.log("\n💡 Próximo passo:");
console.log("   cd ~/hoshino-novo");
console.log("   git add .");
console.log('   git commit -m "atualização"');
console.log("   git push origin HEAD:main");
