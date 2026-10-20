const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// 🔑 Puxa a key do config
const config = require("../config.js");
const API_KEY_BRONXYS = config.API_KEY_BRONXYS || "";

// ==============================================
// 🛠️ HELPERS
// ==============================================
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function fetchJson(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'pt-BR'
    }
  });
  return response.data;
}

async function getFileBuffer(mediaKey, MediaType) {
  const stream = await downloadContentFromMessage(mediaKey, MediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

async function uploadX(midia) {
  try {
    const form = new FormData();
    form.append("file", midia, `upload.jpg`);
    const response = await fetch(`https://api.bronxyshost.com.br/api-bronxys/link_imagem?apikey=${API_KEY_BRONXYS}`, {
      method: "POST",
      body: form
    });
    const data = await response.json();
    return data.link;
  } catch (error) {
    console.log("Erro upload:", error);
    throw error;
  }
}

// ==============================================
// 📄 MENU PESQUISAS (editável)
// ==============================================
function carregarMenuPesquisas() {
  const ARQ = path.join(__dirname, "..", "personalize_aqui", "menu_pesquisas.txt");
  try {
    return fs.readFileSync(ARQ, "utf8");
  } catch {
    return "❌ Arquivo personalize_aqui/menu_pesquisas.txt não encontrado!";
  }
}

module.exports = {
  comandos: [
    // ==============================================
    // 📋 MENU PESQUISAS
    // ==============================================
{
  nome: "menubaixar",
  descricao: "Mostra o menu de pesquisas",
  async executar({ sock, idChat, msg, PREFIXO, NOME_BOT, DONO_PRINCIPAL_NOME }) {
    const data = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    let texto = carregarMenuPesquisas()
      .replace(/{PREFIXO}/g, PREFIXO || "!")
      .replace(/{BOT}/g, NOME_BOT || "Bot")
      .replace(/{DONO}/g, DONO_PRINCIPAL_NOME || "Dono")
      .replace(/{DATA}/g, data);

    const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menupesquisas.json");
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

    const remetente = msg.key.participant || msg.key.remoteJid;

    if (midia?.meta?.tipo === "image") {
      await sock.sendMessage(idChat, { image: midia.buffer, caption: texto, mentions: [remetente] });
    } else if (midia?.meta?.tipo === "video") {
      await sock.sendMessage(idChat, {
        video: midia.buffer, caption: texto, mentions: [remetente],
        gifPlayback: true
      });
    } else {
      await sock.sendMessage(idChat, { text: texto, mentions: [remetente] });
    }
  }
},
    // ==============================================
    // 🎵 MÚSICA
    // ==============================================
    {
      nome: "play",
      descricao: "Baixa música do YouTube em áudio",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `🎵 Exemplo: *!play nome da música*` });
        try {
          const data = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/pesquisa_ytb?nome=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!data || !data[0]) return sock.sendMessage(idChat, { text: "❌ Música não encontrada." });
          if (data[0]?.tempo?.length >= 7) return sock.sendMessage(idChat, { text: "⏰ Muito grande (mais de 1h)." });

          const titulo = data[0]?.titulo || "play";
          await sock.sendMessage(idChat, {
            image: { url: data[0]?.thumb },
            caption: `🎵 *${titulo}*\n⏱️ ${data[0]?.tempo}\n\nBaixando áudio...`
          });
          await sock.sendMessage(idChat, {
            audio: { url: `https://api.bronxyshost.com.br/api-bronxys/play?nome_url=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}` },
            mimetype: "audio/mpeg",
            fileName: `${titulo}.mp3`
          });
        } catch (e) {
          console.log("Erro play:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Não consegui baixar. Tenta outro nome ou verifica a API key." });
        }
      }
    },

