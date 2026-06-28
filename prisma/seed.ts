import { prisma } from "../lib/prisma.js";

// ---------- utilitários de aleatoriedade ----------
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

// valor monetário aleatório com 2 casas decimais
function randomValor(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// data aleatória nos últimos `dias` dias a partir de hoje
function randomData(dias: number): Date {
  const agora = Date.now();
  const offset = randomInt(0, dias) * 24 * 60 * 60 * 1000;
  const minutos = randomInt(0, 24 * 60) * 60 * 1000;
  return new Date(agora - offset - minutos);
}

// ---------- dados de referência ----------
const CATEGORIAS = [
  "Vendas",
  "Compras",
  "Salários",
  "Aluguel",
  "Marketing",
  "Impostos",
  "Manutenção",
  "Serviços",
  "Transporte",
  "Outros",
];

const CONTAS = [
  "Conta Corrente",
  "Conta Poupança",
  "Caixa",
  "Cartão de Crédito",
  "Investimentos",
  "Conta Digital",
];

const FORNECEDORES_CLIENTES = [
  "Mercado Central LTDA",
  "Distribuidora São Jorge",
  "Tech Solutions ME",
  "Padaria Pão Quente",
  "Auto Peças Veloz",
  "Construtora Horizonte",
  "Maria Aparecida Souza",
  "João Pedro Almeida",
  "Comércio de Tecidos Aurora",
  "Farmácia Vida Plena",
  "Transportadora Rota Sul",
  "Café Aroma Especial",
  "Eletro Center Eireli",
  "Papelaria do Saber",
  "Ana Carolina Ferreira",
  "Carlos Eduardo Lima",
  "Restaurante Sabor Caseiro",
  "Oficina Mecânica do Zé",
  "Agropecuária Boa Terra",
  "Studio Beleza & Estética",
  "Livraria Letra Viva",
  "Hortifruti Natural",
  "Marcenaria Madeira Nobre",
  "Clínica Bem Estar",
  "Fernanda Ribeiro Costa",
  "Roberto Carlos Mendes",
  "Imobiliária Lar Feliz",
  "Gráfica Impacto Visual",
  "Pet Shop Amigo Fiel",
  "Academia Corpo em Forma",
];

const CLASSIFICACOES = [
  "Fixo",
  "Variável",
  "Recorrente",
  "Avulso",
  "Investimento",
  null,
];

const OBSERVACOES = [
  "Pagamento referente ao mês corrente",
  "Lançamento gerado automaticamente",
  "Parcela única",
  "Aguardando confirmação bancária",
  "Conferido com nota fiscal",
  "Renegociado com o cliente",
  null,
  null,
];

const TOTAL_LANCAMENTOS = 500;

async function main() {
  console.log("🧹 Limpando dados existentes...");
  // ordem importa por causa das foreign keys
  await prisma.lancamento.deleteMany();
  await prisma.fornecedorCliente.deleteMany();
  await prisma.conta.deleteMany();
  await prisma.categoria.deleteMany();

  console.log("📂 Criando categorias...");
  await prisma.categoria.createMany({
    data: CATEGORIAS.map((nome) => ({ nome })),
  });

  console.log("🏦 Criando contas (tipos de conta)...");
  await prisma.conta.createMany({
    data: CONTAS.map((nome) => ({ nome })),
  });

  console.log("👥 Criando fornecedores/clientes...");
  await prisma.fornecedorCliente.createMany({
    data: FORNECEDORES_CLIENTES.map((nome) => ({ nome })),
  });

  // busca os IDs reais (autoincrement não reinicia após delete)
  const [categorias, contas, fornecedores] = await Promise.all([
    prisma.categoria.findMany({ select: { id: true } }),
    prisma.conta.findMany({ select: { id: true } }),
    prisma.fornecedorCliente.findMany({ select: { id: true } }),
  ]);

  console.log(`💸 Gerando ${TOTAL_LANCAMENTOS} lançamentos aleatórios...`);

  // saldo acumulado por fornecedor (mantém consistência com a regra do POST /lancamentos)
  const saldoPorFornecedor = new Map<number, number>();
  for (const f of fornecedores) saldoPorFornecedor.set(f.id, 0);

  const lancamentos = [] as {
    dataLancamento: Date;
    tipo: "ENTRADA" | "SAIDA";
    valor: number;
    classificacao: string | null;
    observacao: string | null;
    fornecedorClienteId: number;
    contaId: number;
    categoriaId: number;
  }[];

  for (let i = 0; i < TOTAL_LANCAMENTOS; i++) {
    const fornecedor = randomItem(fornecedores);
    // ~55% entradas, 45% saídas
    const tipo: "ENTRADA" | "SAIDA" = Math.random() < 0.55 ? "ENTRADA" : "SAIDA";
    const valor = randomValor(50, 9000);

    lancamentos.push({
      dataLancamento: randomData(365),
      tipo,
      valor,
      classificacao: randomItem(CLASSIFICACOES),
      observacao: randomItem(OBSERVACOES),
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

  console.log("⚖️  Atualizando saldos dos fornecedores/clientes...");
  // updates em paralelo (limitados pelo connectionLimit do pool) — não precisam
  // ser atômicos num seed e evitam o timeout de transação interativa
  await Promise.all(
    fornecedores.map((f) =>
      prisma.fornecedorCliente.update({
        where: { id: f.id },
        data: { saldo: Math.round((saldoPorFornecedor.get(f.id) ?? 0) * 100) / 100 },
      }),
    ),
  );

  // resumo final
  const [c, ct, fc, l] = await Promise.all([
    prisma.categoria.count(),
    prisma.conta.count(),
    prisma.fornecedorCliente.count(),
    prisma.lancamento.count(),
  ]);

  console.log("\n✅ Seed concluído!");
  console.log(`   Categorias:            ${c}`);
  console.log(`   Contas:                ${ct}`);
  console.log(`   Fornecedores/Clientes: ${fc}`);
  console.log(`   Lançamentos:           ${l}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  });
