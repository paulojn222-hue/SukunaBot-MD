const fs = require("fs");
const path = require("path");
const axios = require("axios");

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

async function baixarArquivo(url, destino) {
  try {
    const r = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    // Garante que a pasta existe
    fs.mkdirSync(path.dirname(destino), { recursive: true });

    // Faz backup antes de sobrescrever
    if (fs.existsSync(destino)) {
      const backup = destino + ".bak";
      fs.copyFileSync(destino, backup);
    }

    fs.writeFileSync(destino, r.data);

    // Remove backup
    if (fs.existsSync(destino + ".bak")) {
      fs.unlinkSync(destino + ".bak");
    }

    return true;
  } catch (e) {
    console.log(`Erro baixando ${url}:`, e.message);

    // Restaura backup se falhou
    if (fs.existsSync(destino + ".bak")) {
      try {
        fs.copyFileSync(destino + ".bak", destino);
        fs.unlinkSync(destino + ".bak");
      } catch {}
    }
    return false;
  }
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

module.exports = {
  comandos: [
    {
      nome: "atualizar",
      descricao: "Verifica e aplica atualizações do bot",
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
          const qtdArquivos = (remoto.arquivos || []).length;

          await sock.sendMessage(idChat, {
            text:
              `🎉 *ATUALIZAÇÃO DISPONÍVEL!*\n\n` +
              `> 🔖 Sua versão: *${versaoLocal}*\n` +
              `> 🌐 Nova versão: *${versaoRemota}*\n` +
              `> 📅 ${remoto.data || "Data não informada"}\n\n` +
              `> 📝 *Mensagem:*\n> _${msg}_\n\n` +
              `> 📦 Arquivos para atualizar: *${qtdArquivos}*\n` +
              `> ⏳ Baixando...`
          });

          // 4. Baixa cada arquivo
          let sucesso = 0;
          let falha = 0;

          for (const arq of (remoto.arquivos || [])) {
            if (!arq.url || !arq.destino) continue;

            const destino = path.join(__dirname, "..", arq.destino);
            const ok = await baixarArquivo(arq.url, destino);

            if (ok) {
              sucesso++;
              console.log(`✅ Baixado: ${arq.destino}`);
            } else {
              falha++;
              console.log(`❌ Falhou: ${arq.destino}`);
            }
          }

// 5. Se algum arquivo baixado for package.json, roda npm install
const baixouPackage = (remoto.arquivos || []).some(a => a.destino === "package.json");

if (baixouPackage) {
  await sock.sendMessage(idChat, {
    text: "📦 *Atualizando dependências...*\n\n> Isso pode demorar um pouco..."
  });

  const { execSync } = require("child_process");
  try {
    execSync("npm install", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
      timeout: 300000 // 5 minutos
    });
    console.log("✅ npm install concluído");
  } catch (e) {
    console.log("❌ Erro no npm install:", e.message);
    await sock.sendMessage(idChat, {
      text: `⚠️ Erro ao instalar dependências:\n\n> ${e.message}`
    });
  }
}

          // 5. Atualiza a versão no config.js
          const atualizouConfig = atualizarVersaoConfig(versaoRemota);

          // 6. Avisa e reinicia
          await sock.sendMessage(idChat, {
            text:
              `✅ *ATUALIZAÇÃO CONCLUÍDA!*\n\n` +
              `> 📦 Baixados: *${sucesso}*${falha > 0 ? ` | ❌ Falhas: *${falha}*` : ""}\n` +
              `> 🔖 Nova versão: *${versaoRemota}*\n` +
              `> ⚙️ Config atualizado: *${atualizouConfig ? "✅" : "❌"}*\n` +
              `> 🔄 Reiniciando em *5 segundos*...\n\n` +
              `> 💡 Pastas protegidas:\n` +
              `> • auth, dados, personalize_aqui, node_modules`
          });

          setTimeout(() => {
            console.log("🔄 Reiniciando após atualização...");
            process.exit(0);
          }, 5000);

        } catch (e) {
          console.log("Erro ao atualizar:", e.message);
          await sock.sendMessage(idChat, {
            text: `❌ *Erro:* ${e.message}`
          });
        }
      }
    }
  ]
};
