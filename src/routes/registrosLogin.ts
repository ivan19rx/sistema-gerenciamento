import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

const router = Router();

const LIMITE_PADRAO = 500;
const LIMITE_MAXIMO = 2000;

const TIPOS_ACESSO = ["ADMIN", "EMPRESA"] as const;
const TIPOS_DISPOSITIVO = ["COMPUTADOR", "CELULAR", "TABLET", "DESCONHECIDO"] as const;

const umTexto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function lerData(v: unknown): Date | null | undefined {
    const s = umTexto(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

// GET /registros-login  (somente admin)
// Filtros (todos opcionais):
//   de, ate        instantes ISO (ex: 2026-11-01T03:00:00.000Z) — o frontend
//                  converte o dia local da pessoa em instante
//   sucesso        "true" | "false"
//   tipoAcesso     ADMIN | EMPRESA
//   tipoDispositivo COMPUTADOR | CELULAR | TABLET | DESCONHECIDO
//   empresaId      número
//   busca          trecho do usuário digitado, nome, IP, sistema ou navegador
//   limite         quantos registros trazer (padrão 500, máx. 2000)
// Mais recentes primeiro. `total` e `resumo` contam todos os que batem com o
// filtro, mesmo além do limite.
router.get("/", async (req, res) => {
    try {
        const q = req.query;
        const de = lerData(q.de);
        const ate = lerData(q.ate);
        if (de === null || ate === null) {
            return res.status(400).json({ message: "Data inválida em de/ate (use ISO 8601)" });
        }

        const where: Prisma.RegistroLoginWhereInput = {};
        if (de || ate) where.criadoEm = { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) };

        const sucesso = umTexto(q.sucesso);
        if (sucesso === "true" || sucesso === "false") where.sucesso = sucesso === "true";

        const tipoAcesso = umTexto(q.tipoAcesso);
        if (tipoAcesso) {
            if (!TIPOS_ACESSO.includes(tipoAcesso as (typeof TIPOS_ACESSO)[number])) {
                return res.status(400).json({ message: "tipoAcesso inválido" });
            }
            where.tipoAcesso = tipoAcesso as (typeof TIPOS_ACESSO)[number];
        }

        const tipoDispositivo = umTexto(q.tipoDispositivo);
        if (tipoDispositivo) {
            if (!TIPOS_DISPOSITIVO.includes(tipoDispositivo as (typeof TIPOS_DISPOSITIVO)[number])) {
                return res.status(400).json({ message: "tipoDispositivo inválido" });
            }
            where.tipoDispositivo = tipoDispositivo as (typeof TIPOS_DISPOSITIVO)[number];
        }

        const empresaId = umTexto(q.empresaId);
        if (empresaId) {
            const n = Number(empresaId);
            if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ message: "empresaId inválido" });
            where.empresaId = n;
        }

        const busca = umTexto(q.busca)?.slice(0, 100);
        if (busca) {
            where.OR = [
                { identificador: { contains: busca } },
                { nomeUsuario: { contains: busca } },
                { ip: { contains: busca } },
                { sistema: { contains: busca } },
                { navegador: { contains: busca } },
                { modelo: { contains: busca } },
            ];
        }

        const limiteBruto = Number(umTexto(q.limite) ?? LIMITE_PADRAO);
        const limite = Number.isInteger(limiteBruto) && limiteBruto > 0
            ? Math.min(limiteBruto, LIMITE_MAXIMO)
            : LIMITE_PADRAO;

        const [registros, total, porResultado, porDispositivo] = await Promise.all([
            prisma.registroLogin.findMany({
                where,
                orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
                take: limite,
                include: {
                    empresa: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
                },
            }),
            prisma.registroLogin.count({ where }),
            prisma.registroLogin.groupBy({ by: ["sucesso"], where, _count: { _all: true } }),
            prisma.registroLogin.groupBy({ by: ["tipoDispositivo"], where, _count: { _all: true } }),
        ]);

        // Contagens de todo o filtro (não só dos registros devolvidos).
        const dispositivos = Object.fromEntries(TIPOS_DISPOSITIVO.map((t) => [t, 0])) as Record<(typeof TIPOS_DISPOSITIVO)[number], number>;
        for (const g of porDispositivo) dispositivos[g.tipoDispositivo] = g._count._all;
        const resumo = {
            sucesso: porResultado.find((g) => g.sucesso)?._count._all ?? 0,
            falhas: porResultado.find((g) => !g.sucesso)?._count._all ?? 0,
            porDispositivo: dispositivos,
        };

        return res.status(200).json({ registros, total, limite, resumo });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar registros de login" });
    }
});

export default router;
