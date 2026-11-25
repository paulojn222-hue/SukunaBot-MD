const fs = require("fs");
const path = require("path");

const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");

// ==============================================
// 🛠️ BASE
// ==============================================
function lerRPG() {
  try {
    if (!fs.existsSync(ARQ_RPG)) return { usuarios: {}, grupos: {} };
    const d = JSON.parse(fs.readFileSync(ARQ_RPG, "utf8"));
    if (!d.usuarios) d.usuarios = {};
    return d;
  } catch { return { usuarios: {}, grupos: {} }; }
}

function salvarRPG(dados) {
  try { fs.writeFileSync(ARQ_RPG, JSON.stringify(dados, null, 2)); } catch (e) {}
}

function getUsuario(dados, num) {
  if (!dados.usuarios[num]) dados.usuarios[num] = {};
  const u = dados.usuarios[num];
  if (!u.jardim) u.jardim = { slots: 5, plantas: {}, inseticidas: 0, loja: [], ultimoResetLoja: 0 };
  return u;
}

function normalizarNumero(jid) {
  if (!jid) return "";
  return String(jid).split("@")[0].split(":")[0].replace(/\D/g, "");
}

function formatarTempo(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

// ==============================================
// 🌱 SEMENTES E MUTAÇÕES
// ==============================================
const SEMENTES = [
  { nome: "Cenoura", preco: 5, chance: 30, valor: 10, tempo: 30000, raridade: "Comum" },
  { nome: "Batata", preco: 10, chance: 25, valor: 20, tempo: 60000, raridade: "Comum" },
  { nome: "Tomate", preco: 20, chance: 20, valor: 40, tempo: 90000, raridade: "Incomum" },
  { nome: "Morango", preco: 50, chance: 15, valor: 100, tempo: 120000, raridade: "Incomum" },
  { nome: "Uva", preco: 100, chance: 10, valor: 200, tempo: 180000, raridade: "Raro" },
  { nome: "Abacaxi", preco: 250, chance: 5, valor: 500, tempo: 240000, raridade: "Raro" },
  { nome: "Melancia", preco: 400, chance: 3, valor: 800, tempo: 300000, raridade: "Épico" },
  { nome: "Feijão", preco: 800, chance: 1, valor: 1600, tempo: 600000, raridade: "Lendário" }
];

const MUTACOES = [
  { nome: "Prateada", mult: 0.5, chance: 10, emoji: "🤍" },
  { nome: "Queimada", mult: 1, chance: 8, emoji: "🔥" },
  { nome: "Congelada", mult: 1.5, chance: 6, emoji: "❄️" },
  { nome: "Úmida", mult: 2, chance: 4, emoji: "💧" },
  { nome: "Eletrocutada", mult: 2.5, chance: 2, emoji: "⚡" },
  { nome: "Dourada", mult: 5, chance: 1, emoji: "🌟" },
  { nome: "Rainbow", mult: 10, chance: 0.5, emoji: "🌈" }
];

// ==============================================
// 🎲 GERADOR DE LOJA (RESET A CADA 1H)
// ==============================================
function gerarLoja() {
  const loja = [];
  const pool = [...SEMENTES];
  
  // Sorteia entre 3 a 5 sementes para a loja
  const qtd = Math.floor(Math.random() * 3) + 3;
  
  for (let i = 0; i < qtd; i++) {
    const totalChance = pool.reduce((s, item) => s + item.chance, 0);
    let r = Math.random() * totalChance;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].chance;
      if (r <= 0) {
        loja.push({ ...pool[j], estoque: Math.floor(Math.random() * 3) + 1 });
        pool.splice(j, 1);
        break;
      }
    }
  }
  return loja;
}

