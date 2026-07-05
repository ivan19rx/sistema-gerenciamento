import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";

const router = Router();

const UNIDADES = ["KG", "CAIXA", "PCT"] as const;

function unidadeValida(v: unknown): v is (typeof UNIDADES)[number] {
    return typeof v === "string" && UNIDADES.includes(v as never);
}

// GET /produtos
router.get("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const produtos = await prisma.produto.findMany({
            where: { empresaId },
            select: { id: true, nome: true, unidadeMedida: true },
            orderBy: { nome: "asc" },
        });

        return res.status(200).json(produtos);
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar produtos" });
    }
});

// POST /produtos
router.post("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { nome, unidadeMedida } = req.body;

        if (!nome || String(nome).trim() === "") {
            return res
                .status(400)
                .json({ message: "O nome do produto é obrigatório" });
        }

        if (!unidadeValida(unidadeMedida)) {
            return res.status(400).json({
                message: "Unidade de medida inválida. Use KG, CAIXA ou PCT",
            });
        }

        const nomeFormatado = String(nome).trim();

        const existente = await prisma.produto.findFirst({
            where: { empresaId, nome: nomeFormatado },
        });

        if (existente) {
            return res
                .status(409)
                .json({ message: "Já existe um produto com esse nome" });
        }

        const produto = await prisma.produto.create({
            data: { nome: nomeFormatado, unidadeMedida, empresaId },
        });

        return res
            .status(201)
            .json({ message: "Produto criado com sucesso", produto });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao criar produto" });
    }
});

// PUT /produtos/:id
router.put("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);
        const { nome, unidadeMedida } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        if (!nome || String(nome).trim() === "") {
            return res
                .status(400)
                .json({ message: "O nome do produto é obrigatório" });
        }

        if (!unidadeValida(unidadeMedida)) {
            return res.status(400).json({
                message: "Unidade de medida inválida. Use KG, CAIXA ou PCT",
            });
        }

        const nomeFormatado = String(nome).trim();

        const produto = await prisma.produto.findFirst({
            where: { id, empresaId },
        });

        if (!produto) {
            return res.status(404).json({ message: "Produto não encontrado" });
        }

        const existente = await prisma.produto.findFirst({
            where: { empresaId, nome: nomeFormatado, id: { not: id } },
        });

        if (existente) {
            return res
                .status(409)
                .json({ message: "Já existe um produto com esse nome" });
        }

        const produtoAtualizado = await prisma.produto.update({
            where: { id },
            data: { nome: nomeFormatado, unidadeMedida },
        });

        return res.status(200).json({
            message: "Produto atualizado com sucesso",
            produto: produtoAtualizado,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao atualizar produto" });
    }
});

// DELETE /produtos/:id
router.delete("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const produto = await prisma.produto.findFirst({
            where: { id, empresaId },
        });

        if (!produto) {
            return res.status(404).json({ message: "Produto não encontrado" });
        }

        const vinculados = await prisma.movimentacao.count({
            where: { produtoId: id, empresaId },
        });

        if (vinculados > 0) {
            return res.status(409).json({
                message:
                    "Não é possível excluir um produto que possui movimentações vinculadas",
            });
        }

        await prisma.produto.delete({ where: { id } });

        return res
            .status(200)
            .json({ message: "Produto removido com sucesso" });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao remover produto" });
    }
});

export default router;