// ==============================================
// 📋 ADDPLAYLIST
// ==============================================
{
  nome: "addplaylist",
  descricao: "Adiciona uma música à playlist",
  async executar({ sock, idChat, msg, normalizarNumero }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    if (!quoted) {
      return sock.sendMessage(idChat, {
        text: "❌ Responda a uma *música* enviada pelo *!play* com *!addplaylist*"
      });
    }

    // Pega o nome da música (do caption da imagem ou do áudio)
    let nomeMusica = "";
    if (quoted.imageMessage?.caption) nomeMusica = quoted.imageMessage.caption;
    else if (quoted.videoMessage?.caption) nomeMusica = quoted.videoMessage.caption;
    else if (quoted.documentMessage?.fileName) nomeMusica = quoted.documentMessage.fileName;
    else if (quoted.audioMessage) {
      // Se for áudio, tenta pegar do contexto
      nomeMusica = ctx?.quotedMessage?.audioMessage?.fileName || "";
    }

    // Limpa o nome — pega só o título
    let titulo = nomeMusica;
    if (titulo.includes("🎵")) {
      const match = titulo.match(/🎵\s*\*?([^\n*]+)\*?/);
      if (match) titulo = match[1].trim();
    }
    if (!titulo || titulo.length > 100) {
      titulo = "Música " + Date.now().toString().slice(-4);
    }

    // Remove emojis e caracteres estranhos
    titulo = titulo.replace(/[*_~`]/g, "").trim();

    const euJid = msg.key.participant || msg.key.remoteJid;
    const num = normalizarNumero(euJid);

    const ARQ = path.join(__dirname, "..", "dados", "playlists.json");
    let dados = {};
    try {
      if (fs.existsSync(ARQ)) dados = JSON.parse(fs.readFileSync(ARQ, "utf8"));
    } catch {}

    if (!dados[num]) dados[num] = { lista: [], proxId: 1 };

    const id = dados[num].proxId++;
    dados[num].lista.push({
      id,
      titulo,
      adicionado: Date.now(),
      jid: euJid
    });

    fs.mkdirSync(path.dirname(ARQ), { recursive: true });
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, {
      text:
        `✅ *Música adicionada!*\n\n` +
        `> 🆔 ID: *#${id}*\n` +
        `> 🎵 Título: *${titulo}*\n\n` +
        `> Use *!playlist* pra ver todas.`,
      mentions: [euJid]
    });
  }
},

// ==============================================
// 📋 RMPLAYLIST
// ==============================================
{
  nome: "rmplaylist",
  descricao: "Remove uma música da playlist",
  async executar({ sock, idChat, msg, resto, normalizarNumero }) {
    const id = parseInt((resto || "").trim());
    if (!id) return sock.sendMessage(idChat, { text: "❌ Uso: *!rmplaylist <id>*" });

    const euJid = msg.key.participant || msg.key.remoteJid;
    const num = normalizarNumero(euJid);

    const ARQ = path.join(__dirname, "..", "dados", "playlists.json");
    if (!fs.existsSync(ARQ)) {
      return sock.sendMessage(idChat, { text: "📭 Você não tem playlist." });
    }

    let dados = {};
    try { dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}

    if (!dados[num]?.lista?.length) {
      return sock.sendMessage(idChat, { text: "📭 Você não tem playlist." });
    }

    const idx = dados[num].lista.findIndex(m => m.id === id);
    if (idx < 0) {
      return sock.sendMessage(idChat, { text: `❌ Música *#${id}* não encontrada.` });
    }

    const removida = dados[num].lista.splice(idx, 1)[0];
    fs.writeFileSync(ARQ, JSON.stringify(dados, null, 2));

    await sock.sendMessage(idChat, {
      text:
        `🗑️ *Música removida!*\n\n` +
        `> 🆔 ID: *#${id}*\n` +
        `> 🎵 Título: *${removida.titulo}*`
    });
  }
},

// ==============================================
// 📋 PLAYLIST
// ==============================================
{
  nome: "playlist",
  descricao: "Mostra sua playlist",
  async executar({ sock, idChat, msg, normalizarNumero }) {
    const euJid = msg.key.participant || msg.key.remoteJid;
    const num = normalizarNumero(euJid);

    const ARQ = path.join(__dirname, "..", "dados", "playlists.json");
    if (!fs.existsSync(ARQ)) {
      return sock.sendMessage(idChat, { text: "📭 Você não tem playlist ainda.\n\n> Use *!play* e depois *!addplaylist*." });
    }

    let dados = {};
    try { dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}

    const lista = dados[num]?.lista || [];
    if (!lista.length) {
      return sock.sendMessage(idChat, { text: "📭 Sua playlist tá vazia.\n\n> Use *!play* e depois *!addplaylist*." });
    }

    let txt = `📋 *SUA PLAYLIST*\n\n> Total: *${lista.length}*\n\n`;
    lista.forEach(m => {
      txt += `┃ *#${m.id}* — 🎵 ${m.titulo}\n`;
    });
    txt += `\n> Use *!rmplaylist <id>* pra remover.`;

    await sock.sendMessage(idChat, {
      text: txt,
      mentions: [euJid]
    });
  }
},

