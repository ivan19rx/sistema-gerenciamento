import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// GET /lancamentos
router.get("/", async (req, res) => {
    try {
        const lancamentos = await prisma.lancamento.findMany({
            include: {
                fornecedorCliente: {
                    select: {
                        id: true,
                        nome: true,
                        saldo: true,
                    },
                },
                conta: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                classificacao: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                categoria: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
            orderBy: [
                { dataLancamento: "desc" },
                { id: "desc" },
            ],
        });

        return res.status(200).json(lancamentos);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar lançamentos",
            error,
        });
    }
});

// POST /lancamentos
router.post("/", async (req, res) => {
    try {
        const {
            dataLancamento,
            fornecedorClienteId,
            tipo,
            valor,
            contaId,
            classificacaoId,
            categoriaId,
            observacao,
        } = req.body;

        if (!dataLancamento || !fornecedorClienteId || !tipo || !valor) {
            return res.status(400).json({
                message: "Data, fornecedor/cliente, tipo e valor são obrigatórios",
            });
        }

        if (!["ENTRADA", "SAIDA"].includes(tipo)) {
            return res.status(400).json({
                message: "Tipo inválido. Use ENTRADA ou SAIDA",
            });
        }

        if (Number(valor) <= 0) {
            return res.status(400).json({
                message: "O valor deve ser maior que zero",
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const fornecedorCliente = await tx.fornecedorCliente.findUnique({
                where: { id: Number(fornecedorClienteId) },
            });

            if (!fornecedorCliente) {
                throw new Error("Fornecedor/cliente não encontrado");
            }

            const saldoAtual = Number(fornecedorCliente.saldo);
            const novoSaldo =
                tipo === "ENTRADA"
                    ? saldoAtual + Number(valor)
                    : saldoAtual - Number(valor);

            const lancamento = await tx.lancamento.create({
                data: {
                    dataLancamento: new Date(dataLancamento),
                    fornecedorClienteId: Number(fornecedorClienteId),
                    tipo,
                    valor,
                    contaId: contaId ? Number(contaId) : null,
                    classificacaoId: classificacaoId ? Number(classificacaoId) : null,
                    categoriaId: categoriaId ? Number(categoriaId) : null,
                    observacao,
                },
            });

            const fornecedorClienteAtualizado = await tx.fornecedorCliente.update({
                where: { id: Number(fornecedorClienteId) },
                data: { saldo: novoSaldo },
            });

            return { lancamento, fornecedorCliente: fornecedorClienteAtualizado };
        });

        return res.status(201).json({
            message: "Lançamento criado com sucesso",
            ...resultado,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao criar lançamento",
            error: error instanceof Error ? error.message : error,
        });
    }
});

// GET /lancamentos/cliente/:id
router.get("/cliente/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const lancamentos = await prisma.lancamento.findMany({
            where: {
                fornecedorClienteId: Number(id),
            },
            include: {
                fornecedorCliente: {
                    select: {
                        id: true,
                        nome: true,
                        saldo: true,
                    },
                },
                conta: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                classificacao: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                categoria: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
            orderBy: [
                { dataLancamento: "desc" },
                { id: "desc" },
            ],
        });

        if (lancamentos.length === 0) {
            return res.status(404).json({
                message: "Nenhum lançamento encontrado para este cliente",
            });
        }

        return res.status(200).json(lancamentos);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar lançamentos do cliente",
            error,
        });
    }
});

export default router;