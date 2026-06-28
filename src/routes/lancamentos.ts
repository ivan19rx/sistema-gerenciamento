import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";

const router = Router();

// GET /lancamentos/filtros?clienteId=1&contaId=2&categoriaId=3&tipo=ENTRADA|SAIDA|TODOS
router.get("/filtros", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { clienteId, contaId, categoriaId, tipo } = req.query;

        // sempre escopado à empresa resolvida
        const where: any = { empresaId };

        if (clienteId !== undefined && clienteId !== "") {
            if (isNaN(Number(clienteId))) {
                return res
                    .status(400)
                    .json({ message: "ID do cliente inválido" });
            }
            where.fornecedorClienteId = Number(clienteId);
        }

        if (contaId !== undefined && contaId !== "") {
            if (isNaN(Number(contaId))) {
                return res
                    .status(400)
                    .json({ message: "ID da conta inválido" });
            }
            where.contaId = Number(contaId);
        }

        if (categoriaId !== undefined && categoriaId !== "") {
            if (isNaN(Number(categoriaId))) {
                return res
                    .status(400)
                    .json({ message: "ID da categoria inválido" });
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

        const [lancamentos, totalEntradas, totalSaidas] = await Promise.all([
            prisma.lancamento.findMany({
                where,
                select: {
                    id: true,
                    dataLancamento: true,
                    tipo: true,
                    valor: true,
                    classificacao: true,
                    observacao: true,
                    fornecedorCliente: {
                        select: { id: true, nome: true, saldo: true },
                    },
                    conta: { select: { id: true, nome: true } },
                    categoria: { select: { id: true, nome: true } },
                },
                orderBy: [{ dataLancamento: "desc" }, { id: "desc" }],
            }),
            prisma.lancamento.aggregate({
                where: { ...where, tipo: "ENTRADA" },
                _sum: { valor: true },
            }),
            prisma.lancamento.aggregate({
                where: { ...where, tipo: "SAIDA" },
                _sum: { valor: true },
            }),
        ]);

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
        return res
            .status(500)
            .json({ message: "Erro ao filtrar lançamentos" });
    }
});

// GET /lancamentos/resumo
router.get("/resumo", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [totalEntradas, totalSaidas] = await Promise.all([
            prisma.lancamento.aggregate({
                where: { empresaId, tipo: "ENTRADA" },
                _sum: { valor: true },
                _count: { id: true },
            }),
            prisma.lancamento.aggregate({
                where: { empresaId, tipo: "SAIDA" },
                _sum: { valor: true },
                _count: { id: true },
            }),
        ]);

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
        });
    }
});

// GET /lancamentos
router.get("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const lancamentos = await prisma.lancamento.findMany({
            where: { empresaId },
            include: {
                fornecedorCliente: {
                    select: { id: true, nome: true, saldo: true },
                },
                conta: { select: { id: true, nome: true } },
                categoria: { select: { id: true, nome: true } },
            },
            orderBy: [{ dataLancamento: "desc" }, { id: "desc" }],
        });

        return res.status(200).json(lancamentos);
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar lançamentos" });
    }
});

