/**
 * Seed de administradores — MODELO
 *
 * Este arquivo é apenas um exemplo versionado no Git. NÃO coloque
 * credenciais reais aqui.
 *
 * Como usar:
 *   1. Copie este arquivo para `prisma/seedAdmin.ts`
 *   2. Preencha a lista ADMINS com os administradores reais
 *   3. Rode:  npm run seed:admin
 *
 * O arquivo `prisma/seedAdmin.ts` está no .gitignore justamente porque
 * contém credenciais reais — nunca o comite.
 *
 * Ao contrário do `seed.ts`, este seed é idempotente: NÃO apaga nenhum
 * dado. Ele cria os admins que faltam e, para os que já existem (mesmo
 * e-mail), atualiza a senha para o valor deste arquivo e mantém `ativo`.
 */
import { prisma } from "../lib/prisma.js";
import { hashSenha } from "../src/auth/senha.js";

// Mantém apenas os dígitos do CNPJ (o login compara por dígitos).
const soDigitos = (v: string) => v.replace(/\D/g, "");

// Administradores globais do sistema. Cada admin pode logar por e-mail ou CNPJ.
// Adicione quantos precisar.
const ADMINS: { email: string; cnpj: string; senha: string }[] = [
  { email: "admin@exemplo.com", cnpj: "00000000000000", senha: "troque-esta-senha" },
];

async function main() {
  if (ADMINS.length === 0) {
    console.log("⚠️  Nenhum administrador definido em ADMINS. Nada a fazer.");
    return;
  }

  console.log(`👤 Cadastrando ${ADMINS.length} administrador(es)...`);

  for (const admin of ADMINS) {
    const email = admin.email.trim().toLowerCase();
    const cnpj = soDigitos(admin.cnpj);
    const senha = await hashSenha(admin.senha);

    const registro = await prisma.admin.upsert({
      where: { email },
      update: { cnpj, senha, ativo: true },
      create: { email, cnpj, senha },
    });

    console.log(`   ✔ ${registro.email} (CNPJ ${registro.cnpj}, id ${registro.id})`);
  }

  const total = await prisma.admin.count();
  console.log(`\n✅ Seed de admins concluído! Total de admins: ${total}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Erro no seed de admins:", e);
    process.exit(1);
  });
