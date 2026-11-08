import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

const router = Router();

const LIMITE_PADRAO = 500;
const LIMITE_MAXIMO = 2000;
const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const umTexto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function lerData(v: unknown): Date | null | undefined {
    const s = umTexto(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

// GET /registros-requisicoes  (somente admin)
// Filtros (todos opcionais):
//   de, ate      instantes ISO 8601
//   metodo       GET | POST | PUT | PATCH | DELETE | ALTERACOES (todos menos GET)
//   status       2xx | 3xx | 4xx | 5xx | erros (4xx+5xx) | código exato (ex: 404)
//   tipoAcesso   ADMIN | EMPRESA | ANONIMO (sem login)
//   empresaId    número
//   busca        trecho do caminho, da consulta ou do IP
//   lentas       "true": só as que levaram 1 s ou mais
//   limite       quantos trazer (padrão 500, máx. 2000)
// Mais recentes primeiro. `total` e `resumo` contam tudo que bate com o filtro.
router.get("/", async (req, res) => {
    try {
        const q = req.query;
        const de = lerData(q.de);
        const ate = lerData(q.ate);
        if (de === null || ate === null) {
            return res.status(400).json({ message: "Data inválida em de/ate (use ISO 8601)" });
        }

        const where: Prisma.RegistroRequisicaoWhereInput = {};
        if (de || ate) where.criadoEm = { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) };

        const metodo = umTexto(q.metodo)?.toUpperCase();
        if (metodo === "ALTERACOES") {
            where.metodo = { in: ["POST", "PUT", "PATCH", "DELETE"] };
        } else if (metodo) {
            if (!METODOS.includes(metodo)) return res.status(400).json({ message: "metodo inválido" });
            where.metodo = metodo;
        }

        const status = umTexto(q.status)?.toLowerCase();
        if (status) {
            const faixa = /^([2-5])xx$/.exec(status);
            if (faixa) {
                const base = Number(faixa[1]) * 100;
                where.status = { gte: base, lt: base + 100 };
            } else if (status === "erros") {
                where.status = { gte: 400 };
            } else if (/^\d{3}$/.test(status)) {
                where.status = Number(status);
            } else {
                return res.status(400).json({ message: "status inválido" });
            }
        }

        const tipoAcesso = umTexto(q.tipoAcesso)?.toUpperCase();
        if (tipoAcesso) {
            if (tipoAcesso === "ANONIMO") where.tipoAcesso = null;
            else if (tipoAcesso === "ADMIN" || tipoAcesso === "EMPRESA") where.tipoAcesso = tipoAcesso;
            else return res.status(400).json({ message: "tipoAcesso inválido" });
        }

        const empresaId = umTexto(q.empresaId);
        if (empresaId) {
            const n = Number(empresaId);
            if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: "empresaId inválido" });
            where.empresaId = n;
        }

        if (umTexto(q.lentas) === "true") where.duracaoMs = { gte: 1000 };

        const busca = umTexto(q.busca)?.slice(0, 100);
        if (busca) {
            where.OR = [
                { caminho: { contains: busca } },
                { consulta: { contains: busca } },
                { ip: { contains: busca } },
            ];
        }

        const limiteBruto = Number(umTexto(q.limite) ?? LIMITE_PADRAO);
        const limite = Number.isInteger(limiteBruto) && limiteBruto > 0
            ? Math.min(limiteBruto, LIMITE_MAXIMO)
            : LIMITE_PADRAO;

        const [registros, total, porStatus, media] = await Promise.all([
            prisma.registroRequisicao.findMany({
                where,
                orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
                take: limite,
                include: {
                    empresa: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
                    admin: { select: { id: true, email: true } },
                },
            }),
            prisma.registroRequisicao.count({ where }),
            prisma.registroRequisicao.groupBy({ by: ["status"], where, _count: { _all: true } }),
            prisma.registroRequisicao.aggregate({ where, _avg: { duracaoMs: true } }),
        ]);

        const porClasse = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
        for (const g of porStatus) {
            const classe = `${Math.floor(g.status / 100)}xx` as keyof typeof porClasse;
            if (classe in porClasse) porClasse[classe] += g._count._all;
        }

        return res.status(200).json({
            registros,
            total,
            limite,
            resumo: {
                porClasse,
                duracaoMediaMs: Math.round(media._avg.duracaoMs ?? 0),
            },
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar registros de requisições" });
    }
});

export default router;
