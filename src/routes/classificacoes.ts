import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

// GET /classificacoes
router.get("/", async (req, res) => {
    try {
        const classificacoes = await prisma.classificacao.findMany({
            select: {
                id: true,
                nome: true,
            },
            orderBy: {
                nome: "asc",
            },
        });

        return res.status(200).json(classificacoes);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar classificações",
            error,
        });
    }
});

// POST /classificacoes
router.post("/", async (req, res) => {
    try {
        const { nome } = req.body;

        if (!nome || nome.trim() === "") {
            return res.status(400).json({
                message: "O nome da classificação é obrigatório",
            });
        }

        const classificacaoExistente = await prisma.classificacao.findUnique({
            where: { nome: nome.trim() },
        });

        if (classificacaoExistente) {
            return res.status(409).json({
                message: "Já existe uma classificação com esse nome",
            });
        }

        const classificacao = await prisma.classificacao.create({
            data: { nome: nome.trim() },
        });

        return res.status(201).json({
            message: "Classificação criada com sucesso",
            classificacao,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao criar classificação",
            error,
        });
    }
});

// PUT /classificacoes/:id
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        if (!nome || nome.trim() === "") {
            return res.status(400).json({
                message: "O nome da classificação é obrigatório",
            });
        }

        const classificacao = await prisma.classificacao.findUnique({
            where: { id },
        });

        if (!classificacao) {
            return res.status(404).json({
                message: "Classificação não encontrada",
            });
        }

        const classificacaoExistente = await prisma.classificacao.findFirst({
            where: {
                nome: nome.trim(),
                id: { not: id },
            },
        });

        if (classificacaoExistente) {
            return res.status(409).json({
                message: "Já existe uma classificação com esse nome",
            });
        }

        const classificacaoAtualizada = await prisma.classificacao.update({
            where: { id },
            data: { nome: nome.trim() },
        });

        return res.status(200).json({
            message: "Classificação atualizada com sucesso",
            classificacao: classificacaoAtualizada,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao atualizar classificação",
            error,
        });
    }
});

// DELETE /classificacoes/:id
router.delete("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const classificacaoExistente = await prisma.classificacao.findUnique({
            where: { id },
        });

        if (!classificacaoExistente) {
            return res.status(404).json({
                message: "Classificação não encontrada",
            });
        }

        await prisma.classificacao.delete({
            where: { id },
        });

        return res.status(200).json({
            message: "Classificação removida com sucesso",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao remover classificação",
            error,
        });
    }
});

export default router;