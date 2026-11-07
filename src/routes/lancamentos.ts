import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";
import { transacao, travarLinha } from "../transacao.js";
import {
    parseCentavos,
    centavosParaDecimal,
    decimalParaCentavos,
    MSG_VALOR_INVALIDO,
} from "../valores.js";

const router = Router();

// Efeito de um lançamento no saldo do fornecedor/cliente, em centavos:
// ENTRADA soma, SAIDA subtrai.
function efeitoCentavos(tipo: string, centavos: number): number {
    return tipo === "ENTRADA" ? centavos : -centavos;
}

// Ajusta o saldo de forma atômica no banco (UPDATE ... SET saldo = saldo + x).
// Diferente de "ler, somar em JS e gravar", duas operações simultâneas no
// mesmo cliente não sobrescrevem uma à outra.
function ajustarSaldo(tx: any, fornecedorClienteId: number, deltaCentavos: number) {
    return tx.fornecedorCliente.update({
        where: { id: fornecedorClienteId },
        data: { saldo: { increment: centavosParaDecimal(deltaCentavos) } },
    });
}

// GET /lancamentos/filtros?clienteId=1&contaId=2&categoriaId=3&tipo=ENTRADA|SAIDA|TODOS
router.get("/filtros", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { clienteId, contaId, categoriaId, tipo, dataInicio, dataFim } =
            req.query;

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

        // Filtro de período por data do lançamento. Aceita "YYYY-MM-DD" e trata
        // o intervalo como inclusivo em ambas as pontas (o dia final inteiro).
        const periodo: { gte?: Date; lte?: Date } = {};

        if (dataInicio !== undefined && dataInicio !== "") {
            const inicio = new Date(`${String(dataInicio)}T00:00:00.000Z`);
            if (isNaN(inicio.getTime())) {
                return res
                    .status(400)
                    .json({ message: "Data inicial inválida" });
            }
            periodo.gte = inicio;
        }

        if (dataFim !== undefined && dataFim !== "") {
            const fim = new Date(`${String(dataFim)}T23:59:59.999Z`);
            if (isNaN(fim.getTime())) {
                return res.status(400).json({ message: "Data final inválida" });
            }
            periodo.lte = fim;
        }

        if (
            periodo.gte !== undefined &&
            periodo.lte !== undefined &&
            periodo.gte > periodo.lte
        ) {
            return res.status(400).json({
                message: "A data inicial não pode ser maior que a data final",
            });
        }

        if (periodo.gte !== undefined || periodo.lte !== undefined) {
            where.dataLancamento = periodo;
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
                dataInicio: dataInicio ? String(dataInicio) : null,
                dataFim: dataFim ? String(dataFim) : null,
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

        const valorCentavos = parseCentavos(valor);
        if (valorCentavos === null || valorCentavos <= 0) {
            return res.status(400).json({
                message: `Valor inválido: ${MSG_VALOR_INVALIDO}, maior que zero`,
            });
        }

        const data = new Date(dataLancamento);
        if (isNaN(data.getTime())) {
            return res.status(400).json({ message: "Data inválida" });
        }

        const resultado = await transacao(async (tx) => {
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

            // O saldo é ajustado ANTES de gravar o lançamento: o UPDATE trava a
            // linha do cliente logo de início, e uma operação simultânea no mesmo
            // cliente espera esta terminar (em vez de as duas se travarem).
            const fornecedorClienteAtualizado = await ajustarSaldo(
                tx,
                Number(fornecedorClienteId),
                efeitoCentavos(tipo, valorCentavos),
            );

            const lancamento = await tx.lancamento.create({
                data: {
                    dataLancamento: data,
                    empresaId,
                    fornecedorClienteId: Number(fornecedorClienteId),
                    tipo,
                    valor: centavosParaDecimal(valorCentavos),
                    contaId: Number(contaId),
                    classificacao: classificacao
                        ? String(classificacao).trim()
                        : null,
                    categoriaId: Number(categoriaId),
                    observacao: observacao ?? null,
                },
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

        const resultado = await transacao(async (tx) => {
            await travarLinha(tx, "lancamentos", id);
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

            // ao deletar, desfaz o efeito do lançamento no saldo
            const fornecedorClienteAtualizado = await ajustarSaldo(
                tx,
                lancamento.fornecedorClienteId,
                -efeitoCentavos(
                    lancamento.tipo,
                    decimalParaCentavos(lancamento.valor),
                ),
            );

            const lancamentoDeletado = await tx.lancamento.delete({
                where: { id },
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

        const valorCentavos =
            valor !== undefined ? parseCentavos(valor) : undefined;
        if (
            valorCentavos !== undefined &&
            (valorCentavos === null || valorCentavos <= 0)
        ) {
            return res.status(400).json({
                message: `Valor inválido: ${MSG_VALOR_INVALIDO}, maior que zero`,
            });
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

        const resultado = await transacao(async (tx) => {
            await travarLinha(tx, "lancamentos", id);
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
            await ajustarSaldo(
                tx,
                lancamentoAtual.fornecedorClienteId,
                -efeitoCentavos(
                    lancamentoAtual.tipo,
                    decimalParaCentavos(lancamentoAtual.valor),
                ),
            );

            const novoFornecedorClienteId =
                fornecedorClienteId !== undefined
                    ? Number(fornecedorClienteId)
                    : lancamentoAtual.fornecedorClienteId;

            const novoTipo =
                tipo !== undefined ? tipo : lancamentoAtual.tipo;

            const novoValorCentavos =
                valorCentavos ?? decimalParaCentavos(lancamentoAtual.valor);

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
            if (valorCentavos !== undefined && valorCentavos !== null) {
                dadosAtualizacao.valor = centavosParaDecimal(valorCentavos);
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

            // 2) aplica o efeito do lançamento novo no saldo do fornecedor novo
            // (atômico; funciona mesmo quando é o mesmo fornecedor do passo 1).
            // Feito antes de regravar o lançamento, pelo mesmo motivo do POST.
            const fornecedorClienteAtualizado = await ajustarSaldo(
                tx,
                novoFornecedorClienteId,
                efeitoCentavos(novoTipo, novoValorCentavos),
            );

            const lancamentoAtualizado = await tx.lancamento.update({
                where: { id },
                data: dadosAtualizacao,
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
