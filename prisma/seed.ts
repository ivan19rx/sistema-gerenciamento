import { prisma } from "../lib/prisma.js";
import { hashSenha } from "../src/auth/senha.js";

// ---------- utilitários de aleatoriedade ----------
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

function randomValor(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomData(dias: number): Date {
  const agora = Date.now();
  const offset = randomInt(0, dias) * 24 * 60 * 60 * 1000;
  const minutos = randomInt(0, 24 * 60) * 60 * 1000;
  return new Date(agora - offset - minutos);
}

// ---------- dados de referência ----------
const CATEGORIAS = [
  "Vendas", "Compras", "Salários", "Aluguel", "Marketing",
  "Impostos", "Manutenção", "Serviços", "Transporte", "Outros",
];

const CONTAS = [
  "Conta Corrente", "Conta Poupança", "Caixa",
  "Cartão de Crédito", "Investimentos", "Conta Digital",
];

const FORNECEDORES_CLIENTES = [
  "Mercado Central LTDA", "Distribuidora São Jorge", "Tech Solutions ME",
  "Padaria Pão Quente", "Auto Peças Veloz", "Construtora Horizonte",
  "Maria Aparecida Souza", "João Pedro Almeida", "Comércio de Tecidos Aurora",
  "Farmácia Vida Plena", "Transportadora Rota Sul", "Café Aroma Especial",
  "Eletro Center Eireli", "Papelaria do Saber", "Ana Carolina Ferreira",
  "Carlos Eduardo Lima", "Restaurante Sabor Caseiro", "Oficina Mecânica do Zé",
  "Agropecuária Boa Terra", "Studio Beleza & Estética",
];

const CLASSIFICACOES = ["Fixo", "Variável", "Recorrente", "Avulso", "Investimento", null];

const OBSERVACOES = [
  "Pagamento referente ao mês corrente", "Lançamento gerado automaticamente",
  "Parcela única", "Aguardando confirmação bancária",
  "Conferido com nota fiscal", "Renegociado com o cliente", null, null,
];

// admin global do sistema
const ADMIN = { email: "admin@sistema.com", senha: "admin123" };

// empresas (tenants) de exemplo
const EMPRESAS = [
  {
    cnpj: "11222333000181",
    razaoSocial: "Comércio Alfa LTDA",
    nomeFantasia: "Alfa Comércio",
    inscricaoEstadual: "111222333",
    inscricaoMunicipal: "9988776",
    endereco: "Rua das Flores, 100 - Centro",
    email: "alfa@empresa.com",
    senha: "empresa123",
  },
  {
    cnpj: "99888777000166",
    razaoSocial: "Serviços Beta ME",
    nomeFantasia: "Beta Serviços",
    inscricaoEstadual: "444555666",
    inscricaoMunicipal: "1122334",
    endereco: "Av. Brasil, 2000 - Jardim América",
    email: "beta@empresa.com",
    senha: "empresa123",
  },
];

const LANCAMENTOS_POR_EMPRESA = 200;

async function semearDadosDaEmpresa(empresaId: number) {
  await prisma.categoria.createMany({
    data: CATEGORIAS.map((nome) => ({ nome, empresaId })),
  });
  await prisma.conta.createMany({
    data: CONTAS.map((nome) => ({ nome, empresaId })),
  });
  await prisma.fornecedorCliente.createMany({
    data: FORNECEDORES_CLIENTES.map((nome) => ({ nome, empresaId })),
  });

  const [categorias, contas, fornecedores] = await Promise.all([
    prisma.categoria.findMany({ where: { empresaId }, select: { id: true } }),
    prisma.conta.findMany({ where: { empresaId }, select: { id: true } }),
    prisma.fornecedorCliente.findMany({
      where: { empresaId },
      select: { id: true },
    }),
  ]);

  const saldoPorFornecedor = new Map<number, number>();
  for (const f of fornecedores) saldoPorFornecedor.set(f.id, 0);

  const lancamentos = [] as {
    dataLancamento: Date;
    tipo: "ENTRADA" | "SAIDA";
    valor: number;
    classificacao: string | null;
    observacao: string | null;
    empresaId: number;
    fornecedorClienteId: number;
    contaId: number;
    categoriaId: number;
  }[];

  for (let i = 0; i < LANCAMENTOS_POR_EMPRESA; i++) {
    const fornecedor = randomItem(fornecedores);
    const tipo: "ENTRADA" | "SAIDA" = Math.random() < 0.55 ? "ENTRADA" : "SAIDA";
    const valor = randomValor(50, 9000);

    lancamentos.push({
      dataLancamento: randomData(365),
      tipo,
      valor,
      classificacao: randomItem(CLASSIFICACOES),
      observacao: randomItem(OBSERVACOES),
      empresaId,
      fornecedorClienteId: fornecedor.id,
      contaId: randomItem(contas).id,
      categoriaId: randomItem(categorias).id,
    });

    const saldoAtual = saldoPorFornecedor.get(fornecedor.id) ?? 0;
    saldoPorFornecedor.set(
      fornecedor.id,
      tipo === "ENTRADA" ? saldoAtual + valor : saldoAtual - valor,
    );
  }

  await prisma.lancamento.createMany({ data: lancamentos });

  await Promise.all(
    fornecedores.map((f) =>
      prisma.fornecedorCliente.update({
        where: { id: f.id },
        data: {
          saldo: Math.round((saldoPorFornecedor.get(f.id) ?? 0) * 100) / 100,
        },
      }),
    ),
  );
}

async function main() {
  console.log("🧹 Limpando dados existentes...");
  await prisma.lancamento.deleteMany();
  await prisma.fornecedorCliente.deleteMany();
  await prisma.conta.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.empresa.deleteMany();
  await prisma.admin.deleteMany();

  console.log("👤 Criando administrador...");
  await prisma.admin.create({
    data: { email: ADMIN.email, senha: await hashSenha(ADMIN.senha) },
  });

  console.log("🏢 Criando empresas e seus dados...");
  for (const e of EMPRESAS) {
    const empresa = await prisma.empresa.create({
      data: { ...e, senha: await hashSenha(e.senha) },
    });
    console.log(`   → ${empresa.razaoSocial} (id ${empresa.id})`);
    await semearDadosDaEmpresa(empresa.id);
  }

  const [admins, empresas, l] = await Promise.all([
    prisma.admin.count(),
    prisma.empresa.count(),
    prisma.lancamento.count(),
  ]);

  console.log("\n✅ Seed concluído!");
  console.log(`   Admins:      ${admins}`);
  console.log(`   Empresas:    ${empresas}`);
  console.log(`   Lançamentos: ${l}`);
  console.log("\nCredenciais de exemplo:");
  console.log(`   ADMIN   → ${ADMIN.email} / ${ADMIN.senha}`);
  for (const e of EMPRESAS) {
    console.log(`   EMPRESA → ${e.email} (ou CNPJ ${e.cnpj}) / ${e.senha}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  });
