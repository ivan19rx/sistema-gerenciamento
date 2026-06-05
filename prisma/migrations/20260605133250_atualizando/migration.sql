/*
  Warnings:

  - You are about to drop the column `fornecedor_cliente` on the `lancamentos` table. All the data in the column will be lost.
  - You are about to drop the column `saldo` on the `lancamentos` table. All the data in the column will be lost.
  - Added the required column `fornecedor_cliente_id` to the `lancamentos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `lancamentos` DROP COLUMN `fornecedor_cliente`,
    DROP COLUMN `saldo`,
    ADD COLUMN `fornecedor_cliente_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `fornecedores_clientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `saldo` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fornecedores_clientes_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_fornecedor_cliente_id_fkey` FOREIGN KEY (`fornecedor_cliente_id`) REFERENCES `fornecedores_clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
