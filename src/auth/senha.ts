import bcrypt from "bcryptjs";

// Custo do bcrypt. 12 é um bom equilíbrio entre segurança e desempenho.
const SALT_ROUNDS = 12;

export async function hashSenha(senha: string): Promise<string> {
    return bcrypt.hash(senha, SALT_ROUNDS);
}

export async function compararSenha(
    senha: string,
    hash: string,
): Promise<boolean> {
    return bcrypt.compare(senha, hash);
}
