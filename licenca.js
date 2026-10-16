const config = require("./config.js");

// ==============================================
// 🔑 CONFIGURAÇÃO DA API
// ==============================================
const API = "https://thekhempire.com/api/lic/v1/validar";

// ==============================================
// 🔍 VALIDAR LICENÇA
// ==============================================
async function validarLicenca(chave, dispositivo) {
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave, dispositivo })
    });
    return await r.json();
  } catch (e) {
    console.log("⚠️ Erro de rede ao validar licença:", e.message);
    return { ok: false, motivo: "rede" };
  }
}

// ==============================================
// 🛡️ VERIFICAR LICENÇA (chamada no boot)
// ==============================================
async function verificarLicenca() {
  const CHAVE = (config.LICENCA || "").trim();
  const NUMERO = config.NUMERO_BOT || config.DONO_PRINCIPAL_NUMERO || "";

  console.log("\n🔑 Verificando licença...");

  // 1. Sem key configurada
  if (!CHAVE || CHAVE === "SUA_KEY_AQUI") {
    console.log("\n❌ NENHUMA LICENÇA CONFIGURADA!");
    console.log("👉 Coloque sua key no config.js (campo LICENCA).");
    console.log("👉 Solicite uma key ao dono do bot.\n");
    return false;
  }

  // 2. Valida com a API
  const lic = await validarLicenca(CHAVE, NUMERO);

  if (!lic.ok) {
    const motivos = {
      invalida: "Chave inválida.",
      revogada: "Licença revogada. Fale com o suporte.",
      expirada: "Licença expirada. Renove para continuar.",
      outro_dispositivo: "Esta chave já está sendo usada em outro número.",
      projeto_inativo: "Serviço temporariamente indisponível.",
      rede: "Sem conexão com o servidor de licenças."
    };
    console.log(`\n❌ ${motivos[lic.motivo] || "Licença não validada."}\n`);
    return false;
  }

  console.log(`✅ Licença ok — cliente: ${lic.cliente || "N/A"}\n`);
  return true;
}

// ==============================================
// 🔄 REVALIDAR DE 6 EM 6 HORAS
// ==============================================
function iniciarRevalidacao() {
  const CHAVE = (config.LICENCA || "").trim();
  const NUMERO = config.NUMERO_BOT || config.DONO_PRINCIPAL_NUMERO || "";

  setInterval(async () => {
    const v = await validarLicenca(CHAVE, NUMERO);
    if (v && !v.ok) {
      console.error(`❌ Licença deixou de ser válida: ${v.motivo}`);
      process.exit(1);
    }
    console.log("✅ Licença revalidada.");
  }, 6 * 60 * 60 * 1000);
}

module.exports = { verificarLicenca, iniciarRevalidacao };
