import '../core/errors/domain_error.dart';

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

class SpikeSyntheticFxRateProvider {
  const SpikeSyntheticFxRateProvider();

  /// Synthetic values exist only so the disposable visual/runtime spike can
  /// exercise multi-currency posting end-to-end. Production must replace this
  /// provider with business-configured, date-scoped rates and show the snapshot
  /// in the approval preview.
  int rateScaled({required String from, required String to}) {
    final source = from.trim().toUpperCase();
    final target = to.trim().toUpperCase();
    if (source == target) return 100000000;
    if (target != 'YER') {
      throw const DomainError(
        'FX_RATE_NOT_CONFIGURED',
        'Spike FX provider only targets YER base currency.',
      );
    }
    return switch (source) {
      'SAR' => 425 * 100000000,
      'USD' => 1600 * 100000000,
      _ => throw const DomainError(
          'FX_RATE_NOT_CONFIGURED',
          'No explicit spike FX rate exists for this currency.',
        ),
    };
  }
}
