import express from "express";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import swaggerUi from "swagger-ui-express";

import authRouter from "./routes/auth.js";
import empresasRouter from "./routes/empresas.js";
import contasRouter from "./routes/contas.js";
import categoriasRouter from "./routes/categorias.js";
import fornecedoresClientesRouter from "./routes/fornecedoresClientes.js";
import lancamentosRouter from "./routes/lancamentos.js";
import movimentacoesRouter from "./routes/movimentacoes.js";
import produtosRouter from "./routes/produtos.js";
import registrosLoginRouter from "./routes/registrosLogin.js";
import registrosRequisicoesRouter from "./routes/registrosRequisicoes.js";
import { registrarRequisicoes, iniciarRegistroRequisicoes } from "./registroRequisicoes.js";
import { swaggerSpec } from "./docs/swagger.js";
import { autenticar, apenasAdmin, resolverEmpresa } from "./auth/middleware.js";
import {
    opcoesCors,
    limiteCorpoJson,
    limitadorGlobal,
    limitadorAutenticacao,
    configurarTrustProxy,
    rotaNaoEncontrada,
    tratadorDeErros,
} from "./seguranca.js";

const app = express();
const port = Number(process.env.PORT) || 9090;

// Não expor a tecnologia do servidor.
app.disable("x-powered-by");

// Permite o rate-limit enxergar o IP real atrás de proxy (configurável).
configurarTrustProxy(app);

// Cabeçalhos de segurança. CSP desligada porque quebraria a UI inline do
// Swagger; como a API serve JSON para um SPA separado, a CSP aqui agrega pouco.
app.use(helmet({ contentSecurityPolicy: false }));

// CORS restrito às origens do frontend (ver CORS_ORIGINS no .env).
app.use(cors(opcoesCors));

// Corpo JSON com limite de tamanho.
app.use(express.json({ limit: limiteCorpoJson }));

// Proteção contra poluição de parâmetros (query/body duplicados).
app.use(hpp());

// Registro de requisições (para o admin). Antes do rate-limit para também
// registrar as requisições bloqueadas por excesso (429).
app.use(registrarRequisicoes);
iniciarRegistroRequisicoes();

// Rate limiting global para todas as rotas.
app.use(limitadorGlobal);

// Documentação Swagger: UI em /docs e JSON em /docs.json
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (req, res) => {
    res.json(swaggerSpec);
});

// Autenticação (público) — com limitador restritivo contra força-bruta.
app.use("/auth", limitadorAutenticacao, authRouter);

// Gestão de empresas: somente o administrador global
app.use("/empresas", autenticar, apenasAdmin, empresasRouter);

// Histórico de logins (com dispositivo): somente o administrador global
app.use("/registros-login", autenticar, apenasAdmin, registrosLoginRouter);
app.use("/registros-requisicoes", autenticar, apenasAdmin, registrosRequisicoesRouter);

// Rotas de dados: exigem autenticação e resolução do tenant (empresa)
app.use("/contas", autenticar, resolverEmpresa, contasRouter);
app.use("/categorias", autenticar, resolverEmpresa, categoriasRouter);
app.use(
    "/fornecedores-clientes",
    autenticar,
    resolverEmpresa,
    fornecedoresClientesRouter,
);
app.use("/lancamentos", autenticar, resolverEmpresa, lancamentosRouter);
app.use("/movimentacoes", autenticar, resolverEmpresa, movimentacoesRouter);
app.use("/produtos", autenticar, resolverEmpresa, produtosRouter);

// 404 para rotas não mapeadas.
app.use(rotaNaoEncontrada);

// Tratador de erro final (não vaza stack trace em produção).
app.use(tratadorDeErros);

app.listen(port, () => {
    console.log("Servidor rodando na porta: " + port);
    console.log(
        "Documentação disponível em: http://localhost:" + port + "/docs",
    );
});
