-- AlterTable
ALTER TABLE `admins` ADD COLUMN `cnpj` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `admins_cnpj_key` ON `admins`(`cnpj`);
