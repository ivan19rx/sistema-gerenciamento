/*
  Warnings:

  - You are about to drop the column `classificacao_id` on the `lancamentos` table. All the data in the column will be lost.
  - You are about to drop the `classificacoes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `lancamentos` DROP FOREIGN KEY `lancamentos_classificacao_id_fkey`;

-- DropIndex
DROP INDEX `lancamentos_classificacao_id_fkey` ON `lancamentos`;

-- AlterTable
ALTER TABLE `lancamentos` DROP COLUMN `classificacao_id`,
    ADD COLUMN `classificacao` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `classificacoes`;
