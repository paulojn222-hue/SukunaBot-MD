const fs = require("fs");
const path = require("path");

module.exports = {
  comandos: [
    {
      nome: "botao",
      descricao: "Ativa/desativa os botões interativos no menu",
      async executar({ sock, idChat, msg, resto }) {
        const ARQ_CFG_MENU = path.join(__dirname, "..", "dados", "config_menu.json");
        
        const op = resto ? resto.trim().toLowerCase() : "";
        if (!['on', 'off'].includes(op)) {
          return sock.sendMessage(idChat, { text: "❌ Use: *!botao on* ou *!botao off*" }, { quoted: msg });
        }

        let cfg = {};
        try {
          if (fs.existsSync(ARQ_CFG_MENU)) cfg = JSON.parse(fs.readFileSync(ARQ_CFG_MENU, "utf8"));
        } catch (e) {}

        cfg.botoes = (op === 'on');

        if (!fs.existsSync(path.dirname(ARQ_CFG_MENU))) {
          fs.mkdirSync(path.dirname(ARQ_CFG_MENU), { recursive: true });
        }
        fs.writeFileSync(ARQ_CFG_MENU, JSON.stringify(cfg, null, 2));

        await sock.sendMessage(idChat, { 
          text: `✅ Menu com botões *${op.toUpperCase()}*!` 
        }, { quoted: msg });
      }
    }
  ]
};
