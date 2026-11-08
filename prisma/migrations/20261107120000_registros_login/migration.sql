-- CreateTable
CREATE TABLE `registros_login` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo_acesso` ENUM('ADMIN', 'EMPRESA') NOT NULL,
    `sucesso` BOOLEAN NOT NULL,
    `motivo` VARCHAR(100) NULL,
    `identificador` VARCHAR(191) NOT NULL,
    `nome_usuario` VARCHAR(191) NULL,
    `admin_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` TEXT NULL,
    `tipo_dispositivo` ENUM('COMPUTADOR', 'CELULAR', 'TABLET', 'DESCONHECIDO') NOT NULL,
    `sistema` VARCHAR(64) NULL,
    `navegador` VARCHAR(64) NULL,
    `modelo` VARCHAR(100) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `registros_login_criado_em_idx`(`criado_em`),
    INDEX `registros_login_empresa_id_criado_em_idx`(`empresa_id`, `criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registros_login` ADD CONSTRAINT `registros_login_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registros_login` ADD CONSTRAINT `registros_login_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