module.exports = {
  comandos: [
// ==============================================
// 🏡 VER JARDIM (Corrigido)
// ==============================================
{
  nome: "jardin",
  descricao: "Mostra seu jardim",
  async executar({ sock, idChat, msg, normalizarNumero }) {
    const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
    const dados = lerRPG();
    const u = getUsuario(dados, num);

    const agora = Date.now();
    let pragasAviso = "";
    let textoPlantas = "";

    for (const [semente, info] of Object.entries(u.jardim.plantas)) {
      // 1. Verifica se a praga matou a planta
      if (info.pragaAtiva && !info.perdeu) {
        if (agora >= info.tempoPraga) {
          info.perdeu = true;
          info.pragaAtiva = false;
        } else {
          pragasAviso += `┃ ⚠️ *${semente}* com praga! (Use *!inseticida ${semente}*)\n`;
        }
      }

      // 2. Verifica o status real da planta
      let status = "🌱 Crescendo";
      if (info.perdeu) {
        status = "🥀 Morta (use *!coletar* pra limpar)";
      } else if (agora >= info.prontoEm) {
        status = "✅ Pronta pra coletar! (use *!coletar " + semente + "*)";
      } else {
        const falta = info.prontoEm - agora;
        status = `⏳ Crescendo (faltam ${formatarTempo(falta)})`;
      }

      const mut = info.mutacao ? `${info.mutacaoEmoji} ${info.mutacao} (${info.mult}x)` : "Normal";
      textoPlantas += `┃ - *${semente}*\n┃   Mutação: ${mut}\n┃   Status: ${status}\n`;
    }

    if (!textoPlantas) textoPlantas = "┃ _Nenhuma planta no momento_";
    
    salvarRPG(dados);

    await sock.sendMessage(idChat, {
      text: `🏡 *SEU JARDIM*\n\n> 🌱 Slots: *${Object.keys(u.jardim.plantas).length}/${u.jardim.slots}*\n> 🧪 Inseticidas: *${u.jardim.inseticidas}*\n\n${pragasAviso ? `⚠️ *AVISOS*\n${pragasAviso}\n` : ""}🌿 *Plantas:*\n${textoPlantas}`,
      mentions: [msg.key.participant || msg.key.remoteJid]
    });
  }
},
    // ==============================================
    // 🏗️ MELHORAR JARDIM
    // ==============================================
    {
      nome: "melhorar_jardin",
      descricao: "Aumenta os slots do jardim",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if (u.jardim.slots >= 20) return sock.sendMessage(idChat, { text: "❌ Seu jardim já está no nível máximo (20 slots)." });

        const custo = u.jardim.slots * 500;
        if ((u.moedas || 0) < custo) return sock.sendMessage(idChat, { text: `❌ Precisa de *${custo}* moedas para melhorar.` });

        u.moedas -= custo;
        u.jardim.slots += 1;
        salvarRPG(dados);

        await sock.sendMessage(idChat, { text: `✅ *JARDIM MELHORADO!*\n\n> Slots agora: *${u.jardim.slots}*\n> Custou: *${custo}*` });
      }
    },

// ==============================================
// 🛒 LOJA DE SEMENTES (Com Porcentagens)
// ==============================================
{
  nome: "loja_semente",
  descricao: "Loja de sementes (reseta a cada 1h)",
  async executar({ sock, idChat, msg, normalizarNumero, resto }) {
    const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
    const dados = lerRPG();
    const u = getUsuario(dados, num);

    const UMA_HORA = 3600000;
    if (Date.now() - u.jardim.ultimoResetLoja > UMA_HORA || u.jardim.loja.length === 0) {
      u.jardim.loja = gerarLoja();
      u.jardim.ultimoResetLoja = Date.now();
      salvarRPG(dados);
    }

    // Compra
    if (resto) {
      const partes = resto.trim().split(/\s+/);
      const index = parseInt(partes[0]) - 1;
      const qtd = parseInt(partes[1]) || 1;
      
      if (isNaN(index) || index < 0 || index >= u.jardim.loja.length) return sock.sendMessage(idChat, { text: "❌ ID inválido." });
      
      const semente = u.jardim.loja[index];
      if (semente.estoque < qtd) return sock.sendMessage(idChat, { text: "❌ Sem estoque suficiente." });
      
      const total = semente.preco * qtd;
      if ((u.moedas || 0) < total) return sock.sendMessage(idChat, { text: `❌ Precisa de *${total}* moedas.` });

      u.moedas -= total;
      
      if (!u.inventario) u.inventario = {};
      u.inventario[`semente_${semente.nome}`] = (u.inventario[`semente_${semente.nome}`] || 0) + qtd;
      semente.estoque -= qtd;
      
      salvarRPG(dados);
      return sock.sendMessage(idChat, { text: `✅ Comprou *${qtd}x Semente de ${semente.nome}* por *${total}* moedas!\n\n> Já está na sua mochila.` });
    }

    // Mostra loja
    let txt = `🌱 *LOJA DE SEMENTES*\n> Reseta em: *${formatarTempo(UMA_HORA - (Date.now() - u.jardim.ultimoResetLoja))}*\n\n`;
    u.jardim.loja.forEach((s, i) => {
      txt += `┃ *${i + 1}.* ${s.nome} (${s.raridade})\n┃    💰 ${s.preco} | 📦 Estoque: ${s.estoque}\n`;
    });
    
    // Mostra a tabela de chances
    txt += `\n📊 *CHANCES DE APARECER:*\n`;
    SEMENTES.forEach(s => {
      txt += `> ${s.nome}: *${s.chance}%*\n`;
    });

    txt += `\n> Comprar: *!loja_semente <ID> <QTD>*`;

    await sock.sendMessage(idChat, { text: txt });
  }
},

// ==============================================
// 🧺 COLETAR PLANTA (Vai pra mochila)
// ==============================================
{
  nome: "coletar",
  descricao: "Colhe uma planta pronta do jardim",
  async executar({ sock, idChat, msg, normalizarNumero, resto }) {
    const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
    const dados = lerRPG();
    const u = getUsuario(dados, num);

    const nome = (resto || "").trim();
    if (!nome) return sock.sendMessage(idChat, { text: "❌ Uso: *!coletar <nome>*" });

    const planta = u.jardim.plantas[nome];
    if (!planta) return sock.sendMessage(idChat, { text: "❌ Você não tem essa planta no jardim." });
    
    // Se estiver morta, só limpa o slot
    if (planta.perdeu) {
      delete u.jardim.plantas[nome];
      salvarRPG(dados);
      return sock.sendMessage(idChat, { text: `🥀 A planta *${nome}* estava morta e foi removida do jardim.` });
    }

    if (planta.pragaAtiva) return sock.sendMessage(idChat, { text: "🐛 A planta está com praga! Use *!inseticida* primeiro." });
    if (Date.now() < planta.prontoEm) return sock.sendMessage(idChat, { text: `⏰ A planta ainda está crescendo. Faltam *${formatarTempo(planta.prontoEm - Date.now())}*.` });

    // Guarda o nome com a mutação no inventário (se tiver)
    const nomeNoInv = planta.mutacao 
      ? `${planta.mutacao}_${nome}` // Ex: Dourada_Melancia
      : nome;

    if (!u.inventario) u.inventario = {};
    u.inventario[`colheita_${nomeNoInv}`] = (u.inventario[`colheita_${nomeNoInv}`] || 0) + 1;
    
    delete u.jardim.plantas[nome];
    salvarRPG(dados);

    await sock.sendMessage(idChat, {
      text: `🧺 *COLETADO!*\n\n> Você colheu: ${planta.mutacaoEmoji || "🌱"} *${nomeNoInv.replace("_", " ")}*\n\n> Já está na sua mochila! Use *!vender ${nome}* pra vender.`
    });
  }
},

// ==============================================
// 💰 VENDER PLANTA (Do inventário)
// ==============================================
{
  nome: "vender_planta",
  descricao: "Vende uma planta da mochila",
  async executar({ sock, idChat, msg, normalizarNumero, resto }) {
    const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
    const dados = lerRPG();
    const u = getUsuario(dados, num);

    const nomeInput = (resto || "").trim();
    if (!nomeInput) return sock.sendMessage(idChat, { text: "❌ Uso: *!vender_planta <nome>*\nEx: *!vender_planta Melancia*" });

    // Procura no inventário a chave que contenha o nome
    const chaveInv = Object.keys(u.inventario || {}).find(k => k.startsWith("colheita_") && k.toLowerCase().includes(nomeInput.toLowerCase()));
    
    if (!chaveInv || u.inventario[chaveInv] <= 0) {
      return sock.sendMessage(idChat, { text: `❌ Você não tem *${nomeInput}* na mochila.` });
    }

    // Extrai os dados (ex: colheita_Dourada_Melancia)
    const nomeLimpo = chaveInv.replace("colheita_", "");
    let mult = 1;
    let sementeBaseNome = nomeLimpo;

    // Verifica se tem mutação no nome
    for (const m of MUTACOES) {
      if (nomeLimpo.startsWith(`${m.nome}_`)) {
        mult = m.mult;
        sementeBaseNome = nomeLimpo.replace(`${m.nome}_`, "");
        break;
      }
    }

    const sementeDados = SEMENTES.find(s => s.nome === sementeBaseNome);
    if (!sementeDados) return sock.sendMessage(idChat, { text: "❌ Erro interno: semente não encontrada." });

    const valorFinal = Math.floor(sementeDados.valor * mult);
    
    u.inventario[chaveInv] -= 1;
    if (u.inventario[chaveInv] <= 0) delete u.inventario[chaveInv];

    u.moedas = (u.moedas || 0) + valorFinal;
    salvarRPG(dados);

    await sock.sendMessage(idChat, {
      text: `💰 *VENDIDO!*\n\n> ${nomeLimpo.replace("_", " ")}\n> +*${valorFinal}* moedas\n\n> Saldo: *${u.moedas}*`
    });
  }
},

    // ==============================================
    // 🧪 COMPRAR INSETICIDA (Atalho na Loja)
    // ==============================================
    {
      nome: "comprar_inseticida",
      descricao: "Compra inseticida",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if ((u.moedas || 0) < 200) return sock.sendMessage(idChat, { text: "❌ Precisa de *200* moedas." });

        u.moedas -= 200;
        u.jardim.inseticidas = (u.jardim.inseticidas || 0) + 5;
        salvarRPG(dados);

        await sock.sendMessage(idChat, { text: "✅ *INSETICIDA COMPRADO!*\n\n> +5 usos\n> Total: *" + u.jardim.inseticidas + "*" });
      }
    },

    // ==============================================
    // 💧 USAR INSETICIDA
    // ==============================================
    {
      nome: "inseticida",
      descricao: "Usa inseticida numa planta com praga",
      async executar({ sock, idChat, msg, normalizarNumero, resto }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        
        const nomeSemente = (resto || "").trim();
        if (!nomeSemente) return sock.sendMessage(idChat, { text: "❌ Uso: *!inseticida <nome da planta>*" });

        const planta = u.jardim.plantas[nomeSemente];
        if (!planta) return sock.sendMessage(idChat, { text: "❌ Você não tem essa planta." });
        if (!planta.pragaAtiva) return sock.sendMessage(idChat, { text: "❌ Essa planta não está com praga." });
        if (planta.perdeu) return sock.sendMessage(idChat, { text: "❌ A planta já morreu." });
        if (u.jardim.inseticidas <= 0) return sock.sendMessage(idChat, { text: "❌ Sem inseticida. Compre por *!comprar_inseticida*." });

        u.jardim.inseticidas -= 1;
        planta.pragaAtiva = false;
        salvarRPG(dados);

        await sock.sendMessage(idChat, { text: `✅ *Praga removida da ${nomeSemente}!*\n\n> Inseticidas restantes: *${u.jardim.inseticidas}*` });
      }
    },

    // ==============================================
    // 🌱 PLANTAR
    // ==============================================
    {
      nome: "plantar",
      descricao: "Planta uma semente",
      async executar({ sock, idChat, msg, normalizarNumero, resto }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        const nomeSemente = (resto || "").trim();
        if (!nomeSemente) return sock.sendMessage(idChat, { text: "❌ Uso: *!plantar <nome>*" });

        const sementeDados = SEMENTES.find(s => s.nome.toLowerCase() === nomeSemente.toLowerCase());
        if (!sementeDados) return sock.sendMessage(idChat, { text: "❌ Semente inválida." });

        if (Object.keys(u.jardim.plantas).length >= u.jardim.slots) return sock.sendMessage(idChat, { text: "❌ Jardim cheio! Melhore com *!melhorar_jardin*." });
        if (u.jardim.plantas[sementeDados.nome]) return sock.sendMessage(idChat, { text: "❌ Você já tem uma planta dessa crescendo." });

        if (!u.inventario || !u.inventario[`semente_${sementeDados.nome}`] || u.inventario[`semente_${sementeDados.nome}`] <= 0) {
          return sock.sendMessage(idChat, { text: `❌ Não tem semente de *${sementeDados.nome}*. Compre na loja.` });
        }

        u.inventario[`semente_${sementeDados.nome}`] -= 1;

        // Sorteio de mutação
        let mutacao = null;
        const r = Math.random() * 100;
        let acumulado = 0;
        for (const m of MUTACOES) {
          acumulado += m.chance;
          if (r <= acumulado) {
            mutacao = m;
            break;
          }
        }

        u.jardim.plantas[sementeDados.nome] = {
          plantadoEm: Date.now(),
          prontoEm: Date.now() + sementeDados.tempo,
          pragaAtiva: false,
          tempoPraga: Date.now() + 1800000, // 30 min
          mutacao: mutacao ? mutacao.nome : null,
          mutacaoEmoji: mutacao ? mutacao.emoji : null,
          mult: mutacao ? mutacao.mult : 1,
          perdeu: false
        };

        salvarRPG(dados);

        await sock.sendMessage(idChat, {
          text: `🌱 *PLANTADO!*\n\n> Semente: *${sementeDados.nome}*\n> Ficará pronto em: *${formatarTempo(sementeDados.tempo)}*\n\n> ⚠️ Cuidado com pragas! Use *!inseticida ${sementeDados.nome}* se necessário.${mutacao ? `\n\n🎲 *MUTAÇÃO:* ${mutacao.emoji} *${mutacao.nome}* (${mutacao.mult}x)` : ""}`
        });
      }
    },

    // ==============================================
    // 💰 VENDER
    // ==============================================
    {
      nome: "vender_planta",
      descricao: "Vende uma planta pronta",
      async executar({ sock, idChat, msg, normalizarNumero, resto }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        const nome = (resto || "").trim();
        if (!nome) return sock.sendMessage(idChat, { text: "❌ Uso: *!vender_planta <nome>*" });

        const planta = u.jardim.plantas[nome];
        if (!planta) return sock.sendMessage(idChat, { text: "❌ Você não tem essa planta." });
        if (planta.perdeu) {
          delete u.jardim.plantas[nome];
          salvarRPG(dados);
          return sock.sendMessage(idChat, { text: "🥀 A planta estava morta e foi removida." });
        }
        if (planta.pragaAtiva) return sock.sendMessage(idChat, { text: "🐛 A planta está com praga! Use *!inseticida* primeiro." });
        if (Date.now() < planta.prontoEm) return sock.sendMessage(idChat, { text: `⏰ Ainda não está pronta. Faltam *${formatarTempo(planta.prontoEm - Date.now())}*.` });

        const sementeDados = SEMENTES.find(s => s.nome === nome);
        const valorBase = sementeDados.valor;
        const valorFinal = Math.floor(valorBase * (planta.mult || 1));

        u.moedas = (u.moedas || 0) + valorFinal;
        delete u.jardim.plantas[nome];
        salvarRPG(dados);

        await sock.sendMessage(idChat, {
          text: `💰 *VENDIDO!*\n\n> ${planta.mutacaoEmoji || "🌱"} ${nome} ${planta.mutacao ? `(${planta.mutacao})` : ""}\n> +*${valorFinal}* moedas\n\n> Saldo: *${u.moedas}*`
        });
      }
    },

