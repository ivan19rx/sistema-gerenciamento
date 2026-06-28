/*
  Warnings:

  - Made the column `conta_id` on table `lancamentos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `categoria_id` on table `lancamentos` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `lancamentos` DROP FOREIGN KEY `lancamentos_categoria_id_fkey`;

-- DropForeignKey
ALTER TABLE `lancamentos` DROP FOREIGN KEY `lancamentos_conta_id_fkey`;

-- DropIndex
DROP INDEX `lancamentos_categoria_id_fkey` ON `lancamentos`;

-- DropIndex
DROP INDEX `lancamentos_conta_id_fkey` ON `lancamentos`;

-- AlterTable
ALTER TABLE `lancamentos` MODIFY `conta_id` INTEGER NOT NULL,
    MODIFY `categoria_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_conta_id_fkey` FOREIGN KEY (`conta_id`) REFERENCES `contas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
