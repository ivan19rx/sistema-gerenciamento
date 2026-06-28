import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";

const router = Router();

// GET /categorias
router.get("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const categorias = await prisma.categoria.findMany({
            where: { empresaId },
            select: { id: true, nome: true },
            orderBy: { nome: "asc" },
        });

        return res.status(200).json(categorias);
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar categorias" });
    }
});

// POST /categorias
router.post("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { nome } = req.body;

        if (!nome || String(nome).trim() === "") {
            return res.status(400).json({
                message: "O nome da categoria é obrigatório",
            });
        }

        const nomeFormatado = String(nome).trim();

        const categoriaExistente = await prisma.categoria.findFirst({
            where: { empresaId, nome: nomeFormatado },
        });

        if (categoriaExistente) {
            return res.status(409).json({
                message: "Já existe uma categoria com esse nome",
            });
        }

        const categoria = await prisma.categoria.create({
            data: { nome: nomeFormatado, empresaId },
        });

        return res.status(201).json({
            message: "Categoria criada com sucesso",
            categoria,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao criar categoria" });
    }
});

// PUT /categorias/:id
router.put("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);
        const { nome } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        if (!nome || String(nome).trim() === "") {
            return res.status(400).json({
                message: "O nome da categoria é obrigatório",
            });
        }

        const nomeFormatado = String(nome).trim();

        const categoria = await prisma.categoria.findFirst({
            where: { id, empresaId },
        });

        if (!categoria) {
            return res
                .status(404)
                .json({ message: "Categoria não encontrada" });
        }

        const categoriaExistente = await prisma.categoria.findFirst({
            where: { empresaId, nome: nomeFormatado, id: { not: id } },
        });

        if (categoriaExistente) {
            return res.status(409).json({
                message: "Já existe uma categoria com esse nome",
            });
        }

        const categoriaAtualizada = await prisma.categoria.update({
            where: { id },
            data: { nome: nomeFormatado },
        });

        return res.status(200).json({
            message: "Categoria atualizada com sucesso",
            categoria: categoriaAtualizada,
        });
    } catch (error) {
        return res
            .status(500)
            .json({ message: "Erro ao atualizar categoria" });
    }
});

// DELETE /categorias/:id
router.delete("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const categoria = await prisma.categoria.findFirst({
            where: { id, empresaId },
        });

        if (!categoria) {
            return res
                .status(404)
                .json({ message: "Categoria não encontrada" });
        }

        const vinculados = await prisma.lancamento.count({
            where: { categoriaId: id, empresaId },
        });

        if (vinculados > 0) {
            return res.status(409).json({
                message:
                    "Não é possível excluir uma categoria que possui lançamentos vinculados",
            });
        }

        await prisma.categoria.delete({ where: { id } });

        return res
            .status(200)
            .json({ message: "Categoria removida com sucesso" });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao remover categoria" });
    }
});

export default router;
