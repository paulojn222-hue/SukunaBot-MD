const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { execSync } = require("child_process");

const config = require("../config.js");

// ==============================================
// 🔧 CONFIGURAÇÃO
// ==============================================
const GITHUB_USER = "paulojn222-hue";
const GITHUB_REPO = "SukunaBot-MD";
const GITHUB_BRANCH = "main";

const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/version.js`;

// ==============================================
// 🛡️ NUNCA SOBRESCREVER (dados e personalizações do cliente)
// Mesmo que um ZIP futuro venha com algum desses itens (por engano),
// o conteúdo que já existe no bot do cliente é mantido.
//
// ⚠️ licenca.js está aqui porque você pediu pra preservar — isso significa
// que uma atualização de licença enviada no ZIP NÃO vai mais substituir o
// licenca.js do cliente. Se um dia precisar empurrar correções de licença,
// remova "licenca.js" desta lista antes de gerar o deploy.
// ==============================================
const PROTEGIDOS = [
  "auth",
  "dados",
  "config.js",
  "package.json",
  "personalize_aqui",
  "licenca.js",
  "node_modules"
];

// ==============================================
// 🛠️ HELPERS
// ==============================================
async function baixarVersaoRemota() {
  try {
    const r = await axios.get(VERSION_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000
    });

    // O arquivo é um module.exports, precisa avaliar
    const texto = r.data;
    const match = texto.match(/module\.exports\s*=\s*({[\s\S]*?});/);
    if (!match) throw new Error("Formato do version.js inválido");

    // Avalia o objeto
    const obj = eval("(" + match[1] + ")");
    return obj;
  } catch (e) {
    console.log("Erro baixando version.js:", e.message);
    return null;
  }
}

function compararVersoes(v1, v2) {
  const p1 = v1.split(".").map(Number);
  const p2 = v2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if ((p1[i] || 0) > (p2[i] || 0)) return 1;  // v1 > v2
    if ((p1[i] || 0) < (p2[i] || 0)) return -1; // v1 < v2
  }
  return 0; // iguais
}

function atualizarVersaoConfig(novaVersao) {
  const ARQ = path.join(__dirname, "..", "config.js");
  try {
    let conteudo = fs.readFileSync(ARQ, "utf8");

    if (conteudo.match(/VERSAO\s*:\s*"[^"]*"/)) {
      conteudo = conteudo.replace(/VERSAO\s*:\s*"[^"]*"/, `VERSAO: "${novaVersao}"`);
    } else {
      // Adiciona antes do fechamento
      conteudo = conteudo.replace(/\n};?\s*$/, `\n  VERSAO: "${novaVersao}"\n};\n`);
    }

    fs.writeFileSync(ARQ, conteudo);
    return true;
  } catch (e) {
    console.log("Erro atualizando config.js:", e.message);
    return false;
  }
}

// ==============================================
// 🛡️ CÓPIA PROTEGIDA
// Copia tudo que foi extraído do ZIP para a raiz do bot, EXCETO os itens
// de PROTEGIDOS (verificados só no nível raiz — uma pasta "dados" dentro
// de "comandos/", por exemplo, não seria bloqueada por engano).
// Arquivos/pastas que já existem e não vieram no ZIP são mantidos como estão
// (igual o unzip -o se comportava: só sobrescreve, nunca apaga).
// ==============================================
function copiarRecursivoPreservando(origem, destino, preservados, raizRelativaBase = "") {
  const itens = fs.readdirSync(origem);

  for (const item of itens) {
    const caminhoRelativo = raizRelativaBase ? path.join(raizRelativaBase, item) : item;

    if (!raizRelativaBase && PROTEGIDOS.includes(item)) {
      preservados.add(item);
      continue; // nunca entra nesse item vindo do ZIP
    }

    const origemItem = path.join(origem, item);
    const destinoItem = path.join(destino, item);
    const stat = fs.statSync(origemItem);

    if (stat.isDirectory()) {
      if (!fs.existsSync(destinoItem)) fs.mkdirSync(destinoItem, { recursive: true });
      copiarRecursivoPreservando(origemItem, destinoItem, preservados, caminhoRelativo);
    } else {
      fs.mkdirSync(path.dirname(destinoItem), { recursive: true });
      fs.copyFileSync(origemItem, destinoItem);
    }
  }
}

// ==============================================
// 📥 COMANDO ATUALIZAR
// ==============================================
module.exports = {
  comandos: [
    {
      nome: "atualizar",
      descricao: "Verifica e aplica atualizações do bot via ZIP",
      async executar({ sock, idChat }) {
        await sock.sendMessage(idChat, {
          text: "🔄 *VERIFICANDO ATUALIZAÇÕES...*\n\n> Consultando o GitHub..."
        });

        const caminhoRaiz = path.join(__dirname, "..");
        const tmpZip = path.join(caminhoRaiz, "temp_update.zip");
        const pastaExtracao = path.join(caminhoRaiz, "temp_update_extract");

        try {
          // 1. Baixa o version.js remoto
          const remoto = await baixarVersaoRemota();

          if (!remoto || !remoto.versao) {
            return sock.sendMessage(idChat, {
              text: "❌ *Não consegui verificar as atualizações.*\n\n> Tente novamente mais tarde."
            });
          }

          const versaoLocal = config.VERSAO || "0.0.0";
          const versaoRemota = remoto.versao;

          // 2. Compara versões
          const comparacao = compararVersoes(versaoRemota, versaoLocal);

          if (comparacao <= 0) {
            return sock.sendMessage(idChat, {
              text:
                `✅ *VOCÊ JÁ ESTÁ NA VERSÃO MAIS RECENTE!*\n\n` +
                `> 🔖 Sua versão: *${versaoLocal}*\n` +
                `> 🌐 Versão no GitHub: *${versaoRemota}*\n\n` +
                `> 💡 Nenhuma atualização disponível.`
            });
          }

          // 3. Tem atualização!
          const msg = remoto.mensagem || "Nova versão disponível!";

          if (!remoto.urlZip) {
            return sock.sendMessage(idChat, {
              text: "❌ *Erro de configuração:* O `version.js` não contém a variável `urlZip` com o link do ZIP."
            });
          }

          await sock.sendMessage(idChat, {
            text:
              `🎉 *ATUALIZAÇÃO DISPONÍVEL!*\n\n` +
              `> 🔖 Sua versão: *${versaoLocal}*\n` +
              `> 🌐 Nova versão: *${versaoRemota}*\n` +
              `> 📅 ${remoto.data || "Data não informada"}\n\n` +
              `> 📝 *Mensagem:*\n> _${msg}_\n\n` +
              `> ⏳ Baixando pacote de atualização...`
          });

          // 4. Baixa o ZIP
          const r = await axios.get(remoto.urlZip, {
            responseType: "arraybuffer",
            timeout: 60000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });

          fs.writeFileSync(tmpZip, r.data);

          // 5. Extrai o ZIP numa pasta TEMPORÁRIA (não direto na raiz do bot)
          await sock.sendMessage(idChat, {
            text: "📦 *Extraindo arquivos...*\n\n> Isso pode demorar um pouco."
          });

          try {
            // Verifica se o unzip está instalado
            execSync("unzip -v", { stdio: "ignore" });
          } catch (e) {
            throw new Error("O comando 'unzip' não está instalado no Termux. Peça para o cliente rodar: pkg install unzip");
          }

          if (fs.existsSync(pastaExtracao)) {
            fs.rmSync(pastaExtracao, { recursive: true, force: true });
          }
          fs.mkdirSync(pastaExtracao, { recursive: true });

          execSync(`unzip -o "${tmpZip}" -d "${pastaExtracao}"`, { stdio: "inherit" });

          // 6. Copia da pasta temporária pra raiz, PULANDO os itens protegidos
          const preservados = new Set();
          copiarRecursivoPreservando(pastaExtracao, caminhoRaiz, preservados);

          // 7. Remove a pasta temporária e o ZIP
          fs.rmSync(pastaExtracao, { recursive: true, force: true });
          fs.unlinkSync(tmpZip);

          // 8. Atualiza a versão no config.js
          const atualizouConfig = atualizarVersaoConfig(versaoRemota);

          // 9. Avisa e reinicia
          const listaPreservados = PROTEGIDOS
            .map(p => (preservados.has(p) ? `• ${p} *(detectado no pacote e ignorado)*` : `• ${p}`))
            .join("\n> ");

          await sock.sendMessage(idChat, {
            text:
              `✅ *ATUALIZAÇÃO CONCLUÍDA!*\n\n` +
              `> 🔖 Nova versão: *${versaoRemota}*\n` +
              `> ⚙️ Config atualizado: *${atualizouConfig ? "✅" : "❌"}*\n` +
              `> 🔄 Reiniciando em *5 segundos*...\n\n` +
              `> 💡 Itens sempre preservados:\n> ${listaPreservados}`
          });

          setTimeout(() => {
            console.log("🔄 Reiniciando após atualização via ZIP...");
            process.exit(0);
          }, 5000);

        } catch (e) {
          console.log("Erro ao atualizar:", e.message);

          // Limpeza em caso de erro, pra não deixar lixo temporário
          try { if (fs.existsSync(pastaExtracao)) fs.rmSync(pastaExtracao, { recursive: true, force: true }); } catch {}
          try { if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip); } catch {}

          await sock.sendMessage(idChat, {
            text: `❌ *Erro na atualização:*\n\n> ${e.message}`
          });
        }
      }
    }
  ]
};

