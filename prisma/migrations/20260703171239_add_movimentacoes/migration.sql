-- CreateTable
CREATE TABLE `movimentacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `data_movimento` DATETIME(3) NOT NULL,
    `tipo` ENUM('ENTRADA', 'SAIDA') NOT NULL,
    `produto` VARCHAR(191) NULL,
    `quantidade` DECIMAL(10, 2) NULL,
    `preco` DECIMAL(10, 2) NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `valor_detalhado` VARCHAR(191) NULL,
    `nf` VARCHAR(191) NULL,
    `motorista` VARCHAR(191) NULL,
    `veiculo` VARCHAR(191) NULL,
    `transportadora` VARCHAR(191) NULL,
    `descricao` TEXT NULL,
    `empresa_id` INTEGER NOT NULL,
    `fornecedor_cliente_id` INTEGER NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `movimentacoes_empresa_id_data_movimento_idx`(`empresa_id`, `data_movimento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `movimentacoes` ADD CONSTRAINT `movimentacoes_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes` ADD CONSTRAINT `movimentacoes_fornecedor_cliente_id_fkey` FOREIGN KEY (`fornecedor_cliente_id`) REFERENCES `fornecedores_clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
