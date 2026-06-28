import jwt from "jsonwebtoken";

const rawSecret = process.env.JWT_SECRET;

if (!rawSecret) {
    throw new Error("JWT_SECRET não configurado nas variáveis de ambiente");
}

const JWT_SECRET: string = rawSecret;

// Expiração em segundos (padrão: 8 horas).
const JWT_EXPIRES_IN_SECONDS = Number(
    process.env.JWT_EXPIRES_IN_SECONDS ?? 60 * 60 * 8,
);

export type Papel = "ADMIN" | "EMPRESA";

export interface TokenPayload {
    // id do admin (role ADMIN) ou da empresa (role EMPRESA)
    id: number;
    role: Papel;
}

export function assinarToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN_SECONDS,
    });
}

export function verificarToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (
        typeof decoded !== "object" ||
        decoded === null ||
        typeof (decoded as TokenPayload).id !== "number" ||
        typeof (decoded as TokenPayload).role !== "string"
    ) {
        throw new Error("Token com formato inválido");
    }

    return {
        id: (decoded as TokenPayload).id,
        role: (decoded as TokenPayload).role,
    };
}
