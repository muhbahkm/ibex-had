class SpikeRuntimeConfig {
  const SpikeRuntimeConfig({
    this.businessId = 'B-LOCAL-DEMO',
    this.userId = 'U-LOCAL-DEMO',
    this.defaultWarehouseId = 'WH-MAIN',
    this.baseCurrencyCode = 'YER',
    this.cashAccountId = 'CASH-MAIN',
    this.cashLedgerAccountId = 'ACC-CASH',
    this.salesRevenueAccountId = 'ACC-SALES',
    this.inventoryLedgerAccountId = 'ACC-INVENTORY',
    this.cogsLedgerAccountId = 'ACC-COGS',
    this.accountsReceivableLedgerAccountId = 'ACC-AR',
  });

  final String businessId;
  final String userId;
  final String defaultWarehouseId;
  final String baseCurrencyCode;
  final String cashAccountId;
  final String cashLedgerAccountId;
  final String salesRevenueAccountId;
  final String inventoryLedgerAccountId;
  final String cogsLedgerAccountId;
  final String accountsReceivableLedgerAccountId;
}
