module.exports = {
  comandos: [
    // ==============================================
    // 🤖 VERIFICADOR DE BOTS NO GRUPO
    // ==============================================
    {
      nome: "checkbots",
      descricao: "Verifica se tem outros bots no grupo (só dono)",
      async executar({ sock, idChat }) {
        if (!idChat.endsWith("@g.us")) return sock.sendMessage(idChat, { text: "❌ Só funciona em grupos." });

        try {
          const meta = await sock.groupMetadata(idChat);
          // Filtra quem tem nome de bot (heurística simples)
          const suspeitos = meta.participants.filter(p => {
            const nome = (p.name || p.notify || "").toLowerCase();
            return nome.includes("bot") || nome.includes("md") || nome.includes("hoshino") || nome.includes("infinity");
          });

          if (!suspeitos.length) {
            return sock.sendMessage(idChat, { text: "✅ *Nenhum outro bot detectado nesse grupo.*" });
          }

          const mentions = suspeitos.map(s => s.id);
          const linhas = suspeitos.map(s => {
            const num = String(s.id).split("@")[0].split(":")[0];
            const nome = s.name || s.notify || "Sem nome";
            return `┃ 🤖 @${num} (${nome})`;
          }).join("\n");

          await sock.sendMessage(idChat, {
            text: `🚨 *BOTS DETECTADOS NO GRUPO:*\n\n${linhas}\n\n> ⚠️ *Cuidado!* Bots podem tentar roubar seus comandos.`,
            mentions
          });
        } catch (e) {
          await sock.sendMessage(idChat, { text: `❌ Erro: ${e.message}` });
        }
      }
    }
  ]
};
