import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// GET /fornecedores-clientes
router.get("/", async (req, res) => {
    try {
        const fornecedoresClientes = await prisma.fornecedorCliente.findMany({
            orderBy: { nome: "asc" },
        });

        return res.status(200).json(fornecedoresClientes);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar fornecedores/clientes",
            error,
        });
    }
});

// POST /fornecedores-clientes
// POST /fornecedores-clientes
router.post("/", async (req, res) => {
    try {
        const { nome, saldo } = req.body;

        if (!nome || nome.trim() === "") {
            return res.status(400).json({
                message: "O nome é obrigatório",
            });
        }

        if (saldo !== undefined && saldo !== "" && isNaN(parseFloat(saldo))) {
            return res.status(400).json({
                message: "O saldo deve ser um número válido",
            });
        }

        const nomeFormatado = nome.trim();

        const existente = await prisma.fornecedorCliente.findUnique({
            where: { nome: nomeFormatado },
        });

        if (existente) {
            return res.status(409).json({
                message: "Já existe um fornecedor/cliente com esse nome",
            });
        }

        const data: any = { nome: nomeFormatado };

        if (saldo !== undefined && saldo !== "") {
            data.saldo = String(parseFloat(saldo));
        }

        const fornecedorCliente = await prisma.fornecedorCliente.create({ data });

        return res.status(201).json({
            message: "Fornecedor/cliente criado com sucesso",
            fornecedorCliente,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao criar fornecedor/cliente",
            error,
        });
    }
});

// PUT /fornecedores-clientes/:id
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome, ativo, saldo } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const fornecedorCliente = await prisma.fornecedorCliente.findUnique({
            where: { id },
        });

        if (!fornecedorCliente) {
            return res.status(404).json({
                message: "Fornecedor/cliente não encontrado",
            });
        }

        const data: any = {};

        if (nome !== undefined) {
            if (!nome || nome.trim() === "") {
                return res.status(400).json({
                    message: "O nome não pode ser vazio",
                });
            }

            const nomeFormatado = nome.trim();

            const existente = await prisma.fornecedorCliente.findFirst({
                where: {
                    nome: nomeFormatado,
                    id: { not: id },
                },
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

        const fornecedorClienteAtualizado = await prisma.fornecedorCliente.update({
            where: { id },
            data,
        });

        return res.status(200).json({
            message: "Fornecedor/cliente atualizado com sucesso",
            fornecedorCliente: fornecedorClienteAtualizado,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao atualizar fornecedor/cliente",
            error,
        });
    }
});

// DELETE /fornecedores-clientes/:id
router.delete("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const fornecedorCliente = await prisma.fornecedorCliente.findUnique({
            where: { id },
            include: { lancamentos: true },
        });

        if (!fornecedorCliente) {
            return res.status(404).json({
                message: "Fornecedor/cliente não encontrado",
            });
        }

        if (fornecedorCliente.lancamentos.length > 0) {
            return res.status(409).json({
                message: "Não é possível excluir fornecedor/cliente com lançamentos vinculados",
            });
        }

        await prisma.fornecedorCliente.delete({
            where: { id },
        });

        return res.status(200).json({
            message: "Fornecedor/cliente removido com sucesso",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao remover fornecedor/cliente",
            error,
        });
    }
});

export default router;