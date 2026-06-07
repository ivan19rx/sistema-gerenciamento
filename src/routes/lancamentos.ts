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

// PATCH /lancamentos/:id
router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;

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

        if (!id || isNaN(Number(id))) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        if (tipo !== undefined && !["ENTRADA", "SAIDA"].includes(tipo)) {
            return res.status(400).json({
                message: "Tipo inválido. Use ENTRADA ou SAIDA",
            });
        }

        if (valor !== undefined && Number(valor) <= 0) {
            return res.status(400).json({
                message: "O valor deve ser maior que zero",
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const lancamentoAtual = await tx.lancamento.findUnique({
                where: { id: Number(id) },
            });

            if (!lancamentoAtual) {
                throw new Error("Lançamento não encontrado");
            }

            const fornecedorAntigo = await tx.fornecedorCliente.findUnique({
                where: { id: lancamentoAtual.fornecedorClienteId },
            });

            if (!fornecedorAntigo) {
                throw new Error("Fornecedor/cliente antigo não encontrado");
            }

            const saldoAntigoAtual = Number(fornecedorAntigo.saldo);

            const saldoSemLancamentoAntigo =
                lancamentoAtual.tipo === "ENTRADA"
                    ? saldoAntigoAtual - Number(lancamentoAtual.valor)
                    : saldoAntigoAtual + Number(lancamentoAtual.valor);

            await tx.fornecedorCliente.update({
                where: { id: lancamentoAtual.fornecedorClienteId },
                data: { saldo: saldoSemLancamentoAntigo },
            });

            const novoFornecedorClienteId =
                fornecedorClienteId !== undefined
                    ? Number(fornecedorClienteId)
                    : lancamentoAtual.fornecedorClienteId;

            const novoTipo = tipo !== undefined ? tipo : lancamentoAtual.tipo;

            const novoValor =
                valor !== undefined
                    ? Number(valor)
                    : Number(lancamentoAtual.valor);

            const fornecedorNovo = await tx.fornecedorCliente.findUnique({
                where: { id: novoFornecedorClienteId },
            });

            if (!fornecedorNovo) {
                throw new Error("Novo fornecedor/cliente não encontrado");
            }

            const saldoNovoAtual = Number(fornecedorNovo.saldo);

            const novoSaldo =
                novoTipo === "ENTRADA"
                    ? saldoNovoAtual + novoValor
                    : saldoNovoAtual - novoValor;

            const dadosAtualizacao: any = {};

            if (dataLancamento !== undefined) {
                dadosAtualizacao.dataLancamento = new Date(dataLancamento);
            }

            if (fornecedorClienteId !== undefined) {
                dadosAtualizacao.fornecedorClienteId = Number(fornecedorClienteId);
            }

            if (tipo !== undefined) {
                dadosAtualizacao.tipo = tipo;
            }

            if (valor !== undefined) {
                dadosAtualizacao.valor = Number(valor);
            }

            if (contaId !== undefined) {
                dadosAtualizacao.contaId = contaId === null ? null : Number(contaId);
            }

            if (classificacaoId !== undefined) {
                dadosAtualizacao.classificacaoId =
                    classificacaoId === null ? null : Number(classificacaoId);
            }

            if (categoriaId !== undefined) {
                dadosAtualizacao.categoriaId =
                    categoriaId === null ? null : Number(categoriaId);
            }

            if (observacao !== undefined) {
                dadosAtualizacao.observacao = observacao;
            }

            const lancamentoAtualizado = await tx.lancamento.update({
                where: { id: Number(id) },
                data: dadosAtualizacao,
            });

            const fornecedorClienteAtualizado = await tx.fornecedorCliente.update({
                where: { id: novoFornecedorClienteId },
                data: { saldo: novoSaldo },
            });

            return {
                lancamento: lancamentoAtualizado,
                fornecedorCliente: fornecedorClienteAtualizado,
            };
        });

        return res.status(200).json({
            message: "Lançamento atualizado com sucesso",
            ...resultado,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao atualizar lançamento",
            error: error instanceof Error ? error.message : error,
        });
    }
});

// DELETE /lancamentos/:id
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const resultado = await prisma.$transaction(async (tx) => {
            const lancamento = await tx.lancamento.findUnique({
                where: { id: Number(id) },
            });

            if (!lancamento) {
                throw new Error("Lançamento não encontrado");
            }

            const fornecedorCliente = await tx.fornecedorCliente.findUnique({
                where: { id: lancamento.fornecedorClienteId },
            });

            if (!fornecedorCliente) {
                throw new Error("Fornecedor/cliente não encontrado");
            }

            const saldoAtual = Number(fornecedorCliente.saldo);

            // Ao deletar, desfaz o efeito do lançamento no saldo
            const novoSaldo =
                lancamento.tipo === "ENTRADA"
                    ? saldoAtual - Number(lancamento.valor)
                    : saldoAtual + Number(lancamento.valor);

            const lancamentoDeletado = await tx.lancamento.delete({
                where: { id: Number(id) },
            });

            const fornecedorClienteAtualizado = await tx.fornecedorCliente.update({
                where: { id: lancamento.fornecedorClienteId },
                data: { saldo: novoSaldo },
            });

            return {
                lancamento: lancamentoDeletado,
                fornecedorCliente: fornecedorClienteAtualizado,
            };
        });

        return res.status(200).json({
            message: "Lançamento deletado com sucesso",
            ...resultado,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao deletar lançamento",
            error: error instanceof Error ? error.message : error,
        });
    }
});

export default router;