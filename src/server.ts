import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import contasRouter from "./routes/contas.js";
import categoriasRouter from "./routes/categorias.js";
import fornecedoresClientesRouter from "./routes/fornecedoresClientes.js";
import lancamentosRouter from "./routes/lancamentos.js";
import { swaggerSpec } from "./docs/swagger.js";

const app = express();
const port = 9090;

app.use(express.json());
app.use(cors());

// Documentação Swagger: UI em /docs e JSON em /docs.json
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/docs.json", (req, res) => {
    res.json(swaggerSpec);
});

app.use("/contas", contasRouter);
app.use("/categorias", categoriasRouter);
app.use("/fornecedores-clientes", fornecedoresClientesRouter);
app.use("/lancamentos", lancamentosRouter);

app.listen(port, () => {
    console.log("Servidor rodando na porta: " + port);
    console.log("Documentação disponível em: http://localhost:" + port + "/docs");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
});