// POST /lancamentos
router.post("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
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

        if (
            !dataLancamento ||
            !fornecedorClienteId ||
            !tipo ||
            valor === undefined ||
            !contaId ||
            !categoriaId
        ) {
            return res.status(400).json({
                message:
                    "Data, fornecedor/cliente, tipo, valor, conta e categoria são obrigatórios",
            });
        }

        if (!["ENTRADA", "SAIDA"].includes(tipo)) {
            return res
                .status(400)
                .json({ message: "Tipo inválido. Use ENTRADA ou SAIDA" });
        }

        if (isNaN(Number(valor)) || Number(valor) <= 0) {
            return res
                .status(400)
                .json({ message: "O valor deve ser um número maior que zero" });
        }

        const data = new Date(dataLancamento);
        if (isNaN(data.getTime())) {
            return res.status(400).json({ message: "Data inválida" });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            // todas as entidades referenciadas têm que pertencer à mesma empresa
            const fornecedorCliente = await tx.fornecedorCliente.findFirst({
                where: { id: Number(fornecedorClienteId), empresaId },
            });
            if (!fornecedorCliente) {
                throw new Error("Fornecedor/cliente não encontrado");
            }

            const conta = await tx.conta.findFirst({
                where: { id: Number(contaId), empresaId },
            });
            if (!conta) {
                throw new Error("Conta não encontrada");
            }

            const categoria = await tx.categoria.findFirst({
                where: { id: Number(categoriaId), empresaId },
            });
            if (!categoria) {
                throw new Error("Categoria não encontrada");
            }

            const saldoAtual = Number(fornecedorCliente.saldo);
            const novoSaldo =
                tipo === "ENTRADA"
                    ? saldoAtual + Number(valor)
                    : saldoAtual - Number(valor);

            const lancamento = await tx.lancamento.create({
                data: {
                    dataLancamento: data,
                    empresaId,
                    fornecedorClienteId: Number(fornecedorClienteId),
                    tipo,
                    valor: Number(valor),
                    contaId: Number(contaId),
                    classificacao: classificacao
                        ? String(classificacao).trim()
                        : null,
                    categoriaId: Number(categoriaId),
                    observacao: observacao ?? null,
                },
            });

            const fornecedorClienteAtualizado =
                await tx.fornecedorCliente.update({
                    where: { id: Number(fornecedorClienteId) },
                    data: { saldo: novoSaldo },
                });

            return {
                lancamento,
                fornecedorCliente: fornecedorClienteAtualizado,
            };
        });

        return res.status(201).json({
            message: "Lançamento criado com sucesso",
            ...resultado,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (
            msg.includes("não encontrad") // fornecedor/conta/categoria
        ) {
            return res.status(404).json({ message: msg });
        }
        return res.status(500).json({ message: "Erro ao criar lançamento" });
    }
});

// DELETE /lancamentos/:id
router.delete("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const lancamento = await tx.lancamento.findFirst({
                where: { id, empresaId },
            });
            if (!lancamento) {
                throw new Error("Lançamento não encontrado");
            }

            const fornecedorCliente = await tx.fornecedorCliente.findFirst({
                where: { id: lancamento.fornecedorClienteId, empresaId },
            });
            if (!fornecedorCliente) {
                throw new Error("Fornecedor/cliente não encontrado");
            }

            const saldoAtual = Number(fornecedorCliente.saldo);

            // ao deletar, desfaz o efeito do lançamento no saldo
            const novoSaldo =
                lancamento.tipo === "ENTRADA"
                    ? saldoAtual - Number(lancamento.valor)
                    : saldoAtual + Number(lancamento.valor);

            const lancamentoDeletado = await tx.lancamento.delete({
                where: { id },
            });

            const fornecedorClienteAtualizado =
                await tx.fornecedorCliente.update({
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
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("não encontrad")) {
            return res.status(404).json({ message: msg });
        }
        return res.status(500).json({ message: "Erro ao deletar lançamento" });
    }
});

