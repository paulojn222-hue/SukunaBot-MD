const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Função para pegar a chave da API de forma segura, seja qual for o nome no config
function obterApiKey(config) {
    if (config?.spiderKey) return config.spiderKey;
    try {
        const cfg = require('../config.js');
        return cfg.spiderKey || cfg.SPIDER_X_API_KEY || cfg.apiKey || "";
    } catch (e) {
        return "";
    }
}

function getBotaoCanal() {
    try {
        const config = require('../config.js');
        if (!config.canal || !config.canal.id) return {};
        return {
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.canal.id.trim(),
                    newsletterName: config.canal.nome || "Ver Canal",
                    serverMessageId: Math.floor(Math.random() * 99999) + 1
                }
            }
        };
    } catch (e) { return {}; }
}

function buildApiUrl(path, params = {}, apiKey) {
    const url = new URL("https://api.spiderx.com.br/api" + path);
    url.searchParams.set('api_key', apiKey);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    return url.toString();
}

function getApiHeaders(apiKey) {
    return { 'X-API-KEY': apiKey };
}

async function fetchJson(url) {
    const response = await axios.get(url, { headers: { 'User-Agent': 'SpiderX-Examples/1.0', 'Accept-Language': 'pt-BR' } });
    return response.data;
}

async function postJson(url, body) {
    const response = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
}

async function postForm(url, form, options = {}) {
    const response = await axios.post(url, form, { headers: { ...form.getHeaders(), ...options.headers }, ...options });
    return response.data;
}

async function postFormBuffer(url, form, options = {}) {
    const response = await axios.post(url, form, { responseType: 'arraybuffer', headers: { ...form.getHeaders(), ...options.headers }, ...options });
    return Buffer.from(response.data);
}

