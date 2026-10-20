const COR = {
  reset: "\x1b[0m",
  branco: "\x1b[37m",
  vermelho: "\x1b[31m",
  verde: "\x1b[32m",
  amarelo: "\x1b[33m",
  azul: "\x1b[34m",
  magenta: "\x1b[35m",
  ciano: "\x1b[36m",
  brilhante: "\x1b[1m",
  cianoBrilhante: "\x1b[96m"   // 👈 NOVO: ciano brilhante
};

const TEMA = {
  titulo: "\x1b[96m",        // ciano brilhante
  destaque: "\x1b[96m",      // ciano brilhante
  sucesso: "\x1b[96m",       // ciano brilhante
  erro: "\x1b[31m",          // 🔴 continua vermelho
  aviso: "\x1b[33m",         // 🟡 continua amarelo (destaque)
  info: "\x1b[96m",          // ciano brilhante
  opcao: "\x1b[33m",         // 🟡 continua amarelo
  linha: "\x1b[96m"          // ciano brilhante
};

module.exports = { COR, TEMA };
