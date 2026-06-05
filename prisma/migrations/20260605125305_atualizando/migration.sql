/*
  Warnings:

  - You are about to drop the column `tipo` on the `categorias` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nome]` on the table `categorias` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `categorias_nome_tipo_key` ON `categorias`;

-- AlterTable
ALTER TABLE `categorias` DROP COLUMN `tipo`;

-- CreateIndex
CREATE UNIQUE INDEX `categorias_nome_key` ON `categorias`(`nome`);
