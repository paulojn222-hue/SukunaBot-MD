const fs = require("fs");
const path = require("path");

const ARQUIVO_MENU = path.join(__dirname, "..", "personalize_aqui", "menu.txt");

function carregarMenu() {
  try {
    return fs.readFileSync(ARQUIVO_MENU, "utf8");
  } catch (e) {
    return "❌ Arquivo personalize_aqui/menu.txt não encontrado!";
  }
}

module.exports = {
  comandos: [
    {
      nome: "menu",
      descricao: "Mostra o menu do bot",
      async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME, totalComandos }) {
        // 📅 Data e hora em Brasília
        const agora = new Date();
        const data = agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const hora = agora.toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit"
        });

        // 👤 Usuário que mandou a mensagem
        const remetente = msg.key.participant || msg.key.remoteJid;
        const userNumero = String(remetente).split("@")[0].split(":")[0];
        const userMencao = `@${userNumero}`;

        // 📝 Carrega o texto e substitui os placeholders
        let texto = carregarMenu()
          .replace(/{BOT}/g, NOME_BOT || "HoshinoBot-MD v2")
          .replace(/{USER}/g, userMencao)
          .replace(/{PREFIXO}/g, PREFIXO || "!")
          .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Não definido")
          .replace(/{DATA}/g, data)
          .replace(/{HORA}/g, hora)
          .replace(/{TOTAL}/g, totalComandos || 0);

// 📎 Verifica se tem mídia salva pro menu principal
const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menu.json");
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
} catch (e) {
  console.log("Erro lendo mídia do menu:", e.message);
}
        // 📤 Envia (com mídia ou só texto)
if (midia?.meta?.tipo === "image") {
  await sock.sendMessage(idChat, {
    image: midia.buffer,
    caption: texto,
    mentions: [remetente]
  });
} else if (midia?.meta?.tipo === "video") {
  await sock.sendMessage(idChat, {
    video: midia.buffer,
    caption: texto,
    mentions: [remetente],
    gifPlayback: true // 👈 ENVIA COMO GIF
  });
} else {
  await sock.sendMessage(idChat, {
    text: texto,
    mentions: [remetente]
  });
}
      }
    }
  ]
};