// PATCH /lancamentos/:id
router.patch("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);

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

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        if (tipo !== undefined && !["ENTRADA", "SAIDA"].includes(tipo)) {
            return res
                .status(400)
                .json({ message: "Tipo inválido. Use ENTRADA ou SAIDA" });
        }

        if (
            valor !== undefined &&
            (isNaN(Number(valor)) || Number(valor) <= 0)
        ) {
            return res
                .status(400)
                .json({ message: "O valor deve ser um número maior que zero" });
        }

        if (
            contaId !== undefined &&
            (contaId === null || contaId === "" || isNaN(Number(contaId)))
        ) {
            return res.status(400).json({
                message: "Conta inválida. A conta é obrigatória",
            });
        }

        if (
            categoriaId !== undefined &&
            (categoriaId === null ||
                categoriaId === "" ||
                isNaN(Number(categoriaId)))
        ) {
            return res.status(400).json({
                message: "Categoria inválida. A categoria é obrigatória",
            });
        }

        let dataConvertida: Date | undefined;
        if (dataLancamento !== undefined) {
            dataConvertida = new Date(dataLancamento);
            if (isNaN(dataConvertida.getTime())) {
                return res.status(400).json({ message: "Data inválida" });
            }
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const lancamentoAtual = await tx.lancamento.findFirst({
                where: { id, empresaId },
            });
            if (!lancamentoAtual) {
                throw new Error("Lançamento não encontrado");
            }

            const fornecedorAntigo = await tx.fornecedorCliente.findFirst({
                where: { id: lancamentoAtual.fornecedorClienteId, empresaId },
            });
            if (!fornecedorAntigo) {
                throw new Error("Fornecedor/cliente antigo não encontrado");
            }

            // 1) desfaz o efeito do lançamento atual no saldo do fornecedor antigo
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

            const novoTipo =
                tipo !== undefined ? tipo : lancamentoAtual.tipo;

            const novoValor =
                valor !== undefined
                    ? Number(valor)
                    : Number(lancamentoAtual.valor);

            // valida propriedade das novas referências (todas da mesma empresa)
            const fornecedorNovo = await tx.fornecedorCliente.findFirst({
                where: { id: novoFornecedorClienteId, empresaId },
            });
            if (!fornecedorNovo) {
                throw new Error("Novo fornecedor/cliente não encontrado");
            }

            if (contaId !== undefined) {
                const conta = await tx.conta.findFirst({
                    where: { id: Number(contaId), empresaId },
                });
                if (!conta) {
                    throw new Error("Conta não encontrada");
                }
            }

            if (categoriaId !== undefined) {
                const categoria = await tx.categoria.findFirst({
                    where: { id: Number(categoriaId), empresaId },
                });
                if (!categoria) {
                    throw new Error("Categoria não encontrada");
                }
            }

            // 2) aplica o efeito do lançamento novo no saldo do fornecedor novo.
            // Relê o saldo (pode ter sido alterado no passo 1, se for o mesmo).
            const fornecedorNovoAtual = await tx.fornecedorCliente.findFirst({
                where: { id: novoFornecedorClienteId, empresaId },
            });
            const saldoNovoAtual = Number(fornecedorNovoAtual!.saldo);

            const novoSaldo =
                novoTipo === "ENTRADA"
                    ? saldoNovoAtual + novoValor
                    : saldoNovoAtual - novoValor;

            const dadosAtualizacao: any = {};

            if (dataConvertida !== undefined) {
                dadosAtualizacao.dataLancamento = dataConvertida;
            }
            if (fornecedorClienteId !== undefined) {
                dadosAtualizacao.fornecedorClienteId = novoFornecedorClienteId;
            }
            if (tipo !== undefined) {
                dadosAtualizacao.tipo = tipo;
            }
            if (valor !== undefined) {
                dadosAtualizacao.valor = Number(valor);
            }
            if (contaId !== undefined) {
                dadosAtualizacao.contaId = Number(contaId);
            }
            if (classificacao !== undefined) {
                dadosAtualizacao.classificacao =
                    classificacao === null
                        ? null
                        : String(classificacao).trim() || null;
            }
            if (categoriaId !== undefined) {
                dadosAtualizacao.categoriaId = Number(categoriaId);
            }
            if (observacao !== undefined) {
                dadosAtualizacao.observacao = observacao;
            }

            const lancamentoAtualizado = await tx.lancamento.update({
                where: { id },
                data: dadosAtualizacao,
            });

            const fornecedorClienteAtualizado =
                await tx.fornecedorCliente.update({
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
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("não encontrad")) {
            return res.status(404).json({ message: msg });
        }
        return res
            .status(500)
            .json({ message: "Erro ao atualizar lançamento" });
    }
});

export default router;
