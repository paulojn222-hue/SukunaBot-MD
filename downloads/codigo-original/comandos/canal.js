const fs = require("fs");
const path = require("path");

module.exports = {
  comandos: [
    // ==============================================
    // 🪄 MENU CANAL
    // ==============================================
    {
      nome: "menucanal",
      descricao: "Mostra o menu do canal",
      async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME }) {
        const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        
        // Caminho do texto do menu
        const caminhoMenu = path.join(__dirname, "..", "personalize_aqui", "menu_canal.txt");
        
        if (!fs.existsSync(caminhoMenu)) {
          return sock.sendMessage(idChat, { text: "❌ Arquivo *personalize_aqui/menu_canal.txt* não encontrado!" });
        }

        let texto = fs.readFileSync(caminhoMenu, "utf8")
          .replace(/{PREFIXO}/g, PREFIXO || "!")
          .replace(/{BOT}/g, NOME_BOT || "Bot")
          .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
          .replace(/{DATA}/g, data);

        // Verifica mídia (se você configurou uma foto/vídeo pro menu do canal)
        const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menucanal.json");
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
        } catch {}

        if (midia?.meta?.tipo === "image") {
          await sock.sendMessage(idChat, { image: midia.buffer, caption: texto });
        } else if (midia?.meta?.tipo === "video") {
          await sock.sendMessage(idChat, { video: midia.buffer, caption: texto, gifPlayback: true });
        } else {
          await sock.sendMessage(idChat, { text: texto });
        }
      }
    }
  ]
};
