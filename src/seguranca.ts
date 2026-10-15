// Camada de segurança da API: CORS restrito, rate limiting, limite de corpo
// e tratadores de 404 / erro. Os limites e origens são configuráveis por
// variável de ambiente (ver .env.example), com defaults amigáveis ao uso
// em desenvolvimento para não travar o frontend Vite.

import { rateLimit } from "express-rate-limit";
import type { CorsOptions } from "cors";
import type { Express, ErrorRequestHandler, RequestHandler } from "express";

// Lê um inteiro de env com fallback; ignora valores vazios/ inválidos.
function envInt(nome: string, padrao: number): number {
    const bruto = process.env[nome];
    if (bruto === undefined || bruto.trim() === "") {
        return padrao;
    }
    const n = Number(bruto);
    return Number.isFinite(n) && n > 0 ? n : padrao;
}

// Janela padrão dos limitadores: 15 minutos.
const JANELA_PADRAO_MS = 15 * 60 * 1000;

// Origens permitidas pelo CORS. Default cobre o dev server do Vite nas
// portas 5173 e 5174 (usada quando a 5173 está ocupada).
const origensPermitidas = (
    process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:5174"
)
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

export const opcoesCors: CorsOptions = {
    origin(origin, callback) {
        // Requisições sem Origin (curl, health checks, Swagger same-origin)
        // são liberadas; navegadores sempre enviam Origin em chamadas cross-site.
        if (!origin || origensPermitidas.includes(origin)) {
            return callback(null, true);
        }
        // Origem não permitida: nega sem lançar erro (o navegador bloqueia por
        // ausência dos cabeçalhos CORS, sem gerar um 500 ruidoso).
        return callback(null, false);
    },
    credentials: true,
};

// Limite de tamanho do corpo JSON (configurável). Os payloads da aplicação
// são pequenos, então 100kb é folgado e protege contra abuso.
export const limiteCorpoJson = process.env.JSON_BODY_LIMIT ?? "100kb";

// Limitador global: aplicado a todas as rotas. Default generoso para não
// atrapalhar o SPA, que dispara várias chamadas por tela.
export const limitadorGlobal = rateLimit({
    windowMs: envInt("RATE_LIMIT_WINDOW_MS", JANELA_PADRAO_MS),
    limit: envInt("RATE_LIMIT_MAX", 1000),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Muitas requisições deste IP. Tente novamente mais tarde.",
    },
});

// Limitador restritivo para /auth: contém força-bruta nos logins. Só conta
// tentativas que falham (skipSuccessfulRequests), então o uso normal não trava.
export const limitadorAutenticacao = rateLimit({
    windowMs: envInt("AUTH_RATE_LIMIT_WINDOW_MS", JANELA_PADRAO_MS),
    limit: envInt("AUTH_RATE_LIMIT_MAX", 20),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        message: "Muitas tentativas de login. Tente novamente mais tarde.",
    },
});

// Configura o trust proxy a partir de TRUST_PROXY para o rate-limit enxergar o
// IP real quando a API roda atrás de um proxy reverso. Em dev (sem proxy) fica
// desligado — o default permissivo (true) é evitado de propósito, pois permite
// falsificar o IP via X-Forwarded-For.
export function configurarTrustProxy(app: Express): void {
    const bruto = process.env.TRUST_PROXY;
    if (bruto === undefined || bruto.trim() === "") {
        return;
    }
    if (bruto === "true" || bruto === "false") {
        app.set("trust proxy", bruto === "true");
        return;
    }
    const n = Number(bruto);
    app.set("trust proxy", Number.isFinite(n) ? n : bruto);
}

// 404 limpo e consistente com o formato de erro da API.
export const rotaNaoEncontrada: RequestHandler = (_req, res) => {
    res.status(404).json({ message: "Recurso não encontrado" });
};

// Tratador de erro final: loga no servidor e nunca vaza stack trace em
// produção. Em desenvolvimento devolve a mensagem para facilitar o debug.
export const tratadorDeErros: ErrorRequestHandler = (err, _req, res, next) => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    const ehProducao = process.env.NODE_ENV === "production";
    res.status(500).json({
        message: "Erro interno do servidor",
        ...(ehProducao
            ? {}
            : { error: err instanceof Error ? err.message : String(err) }),
    });
};
