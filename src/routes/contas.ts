import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { getEmpresaId } from "../auth/middleware.js";

const router = Router();

// Todas as rotas operam apenas sobre a empresa resolvida (req.empresaId).

// GET /contas
router.get("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);

        const contas = await prisma.conta.findMany({
            where: { empresaId },
            orderBy: { nome: "asc" },
        });

        return res.status(200).json(contas);
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar contas" });
    }
});

// POST /contas
router.post("/", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const { nome } = req.body;

        if (!nome || String(nome).trim() === "") {
            return res.status(400).json({
                message: "O campo nome é obrigatório",
            });
        }

        const nomeFormatado = String(nome).trim();

        const contaExistente = await prisma.conta.findFirst({
            where: { empresaId, nome: nomeFormatado },
        });

        if (contaExistente) {
            return res.status(409).json({ message: "Essa conta já existe" });
        }

        const novaConta = await prisma.conta.create({
            data: { nome: nomeFormatado, empresaId },
        });

        return res.status(201).json({
            message: "Conta criada com sucesso",
            conta: novaConta,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao adicionar conta",
        });
    }
});

// PUT /contas/:id
router.put("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);
        const { nome } = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        if (!nome || String(nome).trim() === "") {
            return res.status(400).json({ message: "O nome é obrigatório" });
        }

        const nomeFormatado = String(nome).trim();

        const conta = await prisma.conta.findFirst({
            where: { id, empresaId },
        });

        if (!conta) {
            return res.status(404).json({ message: "Conta não encontrada" });
        }

        const contaExistente = await prisma.conta.findFirst({
            where: { empresaId, nome: nomeFormatado, id: { not: id } },
        });

        if (contaExistente) {
            return res
                .status(409)
                .json({ message: "Já existe uma conta com esse nome" });
        }

        const contaAtualizada = await prisma.conta.update({
            where: { id },
            data: { nome: nomeFormatado },
        });

        return res.status(200).json({
            message: "Conta atualizada com sucesso",
            conta: contaAtualizada,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao atualizar conta" });
    }
});

// DELETE /contas/:id
router.delete("/:id", async (req, res) => {
    try {
        const empresaId = getEmpresaId(req);
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const conta = await prisma.conta.findFirst({
            where: { id, empresaId },
        });

        if (!conta) {
            return res.status(404).json({ message: "Conta não encontrada" });
        }

        const vinculados = await prisma.lancamento.count({
            where: { contaId: id, empresaId },
        });

        if (vinculados > 0) {
            return res.status(409).json({
                message:
                    "Não é possível excluir uma conta que possui lançamentos vinculados",
            });
        }

        await prisma.conta.delete({ where: { id } });

        return res
            .status(200)
            .json({ message: "Conta excluída com sucesso" });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao excluir conta" });
    }
});

export default router;
