import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// GET /lancamentos/filtros?clienteId=1&contaId=2&categoriaId=3&tipo=ENTRADA|SAIDA|TODOS
router.get("/filtros", async (req, res) => {
    try {
        const {
            clienteId,
            contaId,
            categoriaId,
            tipo,
        } = req.query;

        const where: any = {};

        if (clienteId !== undefined && clienteId !== "") {
            if (isNaN(Number(clienteId))) {
                return res.status(400).json({
                    message: "ID do cliente inválido",
                });
            }

            where.fornecedorClienteId = Number(clienteId);
        }

        if (contaId !== undefined && contaId !== "") {
            if (isNaN(Number(contaId))) {
                return res.status(400).json({
                    message: "ID da conta inválido",
                });
            }

            where.contaId = Number(contaId);
        }

        if (categoriaId !== undefined && categoriaId !== "") {
            if (isNaN(Number(categoriaId))) {
                return res.status(400).json({
                    message: "ID da categoria inválido",
                });
            }

            where.categoriaId = Number(categoriaId);
        }

        if (tipo !== undefined && tipo !== "") {
            const tipoFiltro = String(tipo).toUpperCase();

            if (!["TODOS", "ENTRADA", "SAIDA"].includes(tipoFiltro)) {
                return res.status(400).json({
                    message: "Tipo inválido. Use TODOS, ENTRADA ou SAIDA",
                });
            }

            if (tipoFiltro !== "TODOS") {
                where.tipo = tipoFiltro;
            }
        }

        const lancamentos = await prisma.lancamento.findMany({
            where,
            select: {
                id: true,
                dataLancamento: true,
                tipo: true,
                valor: true,
                classificacao: true,
                observacao: true,

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

        const totalEntradas = await prisma.lancamento.aggregate({
            where: {
                ...where,
                tipo: "ENTRADA",
            },
            _sum: {
                valor: true,
            },
        });

        const totalSaidas = await prisma.lancamento.aggregate({
            where: {
                ...where,
                tipo: "SAIDA",
            },
            _sum: {
                valor: true,
            },
        });

        return res.status(200).json({
            filtros: {
                clienteId: clienteId ? Number(clienteId) : null,
                contaId: contaId ? Number(contaId) : null,
                categoriaId: categoriaId ? Number(categoriaId) : null,
                tipo: tipo ? String(tipo).toUpperCase() : "TODOS",
            },
            resumo: {
                totalRegistros: lancamentos.length,
                totalEntradas: Number(totalEntradas._sum.valor || 0),
                totalSaidas: Number(totalSaidas._sum.valor || 0),
                saldoCalculado:
                    Number(totalEntradas._sum.valor || 0) -
                    Number(totalSaidas._sum.valor || 0),
            },
            lancamentos,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao filtrar lançamentos",
            error: error instanceof Error ? error.message : error,
        });
    }
});

// GET /lancamentos/resumo
router.get("/resumo", async (req, res) => {
    try {
        const totalEntradas = await prisma.lancamento.aggregate({
            where: {
                tipo: "ENTRADA",
            },
            _sum: {
                valor: true,
            },
            _count: {
                id: true,
            },
        });

        const totalSaidas = await prisma.lancamento.aggregate({
            where: {
                tipo: "SAIDA",
            },
            _sum: {
                valor: true,
            },
            _count: {
                id: true,
            },
        });

        const entradas = Number(totalEntradas._sum.valor || 0);
        const saidas = Number(totalSaidas._sum.valor || 0);

        return res.status(200).json({
            resumo: {
                totalEntradas: entradas,
                totalSaidas: saidas,
                saldoFinal: entradas - saidas,
                quantidadeEntradas: totalEntradas._count.id,
                quantidadeSaidas: totalSaidas._count.id,
                totalRegistros:
                    totalEntradas._count.id + totalSaidas._count.id,
            },
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar resumo dos lançamentos",
            error: error instanceof Error ? error.message : error,
        });
    }
});
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
            classificacao,
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
                    classificacao: classificacao ? classificacao.trim() : null,
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
            classificacao,
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

            if (classificacao !== undefined) {
                dadosAtualizacao.classificacao =
                    classificacao === null ? null : classificacao.trim() || null;
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

// // GET /lancamentos/cliente/:id?tipo=TODOS | ENTRADA | SAIDA
// router.get("/cliente/:id", async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { tipo } = req.query;

//         if (!id || isNaN(Number(id))) {
//             return res.status(400).json({
//                 message: "ID do fornecedor/cliente inválido",
//             });
//         }

//         const tipoFiltro = tipo ? String(tipo).toUpperCase() : "TODOS";

//         if (!["TODOS", "ENTRADA", "SAIDA"].includes(tipoFiltro)) {
//             return res.status(400).json({
//                 message: "Filtro inválido. Use TODOS, ENTRADA ou SAIDA",
//             });
//         }

//         const fornecedorCliente = await prisma.fornecedorCliente.findUnique({
//             where: {
//                 id: Number(id),
//             },
//             select: {
//                 id: true,
//                 nome: true,
//                 saldo: true,
//             },
//         });

//         if (!fornecedorCliente) {
//             return res.status(404).json({
//                 message: "Fornecedor/cliente não encontrado",
//             });
//         }

//         const where: any = {
//             fornecedorClienteId: Number(id),
//         };

//         if (tipoFiltro !== "TODOS") {
//             where.tipo = tipoFiltro;
//         }

//         const lancamentos = await prisma.lancamento.findMany({
//             where,
//             select: {
//                 id: true,
//                 dataLancamento: true,
//                 tipo: true,
//                 valor: true,
//                 classificacao: true,
//                 observacao: true,

//                 fornecedorCliente: {
//                     select: {
//                         id: true,
//                         nome: true,
//                         saldo: true,
//                     },
//                 },

//                 conta: {
//                     select: {
//                         id: true,
//                         nome: true,
//                     },
//                 },

//                 categoria: {
//                     select: {
//                         id: true,
//                         nome: true,
//                     },
//                 },
//             },
//             orderBy: [
//                 { dataLancamento: "desc" },
//                 { id: "desc" },
//             ],
//         });

//         const totalEntradas = await prisma.lancamento.aggregate({
//             where: {
//                 fornecedorClienteId: Number(id),
//                 tipo: "ENTRADA",
//             },
//             _sum: {
//                 valor: true,
//             },
//         });

//         const totalSaidas = await prisma.lancamento.aggregate({
//             where: {
//                 fornecedorClienteId: Number(id),
//                 tipo: "SAIDA",
//             },
//             _sum: {
//                 valor: true,
//             },
//         });

//         return res.status(200).json({
//             fornecedorCliente,
//             filtro: tipoFiltro,
//             resumo: {
//                 totalRegistros: lancamentos.length,
//                 totalEntradas: Number(totalEntradas._sum.valor || 0),
//                 totalSaidas: Number(totalSaidas._sum.valor || 0),
//                 saldoCalculado:
//                     Number(totalEntradas._sum.valor || 0) -
//                     Number(totalSaidas._sum.valor || 0),
//             },
//             lancamentos,
//         });
//     } catch (error) {
//         return res.status(500).json({
//             message: "Erro ao buscar lançamentos do cliente",
//             error: error instanceof Error ? error.message : error,
//         });
//     }
// });
export default router;