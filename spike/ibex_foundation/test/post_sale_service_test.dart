import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ibex_foundation_spike/database/spike_database.dart';
import 'package:ibex_foundation_spike/operating_engine/post_sale_command.dart';
import 'package:ibex_foundation_spike/operating_engine/post_sale_service.dart';

void main() {
  late SpikeDatabase db;
  late PostSaleService service;

  setUp(() async {
    db = SpikeDatabase.inMemory();
    service = PostSaleService(db);
    await db.into(db.inventoryBalances).insert(
          InventoryBalancesCompanion.insert(
            warehouseId: 'WH-1',
            productId: 'P-1',
            quantityScaled: 10 * 1000000,
            inventoryValueScaled: 500 * 10000,
            wacUnitCostScaled: 50 * 10000,
            updatedAt: DateTime.utc(2026, 8, 11),
          ),
        );
  });

  tearDown(() => db.close());

  PostSaleCommand command({String operationId = 'op-sale-1', int qty = 2 * 1000000}) {
    return PostSaleCommand(
      operationId: operationId,
      businessId: 'B-1',
      userId: 'U-1',
      warehouseId: 'WH-1',
      currencyCode: 'YER',
      baseCurrencyCode: 'YER',
      exchangeRateScaled: 100000000,
      cashAccountId: 'CASH-1',
      cashLedgerAccountId: 'ACC-CASH',
      salesRevenueAccountId: 'ACC-SALES',
      inventoryLedgerAccountId: 'ACC-INV',
      cogsLedgerAccountId: 'ACC-COGS',
      saleAt: DateTime.utc(2026, 8, 11, 10),
      lines: [
        PostSaleLineInput(
          productId: 'P-1',
          quantityScaled: qty,
          unitPriceScaled: 80 * 10000,
        ),
      ],
    );
  }

  test('PostSale atomically creates sale, stock, journal, payment, operation and audit', () async {
    final result = await service.execute(command());

    expect(result.documentNo, 'SAL-2026-000001');
    expect((await db.select(db.sales).get()).length, 1);
    expect((await db.select(db.stockMovements).get()).length, 1);
    expect((await db.select(db.stockMovementItems).get()).length, 1);
    expect((await db.select(db.journalEntries).get()).length, 1);
    expect((await db.select(db.journalLines).get()).length, 4);
    expect((await db.select(db.payments).get()).length, 1);
    expect((await db.select(db.operationLog).get()).length, 1);
    expect((await db.select(db.auditLogs).get()).length, 1);

    final balance = await db.select(db.inventoryBalances).getSingle();
    expect(balance.quantityScaled, 8 * 1000000);
    expect(balance.inventoryValueScaled, 400 * 10000);

    final lines = await db.select(db.journalLines).get();
    final debit = lines.fold<int>(0, (sum, line) => sum + line.baseDebitScaled);
    final credit = lines.fold<int>(0, (sum, line) => sum + line.baseCreditScaled);
    expect(debit, credit);
  });

  test('same operation id is idempotent and does not duplicate truth', () async {
    final first = await service.execute(command());
    final second = await service.execute(command());

    expect(second.idempotentReplay, isTrue);
    expect(second.saleId, first.saleId);
    expect(second.documentNo, first.documentNo);
    expect((await db.select(db.sales).get()).length, 1);
    expect((await db.select(db.payments).get()).length, 1);
    expect((await db.select(db.operationLog).get()).length, 1);
  });

  test('insufficient stock rolls back complete operation', () async {
    await expectLater(
      service.execute(command(operationId: 'op-fail', qty: 11 * 1000000)),
      throwsA(predicate((e) => e.toString().contains('INV_INSUFFICIENT_STOCK'))),
    );

    expect(await db.select(db.sales).get(), isEmpty);
    expect(await db.select(db.stockMovements).get(), isEmpty);
    expect(await db.select(db.journalEntries).get(), isEmpty);
    expect(await db.select(db.payments).get(), isEmpty);
    expect(await db.select(db.operationLog).get(), isEmpty);
    expect(await db.select(db.auditLogs).get(), isEmpty);

    final balance = await db.select(db.inventoryBalances).getSingle();
    expect(balance.quantityScaled, 10 * 1000000);
    expect(balance.inventoryValueScaled, 500 * 10000);
  });
}
