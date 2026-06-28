import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";

const router = Router();

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

// POST /fornecedores-clientes
router.post("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { nome, saldo } = req.body;

        if (!nome || String(nome).trim() === "") {
            return res.status(400).json({ message: "O nome é obrigatório" });
        }

        if (saldo !== undefined && saldo !== "" && isNaN(parseFloat(saldo))) {
            return res.status(400).json({
                message: "O saldo deve ser um número válido",
            });
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
                ...(saldo !== undefined && saldo !== ""
                    ? { saldo: String(parseFloat(saldo)) }
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
        const { nome, ativo, saldo } = req.body;

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

        if (saldo !== undefined && saldo !== "") {
            if (isNaN(parseFloat(saldo))) {
                return res.status(400).json({
                    message: "O saldo deve ser um número válido",
                });
            }
            data.saldo = String(parseFloat(saldo));
        }

        const fornecedorClienteAtualizado =
            await prisma.fornecedorCliente.update({
                where: { id },
                data,
            });

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
