import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { compararSenha } from "../auth/senha.js";
import { assinarToken } from "../auth/jwt.js";
import { registrarLogin } from "../registroLogin.js";

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

        const nomeEmpresa = empresa?.nomeFantasia || empresa?.razaoSocial || null;
        const base = { tipoAcesso: "EMPRESA" as const, identificador: id };

        // Mensagem genérica: não revela se o identificador existe. O motivo
        // real fica só no registro de login (visto pelo administrador).
        if (!empresa) {
            await registrarLogin(req, { ...base, sucesso: false, motivo: "Usuário não encontrado" });
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const ok = await compararSenha(String(senha), empresa.senha);
        if (!ok || !empresa.ativo) {
            await registrarLogin(req, {
                ...base, sucesso: false, empresaId: empresa.id, nomeUsuario: nomeEmpresa,
                motivo: !ok ? "Senha incorreta" : "Cadastro inativo",
            });
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = assinarToken({ id: empresa.id, role: "EMPRESA" });
        await registrarLogin(req, { ...base, sucesso: true, empresaId: empresa.id, nomeUsuario: nomeEmpresa });

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
// O "identificador" pode ser o CNPJ ou o e-mail do admin.
// Aceita também o campo legado `email` para compatibilidade.
router.post("/admin/login", async (req, res) => {
    try {
        const { identificador, email, senha } = req.body;
        const entrada = identificador ?? email;

        if (!entrada || !senha) {
            return res.status(400).json({
                message: "Informe identificador (CNPJ ou e-mail) e senha",
            });
        }

        const id = String(entrada).trim();
        const cnpj = apenasDigitos(id);
        const pareceCnpj = cnpj.length >= 11;

        const admin = await prisma.admin.findFirst({
            where: {
                OR: [
                    { email: id.toLowerCase() },
                    ...(pareceCnpj ? [{ cnpj }] : []),
                ],
            },
            // sobrescreve o omit global para poder validar a senha
            omit: { senha: false },
        });

        const base = { tipoAcesso: "ADMIN" as const, identificador: id };

        if (!admin) {
            await registrarLogin(req, { ...base, sucesso: false, motivo: "Usuário não encontrado" });
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const ok = await compararSenha(String(senha), admin.senha);
        if (!ok || !admin.ativo) {
            await registrarLogin(req, {
                ...base, sucesso: false, adminId: admin.id, nomeUsuario: admin.email,
                motivo: !ok ? "Senha incorreta" : "Cadastro inativo",
            });
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const token = assinarToken({ id: admin.id, role: "ADMIN" });
        await registrarLogin(req, { ...base, sucesso: true, adminId: admin.id, nomeUsuario: admin.email });

        return res.status(200).json({
            token,
            admin: { id: admin.id, email: admin.email, cnpj: admin.cnpj },
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao efetuar login" });
    }
});

export default router;
