import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";

const router = Router();

// Efeito de uma movimentação no saldo do fornecedor/cliente:
// ENTRADA soma (a pagar), SAIDA subtrai (a receber).
function efeitoNoSaldo(tipo: "ENTRADA" | "SAIDA", total: number): number {
    return tipo === "ENTRADA" ? total : -total;
}

// O total é sempre derivado no servidor: quantidade × preço (2 casas).
function calcularTotal(quantidade: number, preco: number): number {
    return Math.round(quantidade * preco * 100) / 100;
}

const CAMPOS_OPCIONAIS = [
    "valorDetalhado",
    "nf",
    "motorista",
    "veiculo",
    "transportadora",
    "descricao",
] as const;

// Normaliza um texto opcional: string vazia/whitespace vira null.
function textoOuNull(v: unknown): string | null {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
}

// GET /movimentacoes  — lista todas as movimentações da empresa.
router.get("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const movimentacoes = await prisma.movimentacao.findMany({
            where: { empresaId },
            select: {
                id: true,
                dataMovimento: true,
                tipo: true,
                quantidade: true,
                preco: true,
                total: true,
                valorDetalhado: true,
                nf: true,
                motorista: true,
                veiculo: true,
                transportadora: true,
                descricao: true,
                fornecedorCliente: {
                    select: { id: true, nome: true, saldo: true },
                },
                produto: {
                    select: { id: true, nome: true, unidadeMedida: true },
                },
            },
            orderBy: [{ dataMovimento: "desc" }, { id: "desc" }],
        });

        return res.status(200).json(movimentacoes);
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao buscar movimentações" });
    }
});

// GET /movimentacoes/transportadoras  — nomes distintos de transportadoras já
// usadas pela empresa (para autocomplete no cadastro de saídas).
router.get("/transportadoras", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const rows = await prisma.movimentacao.findMany({
            where: { empresaId, transportadora: { not: null } },
            select: { transportadora: true },
            distinct: ["transportadora"],
            orderBy: { transportadora: "asc" },
        });

        const transportadoras = rows
            .map((r) => r.transportadora)
            .filter((t): t is string => !!t);

        return res.status(200).json(transportadoras);
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao buscar transportadoras" });
    }
});

// POST /movimentacoes  — cria a movimentação e ajusta o saldo do fornecedor/cliente.
router.post("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const {
            dataMovimento,
            fornecedorClienteId,
            produtoId,
            tipo,
            quantidade,
            preco,
        } = req.body;

        if (
            !dataMovimento ||
            !fornecedorClienteId ||
            !produtoId ||
            !tipo ||
            quantidade === undefined ||
            preco === undefined
        ) {
            return res.status(400).json({
                message:
                    "Data, fornecedor/cliente, produto, tipo, quantidade e preço são obrigatórios",
            });
        }

        if (!["ENTRADA", "SAIDA"].includes(tipo)) {
            return res
                .status(400)
                .json({ message: "Tipo inválido. Use ENTRADA ou SAIDA" });
        }

        if (isNaN(Number(quantidade)) || Number(quantidade) <= 0) {
            return res.status(400).json({
                message: "A quantidade deve ser um número maior que zero",
            });
        }

        if (isNaN(Number(preco)) || Number(preco) <= 0) {
            return res.status(400).json({
                message: "O preço deve ser um número maior que zero",
            });
        }

        // O total é sempre derivado no servidor: quantidade × preço.
        const total = calcularTotal(Number(quantidade), Number(preco));

        const data = new Date(dataMovimento);
        if (isNaN(data.getTime())) {
            return res.status(400).json({ message: "Data inválida" });
        }

        const opcionais: Record<string, string | null> = {};
        for (const campo of CAMPOS_OPCIONAIS) {
            opcionais[campo] = textoOuNull(req.body[campo]);
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const fornecedorCliente = await tx.fornecedorCliente.findFirst({
                where: { id: Number(fornecedorClienteId), empresaId },
            });
            if (!fornecedorCliente) {
                throw new Error("Fornecedor/cliente não encontrado");
            }

            const produto = await tx.produto.findFirst({
                where: { id: Number(produtoId), empresaId },
            });
            if (!produto) {
                throw new Error("Produto não encontrado");
            }

            const novoSaldo =
                Number(fornecedorCliente.saldo) + efeitoNoSaldo(tipo, total);

            const movimentacao = await tx.movimentacao.create({
                data: {
                    dataMovimento: data,
                    empresaId,
                    fornecedorClienteId: Number(fornecedorClienteId),
                    produtoId: Number(produtoId),
                    tipo,
                    total,
                    quantidade: Number(quantidade),
                    preco: Number(preco),
                    ...opcionais,
                },
            });

            const fornecedorClienteAtualizado =
                await tx.fornecedorCliente.update({
                    where: { id: Number(fornecedorClienteId) },
                    data: { saldo: novoSaldo },
                });

            return { movimentacao, fornecedorCliente: fornecedorClienteAtualizado };
        });

        return res.status(201).json({
            message: "Movimentação criada com sucesso",
            ...resultado,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("não encontrad")) {
            return res.status(404).json({ message: msg });
        }
        return res.status(500).json({ message: "Erro ao criar movimentação" });
    }
});

