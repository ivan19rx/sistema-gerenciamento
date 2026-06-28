import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";

const {
  DATABASE_HOST,
  DATABASE_PORT,
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_NAME,
} = process.env;

if (
  !DATABASE_HOST ||
  !DATABASE_PORT ||
  !DATABASE_USER ||
  DATABASE_PASSWORD === undefined ||
  !DATABASE_NAME
) {
  throw new Error("Variáveis de ambiente do banco não configuradas");
}

const adapter = new PrismaMariaDb({
  host: DATABASE_HOST,
  port: Number(DATABASE_PORT),
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  database: DATABASE_NAME,
  connectionLimit: 5,
});

// `omit` global: a senha (hash) nunca é selecionada por padrão, evitando
// vazamento acidental em respostas. As rotas de login sobrescrevem com
// `omit: { senha: false }` apenas para validar a credencial.
const prisma = new PrismaClient({
  adapter,
  omit: {
    empresa: { senha: true },
    admin: { senha: true },
  },
});

export { prisma };