import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { verificarToken, type Papel } from "./jwt.js";

// Campos adicionados à requisição pelos middlewares de autenticação.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            auth?: { id: number; role: Papel };
            empresaId?: number;
        }
    }
}

// Valida o Bearer token e popula req.auth.
export function autenticar(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token não fornecido" });
    }

    try {
        const payload = verificarToken(header.slice(7));
        req.auth = { id: payload.id, role: payload.role };
        return next();
    } catch {
        return res.status(401).json({ message: "Token inválido ou expirado" });
    }
}

// Restringe o acesso ao administrador global.
export function apenasAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.auth?.role !== "ADMIN") {
        return res
            .status(403)
            .json({ message: "Acesso restrito ao administrador" });
    }
    return next();
}

// Resolve qual empresa (tenant) é o alvo da requisição.
// - EMPRESA: usa sempre a própria empresa do token (não pode falsificar).
// - ADMIN: precisa indicar a empresa-alvo via header X-Empresa-Id (ou ?empresaId).
export async function resolverEmpresa(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const auth = req.auth;

    if (!auth) {
        return res.status(401).json({ message: "Não autenticado" });
    }

    if (auth.role === "EMPRESA") {
        req.empresaId = auth.id;
        return next();
    }

    // ADMIN
    const headerEmpresa = req.header("X-Empresa-Id");
    const queryEmpresa =
        typeof req.query.empresaId === "string" ? req.query.empresaId : undefined;
    const seletor = headerEmpresa ?? queryEmpresa;
    const empresaId = Number(seletor);

    if (!seletor || Number.isNaN(empresaId)) {
        return res.status(400).json({
            message:
                "Admin deve informar a empresa-alvo no header X-Empresa-Id",
        });
    }

    try {
        const empresa = await prisma.empresa.findUnique({
            where: { id: empresaId },
            select: { id: true },
        });

        if (!empresa) {
            return res.status(404).json({ message: "Empresa não encontrada" });
        }

        req.empresaId = empresaId;
        return next();
    } catch {
        return res.status(500).json({ message: "Erro ao resolver empresa" });
    }
}

// Helper para uso nas rotas: garante que o tenant foi resolvido.
export function getEmpresaId(req: Request): number {
    if (req.empresaId === undefined) {
        throw new Error("empresaId não resolvido");
    }
    return req.empresaId;
}