// ==============================================
// 🎁 DOAR PLANTA (Da mochila)
// ==============================================
{
  nome: "doar_planta",
  descricao: "Doa uma planta colhida para alguém",
  async executar({ sock, idChat, msg, normalizarNumero, resto }) {
    const alvoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!alvoJid) return sock.sendMessage(idChat, { text: "❌ Uso: *!doar_planta @user <nome da planta>*" });

    const nomeInput = (resto || "").trim().split(/\s+/).find(p => !p.startsWith("@")) || "";
    if (!nomeInput) return sock.sendMessage(idChat, { text: "❌ Diga o nome da planta. Ex: *!doar_planta @user melancia*" });

    const euNum = normalizarNumero(msg.key.participant || msg.key.remoteJid);
    const alvoNum = normalizarNumero(alvoJid);
    if (euNum === alvoNum) return sock.sendMessage(idChat, { text: "❌ Não pode doar pra si." });

    const dados = lerRPG();
    const u = getUsuario(dados, euNum);
    const v = getUsuario(dados, alvoNum);

    if (!u.inventario) u.inventario = {};

    // Procura a planta no inventário do doador
    const chaveInv = Object.keys(u.inventario).find(k => 
      k.startsWith("colheita_") && k.toLowerCase().includes(nomeInput.toLowerCase())
    );

    if (!chaveInv || u.inventario[chaveInv] <= 0) {
      return sock.sendMessage(idChat, { text: `❌ Você não tem *${nomeInput}* na mochila.` });
    }

    // Tira do doador
    u.inventario[chaveInv] -= 1;
    if (u.inventario[chaveInv] <= 0) delete u.inventario[chaveInv];

    // Adiciona no inventário de quem recebe
    if (!v.inventario) v.inventario = {};
    v.inventario[chaveInv] = (v.inventario[chaveInv] || 0) + 1;

    salvarRPG(dados);

    const nomeBonito = chaveInv.replace("colheita_", "").replace(/_/g, " ");

    await sock.sendMessage(idChat, {
      text: `🎁 *PLANTA DOADA!*\n\n> @${euNum} doou *${nomeBonito}* para @${alvoNum}\n\n> Já está na mochila!`,
      mentions: [msg.key.participant || msg.key.remoteJid, alvoJid]
    });
  }
}
  ]
};
