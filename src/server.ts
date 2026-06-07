import express from "express";
import cors from "cors";

import contasRouter from "./routes/contas.js";
import classificacoesRouter from "./routes/classificacoes.js";
import categoriasRouter from "./routes/categorias.js";
import fornecedoresClientesRouter from "./routes/fornecedoresClientes.js";
import lancamentosRouter from "./routes/lancamentos.js";

const app = express();
const port = 9090;

app.use(express.json());
app.use(cors());

app.use("/contas", contasRouter);
app.use("/classificacoes", classificacoesRouter);
app.use("/categorias", categoriasRouter);
app.use("/fornecedores-clientes", fornecedoresClientesRouter);
app.use("/lancamentos", lancamentosRouter);

app.listen(port, () => {
    console.log("Servidor rodando na porta: " + port);
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
});