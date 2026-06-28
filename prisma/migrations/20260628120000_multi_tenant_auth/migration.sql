-- DropIndex
DROP INDEX `categorias_nome_key` ON `categorias`;

-- DropIndex
DROP INDEX `contas_nome_key` ON `contas`;

-- DropIndex
DROP INDEX `fornecedores_clientes_nome_key` ON `fornecedores_clientes`;

-- AlterTable
ALTER TABLE `categorias` ADD COLUMN `empresa_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `contas` ADD COLUMN `empresa_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `fornecedores_clientes` ADD COLUMN `empresa_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `lancamentos` ADD COLUMN `empresa_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cnpj` VARCHAR(191) NOT NULL,
    `razao_social` VARCHAR(191) NOT NULL,
    `nome_fantasia` VARCHAR(191) NULL,
    `inscricao_estadual` VARCHAR(191) NULL,
    `inscricao_municipal` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha` VARCHAR(191) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `empresas_cnpj_key`(`cnpj`),
    UNIQUE INDEX `empresas_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `categorias_empresa_id_nome_key` ON `categorias`(`empresa_id`, `nome`);

-- CreateIndex
CREATE UNIQUE INDEX `contas_empresa_id_nome_key` ON `contas`(`empresa_id`, `nome`);

-- CreateIndex
CREATE UNIQUE INDEX `fornecedores_clientes_empresa_id_nome_key` ON `fornecedores_clientes`(`empresa_id`, `nome`);

-- CreateIndex
CREATE INDEX `lancamentos_empresa_id_data_lancamento_idx` ON `lancamentos`(`empresa_id`, `data_lancamento`);

-- AddForeignKey
ALTER TABLE `fornecedores_clientes` ADD CONSTRAINT `fornecedores_clientes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas` ADD CONSTRAINT `contas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categorias` ADD CONSTRAINT `categorias_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
