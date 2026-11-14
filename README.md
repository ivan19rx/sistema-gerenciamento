# sistema-gerenciamento (API)

API do sistema de gestão financeira multiempresa: Express 5 + Prisma 7 + MySQL,
em TypeScript. O frontend fica no repositório
[front-gerenciamento](https://github.com/ivan19rx/front-gerenciamento).

| Onde | Como roda |
| --- | --- |
| Local | `npm run dev` → http://localhost:9090 (documentação em http://localhost:9090/docs) |
| Produção | Render, deploy automático a cada push na branch `main` |
| Banco | MySQL no Railway |

---

## 1. Primeira vez (máquina nova ou clone novo)

```bash
npm install
```

Crie o `.env` a partir do modelo e preencha os valores (banco, `JWT_SECRET` etc.):

```bash
cp .env.example .env
```

Gere o cliente do Prisma (a pasta `generated/` não vai para o Git):

```bash
npx prisma generate
```

Suba a API:

```bash
npm run dev
```

> O `.env` precisa das **duas** formas de apontar para o banco, e as duas devem
> apontar para o **mesmo** banco:
> - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`,
>   `DATABASE_NAME`: usadas pela API em execução (`lib/prisma.ts`).
> - `DATABASE_URL`: usada pelos comandos `npx prisma ...` (migrations).

---

## 2. Comandos do dia a dia

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe a API em modo desenvolvimento; reinicia sozinha ao salvar um arquivo |
| `npm run build` | `prisma generate` + compila o TypeScript para `dist/` |
| `npm start` | Roda a versão compilada (`dist/src/server.js`); use depois do build |
| `npx tsc --noEmit` | Só confere os tipos, sem gerar arquivos |
| `npx prisma generate` | Regera o cliente do Prisma a partir do `schema.prisma` |
| `npx prisma migrate status` | Mostra quais migrations já foram aplicadas no banco do `.env` |
| `npx prisma studio` | Abre uma interface web para ver/editar o banco do `.env` |
| `npm run seed:admin` | Cria/atualiza os administradores (não apaga nada) |
| `npm run seed` | ⚠️ **Apaga todos os dados** e recria dados de teste |

---

## 3. Quando você alterar a API

### Caso A: mudou só código (rotas, regras, validações), sem mexer no banco

1. Teste local:
   ```bash
   npm run dev
   ```
2. Confira se compila (é o mesmo que o Render vai rodar):
   ```bash
   npm run build
   ```
3. Envie:
   ```bash
   git add .
   git commit -m "descrição da mudança"
   git push
   ```
4. O Render faz o deploy sozinho em alguns minutos. Acompanhe em
   dashboard.render.com → serviço `sistema-gerenciamento` → **Events / Logs**.

Se criou ou mudou uma rota, atualize também a documentação em
`src/docs/swagger.ts` (ela é escrita à mão).

### Caso B: mudou o banco (`prisma/schema.prisma`: tabela, coluna, índice, enum)

1. Edite o `prisma/schema.prisma`.
2. Crie a migration (gera o SQL em `prisma/migrations/` e aplica no banco do `.env`):
   ```bash
   npx prisma migrate dev --name descricao_curta
   ```
   Exemplo: `npx prisma migrate dev --name add_telefone_cliente`
3. O comando acima já roda o `prisma generate`. Ajuste o código que usa as
   tabelas novas e teste com `npm run dev`.
4. Confira a compilação:
   ```bash
   npm run build
   ```
5. Envie **o schema e a pasta da migration** juntos:
   ```bash
   git add prisma/schema.prisma prisma/migrations
   git add .
   git commit -m "descrição da mudança no banco"
   git push
   ```
6. No deploy, o Render roda `npx prisma migrate deploy`, que aplica no banco de
   produção só as migrations que ainda faltam.

> ⚠️ **Atenção ao banco do `.env`.** O `migrate dev` aplica a migration no banco
> configurado no `.env`. Se o `.env` estiver apontando para o banco de produção
> (Railway), a mudança vai direto para produção, e se o Prisma detectar
> diferenças entre o banco e as migrations ele pode **pedir para resetar
> o banco (apagando tudo)**. Nunca confirme um reset nesse caso.
>
> O mais seguro é ter um MySQL local para desenvolvimento e apontar o `.env`
> para ele enquanto cria migrations.

Alternativa para revisar o SQL antes de aplicar:

```bash
npx prisma migrate dev --create-only --name descricao_curta
```

Revise o arquivo gerado em `prisma/migrations/<data>_descricao_curta/migration.sql`
e depois aplique:

```bash
npx prisma migrate deploy
```

### Caso C: a mudança na API muda o que o frontend recebe ou envia

Ex.: campo novo na resposta, campo renomeado, rota nova.

1. Faça o deploy da **API primeiro** (casos A ou B).
2. Depois atualize e publique o frontend (veja o README do `front-gerenciamento`).

Se o front for publicado antes, ele pode chamar uma rota ou campo que a API em
produção ainda não tem.

### Caso D: atualizou dependências (`npm install pacote` ou `npm update`)

```bash
npm install
npm run build
git add package.json package-lock.json
git commit -m "atualiza dependências"
git push
```

Se atualizou o `prisma` ou o `@prisma/client`, rode também `npx prisma generate`
e mantenha os dois na mesma versão.

### Caso E: precisa criar ou trocar a senha de um administrador

1. Copie o modelo (só na primeira vez):
   ```bash
   cp prisma/seedAdmin.example.ts prisma/seedAdmin.ts
   ```
2. Edite a lista `ADMINS` em `prisma/seedAdmin.ts`.
3. Rode:
   ```bash
   npm run seed:admin
   ```

O `prisma/seedAdmin.ts` tem senhas reais e está no `.gitignore`: nunca faça commit dele.

### Caso F: mudou uma variável de ambiente

- **Local:** edite o `.env` e reinicie o `npm run dev`.
- **Produção:** Render → serviço → **Environment** → edite e salve. O Render
  reinicia o serviço sozinho. Não é preciso fazer push.
- Variável nova? Adicione também no `.env.example` (sem o valor real).

---

## 4. Deploy no Render (referência)

Configuração do serviço (fica no painel do Render, não no repositório):

- **Build Command:**
  ```
  npm install && npx prisma migrate deploy && npx prisma generate && npm run build
  ```
- **Start Command:** `npm start`
- **Auto-Deploy:** ligado na branch `main`
- **Variáveis:** as mesmas do `.env.example`, com `NODE_ENV=production`,
  `TRUST_PROXY=1` e `CORS_ORIGINS` contendo o domínio do frontend na Vercel.

O arquivo `.npmrc` (`include=dev`) é necessário: com `NODE_ENV=production` o npm
não instalaria TypeScript, `@types/*` e o CLI do Prisma, e o build falharia.
**Não apague esse arquivo.**

Para refazer um deploy sem mudar código: Render → serviço → **Manual Deploy →
Deploy latest commit**.

O plano gratuito do Render "dorme" após ~15 min sem uso. A primeira requisição
depois disso demora de 30 a 60 s; o frontend já tenta de novo sozinho.

---

## 5. Problemas comuns

| Sintoma | Causa provável / solução |
| --- | --- |
| `Cannot find module '../generated/prisma/client.js'` | Falta gerar o cliente: `npx prisma generate` |
| `JWT_SECRET não configurado` | Falta `JWT_SECRET` no `.env` (ou no Render) |
| `Variáveis de ambiente do banco não configuradas` | Falta alguma `DATABASE_*` no `.env` |
| Todas as rotas dão 500 / `pool timeout` | Banco inacessível ou credenciais erradas nas `DATABASE_*` |
| Front dá erro de CORS | Adicione a origem do front em `CORS_ORIGINS` |
| Build falha no Render em `tsc` ou `prisma` | Confira se o `.npmrc` com `include=dev` está no repositório |
| Deploy falha em `prisma migrate deploy` | Migration com erro de SQL ou banco fora do ar; veja o log do deploy |
