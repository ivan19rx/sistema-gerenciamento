import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// GET /contas
router.get("/", async (req, res) => {
    try {
        const contas = await prisma.conta.findMany({
            orderBy: {
                nome: "asc",
            },
        });

        if (contas.length === 0) {
            return res.status(404).json({
                message: "Nenhuma conta encontrada",
            });
        }

        return res.status(200).json(contas);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar contas",
            error,
        });
    }
});

// POST /contas
router.post("/", async (req, res) => {
    try {
        const { nome } = req.body;

        if (!nome) {
            return res.status(400).json({
                message: "O campo nome é obrigatório",
            });
        }

        const contaExistente = await prisma.conta.findUnique({
            where: { nome },
        });

        if (contaExistente) {
            return res.status(409).json({
                message: "Essa conta já existe",
            });
        }

        const novaConta = await prisma.conta.create({
            data: { nome },
        });

        return res.status(201).json({
            message: "Tipo de conta criada com sucesso",
            conta: novaConta,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao adicionar tipo de conta",
            error,
        });
    }
});

// PUT /contas/:id
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome } = req.body;

        if (!nome) {
            return res.status(400).json({
                message: "O nome é obrigatório",
            });
        }

        const conta = await prisma.conta.findUnique({
            where: { id },
        });

        if (!conta) {
            return res.status(404).json({
                message: "Conta não encontrada",
            });
        }

        const contaExistente = await prisma.conta.findFirst({
            where: {
                nome,
                id: { not: id },
            },
        });

        if (contaExistente) {
            return res.status(409).json({
                message: "Já existe uma conta com esse nome",
            });
        }

        const contaAtualizada = await prisma.conta.update({
            where: { id },
            data: { nome },
        });

        return res.status(200).json({
            message: "Conta atualizada com sucesso",
            conta: contaAtualizada,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao atualizar conta",
            error,
        });
    }
});

// DELETE /contas/:id
router.delete("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const conta = await prisma.conta.findUnique({
            where: { id },
            include: { lancamentos: true },
        });

        if (!conta) {
            return res.status(404).json({
                message: "Conta não encontrada",
            });
        }

        if (conta.lancamentos.length > 0) {
            return res.status(409).json({
                message: "Não é possível excluir uma conta que possui lançamentos vinculados",
            });
        }

        await prisma.conta.delete({
            where: { id },
        });

        return res.status(200).json({
            message: "Conta excluída com sucesso",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao excluir conta",
            error,
        });
    }
});

export default router;