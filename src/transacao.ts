import { prisma } from "../lib/prisma.js";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Trava (SELECT ... FOR UPDATE) a linha que vai ser editada/excluída, para que
// a leitura do valor antigo e o ajuste do saldo não usem um dado que outra
// operação simultânea está mudando. `tabela` vem só desta lista fixa.
export async function travarLinha(
    tx: Tx,
    tabela: "lancamentos" | "movimentacoes",
    id: number,
): Promise<void> {
    await tx.$queryRawUnsafe(`SELECT id FROM ${tabela} WHERE id = ? FOR UPDATE`, id);
}

// Executa uma transação e a repete se o MySQL a derrubar por deadlock/conflito
// de escrita (Prisma P2034). Isso acontece quando duas operações mexem no saldo
// do mesmo cliente ao mesmo tempo: o banco cancela uma delas para destravar e
// basta tentar de novo. Também aumenta os tempos limite, porque a transação
// pode precisar esperar a outra terminar (o banco remoto tem latência alta).
export async function transacao<T>(fn: (tx: Tx) => Promise<T>, tentativas = 4): Promise<T> {
    for (let i = 1; ; i++) {
        try {
            return await prisma.$transaction(fn, { maxWait: 10_000, timeout: 20_000 });
        } catch (e) {
            const code = (e as { code?: string } | null)?.code;
            if (code === "P2034" && i < tentativas) {
                await sleep(40 * i + Math.random() * 60);
                continue;
            }
            throw e;
        }
    }
}
