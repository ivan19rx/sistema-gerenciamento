import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { identificarDispositivo, ipDaRequisicao } from "./dispositivo.js";

// Registro de todas as requisições da API, para o administrador.
//
// - Grava DEPOIS da resposta (evento "finish"), então não atrasa ninguém.
// - Junta os registros em memória e grava em lote (createMany) a cada poucos
//   segundos: o banco (Railway, poucas conexões) não recebe um INSERT por
//   requisição. Se o servidor cair, perde-se no máximo o último lote.
// - Não guarda o corpo da requisição (pode ter senha e dados pessoais) e tira
//   da consulta parâmetros sensíveis.
// - Apaga registros mais antigos que REQUISICOES_RETENCAO_DIAS (padrão 90).
// - Consultas (GET/HEAD) que deram certo e foram rápidas NÃO são registradas:
//   são a grande maioria e dizem pouco. Continuam registradas as alterações
//   (POST/PUT/PATCH/DELETE), as consultas com erro (4xx/5xx: acesso negado,
//   token vencido, rota inexistente) e as lentas. REQUISICOES_REGISTRAR_CONSULTAS=true
//   volta a registrar todas.

// Fora do registro: login (tem registro próprio), documentação, preflight de
// CORS e as telas de consulta dos registros (abrir a tela não vira registro).
const IGNORAR = [/^\/auth(\/|$)/, /^\/docs/, /^\/registros-login(\/|$)/, /^\/registros-requisicoes(\/|$)/, /^\/favicon\.ico$/];
const PARAMS_SENSIVEIS = /^(senha|password|token|authorization|secret)$/i;

const INTERVALO_MS = 3000;
const LOTE_MAXIMO = 200;
const FILA_MAXIMA = 5000; // se o banco ficar fora, descarta em vez de estourar a memória

const LENTA_MS = 1000;
const METODOS_CONSULTA = new Set(["GET", "HEAD"]);

// Decide se a requisição entra no registro (depois de saber status e tempo).
export function deveRegistrar(
    metodo: string,
    status: number,
    duracaoMs: number,
    registrarConsultas = process.env.REQUISICOES_REGISTRAR_CONSULTAS === "true",
): boolean {
    if (registrarConsultas || !METODOS_CONSULTA.has(metodo)) return true;
    return status >= 400 || duracaoMs >= LENTA_MS;
}

type Item = Prisma.RegistroRequisicaoCreateManyInput;
let fila: Item[] = [];
let gravando = false;

// /lancamentos/12 → /lancamentos/:id (agrupa a mesma rota com ids diferentes)
export function modeloDaRota(caminho: string): string {
    return caminho
        .split("/")
        .map((p) => (/^\d+$/.test(p) ? ":id" : p))
        .join("/");
}

function limparConsulta(url: string): string | null {
    const i = url.indexOf("?");
    if (i < 0) return null;
    const params = new URLSearchParams(url.slice(i + 1));
    for (const k of [...params.keys()]) if (PARAMS_SENSIVEIS.test(k)) params.set(k, "***");
    const s = params.toString();
    return s ? decodeURIComponent(s).slice(0, 500) : null;
}

async function gravarFila(): Promise<void> {
    if (gravando || fila.length === 0) return;
    gravando = true;
    try {
        while (fila.length > 0) {
            const lote = fila.splice(0, LOTE_MAXIMO);
            await prisma.registroRequisicao.createMany({ data: lote });
        }
    } catch (erro) {
        console.error("Falha ao gravar registros de requisições:", erro);
    } finally {
        gravando = false;
    }
}

export function registrarRequisicoes(req: Request, res: Response, next: NextFunction) {
    const caminho = req.path;
    if (req.method === "OPTIONS" || IGNORAR.some((re) => re.test(caminho))) return next();

    const inicio = process.hrtime.bigint();
    res.on("finish", () => {
        try {
            const duracaoMs = Math.round(Number(process.hrtime.bigint() - inicio) / 1e6);
            if (!deveRegistrar(req.method, res.statusCode, duracaoMs)) return;
            const auth = req.auth;
            const userAgent = req.get("user-agent");
            const dispositivo = identificarDispositivo(userAgent, undefined);
            fila.push({
                metodo: req.method.slice(0, 10),
                caminho: caminho.slice(0, 255),
                rota: modeloDaRota(caminho).slice(0, 255),
                consulta: limparConsulta(req.originalUrl),
                status: res.statusCode,
                duracaoMs,
                tipoAcesso: auth?.role ?? null,
                adminId: auth?.role === "ADMIN" ? auth.id : null,
                empresaId: req.empresaId ?? (auth?.role === "EMPRESA" ? auth.id : null),
                ip: ipDaRequisicao(req.ip),
                tipoDispositivo: dispositivo.tipo,
                sistema: dispositivo.sistema?.slice(0, 64) ?? null,
                navegador: dispositivo.navegador?.slice(0, 64) ?? null,
            });
            if (fila.length > FILA_MAXIMA) fila = fila.slice(-FILA_MAXIMA);
            if (fila.length >= LOTE_MAXIMO) void gravarFila();
        } catch (erro) {
            console.error("Falha ao registrar requisição:", erro);
        }
    });
    return next();
}

// Gravação periódica e limpeza dos registros antigos.
export function iniciarRegistroRequisicoes(): void {
    setInterval(() => void gravarFila(), INTERVALO_MS).unref();

    const dias = Number(process.env.REQUISICOES_RETENCAO_DIAS ?? 90);
    if (!Number.isFinite(dias) || dias <= 0) return; // 0 = guardar para sempre
    const limpar = async () => {
        try {
            const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
            const { count } = await prisma.registroRequisicao.deleteMany({ where: { criadoEm: { lt: limite } } });
            if (count > 0) console.log(`Registros de requisições: ${count} apagados (mais de ${dias} dias).`);
        } catch (erro) {
            console.error("Falha ao limpar registros de requisições:", erro);
        }
    };
    setTimeout(() => void limpar(), 60_000).unref();
    setInterval(() => void limpar(), 24 * 60 * 60 * 1000).unref();
}
