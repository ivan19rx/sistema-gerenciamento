import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import authRouter from "./routes/auth.js";
import empresasRouter from "./routes/empresas.js";
import contasRouter from "./routes/contas.js";
import categoriasRouter from "./routes/categorias.js";
import fornecedoresClientesRouter from "./routes/fornecedoresClientes.js";
import lancamentosRouter from "./routes/lancamentos.js";
import { swaggerSpec } from "./docs/swagger.js";
import { autenticar, apenasAdmin, resolverEmpresa } from "./auth/middleware.js";

const app = express();
const port = Number(process.env.PORT) || 9090;

app.use(express.json());
app.use(cors());

// Documentação Swagger: UI em /docs e JSON em /docs.json
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (req, res) => {
    res.json(swaggerSpec);
});

// Autenticação (público)
app.use("/auth", authRouter);

// Gestão de empresas: somente o administrador global
app.use("/empresas", autenticar, apenasAdmin, empresasRouter);

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

app.listen(port, () => {
    console.log("Servidor rodando na porta: " + port);
    console.log(
        "Documentação disponível em: http://localhost:" + port + "/docs",
    );
});
