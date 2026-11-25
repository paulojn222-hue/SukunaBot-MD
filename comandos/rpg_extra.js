const fs = require("fs");
const path = require("path");
const config = require("../config.js");

// ==============================================
// 📦 ARQUIVOS E FUNÇÕES BASE
// ==============================================
const ARQ_RPG = path.join(__dirname, "..", "dados", "rpg.json");

function lerRPG() {
  try {
    if (!fs.existsSync(ARQ_RPG)) return { usuarios: {}, grupos: {} };
    const d = JSON.parse(fs.readFileSync(ARQ_RPG, "utf8"));
    if (!d.usuarios) d.usuarios = {};
    if (!d.grupos) d.grupos = {};
    return d;
  } catch { return { usuarios: {}, grupos: {} }; }
}

function salvarRPG(dados) {
  try {
    fs.mkdirSync(path.dirname(ARQ_RPG), { recursive: true });
    fs.writeFileSync(ARQ_RPG, JSON.stringify(dados, null, 2));
  } catch (e) { console.log("Erro salvando RPG:", e.message); }
}

function getUsuario(dados, num) {
  if (!dados.usuarios[num]) {
    dados.usuarios[num] = {
      moedas: 0, xp: 0, nivel: 1, msgs: 0, comandos: 0, jid: null,
      inventario: { picareta: 0, vara_pesca: 0, isca: 0, ficha: 0, bilhete: 0, raspadinha: 0, racao: 0, escudo: 0 },
      escudoEquipado: false,
      banco: { bancoId: null, deposito: 0, totalRendido: 0, ultimoRendimento: Date.now() },
      pets: [], petAtivo: null,
      familia: { pais: [], filhos: [], conjuge: null, pedidos: [], pedidosCasar: [] },
      emprestimo: { ativo: false, valor: 0, pedidoEm: 0, expiraEm: 0, ultimoPedido: 0, jid: null },
      conquistas: { desbloqueadas: [], monstros: 0 },
      ultimoInvestir: 0, ultimoMinerar: 0, ultimoPescar: 0, ultimoJob: 0,
      ultimoCassino: 0, ultimoLoteria: 0, raspadinhasHoje: 0, ultimoDiaRaspadinha: "",
      ultimoMsgsDia: "", ultimoMsgsTotal: 0, roubos: []
    };
  }
  const u = dados.usuarios[num];
  if (!u.inventario) u.inventario = {};
  if (!u.banco) u.banco = { bancoId: null, deposito: 0, totalRendido: 0, ultimoRendimento: Date.now() };
  if (!u.pets) u.pets = [];
  if (u.petAtivo === undefined) u.petAtivo = null;
  if (!u.familia) u.familia = { pais: [], filhos: [], conjuge: null, pedidos: [], pedidosCasar: [] };
  if (!u.emprestimo) u.emprestimo = { ativo: false, valor: 0, pedidoEm: 0, expiraEm: 0, ultimoPedido: 0, jid: null };
  return u;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function formatarTempo(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const p = [];
  if (d > 0) p.push(`${d}d`);
  if (h > 0) p.push(`${h}h`);
  if (m > 0) p.push(`${m}m`);
  if (!p.length) p.push(`${s}s`);
  return p.join(" ");
}
function pegarValor(resto) { return parseInt((resto || "").trim().split(/\s+/)[0].replace(/[^\d]/g, "")) || 0; }

// ==============================================
// 🏦 BANCOS E PETS (Constantes)
// ==============================================
const BANCOS = [
  { id: "poupanca", nome: "🏦 Poupança", min: 100, rende: 5 },
  { id: "caixa", nome: "🏛️ Caixa Popular", min: 550, rende: 34 },
  { id: "itau", nome: "🏢 Itaú Prime", min: 1500, rende: 98 },
  { id: "bradesco", nome: "💼 Bradesco Premium", min: 3000, rende: 220 },
  { id: "santander", nome: "🟥 Santander Select", min: 6000, rende: 500 },
  { id: "nubank", nome: "💜 Nubank Ultra", min: 12000, rende: 1100 },
  { id: "btg", nome: "💎 BTG Billion", min: 25000, rende: 2500 },
  { id: "black", nome: "🖤 Black Infinite", min: 50000, rende: 6000 }
];

const PETS = [
  { id: 1, nome: "Galinha", preco: 300, forca: 5, tipo: "terrestre" },
  { id: 2, nome: "Coelho", preco: 500, forca: 8, tipo: "terrestre" },
  { id: 3, nome: "Gato", preco: 1000, forca: 15, tipo: "terrestre" },
  { id: 4, nome: "Cachorro", preco: 2000, forca: 25, tipo: "terrestre" },
  { id: 5, nome: "Leopardo", preco: 4000, forca: 45, tipo: "terrestre" },
  { id: 6, nome: "T-Rex", preco: 8000, forca: 80, tipo: "dinossauro" },
  { id: 7, nome: "Baleia", preco: 12000, forca: 100, tipo: "aquático" },
  { id: 8, nome: "Mosasauro", preco: 20000, forca: 150, tipo: "aquático" },
  { id: 9, nome: "Dragão", preco: 40000, forca: 250, tipo: "mítico" },
  { id: 10, nome: "Hydra", preco: 70000, forca: 500, tipo: "mítico" }
];

function calcularRendimento(conta) {
  if (!conta.bancoId || !conta.deposito) return { rendimento: 0 };
  const decorrido = Date.now() - (conta.ultimoRendimento || Date.now());
  const horas = decorrido / 3600000;
  const banco = BANCOS.find(b => b.id === conta.bancoId);
  return { rendimento: Math.floor((banco?.rende || 0) * horas) };
}

module.exports = {
  comandos: [
    // ==============================================
    // 🏦 BANCO
    // ==============================================
    {
      nome: "banco",
      descricao: "Deposita no banco",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if (!resto) {
          let txt = `╭━━━〔 🏦 *BANCOS* 〕━━━╮\n┃\n`;
          for (const b of BANCOS) txt += `┃ ${b.nome}\n┃   Min: *${b.min}* | Rende: *+${b.rende}*/h\n┃\n`;
          txt += `╰━━━━━━━━━━━━━━━━━━━╯\n\n> *!banco <id> <valor>*`;
          return sock.sendMessage(idChat, { text: txt });
        }

        const partes = resto.trim().toLowerCase().split(/\s+/);
        const bancoId = partes[0];
        const valor = parseInt(partes[1]) || 0;
        const banco = BANCOS.find(b => b.id === bancoId || b.nome.toLowerCase().includes(bancoId));

        if (!banco) return sock.sendMessage(idChat, { text: "❌ Banco inválido." });
        if (valor < banco.min) return sock.sendMessage(idChat, { text: `❌ Mínimo é *${banco.min}*.` });
        if (u.moedas < valor) return sock.sendMessage(idChat, { text: `❌ Só tem *${u.moedas}*.` });

        if (u.banco.bancoId && u.banco.bancoId !== banco.id && u.banco.deposito > 0) {
          return sock.sendMessage(idChat, { text: `❌ Já tem conta no *${u.banco.bancoId}*. Saque antes de mudar.` });
        }

        if (u.banco.deposito > 0) {
          const { rendimento } = calcularRendimento(u.banco);
          u.banco.deposito += rendimento;
        }

        u.moedas -= valor;
        u.banco.bancoId = banco.id;
        u.banco.deposito += valor;
        u.banco.ultimoRendimento = Date.now();
        salvarRPG(dados);

        await sock.sendMessage(idChat, { text: `✅ Depositou *${valor}* no *${banco.nome}*.\n📊 Total: *${u.banco.deposito}*` });
      }
    },
    {
      nome: "saldobanco",
      descricao: "Mostra saldo do banco",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if (!u.banco.bancoId) return sock.sendMessage(idChat, { text: "❌ Sem conta em banco." });
        const { rendimento } = calcularRendimento(u.banco);
        const total = u.banco.deposito + rendimento;

        await sock.sendMessage(idChat, { text: `🏦 *BANCO*\n\n> Depósito: *${u.banco.deposito}*\n> Rendendo: *+${rendimento}*\n> Total: *${total}*` });
      }
    },
    {
      nome: "sacar",
      descricao: "Saca do banco",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if (!u.banco.bancoId) return sock.sendMessage(idChat, { text: "❌ Sem conta em banco." });
        const { rendimento } = calcularRendimento(u.banco);
        const total = u.banco.deposito + rendimento;

        let valor = parseInt((resto || "").trim().split(/\s+/)[0].replace(/[^\d]/g, "")) || total;
        if (valor > total) return sock.sendMessage(idChat, { text: `❌ Só tem *${total}* no banco.` });

        u.moedas += valor;
        u.banco.deposito = total - valor;
        u.banco.ultimoRendimento = Date.now();
        if (u.banco.deposito <= 0) { u.banco.bancoId = null; u.banco.deposito = 0; }
        salvarRPG(dados);

        await sock.sendMessage(idChat, { text: `💸 Sacou *${valor}*.\n🏦 Restante: *${u.banco.deposito}*\n💵 Carteira: *${u.moedas}*` });
      }
    },

    // ==============================================
    // 🐾 PETS
    // ==============================================
    {
      nome: "petshop",
      descricao: "Mostra os pets",
      async executar({ sock, idChat }) {
        let txt = `╭━━━〔 🐾 *PETSHOP* 〕━━━╮\n┃\n`;
        for (const p of PETS) txt += `┃ 🆔 ${p.id} — ${p.nome}\n┃    💰 ${p.preco} | ⚔️ ${p.forca}\n┃\n`;
        txt += `╰━━━━━━━━━━━━━━━━━╯\n\n> *!buypet <id>*`;
        await sock.sendMessage(idChat, { text: txt });
      }
    },
    {
      nome: "buypet",
      descricao: "Compra um pet",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const id = parseInt((resto || "").trim());
        const pet = PETS.find(p => p.id === id);
        if (!pet) return sock.sendMessage(idChat, { text: "❌ Pet inválido." });

        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if (u.petAtivo) return sock.sendMessage(idChat, { text: `❌ Já tem *${u.petAtivo.nome}*. Use *!soltarpet* antes.` });
        if (u.moedas < pet.preco) return sock.sendMessage(idChat, { text: `❌ Precisa de *${pet.preco}*.` });

        u.moedas -= pet.preco;
        const novo = { id: pet.id, nome: pet.nome, apelido: pet.nome, nivel: 1, xp: 0, forca: pet.forca, tipo: pet.tipo, fome: 100 };
        u.petAtivo = novo;
        u.pets.push(novo);
        salvarRPG(dados);

        await sock.sendMessage(idChat, { text: `🎉 *PET ADQUIRIDO!*\n\n> 🐾 ${pet.nome}\n> ⚔️ Força: *${pet.forca}*` });
      }
    },
    {
      nome: "statuspet",
      descricao: "Status do pet",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const u = getUsuario(lerRPG(), num);
        if (!u.petAtivo) return sock.sendMessage(idChat, { text: "❌ Sem pet ativo." });

        const p = u.petAtivo;
        const barra = "█".repeat(Math.floor(p.fome / 10)) + "░".repeat(10 - Math.floor(p.fome / 10));
        await sock.sendMessage(idChat, { text: `🐾 *STATUS*\n\n> Nome: *${p.apelido}*\n> Nível: *${p.nivel}*\n> Força: *${p.forca}*\n> Fome: [${barra}] ${p.fome}%`, mentions: [msg.key.participant || msg.key.remoteJid] });
      }
    },
    {
      nome: "nomearpet",
      descricao: "Renomeia o pet",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const nome = (resto || "").trim();
        if (!nome) return sock.sendMessage(idChat, { text: "❌ Uso: *!nomearpet <nome>*" });
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.petAtivo) return sock.sendMessage(idChat, { text: "❌ Sem pet ativo." });
        u.petAtivo.apelido = nome;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `✅ Pet renomeado para *${nome}*!` });
      }
    },
    {
      nome: "soltarpet",
      descricao: "Solta o pet atual",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.petAtivo) return sock.sendMessage(idChat, { text: "❌ Sem pet ativo." });
        const nome = u.petAtivo.nome;
        u.petAtivo = null;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `👋 Soltou *${nome}* na natureza.` });
      }
    },
    {
      nome: "alimentarpet",
      descricao: "Alimenta o pet",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.petAtivo) return sock.sendMessage(idChat, { text: "❌ Sem pet ativo." });
        if (u.petAtivo.fome >= 100) return sock.sendMessage(idChat, { text: "🍖 Já tá cheio!" });
        if (u.inventario.racao <= 0) return sock.sendMessage(idChat, { text: "❌ Sem *ração*. Compre *!comprar racao 5*." });
        u.inventario.racao -= 1;
        u.petAtivo.fome = Math.min(100, u.petAtivo.fome + 20);
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `🍖 *${u.petAtivo.apelido}* comeu! Fome: *${u.petAtivo.fome}%*` });
      }
    },
    {
      nome: "treinarpet",
      descricao: "Treina o pet",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.petAtivo) return sock.sendMessage(idChat, { text: "❌ Sem pet ativo." });

        if (!resto) return sock.sendMessage(idChat, { text: `🏋️ *TREINOS*\n\n> *1.* Corrida (50m, +2 F)\n> *2.* Natação (100m, +5 F)\n> *3.* Combate (200m, +12 F)\n\nUse: *!treinarpet 1*` });

        const op = parseInt(resto);
        const treinos = { 1: { n: "Corrida", c: 50, f: 2, fome: 15 }, 2: { n: "Natação", c: 100, f: 5, fome: 25 }, 3: { n: "Combate", c: 200, f: 12, fome: 40 } };
        const t = treinos[op];
        if (!t) return sock.sendMessage(idChat, { text: "❌ Treino inválido." });
        if (u.petAtivo.fome < t.fome) return sock.sendMessage(idChat, { text: `🍖 Pet com fome. Alimente.` });
        if (u.moedas < t.c) return sock.sendMessage(idChat, { text: `❌ Precisa de *${t.c}* moedas.` });

        u.moedas -= t.c;
        u.petAtivo.forca += t.f;
        u.petAtivo.fome -= t.fome;
        u.petAtivo.xp += 20;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `🏋️ *${t.n}*\n\n> ⚔️ +${t.f} Força\n> 🍖 -${t.fome} Fome` });
      }
    },
    {
      nome: "batalharpet",
      descricao: "Batalha de pets",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const alvo = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvo) return sock.sendMessage(idChat, { text: "❌ Uso: *!batalharpet @user*" });
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const alvoNum = normalizarNumero(alvo);
        const dados = lerRPG();
        const eu = getUsuario(dados, num);
        const op = getUsuario(dados, alvoNum);

        if (!eu.petAtivo || !op.petAtivo) return sock.sendMessage(idChat, { text: "❌ Ambos precisam ter pets ativos." });
        if (eu.petAtivo.fome < 20 || op.petAtivo.fome < 20) return sock.sendMessage(idChat, { text: "🍖 Um dos pets tá com fome." });

        const p1 = eu.petAtivo.forca + rand(1, 20);
        const p2 = op.petAtivo.forca + rand(1, 20);
        const vencedor = p1 > p2 ? "eu" : "ele";
        const premio = rand(50, 200);

        if (vencedor === "eu") {
          eu.moedas += premio; eu.petAtivo.forca += 3;
          await sock.sendMessage(idChat, { text: `⚔️ *BATALHA*\n\n> *${eu.petAtivo.nome}* venceu!\n> +${premio} moedas`, mentions: [alvo] });
        } else {
          op.moedas += premio; op.petAtivo.forca += 3;
          await sock.sendMessage(idChat, { text: `⚔️ *BATALHA*\n\n> *${op.petAtivo.nome}* venceu!\n> +${premio} moedas`, mentions: [alvo] });
        }
        salvarRPG(dados);
      }
    },

    // ==============================================
    // 💰 EMPRÉSTIMO
    // ==============================================
    {
      nome: "emprestimo",
      descricao: "Pede empréstimo de 10k",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if (u.emprestimo.ativo) return sock.sendMessage(idChat, { text: "❌ Já tem empréstimo ativo. Use *!pagar*." });

        const umaSemana = 604800000;
        if (Date.now() - u.emprestimo.ultimoPedido < umaSemana) {
          const falta = umaSemana - (Date.now() - u.emprestimo.ultimoPedido);
          return sock.sendMessage(idChat, { text: `⏰ Espere *${formatarTempo(falta)}* pra pedir outro.` });
        }

        u.moedas += 10000;
        u.emprestimo = { ativo: true, valor: 10000, pedidoEm: Date.now(), expiraEm: Date.now() + 86400000, ultimoPedido: Date.now(), jid: msg.key.participant || msg.key.remoteJid };
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: "💰 *EMPRÉSTIMO CONCEDIDO!*\n\n> +10.000 moedas\n> Pague em 1 dia com *!pagar* ou serei forçado a cobrar." });
      }
    },
    {
      nome: "pagar",
      descricao: "Paga o empréstimo",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const num = normalizarNumero(msg.key.participant || msg.key.remoteJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        if (!u.emprestimo.ativo) return sock.sendMessage(idChat, { text: "❌ Não tem empréstimo ativo." });
        const valor = u.emprestimo.valor;

        if (u.moedas >= valor) {
          u.moedas -= valor;
          u.emprestimo.ativo = false;
          salvarRPG(dados);
          return sock.sendMessage(idChat, { text: `✅ *PAGO!*\n\n> -${valor} moedas\n> Saldo: *${u.moedas}*` });
        }

        const pago = u.moedas;
        u.moedas = -(valor - pago);
        u.emprestimo.ativo = false;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `⚠️ *PAGAMENTO PARCIAL!*\n\n> Ficou devendo *${Math.abs(u.moedas)}* moedas.` });
      }
    },

    // ==============================================
    // 👨‍👩‍👧 FAMÍLIA / CASAMENTO
    // ==============================================
    {
      nome: "casar",
      descricao: "Pede em casamento",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const alvoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvoJid) return sock.sendMessage(idChat, { text: "❌ Uso: *!casar @user*" });
        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const alvoNum = normalizarNumero(alvoJid);
        if (num === alvoNum) return sock.sendMessage(idChat, { text: "❌ Não pode casar consigo." });

        const dados = lerRPG();
        const eu = getUsuario(dados, num);
        const ele = getUsuario(dados, alvoNum);
        eu.jid = euJid; ele.jid = alvoJid;

        if (eu.familia.conjuge) return sock.sendMessage(idChat, { text: "❌ Já é casado." });
        if (ele.familia.conjuge) return sock.sendMessage(idChat, { text: `❌ @${alvoNum} já é casado.`, mentions: [alvoJid] });

        ele.familia.pedidosCasar.push(num);
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `💍 @${num} pediu @${alvoNum} em casamento!\n\n> *!aceitarcasar* ou *!recusarcasar*`, mentions: [euJid, alvoJid] });
      }
    },
    {
      nome: "aceitarcasar",
      descricao: "Aceita casamento",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.familia.pedidosCasar.length) return sock.sendMessage(idChat, { text: "❌ Sem pedidos." });

        const pretendente = u.familia.pedidosCasar.shift();
        const ele = getUsuario(dados, pretendente);
        u.familia.conjuge = pretendente; ele.familia.conjuge = num;
        u.jid = euJid;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `💍💕 *CASADOS!*\n\n> @${num} e @${pretendente}`, mentions: [euJid, ele.jid] });
      }
    },
    {
      nome: "recusarcasar",
      descricao: "Recusa casamento",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.familia.pedidosCasar.length) return sock.sendMessage(idChat, { text: "❌ Sem pedidos." });
        const recusado = u.familia.pedidosCasar.shift();
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `💔 Recusou @${recusado}.` });
      }
    },
    {
      nome: "divorciar",
      descricao: "Divorcia",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.familia.conjuge) return sock.sendMessage(idChat, { text: "❌ Não é casado." });
        const ex = u.familia.conjuge;
        const ele = getUsuario(dados, ex);
        u.familia.conjuge = null; ele.familia.conjuge = null;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `💔 @${num} e @${ex} se divorciaram.`, mentions: [euJid, ele.jid] });
      }
    },
    {
      nome: "adotar",
      descricao: "Adota (só se casado)",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const alvoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvoJid) return sock.sendMessage(idChat, { text: "❌ Uso: *!adotar @user*" });
        const euJid = msg.key.participant || msg.key.remoteJid;
        const paiNum = normalizarNumero(euJid);
        const filhoNum = normalizarNumero(alvoJid);
        if (paiNum === filhoNum) return sock.sendMessage(idChat, { text: "❌ Não pode se adotar." });

        const dados = lerRPG();
        const pai = getUsuario(dados, paiNum);
        const filho = getUsuario(dados, filhoNum);
        pai.jid = euJid; filho.jid = alvoJid;

        if (!pai.familia.conjuge) return sock.sendMessage(idChat, { text: "❌ Precisa ser casado pra adotar." });
        if (filho.familia.pais.length >= 2) return sock.sendMessage(idChat, { text: "❌ Já tem 2 pais." });
        if (pai.familia.filhos.includes(filhoNum)) return sock.sendMessage(idChat, { text: "❌ Já é seu filho." });

        filho.familia.pedidos.push(paiNum);
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `👨‍👩‍👧 @${paiNum} quer adotar @${filhoNum}!\n\n> *!aceitaradocao* ou *!recusaradocao*`, mentions: [euJid, alvoJid] });
      }
    },
    {
      nome: "aceitaradocao",
      descricao: "Aceita adoção",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        if (!u.familia.pedidos.length) return sock.sendMessage(idChat, { text: "❌ Sem pedidos." });

        const paiNum = u.familia.pedidos.shift();
        const pai = getUsuario(dados, paiNum);
        u.familia.pais.push(paiNum); pai.familia.filhos.push(num);
        
        const conj = pai.familia.conjuge;
        if (conj) {
          const c = getUsuario(dados, conj);
          u.familia.pais.push(conj); c.familia.filhos.push(num);
        }
        u.jid = euJid;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `✅ @${num} foi adotado por @${paiNum}!`, mentions: [euJid, pai.jid] });
      }
    },
    {
      nome: "recusaradocao",
      descricao: "Recusa adoção",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const u = getUsuario(lerRPG(), normalizarNumero(euJid));
        if (!u.familia.pedidos.length) return sock.sendMessage(idChat, { text: "❌ Sem pedidos." });
        const dados = lerRPG();
        u.familia.pedidos.shift();
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: "❌ Adoção recusada." });
      }
    },
    {
      nome: "expulsarfilho",
      descricao: "Expulsa um filho",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const filhoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!filhoJid) return sock.sendMessage(idChat, { text: "❌ Uso: *!expulsarfilho @user*" });
        const euJid = msg.key.participant || msg.key.remoteJid;
        const paiNum = normalizarNumero(euJid);
        const filhoNum = normalizarNumero(filhoJid);
        const dados = lerRPG();
        const pai = getUsuario(dados, paiNum);
        const filho = getUsuario(dados, filhoNum);
        if (!pai.familia.filhos.includes(filhoNum)) return sock.sendMessage(idChat, { text: "❌ Não é seu filho." });

        pai.familia.filhos = pai.familia.filhos.filter(f => f !== filhoNum);
        filho.familia.pais = filho.familia.pais.filter(p => p !== paiNum);
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `👋 @${filhoNum} foi expulso da família.`, mentions: [filhoJid] });
      }
    },
    {
      nome: "meusfilhos",
      descricao: "Mostra seus filhos",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const u = getUsuario(lerRPG(), normalizarNumero(euJid));
        if (!u.familia.filhos.length) return sock.sendMessage(idChat, { text: "👨‍👩‍👧 Nenhum filho." });
        const linhas = u.familia.filhos.map(f => `┃ @${f}`).join("\n");
        await sock.sendMessage(idChat, { text: `👨‍👩‍👧 *FILHOS*\n\n${linhas}`, mentions: u.familia.filhos.map(f => `${f}@s.whatsapp.net`) });
      }
    },
    {
      nome: "minhafamilia",
      descricao: "Mostra sua família",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);

        let txt = `👨‍👩‍👧 *FAMÍLIA DE @${num}*\n\n`;
        const mencoes = [euJid];

        if (u.familia.conjuge) {
          txt += `💍 *Cônjuge:* @${u.familia.conjuge}\n`;
          mencoes.push(`${u.familia.conjuge}@s.whatsapp.net`);
        }
        if (u.familia.pais.length) {
          txt += `👨 *Pais:* ${u.familia.pais.map(p => `@${p}`).join(", ")}\n`;
          u.familia.pais.forEach(p => mencoes.push(`${p}@s.whatsapp.net`));
        }
        if (u.familia.filhos.length) {
          txt += `👶 *Filhos:* ${u.familia.filhos.map(f => `@${f}`).join(", ")}\n`;
          u.familia.filhos.forEach(f => mencoes.push(`${f}@s.whatsapp.net`));
        }

        if (mencoes.length === 1) txt += "> _Família vazia_";
        await sock.sendMessage(idChat, { text: txt, mentions: mencoes });
      }
    },
    {
      nome: "arvoregenealogica",
      descricao: "Mostra árvore genealógica",
      async executar({ sock, idChat, msg, normalizarNumero }) {
        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const dados = lerRPG();
        const u = getUsuario(dados, num);
        
        let txt = `🌳 *ÁRVORE GENEALÓGICA*\n\n`;
        txt += `> 👤 @${num}\n`;
        
        if (u.familia.pais.length) {
          txt += `> ┃\n> ┣ 👨 *Pais:*\n`;
          u.familia.pais.forEach(p => txt += `> ┃  └ @${p}\n`);
        }
        
        if (u.familia.filhos.length) {
          txt += `> ┃\n> ┣ 👶 *Filhos:*\n`;
          u.familia.filhos.forEach(f => txt += `> ┃  └ @${f}\n`);
        }
        
        await sock.sendMessage(idChat, { text: txt, mentions: [euJid] });
      }
    },

    // ==============================================
    // 💵 MESADA E PRESENTES
    // ==============================================
    {
      nome: "mesada",
      descricao: "Manda mesada pra um filho",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const alvoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvoJid) return sock.sendMessage(idChat, { text: "❌ Uso: *!mesada @user <valor>*" });
        const valor = parseInt((resto || "").trim().split(/\s+/).find(p => /^\d+$/.test(p))) || 0;
        if (!valor) return sock.sendMessage(idChat, { text: "❌ Valor inválido." });

        const euJid = msg.key.participant || msg.key.remoteJid;
        const paiNum = normalizarNumero(euJid);
        const filhoNum = normalizarNumero(alvoJid);
        
        const dados = lerRPG();
        const pai = getUsuario(dados, paiNum);
        const filho = getUsuario(dados, filhoNum);

        if (!pai.familia.filhos.includes(filhoNum)) return sock.sendMessage(idChat, { text: `❌ @${filhoNum} não é seu filho.`, mentions: [alvoJid] });
        if (pai.moedas < valor) return sock.sendMessage(idChat, { text: `❌ Só tem *${pai.moedas}*.` });

        pai.moedas -= valor;
        filho.moedas += valor;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `💵 @${paiNum} mandou *${valor}* de mesada pra @${filhoNum}.`, mentions: [euJid, alvoJid] });
      }
    },
    {
      nome: "presentear",
      descricao: "Presenteia com item",
      async executar({ sock, idChat, msg, resto, normalizarNumero }) {
        const alvoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!alvoJid) return sock.sendMessage(idChat, { text: "❌ Uso: *!presentear @user <item> <qtd>*" });
        const partes = (resto || "").trim().toLowerCase().split(/\s+/).filter(p => p && !p.startsWith("@"));
        const item = partes[0];
        const qtd = parseInt(partes[1]) || 1;

        if (!item) return sock.sendMessage(idChat, { text: "❌ Ex: *!presentear @user isca 5*" });

        const euJid = msg.key.participant || msg.key.remoteJid;
        const num = normalizarNumero(euJid);
        const alvoNum = normalizarNumero(alvoJid);
        if (num === alvoNum) return sock.sendMessage(idChat, { text: "❌ Não pode presentear a si." });

        const dados = lerRPG();
        const u = getUsuario(dados, num);
        const v = getUsuario(dados, alvoNum);

        if ((u.inventario[item] || 0) < qtd) return sock.sendMessage(idChat, { text: `❌ Sem *${qtd}x ${item}*.` });

        u.inventario[item] -= qtd;
        v.inventario[item] = (v.inventario[item] || 0) + qtd;
        salvarRPG(dados);
        await sock.sendMessage(idChat, { text: `🎁 @${num} deu *${qtd}x ${item}* pra @${alvoNum}!`, mentions: [euJid, alvoJid] });
      }
    }
  ]
};
