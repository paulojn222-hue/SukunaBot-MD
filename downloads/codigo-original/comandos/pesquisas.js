const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
// ⚠️ AJUSTE AQUI se necessário: se o config.js está na raiz, use "../config"
const config = require("../config");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const BASE = "https://api.bronxyshost.com.br/api-bronxys";

// ==============================================
// 🔧 HELPERS INTERNOS
// ==============================================
function apiUrl(endpoint, params = {}) {
    const url = new URL(`${BASE}/${endpoint}`);
    url.searchParams.set("apikey", config.bronxysApiKey);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}

async function fetchJson(url) {
    const response = await axios.get(url, {
        timeout: 60000,
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "pt-BR"
        }
    });
    return response.data;
}

async function enviar(sock, from, msg, conteudo) {
    return sock.sendMessage(from, conteudo, { quoted: msg });
}

async function baixarMidia(media, tipo) {
    if (!media) throw new Error("Mídia não encontrada.");
    const stream = await downloadContentFromMessage(media, tipo);
    let buffer = Buffer.alloc(0);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

function mensagemCitadas(msg) {
    const m = msg.message || {};
    const ext = m.extendedTextMessage;
    let quoted = ext?.contextInfo?.quotedMessage;
    if (!quoted) return null;

    while (
        quoted.ephemeralMessage ||
        quoted.viewOnceMessage ||
        quoted.viewOnceMessageV2
    ) {
        quoted =
            quoted.ephemeralMessage?.message ||
            quoted.viewOnceMessage?.message ||
            quoted.viewOnceMessageV2?.message ||
            quoted;
    }
    return quoted;
}

function obterMidia(msg, tipo) {
    const m = msg.message || {};
    const quoted = mensagemCitadas(msg);

    const campos = {
        image: ["imageMessage"],
        video: ["videoMessage"],
        audio: ["audioMessage"]
    };

    for (const campo of campos[tipo] || []) {
        if (m[campo]) return m[campo];
        if (quoted?.[campo]) return quoted[campo];
    }
    return null;
}

async function uploadImagem(buffer) {
    const form = new FormData();
    form.append("file", buffer, {
        filename: "imagem.jpg",
        contentType: "image/jpeg"
    });

    const response = await axios.post(
        `https://api.bronxyshost.com.br/api-bronxys/link_imagem?apikey=${encodeURIComponent(config.bronxysApiKey)}`,
        form,
        { headers: form.getHeaders(), timeout: 60000 }
    );

    if (!response.data?.link) {
        throw new Error("A API não retornou o link da imagem.");
    }
    return response.data.link;
}

function validarLink(valor, dominios) {
    try {
        const url = new URL(valor);
        return (
            ["http:", "https:"].includes(url.protocol) &&
            dominios.some(d => url.hostname.toLowerCase().includes(d))
        );
    } catch {
        return false;
    }
}

const ARQ_MENU_PESQ_1 = path.join(__dirname, "..", "personalize_aqui", "menu_pesquisas.txt");
const ARQ_MENU_PESQ_2 = path.join(__dirname, "..", "menus", "menu_pesquisas.txt");

function carregarMenuPesquisas() {
    try {
        if (fs.existsSync(ARQ_MENU_PESQ_1)) return fs.readFileSync(ARQ_MENU_PESQ_1, "utf8");
        if (fs.existsSync(ARQ_MENU_PESQ_2)) return fs.readFileSync(ARQ_MENU_PESQ_2, "utf8");
        return "❌ Menu de downloads não encontrado.";
    } catch {
        return "❌ Erro ao ler o arquivo.";
    }
}

// ==============================================
// ✅ ADAPTADOR: cria comando no formato do loader
// O loader (index.js) chama:
//   executar({ sock, idChat, resto, texto, msg, PREFIXO, ... })
// e registra com: comandos.set(c.nome, c.executar)
// ==============================================
function criarComando(nome, aliases, logica) {
    return {
        nome,
        aliases: aliases || [],
        async executar(ctx) {
            const {
                sock,
                idChat,
                msg,
                resto,
                PREFIXO
            } = ctx;

            // Reconstrói os helpers que a "logica" espera
            const from = idChat;
            const prefix = PREFIXO || config.PREFIXO || "!";
            const q = (resto || "").trim();
            const responder = (mensagem) =>
                enviar(sock, from, msg, { text: mensagem });

            // Verifica API Key
            if (
                !config.bronxysApiKey ||
                config.bronxysApiKey === "SUA_KEY_AQUI"
            ) {
                return responder(
                    "❌ Configure sua API Key em config.js primeiro."
                );
            }

            try {
                return await logica({
                    sock,
                    msg,
                    from,
                    q,
                    prefix,
                    responder
                });
            } catch (erro) {
                console.log(
                    `[ERRO] Comando ${nome}:`,
                    erro.response?.data || erro.message
                );
                return responder(
                    "❌ Ocorreu um erro ao executar o comando. Tente novamente."
                );
            }
        }
    };
}

const comandos = [];

// ==============================================
// 📥 COMANDOS
// ==============================================

// MENU
comandos.push(criarComando("menubaixar", [], async ({ sock, msg, from, prefix, responder }) => {
    // Puxa a MESMA mídia do menu principal
    let midia = null;
    try {
        const caminhoMeta = path.join(__dirname, "..", "dados", "menu_midia_menu.json");
        if (fs.existsSync(caminhoMeta)) {
            const meta = JSON.parse(fs.readFileSync(caminhoMeta, "utf8"));
            if (meta && typeof meta.arquivo === "string") {
                const caminhoArq = path.join(__dirname, "..", "dados", meta.arquivo);
                if (fs.existsSync(caminhoArq)) midia = { meta, buffer: fs.readFileSync(caminhoArq) };
            }
        }
    } catch {}

    const remetente = msg.key.participant || msg.key.remoteJid;
    const userNumero = String(remetente).split("@")[0].split(":")[0];

    const texto = carregarMenuPesquisas()
        .replace(/{prefix}/g, prefix || "!")
        .replace(/{user}/g, `@${userNumero}`)
        .replace(/{botName}/g, "Bot");

    if (midia?.meta?.tipo === "image") {
        return sock.sendMessage(from, {
            image: midia.buffer,
            caption: texto,
            mentions: [remetente]
        }, { quoted: msg });
    }

    if (midia?.meta?.tipo === "video") {
        return sock.sendMessage(from, {
            video: midia.buffer,
            caption: texto,
            mentions: [remetente],
            gifPlayback: true
        }, { quoted: msg });
    }

    return responder(texto);
}));
// TABELA DO CAMPEONATO
comandos.push(criarComando(
    "tabelacamp",
    ["tabela_camp", "tabela-camp", "campeonato", "camptabela"],
    async ({ responder }) => {
        const data = await fetchJson(apiUrl("tabela_camp"));
        if (!Array.isArray(data) || !data.length) {
            return responder("❌ Tabela não encontrada.");
        }

        let resultado = "🏆 TABELA DO CAMPEONATO BRASILEIRO\n\n";
        data.forEach((time, i) => {
            resultado +=
`📍 ${i + 1}º ${time.time}
🎯 Pontos: ${time.pontos}
🎮 Jogos: ${time.jogos}
✅ Vitórias: ${time.vitorias}
🤝 Empates: ${time.empates}
❌ Derrotas: ${time.derrotas}
⚽ Gols pró: ${time.golsPro}
🥅 Gols contra: ${time.golsContra}
📊 Saldo: ${time.saldoGols}
📈 Aproveitamento: ${time.aproveitamento}

━━━━━━━━━━━━━━━━━━

`;
        });
        return responder(resultado);
    }
));

// DOWNLOADS POR LINK
const downloads = [
    ["threads", ["thr"], "threads", ["threads.net"], "video"],
    ["soundcloud", [], "soundcloud", ["soundcloud.com"], "audio"],
    ["ifunny", [], "ifunny", ["ifunny.co"], "video"],
    ["kwai", [], "kwai", ["kwai.com"], "video"],
    ["spotify", [], "spotify", ["spotify.com"], "audio"],
    ["tiktok_video", [], "tiktok", ["tiktok.com"], "video"],
    ["tiktok_audio", [], "tiktok", ["tiktok.com"], "audio"],
    ["face_video", [], "face_video", ["facebook.com", "fb.watch"], "video"],
    ["face_audio", [], "face_audio", ["facebook.com", "fb.watch"], "audio"],
    ["twitter_video", [], "twitter_video", ["twitter.com", "x.com"], "video"],
    ["twitter_audio", [], "twitter_audio", ["twitter.com", "x.com"], "audio"]
];

for (const [nome, aliases, endpoint, dominios, tipo] of downloads) {
    comandos.push(criarComando(nome, aliases, async ({
        sock, msg, from, q, responder
    }) => {
        if (!validarLink(q, dominios)) {
            return responder(`Envie um link válido para usar o comando ${nome}.`);
        }
        await responder("⏳ Aguarde, preparando seu arquivo...");
        const url = apiUrl(endpoint, { url: q });
        return enviar(sock, from, msg, {
            [tipo]: { url },
            mimetype: tipo === "video" ? "video/mp4" : "audio/mpeg"
        });
    }));
}

// YOUTUBE — play
comandos.push(criarComando("play", [], async ({
    sock, msg, from, q, prefix, responder
}) => {
    if (!q) return responder(`Exemplo: ${prefix}play nome da música`);

    const data = await fetchJson(apiUrl("pesquisa_ytb", { nome: q }));
    const item = data?.[0];
    if (!item) return responder("❌ Música não encontrada.");

    if (String(item.tempo || "").length >= 7) {
        return responder("⏰ Esse conteúdo é muito longo.");
    }

    await responder(
`🎵 Título: ${item.titulo || "Não encontrado"}
⏱️ Tempo: ${item.tempo || "Não informado"}
📅 Postado: ${item.postado || "Não informado"}

⏳ Enviando áudio...`
    );

    return enviar(sock, from, msg, {
        audio: { url: apiUrl("play", { nome_url: q }) },
        mimetype: "audio/mpeg",
        fileName: "musica.mp3"
    });
}));

// playmp4
comandos.push(criarComando("playmp4", ["play_video"], async ({
    sock, msg, from, q, prefix, responder
}) => {
    if (!q) return responder(`Exemplo: ${prefix}playmp4 nome do vídeo`);

    const data = await fetchJson(apiUrl("pesquisa_ytb", { nome: q }));
    const item = data?.[0];
    if (!item) return responder("❌ Vídeo não encontrado.");

    if (String(item.tempo || "").length >= 7) {
        return responder("⏰ Esse conteúdo é muito longo.");
    }

    await responder(`🎬 Encontrado: ${item.titulo || q}\n⏳ Enviando vídeo...`);

    return enviar(sock, from, msg, {
        video: { url: apiUrl("play_video", { nome_url: q }) },
        mimetype: "video/mp4",
        fileName: "video.mp4"
    });
}));

// playdoc
comandos.push(criarComando("playdoc", [], async ({
    sock, msg, from, q, prefix, responder
}) => {
    if (!q) return responder(`Exemplo: ${prefix}playdoc nome da música`);

    const data = await fetchJson(apiUrl("pesquisa_ytb", { nome: q }));
    const item = data?.[0];
    if (!item) return responder("❌ Música não encontrada.");

    if (String(item.tempo || "").length >= 7) {
        return responder("⏰ Esse conteúdo é muito longo.");
    }

    return enviar(sock, from, msg, {
        document: { url: apiUrl("play", { nome_url: q }) },
        mimetype: "audio/mpeg",
        fileName: "musica.mp3"
    });
}));

// PESQUISAS
const pesquisas = [
    ["grupos", [], "grupos", "q"],
    ["aptoide_pesquisa", [], "aptoide_pesquisa", "pesquisa"],
    ["playstore", [], "playstore", "nome"],
    ["celular", [], "info_celular", "celular"],
    ["amazon", ["amazonsearch"], "Amazon_Pesquisa", "pesquisa"],
    ["pesquisa_yt", ["ytsearch"], "pesquisa_ytb", "nome"],
    ["signo", [], "horoscopo", "signo"],
    ["cep", [], "consultacep", "cep"],
    ["gerarnick", [], "gerar_nick", "nick"],
    ["gimage", [], "google-img", "nome"],
    ["pinterest", [], "pinterest", "nome"]
];

for (const [nome, aliases, endpoint, parametro] of pesquisas) {
    comandos.push(criarComando(nome, aliases, async ({
        sock, msg, from, q, responder
    }) => {
        if (!q) return responder("Digite o que deseja pesquisar.");

        const data = await fetchJson(apiUrl(endpoint, { [parametro]: q }));

        if (nome === "grupos") {
            if (!Array.isArray(data) || !data.length) return responder("Nenhum grupo encontrado.");
            return responder(data.map(g =>
                `🔗 ${g.link}\n📝 ${g.desc || "Sem descrição"}`
            ).join("\n\n━━━━━━━━━━━━\n\n"));
        }

        if (nome === "aptoide_pesquisa") {
            return responder(String(data.aptoide || "Nenhum resultado encontrado."));
        }

        if (nome === "playstore") {
            const lista = data.resultados || [];
            if (!lista.length) return responder("Nenhum aplicativo encontrado.");
            return responder(lista.slice(0, 15).map((a, i) =>
                `${i + 1}. ${a.title}\nID: ${a.appId}\nLink: ${a.url}`
            ).join("\n\n"));
        }

        if (nome === "celular") {
            return responder(
`📱 Celular: ${data.celular || "Não encontrado"}

${data.resumo || data.infoc || "Informações não encontradas."}`
            );
        }

        if (nome === "amazon") {
            if (!Array.isArray(data) || !data.length) return responder("Nenhum resultado encontrado.");
            return responder(data.slice(0, 15).map((a, i) =>
                `${i + 1}. ${a.titulo}\n💰 ${a.preco}\n🔗 ${a.url}`
            ).join("\n\n━━━━━━━━━━━━\n\n"));
        }

        if (nome === "pesquisa_yt") {
            if (!Array.isArray(data) || !data.length) return responder("Nenhum resultado encontrado.");
            return responder(data.slice(0, 10).map(a =>
                `🎵 ${a.titulo}\n🔗 ${a.url}\n⏱️ ${a.tempo}\n📝 ${a.desc || ""}`
            ).join("\n\n━━━━━━━━━━━━\n\n"));
        }

        if (nome === "signo") {
            return enviar(sock, from, msg, {
                image: { url: data.img },
                caption: `♈ Signo: ${q}\n\n${data.title || ""}\n${data.body || ""}`
            });
        }

        if (nome === "cep") {
            return responder(
`📍 CEP: ${data.cep}
🏠 Rua: ${data.rua}
📌 Complemento: ${data.complemento}
🏘️ Bairro: ${data.vizinhança}
🌆 Cidade: ${data.cidade}
🗺️ Estado: ${data.estado}
☎️ DDD: ${data.ddd}`
            );
        }

        if (nome === "gerarnick") {
            return responder(
                Array.isArray(data)
                    ? "✨ Nicks gerados:\n\n" + data.join("\n\n")
                    : String(data)
            );
        }

        if (nome === "gimage") {
            const item = Array.isArray(data)
                ? data[Math.floor(Math.random() * data.length)]
                : null;
            if (!item?.url) return responder("Imagem não encontrada.");
            return enviar(sock, from, msg, { image: { url: item.url } });
        }

        if (nome === "pinterest") {
            const item = Array.isArray(data)
                ? data[Math.floor(Math.random() * data.length)]
                : null;
            const url = typeof item === "string" ? item : item?.url;
            if (!url) return responder("Imagem não encontrada.");
            return enviar(sock, from, msg, { image: { url } });
        }
    }));
}

// gruposwhatsapp
comandos.push(criarComando("gruposwhatsapp", [], async ({ responder }) => {
    const data = await fetchJson(apiUrl("gruposwhatsapp"));
    if (!Array.isArray(data) || !data.length) {
        return responder("Nenhum grupo encontrado.");
    }
    return responder(data.map(g =>
        `📌 ${g.titulo}\n📜 Regras: ${g.regras}\n🔗 ${g.link}`
    ).join("\n\n━━━━━━━━━━━━\n\n"));
}));

// moedas
comandos.push(criarComando("moedas", ["moeda"], async ({ responder }) => {
    const data = await fetchJson(apiUrl("Moedas_Agora"));
    return responder(
`💰 COTAÇÕES

${data.dolar || ""}
${data.euro || ""}
${data.libra || ""}
${data.bitcoin || ""}
${data.ethereum || ""}
${data.bovespa || ""}
${data.ouro || ""}`
    );
}));

// pergunta
comandos.push(criarComando(
    "pergunta",
    ["openai", "gpt", "chatgpt"],
    async ({ q, responder }) => {
        if (!q) return responder("Digite sua pergunta.");
        const data = await fetchJson(apiUrl("PERGUNTE_E_EU_RESPONDO", { q }));
        return responder(data.msg || "Não consegui obter uma resposta.");
    }
));

// esportenoticias
comandos.push(criarComando("esportenoticias", [
    "esportenoticia", "espnoticia", "espnoticias",
    "noticiasesporte", "noticiaesporte", "noticiaesp",
    "noticiasesp", "esporte_noticias", "esporte_noticia",
    "esporte-noticias", "esporte-noticia"
], async ({ sock, msg, from, responder }) => {
    const data = await fetchJson(apiUrl("esporte_noticias"));
    if (!Array.isArray(data) || !data.length) {
        return responder("Notícias não encontradas.");
    }
    const legenda = data.slice(0, 10).map(a => `📰 ${a.titulo}`).join("\n\n");
    return enviar(sock, from, msg, {
        image: { url: data[0].img },
        caption: legenda
    });
}));

// metadinha
comandos.push(criarComando("metadinha", [], async ({ sock, msg, from }) => {
    const data = await fetchJson(apiUrl("metadinha"));
    await enviar(sock, from, msg, { image: { url: data.link1 } });
    return enviar(sock, from, msg, { image: { url: data.link2 } });
}));

// print
comandos.push(criarComando("print", ["printdesite"], async ({
    sock, msg, from, q, prefix, responder
}) => {
    if (!/^https?:\/\/\S+/i.test(q)) {
        return responder(`Exemplo: ${prefix}print https://google.com`);
    }
    return enviar(sock, from, msg, {
        image: { url: apiUrl("print_de_site", { url: q }) }
    });
}));

// mediafire
comandos.push(criarComando("mediafire", [], async ({
    sock, msg, from, q, responder
}) => {
    if (!validarLink(q, ["mediafire.com"])) {
        return responder("Envie um link válido do MediaFire.");
    }
    const data = await fetchJson(apiUrl("mediafire", { url: q }));
    const item = data.resultado?.[0];
    if (!item?.link) return responder("Arquivo não encontrado.");

    await responder(`📦 ${item.nama || "Arquivo"}\n📏 ${item.size || ""}`);
    return enviar(sock, from, msg, {
        document: { url: item.link },
        mimetype: "application/octet-stream",
        fileName: item.nama || "arquivo"
    });
}));

// aptoide
comandos.push(criarComando("aptoide", [], async ({
    sock, msg, from, q, prefix, responder
}) => {
    if (!validarLink(q, ["aptoide.com"])) {
        return responder(`Exemplo: ${prefix}aptoide link_do_aptoide`);
    }
    const data = await fetchJson(apiUrl("aptoide", { url: q }));
    if (!data.link) return responder("Não foi possível encontrar o arquivo.");
    return enviar(sock, from, msg, {
        document: { url: data.link },
        mimetype: "application/vnd.android.package-archive",
        fileName: data.titulo || "aplicativo.apk"
    });
}));

// instagram
comandos.push(criarComando("instagram", [], async ({
    sock, msg, from, q, responder
}) => {
    if (!validarLink(q, ["instagram.com"])) {
        return responder("Envie um link válido do Instagram.");
    }
    const data = await fetchJson(apiUrl("instagram", { url: q }));
    const item = data.msg?.[0];
    if (!item?.url) return responder("Não encontrei mídia nesse link.");

    const tipos = {
        mp4: ["video", "video/mp4"],
        webp: ["image", "image/webp"],
        jpg: ["image", "image/jpeg"],
        mp3: ["audio", "audio/mpeg"]
    };
    const [campo, mimetype] = tipos[item.type] || tipos.mp4;
    return enviar(sock, from, msg, {
        [campo]: { url: item.url },
        mimetype
    });
}));

// insta_audio
comandos.push(criarComando("insta_audio", [], async ({
    sock, msg, from, q, responder
}) => {
    if (!validarLink(q, ["instagram.com"])) {
        return responder("Envie um link válido do Instagram.");
    }
    const data = await fetchJson(apiUrl("instagram", { url: q }));
    const item = data.msg?.find(m => m.type === "mp3");
    if (!item?.url) return responder("Não encontrei áudio nesse conteúdo.");
    return enviar(sock, from, msg, {
        audio: { url: item.url },
        mimetype: "audio/mpeg"
    });
}));

// gerarlink2
comandos.push(criarComando("gerarlink2", ["imgpralink2"], async ({
    sock, msg, from, responder
}) => {
    const imagem = obterMidia(msg, "image");
    if (!imagem) {
        return responder("Marque ou envie uma imagem para converter em link.");
    }
    const buffer = await baixarMidia(imagem, "image");
    const link = await uploadImagem(buffer);
    return responder(`🔗 Link da imagem:\n${link}`);
}));

// FIGURINHAS DE TEXTO
const stickers = [
    ["attp", ["attp2"]],
    ["ttp_white", ["ttp_brat"]],
    ["attp_white", ["attp_brat"]],
    ["attp_white_video", ["attp_brat_video"]]
];

for (const [nome, aliases] of stickers) {
    comandos.push(criarComando(nome, aliases, async ({
        sock, msg, from, q, prefix, responder
    }) => {
        if (!q) return responder(`Exemplo: ${prefix}${nome} seu texto`);

        const endpoint = nome.replace("_video", "");
        const params = {
            texto: q,
            fonte: nome.startsWith("attp") ? "Arial" : "Arial"
        };

        if (nome === "attp") params.fonte = "Noto Emoji, Noto Sans Mono";
        if (nome === "attp2") params.fonte = "Roboto";
        if (nome.endsWith("_video")) params.type = "video";

        const url = apiUrl(endpoint, params);

        if (nome.endsWith("_video")) {
            return enviar(sock, from, msg, {
                video: { url },
                mimetype: "video/mp4"
            });
        }
        return enviar(sock, from, msg, { sticker: { url } });
    }));
}

// LOGOS
const logos = {
    logos_EPH: [
        "angelwing", "hackneon", "fpsmascote", "equipemascote",
        "txtquadrinhos", "ffavatar", "mascotegame", "angelglx",
        "gizquadro", "wingeffect", "blackpink", "metalgold",
        "girlmascote", "logogame"
    ],
    logos_PHT: [
        "shadow", "cup", "txtborboleta", "cemiterio", "efeitoneon",
        "harryp", "lobometal", "neon2", "madeira", "lovemsg3",
        "coffecup", "coffecup2", "florwooden", "narutologo",
        "fire", "romantic", "smoke", "papel", "lovemsg", "lovemsg2"
    ],
    logos: [
        "ossos", "asfalto", "break", "glitch2", "colaq", "neon3",
        "nuvem", "horror", "matrix", "berry", "luxury", "lava",
        "thunderv2", "neongreen", "neve", "neon", "neon1",
        "neon3d", "gelo", "3dgold", "lapis", "toxic",
        "demongreen", "rainbow", "halloween"
    ]
};

for (const [endpoint, categorias] of Object.entries(logos)) {
    for (const categoria of categorias) {
        comandos.push(criarComando(categoria, [], async ({
            sock, msg, from, q, prefix, responder
        }) => {
            if (!q) return responder(`Exemplo: ${prefix}${categoria} Tomioka`);

            const data = await fetchJson(apiUrl(endpoint, {
                texto: q,
                category: categoria
            }));

            const url = endpoint === "logos_PHT"
                ? data.resultado?.imageUrl
                : data.resultado;

            if (typeof url !== "string" || !url.startsWith("http")) {
                return responder("Não foi possível gerar essa logo.");
            }
            return enviar(sock, from, msg, { image: { url } });
        }));
    }
}

// MONTAGENS COM IMAGEM
const montagens = [
    "lixo", "lgbt", "morto", "preso",
    "deletem", "procurado", "borrar", "merda"
];

for (const categoria of montagens) {
    comandos.push(criarComando(categoria, [], async ({
        sock, msg, from, responder
    }) => {
        const imagem = obterMidia(msg, "image");
        if (!imagem) {
            return responder("Marque uma imagem para usar essa montagem.");
        }
        const buffer = await baixarMidia(imagem, "image");
        const link = await uploadImagem(buffer);

        return enviar(sock, from, msg, {
            image: {
                url: apiUrl("montagem", {
                    url: link,
                    category: categoria
                })
            }
        });
    }));
}

// TRANSCRIÇÃO DE ÁUDIO/VÍDEO
comandos.push(criarComando("transcrever", [], async ({
    sock, msg, from, responder
}) => {
    const audio = obterMidia(msg, "audio");
    const video = obterMidia(msg, "video");
    const media = audio || video;

    if (!media) {
        return responder("Envie ou marque um áudio/vídeo para transcrever.");
    }

    const tipo = audio ? "audio" : "video";
    const buffer = await baixarMidia(media, tipo);

    const form = new FormData();
    form.append("file", buffer, {
        filename: audio ? "audiofile" : "videofile",
        contentType: media.mimetype || "application/octet-stream"
    });

    const response = await axios.post(
        `https://api.bronxyshost.com.br/transcrever?apikey=${encodeURIComponent(config.bronxysApiKey)}`,
        form,
        { headers: form.getHeaders(), timeout: 120000 }
    );

    return responder(response.data?.texto || "Não foi possível transcrever esse arquivo.");
}));

// ==============================================
// ✅ EXPORT NO FORMATO QUE O INDEX.JS ESPERA
// ==============================================
module.exports = { comandos };