// PATCH /movimentacoes/:id  — atualiza e reajusta o saldo (desfaz o efeito
// antigo e aplica o novo, inclusive se mudar o fornecedor/cliente).
router.patch("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);
        const {
            dataMovimento,
            fornecedorClienteId,
            produtoId,
            tipo,
            quantidade,
            preco,
        } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        if (tipo !== undefined && !["ENTRADA", "SAIDA"].includes(tipo)) {
            return res
                .status(400)
                .json({ message: "Tipo inválido. Use ENTRADA ou SAIDA" });
        }

        if (
            quantidade !== undefined &&
            (isNaN(Number(quantidade)) || Number(quantidade) <= 0)
        ) {
            return res.status(400).json({
                message: "A quantidade deve ser um número maior que zero",
            });
        }

        if (preco !== undefined && (isNaN(Number(preco)) || Number(preco) <= 0)) {
            return res.status(400).json({
                message: "O preço deve ser um número maior que zero",
            });
        }

        let dataConvertida: Date | undefined;
        if (dataMovimento !== undefined) {
            dataConvertida = new Date(dataMovimento);
            if (isNaN(dataConvertida.getTime())) {
                return res.status(400).json({ message: "Data inválida" });
            }
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const atual = await tx.movimentacao.findFirst({
                where: { id, empresaId },
            });
            if (!atual) {
                throw new Error("Movimentação não encontrada");
            }

            // 1) desfaz o efeito da movimentação atual no saldo do fornecedor antigo
            const fornecedorAntigo = await tx.fornecedorCliente.findFirst({
                where: { id: atual.fornecedorClienteId, empresaId },
            });
            if (!fornecedorAntigo) {
                throw new Error("Fornecedor/cliente antigo não encontrado");
            }

            const saldoSemEfeitoAntigo =
                Number(fornecedorAntigo.saldo) -
                efeitoNoSaldo(atual.tipo, Number(atual.total));

            await tx.fornecedorCliente.update({
                where: { id: atual.fornecedorClienteId },
                data: { saldo: saldoSemEfeitoAntigo },
            });

            const novoFornecedorClienteId =
                fornecedorClienteId !== undefined
                    ? Number(fornecedorClienteId)
                    : atual.fornecedorClienteId;
            const novoTipo = (tipo ?? atual.tipo) as "ENTRADA" | "SAIDA";

            // total sempre derivado: usa os valores enviados, caindo para os
            // atuais quando não informados.
            const novaQuantidade =
                quantidade !== undefined
                    ? Number(quantidade)
                    : Number(atual.quantidade);
            const novoPreco =
                preco !== undefined ? Number(preco) : Number(atual.preco);
            if (
                isNaN(novaQuantidade) ||
                novaQuantidade <= 0 ||
                isNaN(novoPreco) ||
                novoPreco <= 0
            ) {
                throw new Error(
                    "Quantidade e preço são obrigatórios e devem ser maiores que zero",
                );
            }
            const novoTotal = calcularTotal(novaQuantidade, novoPreco);

            // 2) aplica o efeito novo no saldo do fornecedor novo (relê o saldo,
            // que pode ter mudado no passo 1 se for o mesmo fornecedor).
            const fornecedorNovo = await tx.fornecedorCliente.findFirst({
                where: { id: novoFornecedorClienteId, empresaId },
            });
            if (!fornecedorNovo) {
                throw new Error("Novo fornecedor/cliente não encontrado");
            }

            const novoSaldo =
                Number(fornecedorNovo.saldo) +
                efeitoNoSaldo(novoTipo, novoTotal);

            // valida o novo produto (se enviado) antes de montar a atualização
            if (produtoId !== undefined) {
                const produto = await tx.produto.findFirst({
                    where: { id: Number(produtoId), empresaId },
                });
                if (!produto) {
                    throw new Error("Produto não encontrado");
                }
            }

            const dados: Record<string, unknown> = {};
            if (dataConvertida !== undefined) dados.dataMovimento = dataConvertida;
            if (fornecedorClienteId !== undefined)
                dados.fornecedorClienteId = novoFornecedorClienteId;
            if (produtoId !== undefined) dados.produtoId = Number(produtoId);
            if (tipo !== undefined) dados.tipo = tipo;
            if (quantidade !== undefined) dados.quantidade = novaQuantidade;
            if (preco !== undefined) dados.preco = novoPreco;
            // total é recalculado no servidor e sempre persistido de forma coerente
            dados.total = novoTotal;
            for (const campo of CAMPOS_OPCIONAIS) {
                if (req.body[campo] !== undefined) {
                    dados[campo] = textoOuNull(req.body[campo]);
                }
            }

            const movimentacao = await tx.movimentacao.update({
                where: { id },
                data: dados,
            });

            const fornecedorClienteAtualizado =
                await tx.fornecedorCliente.update({
                    where: { id: novoFornecedorClienteId },
                    data: { saldo: novoSaldo },
                });

            return { movimentacao, fornecedorCliente: fornecedorClienteAtualizado };
        });

        return res.status(200).json({
            message: "Movimentação atualizada com sucesso",
            ...resultado,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("não encontrad")) {
            return res.status(404).json({ message: msg });
        }
        if (msg.includes("obrigatóri")) {
            return res.status(400).json({ message: msg });
        }
        return res
            .status(500)
            .json({ message: "Erro ao atualizar movimentação" });
    }
});

