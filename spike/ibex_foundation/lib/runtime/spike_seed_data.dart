import 'package:drift/drift.dart';

import '../core/text/arabic_search_normalizer.dart';
import '../database/spike_database.dart';
import 'spike_runtime_config.dart';

class SpikeSeedData {
  const SpikeSeedData._();

  static Future<void> ensureSeeded(
    SpikeDatabase db, {
    SpikeRuntimeConfig config = const SpikeRuntimeConfig(),
  }) async {
    final now = DateTime.now().toUtc();
    await db.transaction(() async {
      await db.into(db.warehouses).insertOnConflictUpdate(
            WarehousesCompanion.insert(
              id: config.defaultWarehouseId,
              businessId: config.businessId,
              name: 'المستودع الرئيسي',
              normalizedName: ArabicSearchNormalizer.normalize('المستودع الرئيسي'),
              updatedAt: now,
            ),
          );

      await db.into(db.customers).insertOnConflictUpdate(
            CustomersCompanion.insert(
              id: 'CUSTOMER-GENERAL',
              businessId: config.businessId,
              name: 'زبون عام',
              normalizedName: ArabicSearchNormalizer.normalize('زبون عام'),
              updatedAt: now,
            ),
          );
      await db.into(db.customers).insertOnConflictUpdate(
            CustomersCompanion.insert(
              id: 'CUSTOMER-MOHAMMED-BAHAKAM',
              businessId: config.businessId,
              name: 'محمد عبدالله باحكم',
              normalizedName: ArabicSearchNormalizer.normalize('محمد عبدالله باحكم'),
              updatedAt: now,
            ),
          );

      await db.into(db.products).insertOnConflictUpdate(
            ProductsCompanion.insert(
              id: 'PRODUCT-SIDR-1KG',
              businessId: config.businessId,
              sku: const Value('SIDR-1KG'),
              name: 'سدر — عبوة كيلو',
              normalizedName: ArabicSearchNormalizer.normalize('سدر عبوة كيلو'),
              updatedAt: now,
            ),
          );
      await db.into(db.units).insertOnConflictUpdate(
            UnitsCompanion.insert(
              id: 'UNIT-GALLON',
              name: 'جالون',
              normalizedName: ArabicSearchNormalizer.normalize('جالون'),
              quantityPrecision: 0,
            ),
          );
      await db.into(db.productUnits).insertOnConflictUpdate(
            const ProductUnitsCompanion(
              productId: Value('PRODUCT-SIDR-1KG'),
              unitId: Value('UNIT-GALLON'),
              conversionFactorScaled: Value(1000000),
              isBase: Value(true),
            ),
          );

      final balance = await (db.select(db.inventoryBalances)
            ..where((row) =>
                row.warehouseId.equals(config.defaultWarehouseId) &
                row.productId.equals('PRODUCT-SIDR-1KG')))
          .getSingleOrNull();
      if (balance == null) {
        await db.into(db.inventoryBalances).insert(
              InventoryBalancesCompanion.insert(
                warehouseId: config.defaultWarehouseId,
                productId: 'PRODUCT-SIDR-1KG',
                quantityScaled: 100 * 1000000,
                inventoryValueScaled: 250000 * 10000,
                wacUnitCostScaled: 2500 * 10000,
                updatedAt: now,
              ),
            );
      }
    });
  }
}
