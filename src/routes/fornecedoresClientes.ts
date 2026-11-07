import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";
import {
    parseCentavos,
    centavosParaDecimal,
    MSG_VALOR_INVALIDO,
} from "../valores.js";

const router = Router();

const MSG_SALDO_INVALIDO = `Saldo inválido: ${MSG_VALOR_INVALIDO}`;

// GET /fornecedores-clientes
router.get("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const fornecedoresClientes = await prisma.fornecedorCliente.findMany({
            where: { empresaId },
            orderBy: { nome: "asc" },
        });

        return res.status(200).json(fornecedoresClientes);
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao buscar fornecedores/clientes" });
    }
});

// GET /fornecedores-clientes/resumo
// Soma exata (Decimal) dos saldos da empresa: saldos negativos = a receber,
// positivos = a pagar. Independente de paginação/filtros da listagem.
router.get("/resumo", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const [positivos, negativos] = await Promise.all([
            prisma.fornecedorCliente.aggregate({
                where: { empresaId, saldo: { gt: 0 } },
                _sum: { saldo: true },
            }),
            prisma.fornecedorCliente.aggregate({
                where: { empresaId, saldo: { lt: 0 } },
                _sum: { saldo: true },
            }),
        ]);

        // A receber = soma dos saldos negativos (em módulo); a pagar = soma dos
        // saldos positivos. Saldo = a receber − a pagar.
        const totalReceber = Math.abs(Number(negativos._sum.saldo || 0));
        const totalPagar = Number(positivos._sum.saldo || 0);

        return res.status(200).json({
            resumo: {
                totalReceber,
                totalPagar,
                saldo: totalReceber - totalPagar,
            },
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao calcular resumo de fornecedores/clientes",
        });
    }
});

// POST /fornecedores-clientes
router.post("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { nome, saldo } = req.body;

        if (!nome || String(nome).trim() === "") {
            return res.status(400).json({ message: "O nome é obrigatório" });
        }

        // saldo inicial (opcional); pode ser negativo (= a receber)
        const temSaldo = saldo !== undefined && saldo !== null && saldo !== "";
        const saldoCentavos = temSaldo
            ? parseCentavos(saldo, { permitirNegativo: true })
            : null;
        if (temSaldo && saldoCentavos === null) {
            return res.status(400).json({ message: MSG_SALDO_INVALIDO });
        }

        const nomeFormatado = String(nome).trim();

        const existente = await prisma.fornecedorCliente.findFirst({
            where: { empresaId, nome: nomeFormatado },
        });

        if (existente) {
            return res.status(409).json({
                message: "Já existe um fornecedor/cliente com esse nome",
            });
        }

        const fornecedorCliente = await prisma.fornecedorCliente.create({
            data: {
                nome: nomeFormatado,
                empresaId,
                ...(saldoCentavos !== null
                    ? { saldo: centavosParaDecimal(saldoCentavos) }
                    : {}),
            },
        });

        return res.status(201).json({
            message: "Fornecedor/cliente criado com sucesso",
            fornecedorCliente,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao criar fornecedor/cliente" });
    }
});

// PUT /fornecedores-clientes/:id
router.put("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);
        const { nome, ativo, saldo, saldoEsperado } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const fornecedorCliente = await prisma.fornecedorCliente.findFirst({
            where: { id, empresaId },
        });

        if (!fornecedorCliente) {
            return res.status(404).json({
                message: "Fornecedor/cliente não encontrado",
            });
        }

        const data: {
            nome?: string;
            ativo?: boolean;
            saldo?: string;
        } = {};

        // Ajuste manual de saldo. O saldo também é alterado por lançamentos e
        // movimentações, então quem edita precisa informar o saldo que estava
        // vendo (saldoEsperado). Se ele mudou nesse meio-tempo, recusamos em
        // vez de sobrescrever o valor novo com um antigo.
        let saldoEsperadoDecimal: string | null = null;
        if (saldo !== undefined && saldo !== null && saldo !== "") {
            const novo = parseCentavos(saldo, { permitirNegativo: true });
            if (novo === null) {
                return res.status(400).json({ message: MSG_SALDO_INVALIDO });
            }
            const esperado = parseCentavos(saldoEsperado, { permitirNegativo: true });
            if (esperado === null) {
                return res.status(400).json({
                    message:
                        "Para ajustar o saldo, informe também o saldo atual exibido (saldoEsperado)",
                });
            }
            data.saldo = centavosParaDecimal(novo);
            saldoEsperadoDecimal = centavosParaDecimal(esperado);
        }

        if (nome !== undefined) {
            if (!nome || String(nome).trim() === "") {
                return res
                    .status(400)
                    .json({ message: "O nome não pode ser vazio" });
            }

            const nomeFormatado = String(nome).trim();

            const existente = await prisma.fornecedorCliente.findFirst({
                where: { empresaId, nome: nomeFormatado, id: { not: id } },
            });

            if (existente) {
                return res.status(409).json({
                    message: "Já existe um fornecedor/cliente com esse nome",
                });
            }

            data.nome = nomeFormatado;
        }

        if (ativo !== undefined) {
            data.ativo = Boolean(ativo);
        }

        if (saldoEsperadoDecimal !== null) {
            // UPDATE condicional: só grava se o saldo ainda for o esperado.
            const { count } = await prisma.fornecedorCliente.updateMany({
                where: { id, empresaId, saldo: saldoEsperadoDecimal },
                data,
            });
            if (count === 0) {
                return res.status(409).json({
                    message:
                        "O saldo deste cliente/fornecedor mudou desde que o formulário foi aberto (houve um lançamento ou movimentação). Feche, reabra e confira antes de ajustar.",
                });
            }
        } else if (Object.keys(data).length > 0) {
            await prisma.fornecedorCliente.update({ where: { id }, data });
        }

        const fornecedorClienteAtualizado =
            await prisma.fornecedorCliente.findFirst({ where: { id, empresaId } });

        return res.status(200).json({
            message: "Fornecedor/cliente atualizado com sucesso",
            fornecedorCliente: fornecedorClienteAtualizado,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao atualizar fornecedor/cliente" });
    }
});

// DELETE /fornecedores-clientes/:id
router.delete("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const fornecedorCliente = await prisma.fornecedorCliente.findFirst({
            where: { id, empresaId },
        });

        if (!fornecedorCliente) {
            return res.status(404).json({
                message: "Fornecedor/cliente não encontrado",
            });
        }

        const vinculados = await prisma.lancamento.count({
            where: { fornecedorClienteId: id, empresaId },
        });

        if (vinculados > 0) {
            return res.status(409).json({
                message:
                    "Não é possível excluir fornecedor/cliente com lançamentos vinculados",
            });
        }

        await prisma.fornecedorCliente.delete({ where: { id } });

        return res
            .status(200)
            .json({ message: "Fornecedor/cliente removido com sucesso" });
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao remover fornecedor/cliente" });
    }
});

export default router;
