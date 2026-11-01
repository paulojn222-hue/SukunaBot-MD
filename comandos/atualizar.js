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
          const caminhoRaiz = path.join(__dirname, "..");
          const tmpZip = path.join(caminhoRaiz, "temp_update.zip");

          const r = await axios.get(remoto.urlZip, {
            responseType: "arraybuffer",
            timeout: 60000,
            headers: { "User-Agent": "Mozilla/5.0" }
          });

          fs.writeFileSync(tmpZip, r.data);

          // 5. Extrai o ZIP
          await sock.sendMessage(idChat, {
            text: "📦 *Extraindo arquivos...*\n\n> Isso pode demorar um pouco."
          });

          try {
            // Verifica se o unzip está instalado
            execSync("unzip -v", { stdio: "ignore" });
          } catch (e) {
            throw new Error("O comando 'unzip' não está instalado no Termux. Peça para o cliente rodar: pkg install unzip");
          }

          // Extrai sobrescrevendo os arquivos antigos (-o)
          // O destino é a raiz do bot
          execSync(`unzip -o "${tmpZip}" -d "${caminhoRaiz}"`, { stdio: 'inherit' });

          // 6. Remove o ZIP temporário
          fs.unlinkSync(tmpZip);

          // 7. Atualiza a versão no config.js
          const atualizouConfig = atualizarVersaoConfig(versaoRemota);

          // 8. Avisa e reinicia
          await sock.sendMessage(idChat, {
            text:
              `✅ *ATUALIZAÇÃO CONCLUÍDA!*\n\n` +
              `> 🔖 Nova versão: *${versaoRemota}*\n` +
              `> ⚙️ Config atualizado: *${atualizouConfig ? "✅" : "❌"}*\n` +
              `> 🔄 Reiniciando em *5 segundos*...\n\n` +
              `> 💡 Seus dados foram preservados:\n` +
              `> • auth, dados, personalize_aqui, config.js`
          });

          setTimeout(() => {
            console.log("🔄 Reiniciando após atualização via ZIP...");
            process.exit(0);
          }, 5000);

        } catch (e) {
          console.log("Erro ao atualizar:", e.message);
          await sock.sendMessage(idChat, {
            text: `❌ *Erro na atualização:*\n\n> ${e.message}`
          });
        }
      }
    }
  ]
};