// DELETE /movimentacoes/:id  — remove e desfaz o efeito no saldo.
router.delete("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const movimentacao = await tx.movimentacao.findFirst({
                where: { id, empresaId },
            });
            if (!movimentacao) {
                throw new Error("Movimentação não encontrada");
            }

            const fornecedorCliente = await tx.fornecedorCliente.findFirst({
                where: { id: movimentacao.fornecedorClienteId, empresaId },
            });
            if (!fornecedorCliente) {
                throw new Error("Fornecedor/cliente não encontrado");
            }

            // ao deletar, desfaz o efeito da movimentação no saldo
            const novoSaldo =
                Number(fornecedorCliente.saldo) -
                efeitoNoSaldo(movimentacao.tipo, Number(movimentacao.total));

            const movimentacaoDeletada = await tx.movimentacao.delete({
                where: { id },
            });

            const fornecedorClienteAtualizado =
                await tx.fornecedorCliente.update({
                    where: { id: movimentacao.fornecedorClienteId },
                    data: { saldo: novoSaldo },
                });

            return {
                movimentacao: movimentacaoDeletada,
                fornecedorCliente: fornecedorClienteAtualizado,
            };
        });

        return res.status(200).json({
            message: "Movimentação deletada com sucesso",
            ...resultado,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("não encontrad")) {
            return res.status(404).json({ message: msg });
        }
        return res.status(500).json({ message: "Erro ao deletar movimentação" });
    }
});

export default router;