// ==============================================
// ▶️ TOCARPLAYLIST
// ==============================================
{
  nome: "tocarplaylist",
  descricao: "Toca uma música da sua playlist",
  async executar({ sock, idChat, msg, resto, normalizarNumero }) {
    const id = parseInt((resto || "").trim());
    if (!id) return sock.sendMessage(idChat, { text: "❌ Uso: *!tocarplaylist <id>*\n\n> Veja sua lista com *!playlist*" });

    const euJid = msg.key.participant || msg.key.remoteJid;
    const num = normalizarNumero(euJid);

    const ARQ = path.join(__dirname, "..", "dados", "playlists.json");
    if (!fs.existsSync(ARQ)) {
      return sock.sendMessage(idChat, { text: "📭 Sua playlist tá vazia." });
    }

    let dados = {};
    try { dados = JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch {}

    const lista = dados[num]?.lista || [];
    const musica = lista.find(m => m.id === id);

    if (!musica) {
      return sock.sendMessage(idChat, { text: `❌ Música *#${id}* não encontrada na sua playlist.` });
    }

    await sock.sendMessage(idChat, {
      text: `▶️ Tocando *${musica.titulo}*...\n\n> 🎵 Buscando no YouTube...`
    });

    try {
      // Busca no YouTube
      const data = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/pesquisa_ytb?nome=${encodeURIComponent(musica.titulo)}&apikey=${API_KEY_BRONXYS}`);

      if (!data || !data[0]) {
        return sock.sendMessage(idChat, { text: "❌ Música não encontrada no YouTube." });
      }

      if (data[0]?.tempo?.length >= 7) {
        return sock.sendMessage(idChat, { text: "⏰ Música muito grande (mais de 1h)." });
      }

      const titulo = data[0]?.titulo || musica.titulo;

      // Manda a capa com info
      await sock.sendMessage(idChat, {
        image: { url: data[0]?.thumb },
        caption:
          `🎵 *${titulo}*\n` +
          `⏱️ ${data[0]?.tempo || "?"}\n` +
          `📀 Da sua playlist (#${id})\n\n` +
          `⬇️ Baixando áudio...`
      });

      // Baixa e envia o áudio
      await sock.sendMessage(idChat, {
        audio: { url: `https://api.bronxyshost.com.br/api-bronxys/play?nome_url=${encodeURIComponent(musica.titulo)}&apikey=${API_KEY_BRONXYS}` },
        mimetype: "audio/mpeg",
        fileName: `${titulo}.mp3`
      });

    } catch (e) {
      console.log("Erro tocarplaylist:", e.message);
      await sock.sendMessage(idChat, { text: "❌ Erro ao tocar a música." });
    }
  }
},

    {
      nome: "playmp4",
      descricao: "Baixa vídeo do YouTube",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `🎥 Exemplo: *!playmp4 nome*` });
        try {
          const data = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/pesquisa_ytb?nome=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!data || !data[0]) return sock.sendMessage(idChat, { text: "❌ Vídeo não encontrado." });
          if (data[0]?.tempo?.length >= 7) return sock.sendMessage(idChat, { text: "⏰ Muito grande." });

          const titulo = data[0]?.titulo || "play";
          await sock.sendMessage(idChat, {
            image: { url: data[0]?.thumb },
            caption: `🎥 *${titulo}*\n⏱️ ${data[0]?.tempo}\n\nBaixando vídeo...`
          });
          await sock.sendMessage(idChat, {
            video: { url: `https://api.bronxyshost.com.br/api-bronxys/play_video?nome_url=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}` },
            mimetype: "video/mp4",
            fileName: `${titulo}.mp4`
          });
        } catch (e) {
          console.log("Erro playmp4:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Não consegui baixar o vídeo." });
        }
      }
    },

    {
      nome: "playdoc",
      descricao: "Baixa música como documento",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `📄 Exemplo: *!playdoc nome*` });
        try {
          const data = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/pesquisa_ytb?nome=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!data || !data[0]) return sock.sendMessage(idChat, { text: "❌ Não encontrado." });
          const titulo = data[0]?.titulo || "play";
          await sock.sendMessage(idChat, {
            document: { url: `https://api.bronxyshost.com.br/api-bronxys/play?nome_url=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}` },
            mimetype: "audio/mpeg",
            fileName: `${titulo}.mp3`
          });
        } catch (e) {
          console.log("Erro playdoc:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar documento." });
        }
      }
    },

    {
      nome: "spotify",
      descricao: "Baixa música do Spotify",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("spotify")) return sock.sendMessage(idChat, { text: `🎵 Exemplo: *!spotify https://open.spotify.com/track/...*` });
        try {
          await sock.sendMessage(idChat, { audio: { url: `https://api.bronxyshost.com.br/api-bronxys/spotify?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "audio/mpeg" });
        } catch (e) {
          console.log("Erro spotify:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do Spotify." });
        }
      }
    },

    {
      nome: "soundcloud",
      descricao: "Baixa música do SoundCloud",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("soundcloud")) return sock.sendMessage(idChat, { text: `🎵 Exemplo: *!soundcloud link*` });
        try {
          await sock.sendMessage(idChat, { audio: { url: `https://api.bronxyshost.com.br/api-bronxys/soundcloud?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "audio/mpeg" });
        } catch (e) {
          console.log("Erro soundcloud:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do SoundCloud." });
        }
      }
    },

    {
      nome: "letra",
      descricao: "Busca letra de música",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `🎵 Exemplo: *!letra nome da música*` });
        try {
          const abc = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/letra_musica?letra=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!abc || !abc.letra) return sock.sendMessage(idChat, { text: "❌ Letra não encontrada." });
          await sock.sendMessage(idChat, { text: `🎵 *${abc.titulo}*\n👤 ${abc.compositor}\n\n${abc.letra}`.slice(0, 4000) });
        } catch (e) {
          console.log("Erro letra:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao buscar letra." });
        }
      }
    },

    // ==============================================
    // 🎬 VÍDEOS
    // ==============================================
    {
      nome: "tiktok_video",
      descricao: "Baixa vídeo do TikTok",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("tiktok")) return sock.sendMessage(idChat, { text: `🎬 Exemplo: *!tiktok_video link*` });
        try {
          await sock.sendMessage(idChat, { video: { url: `https://api.bronxyshost.com.br/api-bronxys/tiktok?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "video/mp4" });
        } catch (e) {
          console.log("Erro tiktok_video:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do TikTok." });
        }
      }
    },

    {
      nome: "tiktok_audio",
      descricao: "Baixa áudio do TikTok",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("tiktok")) return sock.sendMessage(idChat, { text: `🎵 Exemplo: *!tiktok_audio link*` });
        try {
          await sock.sendMessage(idChat, { audio: { url: `https://api.bronxyshost.com.br/api-bronxys/tiktok?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "audio/mpeg" });
        } catch (e) {
          console.log("Erro tiktok_audio:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar áudio do TikTok." });
        }
      }
    },

    {
      nome: "instagram",
      descricao: "Baixa do Instagram",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (q.length < 5) return sock.sendMessage(idChat, { text: `📷 Exemplo: *!instagram link*` });
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/instagram?url=${q}&apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.msg?.[0]?.url) return sock.sendMessage(idChat, { text: "❌ Não consegui extrair do Instagram." });
          const tipo = ABC.msg[0].type;
          const A_T = tipo === "mp4" ? "video/mp4" : tipo === "webp" ? "image/webp" : tipo === "jpg" ? "image/jpeg" : tipo === "mp3" ? "audio/mpeg" : "video/mp4";
          await sock.sendMessage(idChat, { [A_T.split("/")[0]]: { url: ABC.msg[0].url }, mimetype: A_T });
        } catch (e) {
          console.log("Erro instagram:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do Instagram." });
        }
      }
    },

    {
      nome: "face_video",
      descricao: "Baixa vídeo do Facebook",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("facebook") && !q.includes("fb.watch")) return sock.sendMessage(idChat, { text: `📘 Exemplo: *!face_video link*` });
        try {
          await sock.sendMessage(idChat, { video: { url: `https://api.bronxyshost.com.br/api-bronxys/face_video?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "video/mp4" });
        } catch (e) {
          console.log("Erro face_video:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do Facebook." });
        }
      }
    },

    {
      nome: "face_audio",
      descricao: "Baixa áudio do Facebook",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("facebook") && !q.includes("fb.watch")) return sock.sendMessage(idChat, { text: `🎵 Exemplo: *!face_audio link*` });
        try {
          await sock.sendMessage(idChat, { audio: { url: `https://api.bronxyshost.com.br/api-bronxys/face_audio?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "audio/mpeg" });
        } catch (e) {
          console.log("Erro face_audio:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar áudio do Facebook." });
        }
      }
    },

    {
      nome: "twitter_video",
      descricao: "Baixa vídeo do Twitter",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("twitter")) return sock.sendMessage(idChat, { text: `🐦 Exemplo: *!twitter_video link*` });
        try {
          await sock.sendMessage(idChat, { video: { url: `https://api.bronxyshost.com.br/api-bronxys/twitter_video?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "video/mp4" });
        } catch (e) {
          console.log("Erro twitter_video:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do Twitter." });
        }
      }
    },

    {
      nome: "twitter_audio",
      descricao: "Baixa áudio do Twitter",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("twitter")) return sock.sendMessage(idChat, { text: `🎵 Exemplo: *!twitter_audio link*` });
        try {
          await sock.sendMessage(idChat, { audio: { url: `https://api.bronxyshost.com.br/api-bronxys/twitter_audio?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "audio/mpeg" });
        } catch (e) {
          console.log("Erro twitter_audio:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar áudio do Twitter." });
        }
      }
    },

    {
      nome: "kwai",
      descricao: "Baixa vídeo do Kwai",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("kwai")) return sock.sendMessage(idChat, { text: `🎬 Exemplo: *!kwai link*` });
        try {
          await sock.sendMessage(idChat, { video: { url: `https://api.bronxyshost.com.br/api-bronxys/kwai?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "video/mp4" });
        } catch (e) {
          console.log("Erro kwai:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do Kwai." });
        }
      }
    },

    {
      nome: "threads",
      descricao: "Baixa do Threads",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("threads.net")) return sock.sendMessage(idChat, { text: `🧵 Exemplo: *!threads link*` });
        try {
          await sock.sendMessage(idChat, { video: { url: `https://api.bronxyshost.com.br/api-bronxys/threads?url=${q}&apikey=${API_KEY_BRONXYS}` } });
        } catch (e) {
          console.log("Erro threads:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do Threads." });
        }
      }
    },

    {
      nome: "mediafire",
      descricao: "Baixa arquivo do Mediafire",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("mediafire.com")) return sock.sendMessage(idChat, { text: `📦 Exemplo: *!mediafire link*` });
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/mediafire?url=${q}&apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.resultado?.[0]) return sock.sendMessage(idChat, { text: "❌ Não consegui extrair." });
          await sock.sendMessage(idChat, {
            document: { url: ABC.resultado[0].link },
            mimetype: "application/" + ABC.resultado[0].mime,
            fileName: ABC.resultado[0].nama
          });
        } catch (e) {
          console.log("Erro mediafire:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do Mediafire." });
        }
      }
    },

    {
      nome: "ifunny",
      descricao: "Baixa vídeo do iFunny",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `🎬 Exemplo: *!ifunny link*` });
        try {
          await sock.sendMessage(idChat, { video: { url: `https://api.bronxyshost.com.br/api-bronxys/ifunny?url=${q}&apikey=${API_KEY_BRONXYS}` }, mimetype: "video/mp4" });
        } catch (e) {
          console.log("Erro ifunny:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar do iFunny." });
        }
      }
    },

    // ==============================================
    // 🔍 PESQUISAS
    // ==============================================
    {
      nome: "pesquisa_yt",
      descricao: "Pesquisa no YouTube",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `🔍 Exemplo: *!pesquisa_yt nome*` });
        try {
          const AB = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/pesquisa_ytb?nome=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!AB?.length) return sock.sendMessage(idChat, { text: "❌ Nada encontrado." });
          let texto = "";
          for (const i of AB) texto += `🎬 *${i.titulo}*\n🔗 ${i.url}\n⏱️ ${i.tempo}\n\n`;
          await sock.sendMessage(idChat, { text: texto.slice(0, 4000) });
        } catch (e) {
          console.log("Erro pesquisa_yt:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro na pesquisa." });
        }
      }
    },

    {
      nome: "gimage",
      descricao: "Pesquisa imagem no Google",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `🖼️ Exemplo: *!gimage naruto*` });
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/google-img?nome=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!Array.isArray(ABC) || !ABC.length) return sock.sendMessage(idChat, { text: "❌ Nenhuma imagem encontrada." });
          await sock.sendMessage(idChat, { image: { url: ABC[Math.floor(Math.random() * ABC.length)].url } });
        } catch (e) {
          console.log("Erro gimage:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Não consegui buscar imagem." });
        }
      }
    },

