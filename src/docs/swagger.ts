// Especificação OpenAPI 3.0 da API de Finanças.
// Servida via Swagger UI em GET /docs (ver src/server.ts).

const swaggerSpec = {
    openapi: "3.0.3",
    info: {
        title: "Finanças API",
        version: "1.0.0",
        description:
            "API de gerenciamento financeiro multiempresa. Autentique em /auth/login (empresa, por CNPJ ou e-mail) ou /auth/admin/login (admin) e envie o token no header Authorization: Bearer. " +
            "A empresa opera sempre sobre os próprios dados (o tenant vem do token). " +
            "O admin lê e escreve os dados de qualquer empresa: liste-as em GET /empresas e, ao acessar uma, envie o ID dela no header X-Empresa-Id em todas as chamadas de dados (contas, categorias, fornecedores/clientes e lançamentos).",
    },
    servers: [
        {
            url: "http://localhost:9090",
            description: "Servidor local de desenvolvimento",
        },
    ],
    tags: [
        { name: "Autenticação", description: "Login de empresa e administrador" },
        { name: "Empresas", description: "Cadastro de empresas (somente admin)" },
        { name: "Contas", description: "Tipos de conta" },
        { name: "Categorias", description: "Categorias de lançamentos" },
        {
            name: "Fornecedores/Clientes",
            description: "Fornecedores e clientes e seus saldos",
        },
        {
            name: "Lançamentos",
            description: "Lançamentos financeiros (entradas e saídas)",
        },
    ],
    components: {
        schemas: {
            Conta: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    nome: { type: "string", example: "Conta Corrente" },
                },
            },
            Categoria: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    nome: { type: "string", example: "Alimentação" },
                },
            },
            FornecedorCliente: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    nome: { type: "string", example: "Mercado Central" },
                    // Prisma Decimal é serializado como string no JSON.
                    saldo: { type: "string", example: "150.00" },
                    ativo: { type: "boolean", example: true },
                    criadoEm: { type: "string", format: "date-time" },
                    atualizadoEm: { type: "string", format: "date-time" },
                },
            },
            Lancamento: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    dataLancamento: { type: "string", format: "date-time" },
                    tipo: {
                        type: "string",
                        enum: ["ENTRADA", "SAIDA"],
                        example: "ENTRADA",
                    },
                    valor: { type: "string", example: "100.00" },
                    classificacao: {
                        type: "string",
                        nullable: true,
                        example: "Fixo",
                    },
                    observacao: {
                        type: "string",
                        nullable: true,
                        example: "Pagamento mensal",
                    },
                    fornecedorClienteId: { type: "integer", example: 1 },
                    contaId: { type: "integer", example: 2 },
                    categoriaId: { type: "integer", example: 3 },
                    criadoEm: { type: "string", format: "date-time" },
                    atualizadoEm: { type: "string", format: "date-time" },
                },
            },
            LancamentoComRelacoes: {
                allOf: [
                    { $ref: "#/components/schemas/Lancamento" },
                    {
                        type: "object",
                        properties: {
                            fornecedorCliente: {
                                type: "object",
                                properties: {
                                    id: { type: "integer", example: 1 },
                                    nome: { type: "string", example: "Mercado Central" },
                                    saldo: { type: "string", example: "150.00" },
                                },
                            },
                            conta: {
                                type: "object",
                                nullable: true,
                                properties: {
                                    id: { type: "integer", example: 2 },
                                    nome: { type: "string", example: "Conta Corrente" },
                                },
                            },
                            categoria: {
                                type: "object",
                                nullable: true,
                                properties: {
                                    id: { type: "integer", example: 3 },
                                    nome: { type: "string", example: "Alimentação" },
                                },
                            },
                        },
                    },
                ],
            },
            Empresa: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    cnpj: { type: "string", example: "11222333000181" },
                    razaoSocial: { type: "string", example: "Comércio Alfa LTDA" },
                    nomeFantasia: { type: "string", nullable: true },
                    inscricaoEstadual: { type: "string", nullable: true },
                    inscricaoMunicipal: { type: "string", nullable: true },
                    endereco: { type: "string", nullable: true },
                    email: { type: "string", example: "alfa@empresa.com" },
                    ativo: { type: "boolean", example: true },
                    criadoEm: { type: "string", format: "date-time" },
                    atualizadoEm: { type: "string", format: "date-time" },
                },
            },
            Mensagem: {
                type: "object",
                properties: {
                    message: { type: "string" },
                },
            },
            Erro: {
                type: "object",
                properties: {
                    message: { type: "string" },
                    error: {},
                },
            },
        },
    },
    paths: {
        "/auth/login": {
            post: {
                tags: ["Autenticação"],
                summary: "Login da empresa (CNPJ ou e-mail)",
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["identificador", "senha"],
                                properties: {
                                    identificador: {
                                        type: "string",
                                        example: "11222333000181",
                                        description: "CNPJ ou e-mail da empresa",
                                    },
                                    senha: { type: "string", example: "empresa123" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Autenticado (retorna token e dados da empresa)",
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    401: { description: "Credenciais inválidas" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/auth/admin/login": {
            post: {
                tags: ["Autenticação"],
                summary: "Login do administrador global",
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["email", "senha"],
                                properties: {
                                    email: { type: "string", example: "admin@sistema.com" },
                                    senha: { type: "string", example: "admin123" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: "Autenticado (retorna token)" },
                    400: { $ref: "#/components/responses/Validacao" },
                    401: { description: "Credenciais inválidas" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/empresas": {
            get: {
                tags: ["Empresas"],
                summary: "Lista empresas (somente admin)",
                responses: {
                    200: {
                        description: "Lista de empresas",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/Empresa" },
                                },
                            },
                        },
                    },
                    403: { description: "Acesso restrito ao administrador" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            post: {
                tags: ["Empresas"],
                summary: "Cadastra uma empresa (somente admin)",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["cnpj", "razaoSocial", "email", "senha"],
                                properties: {
                                    cnpj: { type: "string", example: "11222333000181" },
                                    razaoSocial: { type: "string", example: "Comércio Alfa LTDA" },
                                    nomeFantasia: { type: "string", example: "Alfa Comércio" },
                                    inscricaoEstadual: { type: "string" },
                                    inscricaoMunicipal: { type: "string" },
                                    endereco: { type: "string" },
                                    email: { type: "string", example: "alfa@empresa.com" },
                                    senha: { type: "string", example: "empresa123" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: "Empresa criada com sucesso" },
                    400: { $ref: "#/components/responses/Validacao" },
                    403: { description: "Acesso restrito ao administrador" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/empresas/{id}": {
            parameters: [
                { name: "id", in: "path", required: true, schema: { type: "integer" } },
            ],
            get: {
                tags: ["Empresas"],
                summary: "Detalha uma empresa (somente admin)",
                responses: {
                    200: {
                        description: "Empresa",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/Empresa" },
                            },
                        },
                    },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            put: {
                tags: ["Empresas"],
                summary: "Atualiza uma empresa (somente admin)",
                description:
                    "Envie apenas os campos a alterar. 'ativo: false' desliga a empresa.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    cnpj: { type: "string" },
                                    razaoSocial: { type: "string" },
                                    nomeFantasia: { type: "string" },
                                    inscricaoEstadual: { type: "string" },
                                    inscricaoMunicipal: { type: "string" },
                                    endereco: { type: "string" },
                                    email: { type: "string" },
                                    senha: { type: "string" },
                                    ativo: { type: "boolean" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: "Empresa atualizada com sucesso" },
                    400: { $ref: "#/components/responses/Validacao" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            delete: {
                tags: ["Empresas"],
                summary: "Remove uma empresa (somente admin)",
                description:
                    "Bloqueado se houver lançamentos vinculados; nesse caso, desative com ativo=false.",
                responses: {
                    200: { $ref: "#/components/responses/Sucesso" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/contas": {
            parameters: [{ $ref: "#/components/parameters/EmpresaIdHeader" }],
            get: {
                tags: ["Contas"],
                summary: "Lista todas as contas",
                responses: {
                    200: {
                        description: "Lista de contas ordenadas por nome",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/Conta" },
                                },
                            },
                        },
                    },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            post: {
                tags: ["Contas"],
                summary: "Cria uma nova conta",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["nome"],
                                properties: {
                                    nome: { type: "string", example: "Conta Corrente" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: "Conta criada com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        conta: { $ref: "#/components/schemas/Conta" },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/contas/{id}": {
            parameters: [
                { $ref: "#/components/parameters/EmpresaIdHeader" },
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "integer" },
                },
            ],
            put: {
                tags: ["Contas"],
                summary: "Atualiza uma conta",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["nome"],
                                properties: {
                                    nome: { type: "string", example: "Conta Poupança" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Conta atualizada com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        conta: { $ref: "#/components/schemas/Conta" },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            delete: {
                tags: ["Contas"],
                summary: "Exclui uma conta",
                description:
                    "Não é possível excluir uma conta que possui lançamentos vinculados.",
                responses: {
                    200: { $ref: "#/components/responses/Sucesso" },
                    400: { $ref: "#/components/responses/Validacao" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/categorias": {
            parameters: [{ $ref: "#/components/parameters/EmpresaIdHeader" }],
            get: {
                tags: ["Categorias"],
                summary: "Lista todas as categorias",
                responses: {
                    200: {
                        description: "Lista de categorias ordenadas por nome",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/Categoria" },
                                },
                            },
                        },
                    },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            post: {
                tags: ["Categorias"],
                summary: "Cria uma nova categoria",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["nome"],
                                properties: {
                                    nome: { type: "string", example: "Alimentação" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: "Categoria criada com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        categoria: { $ref: "#/components/schemas/Categoria" },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/categorias/{id}": {
            parameters: [
                { $ref: "#/components/parameters/EmpresaIdHeader" },
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "integer" },
                },
            ],
            put: {
                tags: ["Categorias"],
                summary: "Atualiza uma categoria",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["nome"],
                                properties: {
                                    nome: { type: "string", example: "Transporte" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Categoria atualizada com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        categoria: { $ref: "#/components/schemas/Categoria" },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            delete: {
                tags: ["Categorias"],
                summary: "Remove uma categoria",
                description:
                    "Não é possível excluir uma categoria que possui lançamentos vinculados.",
                responses: {
                    200: { $ref: "#/components/responses/Sucesso" },
                    400: { $ref: "#/components/responses/Validacao" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/fornecedores-clientes": {
            parameters: [{ $ref: "#/components/parameters/EmpresaIdHeader" }],
            get: {
                tags: ["Fornecedores/Clientes"],
                summary: "Lista todos os fornecedores/clientes",
                responses: {
                    200: {
                        description: "Lista ordenada por nome",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/FornecedorCliente" },
                                },
                            },
                        },
                    },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            post: {
                tags: ["Fornecedores/Clientes"],
                summary: "Cria um novo fornecedor/cliente",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["nome"],
                                properties: {
                                    nome: { type: "string", example: "Mercado Central" },
                                    saldo: {
                                        type: "number",
                                        description: "Saldo inicial (opcional, padrão 0)",
                                        example: 0,
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: "Fornecedor/cliente criado com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        fornecedorCliente: {
                                            $ref: "#/components/schemas/FornecedorCliente",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/fornecedores-clientes/{id}": {
            parameters: [
                { $ref: "#/components/parameters/EmpresaIdHeader" },
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "integer" },
                },
            ],
            put: {
                tags: ["Fornecedores/Clientes"],
                summary: "Atualiza um fornecedor/cliente",
                description: "Todos os campos são opcionais; envie apenas o que deseja alterar.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    nome: { type: "string", example: "Mercado Central LTDA" },
                                    ativo: { type: "boolean", example: true },
                                    saldo: { type: "number", example: 250.5 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Fornecedor/cliente atualizado com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        fornecedorCliente: {
                                            $ref: "#/components/schemas/FornecedorCliente",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            delete: {
                tags: ["Fornecedores/Clientes"],
                summary: "Remove um fornecedor/cliente",
                description:
                    "Não é possível excluir um fornecedor/cliente com lançamentos vinculados.",
                responses: {
                    200: { $ref: "#/components/responses/Sucesso" },
                    400: { $ref: "#/components/responses/Validacao" },
                    404: { $ref: "#/components/responses/NaoEncontrado" },
                    409: { $ref: "#/components/responses/Conflito" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/lancamentos": {
            parameters: [{ $ref: "#/components/parameters/EmpresaIdHeader" }],
            get: {
                tags: ["Lançamentos"],
                summary: "Lista todos os lançamentos",
                description: "Inclui dados de fornecedor/cliente, conta e categoria.",
                responses: {
                    200: {
                        description: "Lista ordenada por data (desc)",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/LancamentoComRelacoes",
                                    },
                                },
                            },
                        },
                    },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            post: {
                tags: ["Lançamentos"],
                summary: "Cria um novo lançamento",
                description:
                    "Cria o lançamento e atualiza o saldo do fornecedor/cliente em uma transação. ENTRADA soma ao saldo; SAIDA subtrai.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: [
                                    "dataLancamento",
                                    "fornecedorClienteId",
                                    "tipo",
                                    "valor",
                                    "contaId",
                                    "categoriaId",
                                ],
                                properties: {
                                    dataLancamento: {
                                        type: "string",
                                        format: "date",
                                        example: "2026-06-27",
                                    },
                                    fornecedorClienteId: { type: "integer", example: 1 },
                                    tipo: {
                                        type: "string",
                                        enum: ["ENTRADA", "SAIDA"],
                                        example: "ENTRADA",
                                    },
                                    valor: { type: "number", example: 100.0 },
                                    contaId: { type: "integer", example: 2 },
                                    classificacao: {
                                        type: "string",
                                        nullable: true,
                                        example: "Fixo",
                                    },
                                    categoriaId: { type: "integer", example: 3 },
                                    observacao: {
                                        type: "string",
                                        nullable: true,
                                        example: "Pagamento mensal",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: "Lançamento criado com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        lancamento: { $ref: "#/components/schemas/Lancamento" },
                                        fornecedorCliente: {
                                            $ref: "#/components/schemas/FornecedorCliente",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/lancamentos/{id}": {
            parameters: [
                { $ref: "#/components/parameters/EmpresaIdHeader" },
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "integer" },
                },
            ],
            patch: {
                tags: ["Lançamentos"],
                summary: "Atualiza parcialmente um lançamento",
                description:
                    "Recalcula o saldo do(s) fornecedor(es)/cliente(s) envolvidos. Envie apenas os campos que deseja alterar.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    dataLancamento: { type: "string", format: "date" },
                                    fornecedorClienteId: { type: "integer" },
                                    tipo: { type: "string", enum: ["ENTRADA", "SAIDA"] },
                                    valor: { type: "number" },
                                    contaId: { type: "integer" },
                                    classificacao: { type: "string", nullable: true },
                                    categoriaId: { type: "integer" },
                                    observacao: { type: "string", nullable: true },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Lançamento atualizado com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        lancamento: { $ref: "#/components/schemas/Lancamento" },
                                        fornecedorCliente: {
                                            $ref: "#/components/schemas/FornecedorCliente",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
            delete: {
                tags: ["Lançamentos"],
                summary: "Exclui um lançamento",
                description:
                    "Desfaz o efeito do lançamento no saldo do fornecedor/cliente em uma transação.",
                responses: {
                    200: {
                        description: "Lançamento deletado com sucesso",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        message: { type: "string" },
                                        lancamento: { $ref: "#/components/schemas/Lancamento" },
                                        fornecedorCliente: {
                                            $ref: "#/components/schemas/FornecedorCliente",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/lancamentos/filtros": {
            parameters: [{ $ref: "#/components/parameters/EmpresaIdHeader" }],
            get: {
                tags: ["Lançamentos"],
                summary: "Filtra lançamentos e retorna um resumo",
                parameters: [
                    {
                        name: "clienteId",
                        in: "query",
                        required: false,
                        schema: { type: "integer" },
                        description: "ID do fornecedor/cliente",
                    },
                    {
                        name: "contaId",
                        in: "query",
                        required: false,
                        schema: { type: "integer" },
                    },
                    {
                        name: "categoriaId",
                        in: "query",
                        required: false,
                        schema: { type: "integer" },
                    },
                    {
                        name: "tipo",
                        in: "query",
                        required: false,
                        schema: {
                            type: "string",
                            enum: ["TODOS", "ENTRADA", "SAIDA"],
                            default: "TODOS",
                        },
                    },
                ],
                responses: {
                    200: {
                        description: "Lançamentos filtrados com filtros aplicados e resumo",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        filtros: {
                                            type: "object",
                                            properties: {
                                                clienteId: { type: "integer", nullable: true },
                                                contaId: { type: "integer", nullable: true },
                                                categoriaId: { type: "integer", nullable: true },
                                                tipo: { type: "string", example: "TODOS" },
                                            },
                                        },
                                        resumo: {
                                            type: "object",
                                            properties: {
                                                totalRegistros: { type: "integer" },
                                                totalEntradas: { type: "number" },
                                                totalSaidas: { type: "number" },
                                                saldoCalculado: { type: "number" },
                                            },
                                        },
                                        lancamentos: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/LancamentoComRelacoes",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/Validacao" },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
        "/lancamentos/resumo": {
            parameters: [{ $ref: "#/components/parameters/EmpresaIdHeader" }],
            get: {
                tags: ["Lançamentos"],
                summary: "Resumo geral dos lançamentos",
                responses: {
                    200: {
                        description: "Totais de entradas, saídas e saldo final",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        resumo: {
                                            type: "object",
                                            properties: {
                                                totalEntradas: { type: "number" },
                                                totalSaidas: { type: "number" },
                                                saldoFinal: { type: "number" },
                                                quantidadeEntradas: { type: "integer" },
                                                quantidadeSaidas: { type: "integer" },
                                                totalRegistros: { type: "integer" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    500: { $ref: "#/components/responses/ErroInterno" },
                },
            },
        },
    },
};

// Parâmetros reutilizáveis.
(swaggerSpec.components as Record<string, unknown>).parameters = {
    EmpresaIdHeader: {
        name: "X-Empresa-Id",
        in: "header",
        required: false,
        schema: { type: "integer", example: 2 },
        description:
            "Empresa-alvo da requisição. Obrigatório para o ADMIN (define qual empresa ele está acessando para ler/escrever). " +
            "Ignorado para EMPRESA, que sempre opera sobre a própria empresa do token. " +
            "Alternativamente pode ser enviado como query string ?empresaId=.",
    },
};

// Respostas reutilizáveis. Declaradas aqui e anexadas abaixo para
// manter os $ref de paths legíveis.
(swaggerSpec.components as Record<string, unknown>).responses = {
    Sucesso: {
        description: "Operação realizada com sucesso",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Mensagem" },
            },
        },
    },
    Validacao: {
        description: "Requisição inválida (dados obrigatórios ausentes ou inválidos)",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Mensagem" },
            },
        },
    },
    NaoEncontrado: {
        description: "Recurso não encontrado",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Mensagem" },
            },
        },
    },
    Conflito: {
        description: "Conflito (nome duplicado ou vínculo existente)",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Mensagem" },
            },
        },
    },
    ErroInterno: {
        description: "Erro interno do servidor",
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/Erro" },
            },
        },
    },
};

// Esquema de segurança Bearer (JWT) e exigência global de autenticação.
// As rotas públicas de /auth sobrescrevem com `security: []`.
(swaggerSpec.components as Record<string, unknown>).securitySchemes = {
    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
};

(swaggerSpec as Record<string, unknown>).security = [{ bearerAuth: [] }];

export { swaggerSpec };