async function getFileBuffer(mediakey, mediaType) {
    const stream = await downloadContentFromMessage(mediakey, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

module.exports = {
    comandos: [

// ==============================================
// 📋 MENU DE DOWNLOADS E PESQUISAS (Personalizável)
// ==============================================
{
    nome: "menubaixar",
    descricao: "Mostra o menu de downloads e IA",
    async executar({ sock, idChat, msg, resto, config, PREFIXO, NOME_BOT }) {
        const fs = require("fs");
        const path = require("path");
        
        // Pega as configurações básicas ou usa padrões
        const p = PREFIXO || "!";
        const botNome = NOME_BOT || "MoonBot";

        // 1. Busca o texto no arquivo .txt
        let textoMenu = "";
        const caminhoTexto = path.join(__dirname, "..", "personalize_aqui", "menu_pesquisas.txt");
        
        try {
            if (fs.existsSync(caminhoTexto)) {
                textoMenu = fs.readFileSync(caminhoTexto, "utf8");
                // Substitui as variáveis no texto
                textoMenu = textoMenu
                    .replace(/{PREFIXO}/g, p)
                    .replace(/{BOT}/g, botNome);
            } else {
                // Fallback caso o arquivo não exista
                textoMenu = `╭━━━〔 📥 *MENU DE DOWNLOADS* 〕━━━╮\n┃\n┃ ⚠️ O arquivo de texto do menu não foi encontrado.\n┃ Crie o arquivo em: personaliz_aqui/menu_pesquisas.txt\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
            }
        } catch (e) {
            textoMenu = "❌ Erro ao ler o arquivo de texto do menu.";
        }

        // 2. Busca a mídia (imagem/vídeo) no JSON
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
            console.log("Erro ao carregar mídia do menu:", e);
        }

        // 3. Define quem será mencionado
        const remetente = msg.key.participant || msg.key.remoteJid;

        // 4. Envia com mídia (se existir) ou só o texto
        if (midia?.meta?.tipo === "image") {
            await sock.sendMessage(idChat, {
                image: midia.buffer,
                caption: textoMenu,
                mentions: [remetente],
                ...getBotaoCanal()
            }, { quoted: msg });
        } else if (midia?.meta?.tipo === "video") {
            await sock.sendMessage(idChat, {
                video: midia.buffer,
                caption: textoMenu,
                mentions: [remetente],
                gifPlayback: true,
                ...getBotaoCanal()
            }, { quoted: msg });
        } else {
            await sock.sendMessage(idChat, {
                text: textoMenu,
                mentions: [remetente],
                ...getBotaoCanal()
            }, { quoted: msg });
        }
    }
},

{
    nome: "ytmp3",
    descricao: "Baixa áudio do YouTube",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Eita!* Cadê o link do YouTube?", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "⏳ Já volto com o áudio!", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/yt-mp3', { url: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { audio: { url: data.url }, mimetype: "audio/mpeg", fileName: `${data.title || 'audio'}.mp3`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Erro ao baixar.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "ytmp4",
    descricao: "Baixa vídeo do YouTube",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Calma aí!* Você esqueceu o link.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "⏳ Baixando vídeo...", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/yt-mp4', { url: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { video: { url: data.url }, mimetype: "video/mp4", caption: data.title || "", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Erro ao baixar.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},

{
    nome: "play",
    descricao: "Busca e baixa áudio",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Peraí!* Você não disse o nome da música.\n\n> *Exemplo:* !play MC Kevinho", ...getBotaoCanal() }, { quoted: msg });
        
        await sock.sendMessage(idChat, { text: `🔎 *Procurando "${resto.trim()}"...*\n\n⏳ Deixa eu vasculhar aqui!`, ...getBotaoCanal() }, { quoted: msg });
        
        try {
            // Busca a chave diretamente do config se o objeto config falhar
            let apiKey = config?.spiderKey;
            if (!apiKey) {
                const cfg = require('../config.js');
                apiKey = cfg.spiderKey || cfg.SPIDER_X_API_KEY;
            }

            const data = await fetchJson(buildApiUrl('/downloads/play-audio', { search: resto.trim() }, apiKey));
            await sock.sendMessage(idChat, { audio: { url: data.url }, mimetype: "audio/mpeg", fileName: `${data.title || 'audio'}.mp3`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { 
            await sock.sendMessage(idChat, { text: "❌ Erro: " + e.message, ...getBotaoCanal() }, { quoted: msg }); 
        }
    }
},

{
    nome: "playvd",
    descricao: "Busca e baixa vídeo",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Epa!* Cadê o nome do vídeo?", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: `🔎 Buscando "${resto.trim()}"...`, ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/play-video', { search: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { video: { url: data.url }, mimetype: "video/mp4", caption: data.title || "", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: `❌ Nada encontrado.`, ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "tiktok",
    descricao: "Baixa vídeo do TikTok",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Uai!* Cadê o link?", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🎵 Analisando o TikTok...", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/tik-tok', { url: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { video: { url: data.download_link }, mimetype: "video/mp4", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Erro ao baixar.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "tiktokaudio",
    descricao: "Baixa áudio do TikTok",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Oxe!* Envie o link.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🎵 Extraindo áudio...", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/tik-tok-audio', { url: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { audio: { url: data.download_link }, mimetype: "audio/mpeg", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Erro ao baixar.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "insta",
    descricao: "Baixa mídia do Instagram",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Oxe!* Envie o link.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "📸 Analisando o Instagram...", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/instagram', { url: resto.trim() }, obterApiKey(config)));
            const mediaUrl = data.url || data.thumb;
            if (!mediaUrl) throw new Error("Mídia não encontrada.");
            await sock.sendMessage(idChat, { video: { url: mediaUrl }, mimetype: "video/mp4", caption: data.title || "", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Não consegui baixar.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "face",
    descricao: "Baixa vídeo do Facebook",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Eita!* Envie o link.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "📥 Baixando Facebook...", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/facebook', { url: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { video: { url: data.url }, mimetype: "video/mp4", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Erro ao baixar.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "x",
    descricao: "Baixa mídia do X/Twitter",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ *Manda o link!*", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🐦 Baixando do X...", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/x-twitter', { url: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { video: { url: data.url }, mimetype: "video/mp4", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Erro ao baixar.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "pinterest",
    descricao: "Busca imagens no Pinterest",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ O que você quer buscar?", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🔎 Buscando no Pinterest...", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/downloads/pinterest', { search: resto.trim() }, obterApiKey(config)));
            if (!data || data.length === 0) throw new Error();
            for (const item of data) {
                await sock.sendMessage(idChat, { image: { url: item.url }, caption: `Pinterest: ${resto.trim()}`, ...getBotaoCanal() }, { quoted: msg });
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ Nada encontrado.", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "ytpesquisa",
    descricao: "Pesquisa no YouTube",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite o que quer buscar.", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/search/youtube', { search: resto.trim() }, obterApiKey(config)));
            const list = data.slice(0, 5).map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join("\n\n");
            await sock.sendMessage(idChat, { text: `🔍 *Resultados:*\n\n${list || "Nada encontrado."}`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao pesquisar.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},

{
    nome: "bolsonaro",
    descricao: "Montagem Bolsonaro",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Envie o link da imagem.", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/canvas/bolsonaro', { image_url: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar imagem.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "jail",
    descricao: "Efeito de grade",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Envie o link da imagem.", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/canvas/jail', { image_url: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar imagem.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "invert",
    descricao: "Inverte as cores",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Envie o link da imagem.", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/canvas/invert', { image_url: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar imagem.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "rip",
    descricao: "Efeito de luto",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Envie o link da imagem.", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/canvas/rip', { image_url: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar imagem.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "welcome",
    descricao: "Cria imagem de boas-vindas",
    async executar({ sock, idChat, msg, resto, config }) {
        const [title, description, imageUrl] = (resto || "").split('|').map(i => i.trim());
        if (!title || !description) return sock.sendMessage(idChat, { text: "❌ Use: titulo|descricao|url(opcional)", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/canvas/welcome', { title, description, image_url: imageUrl || undefined }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar welcome.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "goodbye",
    descricao: "Cria imagem de despedida",
    async executar({ sock, idChat, msg, resto, config }) {
        const [title, description, imageUrl] = (resto || "").split('|').map(i => i.trim());
        if (!title || !description) return sock.sendMessage(idChat, { text: "❌ Use: titulo|descricao|url(opcional)", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/canvas/goodbye', { title, description, image_url: imageUrl || undefined }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar goodbye.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "attp",
    descricao: "Sticker animado de texto",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite o texto.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "✨ *Criando figurinha...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/stickers/attp', { text: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao criar figurinha.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "ttp",
    descricao: "Sticker de texto",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite o texto.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "✨ *Criando figurinha...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/stickers/ttp', { text: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao criar figurinha.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "brat",
    descricao: "Sticker estilo Brat",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite o texto.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "✨ *Criando figurinha Brat...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/stickers/brat', { text: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { image: { url }, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao criar figurinha.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "abrat",
    descricao: "Sticker animado Brat",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite o texto.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "✨ *Criando figurinha animada...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const url = buildApiUrl('/stickers/abrat', { text: resto.trim() }, obterApiKey(config));
            await sock.sendMessage(idChat, { video: { url }, gifPlayback: true, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao criar figurinha.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},

{
    nome: "flux",
    descricao: "Gera imagem com IA",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Descreva o que quer gerar.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🎨 *Gerando imagem...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await fetchJson(buildApiUrl('/ai/flux', { text: resto.trim() }, obterApiKey(config)));
            await sock.sendMessage(idChat, { image: { url: data.image }, caption: `🖼️ Prompt: ${resto.trim()}`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar imagem.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "gemini",
    descricao: "IA Gemini",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite a pergunta.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🧠 *Consultando o Gemini...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await postJson(buildApiUrl('/ai/gemini', {}, obterApiKey(config)), { text: resto.trim() });
            await sock.sendMessage(idChat, { text: `🤖 *Resposta do Gemini:*\n\n${data.response || "Sem resposta."}`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *A IA não respondeu.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "gpt5",
    descricao: "IA GPT-5",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite a pergunta.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🧠 *Consultando o GPT-5...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await postJson(buildApiUrl('/ai/gpt-5-mini', {}, obterApiKey(config)), { text: resto.trim() });
            await sock.sendMessage(idChat, { text: `🤖 *Resposta do GPT-5:*\n\n${data.response || "Sem resposta."}`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *A IA não respondeu.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "deepseek",
    descricao: "IA DeepSeek",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite a pergunta.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🧠 *Consultando o DeepSeek...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await postJson(buildApiUrl('/ai/deepseek-v4-flash', {}, obterApiKey(config)), { text: resto.trim() });
            await sock.sendMessage(idChat, { text: `🤖 *Resposta do DeepSeek:*\n\n${data.response || "Sem resposta."}`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *A IA não respondeu.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "haiku",
    descricao: "IA Claude Haiku",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Digite a pergunta.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🧠 *Consultando o Claude...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await postJson(buildApiUrl('/ai/claude-haiku-5-5', {}, obterApiKey(config)), { text: resto.trim() });
            await sock.sendMessage(idChat, { text: `🤖 *Resposta do Claude:*\n\n${data.response || "Sem resposta."}`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *A IA não respondeu.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "tts",
    descricao: "Texto para áudio (vozes)",
    async executar({ sock, idChat, msg, resto, config }) {
        if (!resto) return sock.sendMessage(idChat, { text: "❌ Use: !tts Ola, tudo bem? | joao", ...getBotaoCanal() }, { quoted: msg });
        const rawTts = resto.trim();
        const [ttsText, ttsVoiceRaw] = rawTts.includes("|") ? rawTts.split("|").map(p => p.trim()) : [rawTts, "joao"];
        const ttsVoice = (ttsVoiceRaw || "joao").toLowerCase();
        await sock.sendMessage(idChat, { text: "🔊 *Gerando áudio...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const data = await postJson(buildApiUrl("/ai/tts", {}, obterApiKey(config)), { text: ttsText, voice: ttsVoice });
            await sock.sendMessage(idChat, { audio: { url: data.url }, mimetype: "audio/mpeg", ptt: true, fileName: "tts.mp3", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { await sock.sendMessage(idChat, { text: "❌ *Erro ao gerar áudio.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "whisper",
    descricao: "Transcreve áudio para texto",
    async executar({ sock, idChat, msg, config, downloadMediaMessage }) {
        const isQuotedAudio = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage;
        const isAudio = msg.message?.audioMessage;
        if (!isAudio && !isQuotedAudio) return sock.sendMessage(idChat, { text: "❌ Marque um áudio para transcrever.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🎙️ *Transcrevendo áudio...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const message = isQuotedAudio ? msg.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage : msg.message.audioMessage;
            const buffer = await downloadMediaMessage({ key: { id: isQuotedAudio ? msg.message.extendedTextMessage.contextInfo.stanzaId : msg.key.id }, message: message }, 'buffer', {});
            const form = new FormData();
            form.append('audio', buffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
            const data = await postForm(buildApiUrl("/ai/whisper-v3-turbo", {}, obterApiKey(config)), form);
            await sock.sendMessage(idChat, { text: `📝 *Transcrição:*\n\n${data.transcription || "Nada encontrado."}`, ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { console.log(e); await sock.sendMessage(idChat, { text: " ❌ *Erro ao transcrever.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
},
{
    nome: "removebg",
    descricao: "Remove fundo da imagem",
    async executar({ sock, idChat, msg, config, downloadMediaMessage }) {
        const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        const isImage = msg.message?.imageMessage;
        if (!isImage && !isQuotedImage) return sock.sendMessage(idChat, { text: "❌ Marque uma imagem.", ...getBotaoCanal() }, { quoted: msg });
        await sock.sendMessage(idChat, { text: "🪄 *Removendo fundo...*", ...getBotaoCanal() }, { quoted: msg });
        try {
            const message = isQuotedImage ? msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage : msg.message.imageMessage;
            const buffer = await downloadMediaMessage({ key: { id: isQuotedImage ? msg.message.extendedTextMessage.contextInfo.stanzaId : msg.key.id }, message: message }, 'buffer', {});
            const form = new FormData();
            form.append('image', buffer, { filename: 'imagem.jpg', contentType: 'image/jpeg' });
            const pngBuffer = await postFormBuffer(buildApiUrl("/removebg", {}, obterApiKey(config)), form);
            await sock.sendMessage(idChat, { image: pngBuffer, mimetype: "image/png", fileName: "sem-fundo.png", ...getBotaoCanal() }, { quoted: msg });
        } catch (e) { console.log(e); await sock.sendMessage(idChat, { text: " ❌ *Erro ao remover fundo.*", ...getBotaoCanal() }, { quoted: msg }); }
    }
}
    ]
};
