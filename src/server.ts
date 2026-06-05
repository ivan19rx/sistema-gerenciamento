import { prisma } from "../lib/prisma";

import express from 'express'
import cors from 'cors'

const app = express()
app.use(express.json())
app.use(cors())

const port = 9090

app.get("/listarcontas", async (req, res) => {
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

app.post("/newcontatype", async (req, res) => {
    try {
        const { nome } = req.body;

        if (!nome) {
            return res.status(400).json({
                message: "O campo nome é obrigatório",
            });
        }

        const contaExistente = await prisma.conta.findUnique({
            where: {
                nome: nome,
            },
        });

        if (contaExistente) {
            return res.status(409).json({
                message: "Essa conta já existe",
            });
        }

        const novaConta = await prisma.conta.create({
            data: {
                nome: nome,
            },
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

app.put("/contas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome } = req.body;

        if (!nome) {
            return res.status(400).json({
                message: "O nome é obrigatório",
            });
        }

        // Verifica se a conta existe
        const conta = await prisma.conta.findUnique({
            where: { id },
        });

        if (!conta) {
            return res.status(404).json({
                message: "Conta não encontrada",
            });
        }

        // Verifica se já existe OUTRA conta com esse nome
        const contaExistente = await prisma.conta.findFirst({
            where: {
                nome,
                id: {
                    not: id,
                },
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

app.delete("/contas/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const conta = await prisma.conta.findUnique({
            where: { id },
            include: {
                lancamentos: true,
            },
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


app.get("/classificacoes", async (req, res) => {
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

app.post("/classificacoes", async (req, res) => {
    try {
        const { nome } = req.body;

        if (!nome || nome.trim() === "") {
            return res.status(400).json({
                message: "O nome da classificação é obrigatório",
            });
        }

        const classificacaoExistente = await prisma.classificacao.findUnique({
            where: {
                nome: nome.trim(),
            },
        });

        if (classificacaoExistente) {
            return res.status(409).json({
                message: "Já existe uma classificação com esse nome",
            });
        }

        const classificacao = await prisma.classificacao.create({
            data: {
                nome: nome.trim(),
            },
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

app.put("/classificacoes/:id", async (req, res) => {
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
                id: {
                    not: id,
                },
            },
        });

        if (classificacaoExistente) {
            return res.status(409).json({
                message: "Já existe uma classificação com esse nome",
            });
        }

        const classificacaoAtualizada = await prisma.classificacao.update({
            where: { id },
            data: {
                nome: nome.trim(),
            },
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

app.delete("/classificacoes/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const classificacaoExistente = await prisma.classificacao.findUnique({
            where: {
                id,
            },
        });

        if (!classificacaoExistente) {
            return res.status(404).json({
                message: "Classificação não encontrada",
            });
        }

        await prisma.classificacao.delete({
            where: {
                id,
            },
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

app.get("/categorias", async (req, res) => {
    try {
        const categorias = await prisma.categoria.findMany({
            select: {
                id: true,
                nome: true
            },
            orderBy: {
                nome: "asc",
            },
        });

        if (categorias.length === 0) {
            return res.status(404).json({
                message: "Nenhuma categoria cadastrada",
            });
        }


        return res.status(200).json(categorias);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar categorias",
            error,
        });
    }
});

app.post("/categorias", async (req, res) => {
    try {
        const { nome } = req.body;

        if (!nome || nome.trim() === "") {
            return res.status(400).json({
                message: "O nome da categoria é obrigatório",
            });
        }

        const nomeFormatado = nome.trim();

        const categoriaExistente = await prisma.categoria.findUnique({
            where: {
                nome: nomeFormatado,
            },
        });

        if (categoriaExistente) {
            return res.status(409).json({
                message: "Já existe uma categoria com esse nome",
            });
        }

        const categoria = await prisma.categoria.create({
            data: {
                nome: nomeFormatado,
            },
        });

        return res.status(201).json({
            message: "Categoria criada com sucesso",
            categoria,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao criar categoria",
            error,
        });
    }
});

app.put("/categorias/:id", async (req, res) => {
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
                message: "O nome da categoria é obrigatório",
            });
        }

        const nomeFormatado = nome.trim();

        const categoria = await prisma.categoria.findUnique({
            where: { id },
        });

        if (!categoria) {
            return res.status(404).json({
                message: "Categoria não encontrada",
            });
        }

        const categoriaExistente = await prisma.categoria.findFirst({
            where: {
                nome: nomeFormatado,
                id: {
                    not: id,
                },
            },
        });

        if (categoriaExistente) {
            return res.status(409).json({
                message: "Já existe uma categoria com esse nome",
            });
        }

        const categoriaAtualizada = await prisma.categoria.update({
            where: { id },
            data: {
                nome: nomeFormatado,
            },
        });

        return res.status(200).json({
            message: "Categoria atualizada com sucesso",
            categoria: categoriaAtualizada,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao atualizar categoria",
            error,
        });
    }
});

app.delete("/categorias/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const categoria = await prisma.categoria.findUnique({
            where: { id },
            include: {
                lancamentos: true,
            },
        });

        if (!categoria) {
            return res.status(404).json({
                message: "Categoria não encontrada",
            });
        }

        if (categoria.lancamentos.length > 0) {
            return res.status(409).json({
                message: "Não é possível excluir uma categoria que possui lançamentos vinculados",
            });
        }

        await prisma.categoria.delete({
            where: { id },
        });

        return res.status(200).json({
            message: "Categoria removida com sucesso",
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao remover categoria",
            error,
        });
    }
});

app.get("/fornecedores-clientes", async (req, res) => {
    try {
        const fornecedoresClientes = await prisma.fornecedorCliente.findMany({
            orderBy: {
                nome: "asc",
            },
        });

        return res.status(200).json(fornecedoresClientes);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar fornecedores/clientes",
            error,
        });
    }
});

app.post("/fornecedores-clientes", async (req, res) => {
    try {
        const { nome } = req.body;

        if (!nome || nome.trim() === "") {
            return res.status(400).json({
                message: "O nome é obrigatório",
            });
        }

        const nomeFormatado = nome.trim();

        const existente = await prisma.fornecedorCliente.findUnique({
            where: {
                nome: nomeFormatado,
            },
        });

        if (existente) {
            return res.status(409).json({
                message: "Já existe um fornecedor/cliente com esse nome",
            });
        }

        const fornecedorCliente = await prisma.fornecedorCliente.create({
            data: {
                nome: nomeFormatado,
            },
        });

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

app.put("/fornecedores-clientes/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nome, ativo } = req.body;

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
                    id: {
                        not: id,
                    },
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

app.delete("/fornecedores-clientes/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID inválido",
            });
        }

        const fornecedorCliente = await prisma.fornecedorCliente.findUnique({
            where: { id },
            include: {
                lancamentos: true,
            },
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

app.post("/lancamentos", async (req, res) => {
    try {
        const {
            dataLancamento,
            fornecedorClienteId,
            tipo,
            valor,
            contaId,
            classificacaoId,
            categoriaId,
            observacao,
        } = req.body;

        if (!dataLancamento || !fornecedorClienteId || !tipo || !valor) {
            return res.status(400).json({
                message: "Data, fornecedor/cliente, tipo e valor são obrigatórios",
            });
        }

        if (!["ENTRADA", "SAIDA"].includes(tipo)) {
            return res.status(400).json({
                message: "Tipo inválido. Use ENTRADA ou SAIDA",
            });
        }

        if (Number(valor) <= 0) {
            return res.status(400).json({
                message: "O valor deve ser maior que zero",
            });
        }

        const resultado = await prisma.$transaction(async (tx) => {
            const fornecedorCliente = await tx.fornecedorCliente.findUnique({
                where: { id: Number(fornecedorClienteId) },
            });

            if (!fornecedorCliente) {
                throw new Error("Fornecedor/cliente não encontrado");
            }

            const saldoAtual = Number(fornecedorCliente.saldo);

            const novoSaldo =
                tipo === "ENTRADA"
                    ? saldoAtual + Number(valor)
                    : saldoAtual - Number(valor);

            const lancamento = await tx.lancamento.create({
                data: {
                    dataLancamento: new Date(dataLancamento),
                    fornecedorClienteId: Number(fornecedorClienteId),
                    tipo,
                    valor,
                    contaId: contaId ? Number(contaId) : null,
                    classificacaoId: classificacaoId ? Number(classificacaoId) : null,
                    categoriaId: categoriaId ? Number(categoriaId) : null,
                    observacao,
                },
            });

            const fornecedorClienteAtualizado = await tx.fornecedorCliente.update({
                where: { id: Number(fornecedorClienteId) },
                data: {
                    saldo: novoSaldo,
                },
            });

            return {
                lancamento,
                fornecedorCliente: fornecedorClienteAtualizado,
            };
        });

        return res.status(201).json({
            message: "Lançamento criado com sucesso",
            ...resultado,
        });
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao criar lançamento",
            error: error instanceof Error ? error.message : error,
        });
    }
});

app.get("/lancamentos", async (req, res) => {
    try {
        const lancamentos = await prisma.lancamento.findMany({
            include: {
                fornecedorCliente: {
                    select: {
                        id: true,
                        nome: true,
                        saldo: true,
                    },
                },
                conta: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                classificacao: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                categoria: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
            orderBy: [
                {
                    dataLancamento: "desc",
                },
                {
                    id: "desc",
                },
            ],
        });

        return res.status(200).json(lancamentos);
    } catch (error) {
        return res.status(500).json({
            message: "Erro ao buscar lançamentos",
            error,
        });
    }
});


app.listen(port, () => {
    console.log("servidor roddndo na porta: " + port)
})