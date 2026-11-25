const fs = require("fs");
const path = require("path");

const ARQUIVO_MENU_1 = path.join(__dirname, "..", "personalize_aqui", "menu.txt");
const ARQUIVO_MENU_2 = path.join(__dirname, "..", "menus", "menu.txt");
const ARQ_CFG_MENU = path.join(__dirname, "..", "dados", "config_menu.json");

function carregarMenu() {
  try {
    if (fs.existsSync(ARQUIVO_MENU_1)) return fs.readFileSync(ARQUIVO_MENU_1, "utf8");
    if (fs.existsSync(ARQUIVO_MENU_2)) return fs.readFileSync(ARQUIVO_MENU_2, "utf8");
    return "❌ Menu não encontrado.";
  } catch {
    return "❌ Erro ao ler o arquivo.";
  }
}

function obterSaudacao() {
  const hora = Number(new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

module.exports = {
  comandos: [
    {
      nome: "menu",
      descricao: "Mostra o menu do bot",
      async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME, DONO_PRINCIPAL_NUMERO, DONO_PRINCIPAL_LID, totalComandos, botaoCanal }) {
        const remetente = msg.key.participant || msg.key.remoteJid;

        // Carrega a mídia (se tiver)
        const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menu.json");
        let midia = null;
        try {
          if (fs.existsSync(caminhoMeta)) {
            const meta = JSON.parse(fs.readFileSync(caminhoMeta, "utf8"));
            if (meta && typeof meta.arquivo === "string") {
              const caminhoArq = path.join(__dirname, "..", "dados", meta.arquivo);
              if (fs.existsSync(caminhoArq)) midia = { meta, buffer: fs.readFileSync(caminhoArq) };
            }
          }
        } catch {}

        // MODO TEXTO (O único modo agora)
        const agora = new Date();
        const data = agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const hora = agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        
        const userNumero = String(remetente).split("@")[0].split(":")[0];
        const saudacao = obterSaudacao();

        // 👇 Puxa o número do dono, se não tiver número, puxa o LID
        const numeroDono = DONO_PRINCIPAL_NUMERO || DONO_PRINCIPAL_LID || "Não definido";

        let texto = carregarMenu()
          .replace(/{botName}/g, NOME_BOT || "Bot")
          .replace(/{user}/g, `@${userNumero}`)
          .replace(/{prefix}/g, PREFIXO || "!")
          .replace(/{ownerName}/g, DONO_PRINCIPAL_NOME || "Dono")
          .replace(/{date}/g, data)
          .replace(/{time}/g, hora)
          .replace(/{ownerNumber}/g, numeroDono) // 👈 Substitui aqui
          .replace(/{quantia_comandos}/g, totalComandos || 0)
          .replace(/{SAUDACAO}/g, saudacao);

        const botao = botaoCanal ? botaoCanal() : {};

        if (midia?.meta?.tipo === "image") {
          await sock.sendMessage(idChat, { image: midia.buffer, caption: texto, mentions: [remetente], ...botao });
        } else if (midia?.meta?.tipo === "video") {
          await sock.sendMessage(idChat, { video: midia.buffer, caption: texto, mentions: [remetente], gifPlayback: true, ...botao });
        } else {
          await sock.sendMessage(idChat, { text: texto, mentions: [remetente], ...botao });
        }
      }
    }
  ]
};
