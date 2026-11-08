import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { identificarDispositivo, ipDaRequisicao } from "./dispositivo.js";

export type MotivoFalha =
    | "Usuário não encontrado"
    | "Senha incorreta"
    | "Cadastro inativo";

interface DadosLogin {
    tipoAcesso: "ADMIN" | "EMPRESA";
    identificador: string;
    sucesso: boolean;
    motivo?: MotivoFalha;
    adminId?: number;
    empresaId?: number;
    nomeUsuario?: string | null;
}

// Grava a tentativa de login com o dispositivo de origem. Nunca lança erro:
// uma falha ao registrar não pode impedir (nem revelar nada sobre) o login.
export async function registrarLogin(req: Request, dados: DadosLogin): Promise<void> {
    try {
        const userAgent = req.get("user-agent")?.slice(0, 1000);
        const dispositivo = identificarDispositivo(userAgent, req.body?.dispositivo);

        await prisma.registroLogin.create({
            data: {
                tipoAcesso: dados.tipoAcesso,
                sucesso: dados.sucesso,
                motivo: dados.motivo ?? null,
                identificador: dados.identificador.slice(0, 191),
                nomeUsuario: dados.nomeUsuario?.slice(0, 191) ?? null,
                adminId: dados.adminId ?? null,
                empresaId: dados.empresaId ?? null,
                ip: ipDaRequisicao(req.ip),
                userAgent: userAgent ?? null,
                tipoDispositivo: dispositivo.tipo,
                sistema: dispositivo.sistema?.slice(0, 64) ?? null,
                navegador: dispositivo.navegador?.slice(0, 64) ?? null,
                modelo: dispositivo.modelo?.slice(0, 100) ?? null,
            },
        });
    } catch (erro) {
        console.error("Falha ao registrar login:", erro);
    }
}
