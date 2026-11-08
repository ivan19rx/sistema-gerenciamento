-- CreateTable
CREATE TABLE `registros_requisicoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `metodo` VARCHAR(10) NOT NULL,
    `caminho` VARCHAR(255) NOT NULL,
    `rota` VARCHAR(255) NOT NULL,
    `consulta` VARCHAR(500) NULL,
    `status` SMALLINT NOT NULL,
    `duracao_ms` INTEGER NOT NULL,
    `tipo_acesso` ENUM('ADMIN', 'EMPRESA') NULL,
    `admin_id` INTEGER NULL,
    `empresa_id` INTEGER NULL,
    `ip` VARCHAR(64) NULL,
    `tipo_dispositivo` ENUM('COMPUTADOR', 'CELULAR', 'TABLET', 'DESCONHECIDO') NOT NULL,
    `sistema` VARCHAR(64) NULL,
    `navegador` VARCHAR(64) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `registros_requisicoes_criado_em_idx`(`criado_em`),
    INDEX `registros_requisicoes_empresa_id_criado_em_idx`(`empresa_id`, `criado_em`),
    INDEX `registros_requisicoes_status_criado_em_idx`(`status`, `criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `registros_requisicoes` ADD CONSTRAINT `registros_requisicoes_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `registros_requisicoes` ADD CONSTRAINT `registros_requisicoes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

