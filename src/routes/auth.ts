import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { compararSenha } from "../auth/senha.js";
import { assinarToken } from "../auth/jwt.js";

const router = Router();

function apenasDigitos(valor: string): string {
    return valor.replace(/\D/g, "");
}

// POST /auth/login
// Login da empresa. O "identificador" pode ser o CNPJ ou o e-mail.
router.post("/login", async (req, res) => {
    try {
        const { identificador, senha } = req.body;

        if (!identificador || !senha) {
            return res.status(400).json({
                message: "Informe identificador (CNPJ ou e-mail) e senha",
            });
        }

        const id = String(identificador).trim();
        const cnpj = apenasDigitos(id);
        const pareceCnpj = cnpj.length >= 11;

        const empresa = await prisma.empresa.findFirst({
            where: {
                OR: [
                    { email: id.toLowerCase() },
                    ...(pareceCnpj ? [{ cnpj }] : []),
                ],
            },
            // sobrescreve o omit global para poder validar a senha
            omit: { senha: false },
        });

        // Mensagem genérica: não revela se o identificador existe.
        if (!empresa || !empresa.ativo) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const ok = await compararSenha(String(senha), empresa.senha);
        if (!ok) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = assinarToken({ id: empresa.id, role: "EMPRESA" });

        return res.status(200).json({
            token,
            empresa: {
                id: empresa.id,
                cnpj: empresa.cnpj,
                razaoSocial: empresa.razaoSocial,
                nomeFantasia: empresa.nomeFantasia,
                email: empresa.email,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao efetuar login" });
    }
});

// POST /auth/admin/login
router.post("/admin/login", async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res
                .status(400)
                .json({ message: "Informe e-mail e senha" });
        }

        const admin = await prisma.admin.findUnique({
            where: { email: String(email).trim().toLowerCase() },
            omit: { senha: false },
        });

        if (!admin || !admin.ativo) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const ok = await compararSenha(String(senha), admin.senha);
        if (!ok) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = assinarToken({ id: admin.id, role: "ADMIN" });

        return res.status(200).json({
            token,
            admin: { id: admin.id, email: admin.email },
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao efetuar login" });
    }
});

export default router;