// ==============================================
// 📌 PINTEREST (Obanai API)
// ==============================================
{
  nome: "pinterest",
  descricao: "Busca imagens no Pinterest",
  async executar({ sock, idChat, msg, resto }) {
    const q = (resto || "").trim();
    if (!q) {
      return sock.sendMessage(idChat, { text: `📌 *ᴜsᴏ:* !pinterest2 <pesquisa>` });
    }

    await sock.sendMessage(idChat, { text: "🔍 *ʙᴜsᴄᴀɴᴅᴏ ɪᴍᴀɢᴇɴs...*" });

    try {
      const r = await axios.get(
        `https://obanai-apis.eu.cc/api/dl/pinterest?q=${encodeURIComponent(q)}&apitoken=rj8SpI`
      );
      const data = r.data;

      if (!data.success || !data.data || data.data.length === 0) {
        return sock.sendMessage(idChat, { text: "❌ *ɴᴇɴʜᴜᴍᴀ ɪᴍᴀɢᴇᴍ ᴇɴᴄᴏɴᴛʀᴀᴅᴀ.*" });
      }

      const pushname = msg.pushName || "Usuário";
      const remetente = msg.key.participant || msg.key.remoteJid;

      for (const item of data.data.slice(0, 5)) {
        try {
          const img = await axios.get(item.image, { responseType: "arraybuffer" });
          await sock.sendMessage(idChat, {
            image: Buffer.from(img.data),
            caption: `📌 *${item.title || "Sem título"}*\n👤 ${pushname}`,
            mentions: [remetente]
          });
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.error("[ERRO ENVIO PINTEREST]:", e.message);
        }
      }
    } catch (e) {
      console.error("[ERRO PINTEREST2]:", e.message);
      await sock.sendMessage(idChat, { text: "❌ *ᴇʀʀᴏ ᴀᴏ ʙᴜsᴄᴀʀ ɪᴍᴀɢᴇɴs.*" });
    }
  }
},
    {
      nome: "print",
      descricao: "Print de um site",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `📸 Exemplo: *!print https://google.com*` });
        try {
          await sock.sendMessage(idChat, { image: { url: `https://api.bronxyshost.com.br/api-bronxys/print_de_site?url=${q}&apikey=${API_KEY_BRONXYS}` } });
        } catch (e) {
          console.log("Erro print:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao tirar print." });
        }
      }
    },

    {
      nome: "playstore",
      descricao: "Pesquisa apps na Play Store",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (q.length < 2) return sock.sendMessage(idChat, { text: `🛒 Exemplo: *!playstore whatsapp*` });
        try {
          const data = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/playstore?nome=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!data?.resultados?.length) return sock.sendMessage(idChat, { text: "❌ Nada encontrado." });
          let ABC = "🛒 *Play Store:*\n\n";
          for (const a of data.resultados) ABC += `📱 *${a.title}*\n🆔 ${a.appId}\n🔗 ${a.url}\n\n`;
          await sock.sendMessage(idChat, { text: ABC.slice(0, 4000) });
        } catch (e) {
          console.log("Erro playstore:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro na pesquisa." });
        }
      }
    },

    {
      nome: "amazon",
      descricao: "Pesquisa na Amazon",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (q.length < 4) return sock.sendMessage(idChat, { text: `🛒 Exemplo: *!amazon fone*` });
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/Amazon_Pesquisa?pesquisa=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.length) return sock.sendMessage(idChat, { text: "❌ Nada encontrado." });
          let RST = "🛒 *Amazon:*\n\n";
          for (let i = 0; i < Math.min(40, ABC.length); i++) RST += `(${i + 1}) *${ABC[i].titulo}*\n💰 ${ABC[i].preco}\n🔗 ${ABC[i].url}\n\n`;
          await sock.sendMessage(idChat, { text: RST.slice(0, 4000) });
        } catch (e) {
          console.log("Erro amazon:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro na pesquisa." });
        }
      }
    },

    {
      nome: "aptoide_pesquisa",
      descricao: "Pesquisa apps no Aptoide",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `📱 Exemplo: *!aptoide_pesquisa whatsapp*` });
        try {
          const abc = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/aptoide_pesquisa?pesquisa=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          await sock.sendMessage(idChat, { text: (abc.aptoide || "❌ Nada encontrado.").slice(0, 4000) });
        } catch (e) {
          console.log("Erro aptoide_pesquisa:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro na pesquisa." });
        }
      }
    },

    {
      nome: "aptoide",
      descricao: "Baixa APK do Aptoide",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q.includes("aptoide.com")) return sock.sendMessage(idChat, { text: `📱 Exemplo: *!aptoide link*` });
        try {
          const abc = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/aptoide?url=${q}&apikey=${API_KEY_BRONXYS}`);
          if (!abc?.link) return sock.sendMessage(idChat, { text: "❌ Não consegui extrair." });
          await sock.sendMessage(idChat, {
            document: { url: abc.link },
            mimetype: "application/vnd.android.package-archive",
            fileName: abc.titulo || "app.apk"
          });
        } catch (e) {
          console.log("Erro aptoide:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao baixar APK." });
        }
      }
    },

    {
      nome: "gruposwhatsapp",
      descricao: "Lista de grupos WhatsApp",
      async executar({ sock, idChat }) {
        try {
          const abcd = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/gruposwhatsapp?apikey=${API_KEY_BRONXYS}`);
          if (!abcd?.length) return sock.sendMessage(idChat, { text: "❌ Nada encontrado." });
          let gps = "📱 *Grupos WhatsApp:*\n\n";
          for (const g of abcd) gps += `📌 *${g.titulo}*\n📜 ${g.regras}\n🔗 ${g.link}\n\n`;
          await sock.sendMessage(idChat, { text: gps.slice(0, 4000) });
        } catch (e) {
          console.log("Erro gruposwhatsapp:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao buscar grupos." });
        }
      }
    },

    // ==============================================
    // 📊 INFORMAÇÕES
    // ==============================================
    {
      nome: "tabelacamp",
      descricao: "Tabela do Campeonato Brasileiro",
      async executar({ sock, idChat }) {
        try {
          const abc = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/tabela_camp?apikey=${API_KEY_BRONXYS}`);
          if (!abc?.length) return sock.sendMessage(idChat, { text: "❌ Nada encontrado." });
          let rst = "🏆 *Brasileirão:*\n\n";
          for (let i = 0; i < abc.length; i++) {
            rst += `(${i + 1}º) *${abc[i].time}*\n🎯 ${abc[i].pontos} pts | 🎮 ${abc[i].jogos} J\n✅ ${abc[i].vitorias} | 🤝 ${abc[i].empates} | ❌ ${abc[i].derrotas}\n\n`;
          }
          await sock.sendMessage(idChat, { text: rst.slice(0, 4000) });
        } catch (e) {
          console.log("Erro tabelacamp:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao buscar tabela." });
        }
      }
    },

    {
      nome: "moedas",
      descricao: "Cotações de moedas",
      async executar({ sock, idChat }) {
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/Moedas_Agora?apikey=${API_KEY_BRONXYS}`);
          if (!ABC) return sock.sendMessage(idChat, { text: "❌ Nada encontrado." });
          await sock.sendMessage(idChat, { text: `💰 *COTAÇÕES:*\n\n${ABC?.dolar}\n\n${ABC?.euro}\n\n${ABC?.libra}\n\n${ABC?.bitcoin}\n\n${ABC?.ethereum}\n\n${ABC?.bovespa}\n\n${ABC?.ouro}` });
        } catch (e) {
          console.log("Erro moedas:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao buscar cotações." });
        }
      }
    },

    {
      nome: "cep",
      descricao: "Consulta CEP",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim().replace(/\D/g, "");
        if (!q) return sock.sendMessage(idChat, { text: `📮 Exemplo: *!cep 51240230*` });
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/consultacep?cep=${q}&apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.cep) return sock.sendMessage(idChat, { text: "❌ CEP não encontrado." });
          await sock.sendMessage(idChat, { text: `📮 *CEP ${ABC.cep}*\n\n🏠 ${ABC.rua}\n🏘️ ${ABC.vizinhança}\n🌆 ${ABC.cidade} - ${ABC.estado}\n📞 DDD: ${ABC.ddd}` });
        } catch (e) {
          console.log("Erro cep:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao consultar CEP." });
        }
      }
    },

    {
      nome: "signo",
      descricao: "Horóscopo do signo",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `♈ Exemplo: *!signo virgem*` });
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/horoscopo?signo=${q}&apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.body) return sock.sendMessage(idChat, { text: "❌ Signo não encontrado." });
          await sock.sendMessage(idChat, { image: { url: ABC.img }, caption: `♈ *${q}*\n\n${ABC.title}\n${ABC.body}` });
        } catch (e) {
          console.log("Erro signo:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao buscar horóscopo." });
        }
      }
    },

    {
      nome: "celular",
      descricao: "Info sobre celular",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `📱 Exemplo: *!celular galaxy a9*` });
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/info_celular?celular=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.celular) return sock.sendMessage(idChat, { text: "❌ Não encontrado." });
          await sock.sendMessage(idChat, { text: `📱 *${ABC.celular}*\n\n${ABC.resumo || ABC.infoc || "N/E"}`.slice(0, 4000) });
        } catch (e) {
          console.log("Erro celular:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro na pesquisa." });
        }
      }
    },

    {
      nome: "esportenoticias",
      descricao: "Notícias de esportes",
      async executar({ sock, idChat }) {
        try {
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/esporte_noticias?apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.length) return sock.sendMessage(idChat, { text: "❌ Nada encontrado." });
          let AB = "";
          for (let i = 1; i < ABC.length; i++) AB += `📰 ${ABC[i].titulo}\n\n`;
          await sock.sendMessage(idChat, { image: { url: ABC[0].img }, caption: AB.slice(0, 4000) });
        } catch (e) {
          console.log("Erro esportenoticias:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao buscar notícias." });
        }
      }
    },

    // ==============================================
    // 🤖 IA
    // ==============================================
    {
      nome: "gpt",
      descricao: "Pergunta pro GPT",
      async executar({ sock, idChat, resto }) {
        const q = (resto || "").trim();
        if (!q) return sock.sendMessage(idChat, { text: `🤖 Exemplo: *!pergunta sua pergunta*` });
        try {
          await sock.sendMessage(idChat, { text: "🤖 Pensando..." });
          const ABC = await fetchJson(`https://api.bronxyshost.com.br/api-bronxys/PERGUNTE_E_EU_RESPONDO?q=${encodeURIComponent(q)}&apikey=${API_KEY_BRONXYS}`);
          if (!ABC?.msg) return sock.sendMessage(idChat, { text: "❌ A IA não respondeu." });
          await sock.sendMessage(idChat, { text: `🤖 ${ABC.msg}`.slice(0, 4000) });
        } catch (e) {
          console.log("Erro pergunta:", e.message);
          await sock.sendMessage(idChat, { text: "❌ Erro ao consultar a IA." });
        }
      }
    }
  ]
};
