import { Router } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { hashSenha } from "../auth/senha.js";

const router = Router();

// Montado no server com: autenticar + apenasAdmin.

function apenasDigitos(valor: string): string {
    return valor.replace(/\D/g, "");
}

// GET /empresas
router.get("/", async (req, res) => {
    try {
        const empresas = await prisma.empresa.findMany({
            orderBy: { razaoSocial: "asc" },
        });
        // senha omitida globalmente (ver lib/prisma.ts)
        return res.status(200).json(empresas);
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar empresas" });
    }
});

// GET /empresas/:id
router.get("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const empresa = await prisma.empresa.findUnique({ where: { id } });

        if (!empresa) {
            return res.status(404).json({ message: "Empresa não encontrada" });
        }

        return res.status(200).json(empresa);
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar empresa" });
    }
});

// POST /empresas
router.post("/", async (req, res) => {
    try {
        const {
            cnpj,
            razaoSocial,
            nomeFantasia,
            inscricaoEstadual,
            inscricaoMunicipal,
            endereco,
            email,
            senha,
        } = req.body;

        if (!cnpj || !razaoSocial || !email || !senha) {
            return res.status(400).json({
                message:
                    "CNPJ, razão social, e-mail e senha são obrigatórios",
            });
        }

        const cnpjLimpo = apenasDigitos(String(cnpj));
        if (cnpjLimpo.length !== 14) {
            return res
                .status(400)
                .json({ message: "CNPJ deve conter 14 dígitos" });
        }

        const emailNorm = String(email).trim().toLowerCase();
        if (String(senha).length < 6) {
            return res.status(400).json({
                message: "A senha deve ter ao menos 6 caracteres",
            });
        }

        const existente = await prisma.empresa.findFirst({
            where: { OR: [{ cnpj: cnpjLimpo }, { email: emailNorm }] },
        });

        if (existente) {
            return res.status(409).json({
                message: "Já existe uma empresa com esse CNPJ ou e-mail",
            });
        }

        const empresa = await prisma.empresa.create({
            data: {
                cnpj: cnpjLimpo,
                razaoSocial: String(razaoSocial).trim(),
                nomeFantasia: nomeFantasia ? String(nomeFantasia).trim() : null,
                inscricaoEstadual: inscricaoEstadual
                    ? String(inscricaoEstadual).trim()
                    : null,
                inscricaoMunicipal: inscricaoMunicipal
                    ? String(inscricaoMunicipal).trim()
                    : null,
                endereco: endereco ? String(endereco).trim() : null,
                email: emailNorm,
                senha: await hashSenha(String(senha)),
            },
        });

        return res.status(201).json({
            message: "Empresa criada com sucesso",
            empresa,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao criar empresa" });
    }
});

// PUT /empresas/:id  (envie apenas os campos que deseja alterar)
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const empresa = await prisma.empresa.findUnique({ where: { id } });
        if (!empresa) {
            return res.status(404).json({ message: "Empresa não encontrada" });
        }

        const {
            cnpj,
            razaoSocial,
            nomeFantasia,
            inscricaoEstadual,
            inscricaoMunicipal,
            endereco,
            email,
            senha,
            ativo,
        } = req.body;

        const data: Prisma.EmpresaUpdateInput = {};

        if (cnpj !== undefined) {
            const cnpjLimpo = apenasDigitos(String(cnpj));
            if (cnpjLimpo.length !== 14) {
                return res
                    .status(400)
                    .json({ message: "CNPJ deve conter 14 dígitos" });
            }
            const dup = await prisma.empresa.findFirst({
                where: { cnpj: cnpjLimpo, id: { not: id } },
            });
            if (dup) {
                return res
                    .status(409)
                    .json({ message: "Já existe uma empresa com esse CNPJ" });
            }
            data.cnpj = cnpjLimpo;
        }

        if (email !== undefined) {
            const emailNorm = String(email).trim().toLowerCase();
            if (emailNorm === "") {
                return res
                    .status(400)
                    .json({ message: "E-mail não pode ser vazio" });
            }
            const dup = await prisma.empresa.findFirst({
                where: { email: emailNorm, id: { not: id } },
            });
            if (dup) {
                return res
                    .status(409)
                    .json({ message: "Já existe uma empresa com esse e-mail" });
            }
            data.email = emailNorm;
        }

        if (razaoSocial !== undefined) {
            if (String(razaoSocial).trim() === "") {
                return res
                    .status(400)
                    .json({ message: "Razão social não pode ser vazia" });
            }
            data.razaoSocial = String(razaoSocial).trim();
        }

        if (nomeFantasia !== undefined) {
            data.nomeFantasia = nomeFantasia
                ? String(nomeFantasia).trim()
                : null;
        }

        if (inscricaoEstadual !== undefined) {
            data.inscricaoEstadual = inscricaoEstadual
                ? String(inscricaoEstadual).trim()
                : null;
        }

        if (inscricaoMunicipal !== undefined) {
            data.inscricaoMunicipal = inscricaoMunicipal
                ? String(inscricaoMunicipal).trim()
                : null;
        }

        if (endereco !== undefined) {
            data.endereco = endereco ? String(endereco).trim() : null;
        }

        if (ativo !== undefined) {
            data.ativo = Boolean(ativo);
        }

        if (senha !== undefined) {
            if (String(senha).length < 6) {
                return res.status(400).json({
                    message: "A senha deve ter ao menos 6 caracteres",
                });
            }
            data.senha = await hashSenha(String(senha));
        }

        const atualizada = await prisma.empresa.update({
            where: { id },
            data,
        });

        return res.status(200).json({
            message: "Empresa atualizada com sucesso",
            empresa: atualizada,
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao atualizar empresa" });
    }
});

// DELETE /empresas/:id
// Bloqueia exclusão de empresa que ainda possui dados vinculados.
// Para "desligar" uma empresa, use PUT com { ativo: false }.
router.delete("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({ message: "ID inválido" });
        }

        const empresa = await prisma.empresa.findUnique({ where: { id } });
        if (!empresa) {
            return res.status(404).json({ message: "Empresa não encontrada" });
        }

        const vinculos = await prisma.lancamento.count({
            where: { empresaId: id },
        });

        if (vinculos > 0) {
            return res.status(409).json({
                message:
                    "Não é possível excluir uma empresa com lançamentos vinculados. Desative-a com ativo=false.",
            });
        }

        // remove dados de apoio (sem lançamentos) e a empresa, em transação
        await prisma.$transaction([
            prisma.conta.deleteMany({ where: { empresaId: id } }),
            prisma.categoria.deleteMany({ where: { empresaId: id } }),
            prisma.fornecedorCliente.deleteMany({ where: { empresaId: id } }),
            prisma.empresa.delete({ where: { id } }),
        ]);

        return res
            .status(200)
            .json({ message: "Empresa removida com sucesso" });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao remover empresa" });
    }
});

export default router;
