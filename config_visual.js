// ==============================
// 🎨 CONFIGURAÇÕES VISUAIS
// ==============================

module.exports = {
  // ==========================================
  // 🖍️ CORES DO TERMINAL
  // ==========================================
  COR: {
    reset: "\x1b[0m",
    brilhante: "\x1b[1m",
    escuro: "\x1b[2m",
    italico: "\x1b[3m",
    sublinhado: "\x1b[4m",
    
    preto: "\x1b[30m",
    vermelho: "\x1b[31m",
    verde: "\x1b[32m",
    amarelo: "\x1b[33m",
    azul: "\x1b[34m",
    roxo: "\x1b[35m",
    ciano: "\x1b[36m",
    branco: "\x1b[37m",
    
    fundoPreto: "\x1b[40m",
    fundoVermelho: "\x1b[41m",
    fundoVerde: "\x1b[42m",
    fundoAmarelo: "\x1b[43m",
    fundoAzul: "\x1b[44m",
    fundoRoxo: "\x1b[45m",
    fundoCiano: "\x1b[46m",
    fundoBranco: "\x1b[47m",
    
    vermelhoClaro: "\x1b[91m",
    verdeClaro: "\x1b[92m",
    amareloClaro: "\x1b[93m",
    azulClaro: "\x1b[94m",
    roxoClaro: "\x1b[95m",
    cianoClaro: "\x1b[96m",
    cinzaClaro: "\x1b[37m",
    cinzaEscuro: "\x1b[90m"
  },

  // ==========================================
  // 🎨 TEMA PRINCIPAL
  // ==========================================
  TEMA: {
    titulo: "\x1b[96m\x1b[1m",
    verde: "\x1b[92m",
    verdeClaro: "\x1b[92m",
    sucesso: "\x1b[92m\x1b[1m",
    erro: "\x1b[91m\x1b[1m",
    aviso: "\x1b[93m\x1b[1m",
    info: "\x1b[94m",
    roxo: "\x1b[95m",
    ciano: "\x1b[96m",
    linha: "\x1b[90m",
    branco: "\x1b[37m",
    dourado: "\x1b[38;5;214m"
  },

  // ==========================================
  // 😊 EMOJIS PADRÃO
  // ==========================================
  emoji: {
    sucesso: "✅",
    erro: "❌",
    aviso: "⚠️",
    info: "ℹ️",
    dono: "👑",
    bot: "🤖",
    admin: "🛡️",
    usuario: "👤",
    relogio: "⏰",
    dinheiro: "💵",
    lupa: "🔍",
    carregando: "⏳",
    coracao: "💖",
    estrela: "⭐",
    fogo: "🔥",
    raio: "⚡",
    flor: "🌸",
    lua: "🌙",
    sol: "☀️",
    cadeado: "🔒",
    chave: "🔑"
  },

  // ==========================================
  // ✨ SÍMBOLOS E DECORAÇÃO
  // ==========================================
  simbolos: {
    linha: "───",
    separador: "❬❭",
    topo: "✧══════•❁•══════✧",
    rodape: "✧══════•❁•══════✧",
    divisor: "━━━━━━━━━━━━━━━━━━━━",
    seta: "➤",
    check: "✓",
    cruz: "✗"
  },

  // ==========================================
  // 💬 MENSAGENS PADRÃO
  // ==========================================
  mensagens: {
    botSemPermissao: "⚠️ *Eu não sou administrador deste grupo!*\nPor favor, me dê o cargo de admin para que eu possa funcionar corretamente.",
    comandoApenasGrupo: "❌ Este comando só funciona em grupos!",
    comandoApenasAdmin: "❌ Apenas administradores podem usar este comando!",
    comandoApenasDono: "❌ Apenas o dono do bot pode usar este comando!",
    semMensagem: "❌ Você precisa digitar uma mensagem!",
    semResposta: "❌ Você precisa responder a uma mensagem!",
    semMarcar: "❌ Marque ou responda alguém!",
    naoEncontrado: "❌ Não encontrei o que você procura.",
    semPermissao: "🚫 *Acesso negado!* Você não tem permissão para usar este comando.",
    processando: "⏳ Processando... aguarde um instante!"
  }
};

