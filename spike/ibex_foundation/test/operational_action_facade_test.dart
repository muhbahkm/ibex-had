import 'package:flutter_test/flutter_test.dart';
import 'package:ibex_foundation_spike/agent/command_registry.dart';
import 'package:ibex_foundation_spike/agent/operational_action_facade.dart';
import 'package:ibex_foundation_spike/database/spike_database.dart';
import 'package:ibex_foundation_spike/operating_engine/pay_supplier_command.dart';
import 'package:ibex_foundation_spike/operating_engine/pay_supplier_service.dart';
import 'package:ibex_foundation_spike/operating_engine/post_purchase_service.dart';
import 'package:ibex_foundation_spike/operating_engine/post_sale_return_service.dart';
import 'package:ibex_foundation_spike/operating_engine/transfer_stock_service.dart';

void main() {
  test('unregistered write is rejected before an engine can mutate truth', () async {
    final db = SpikeDatabase.inMemory();
    addTearDown(db.close);
    final facade = OperationalActionFacade(
      registry: const AgentCommandRegistry({}),
      postPurchase: PostPurchaseService(db),
      paySupplier: PaySupplierService(db),
      transferStock: TransferStockService(db),
      postSaleReturn: PostSaleReturnService(db),
    );

    final command = PaySupplierCommand(
      operationId: 'OP-BLOCKED',
      businessId: 'B-1',
      userId: 'U-1',
      supplierId: 'SUP-1',
      currencyCode: 'SAR',
      baseCurrencyCode: 'SAR',
      exchangeRateScaled: 100000000,
      amountScaled: 10000,
      cashAccountId: 'CASH-1',
      cashLedgerAccountId: 'ACC-CASH',
      accountsPayableLedgerAccountId: 'ACC-AP',
      paidAt: DateTime.utc(2026, 8, 11),
    );

    await expectLater(facade.executePaySupplier(command), throwsA(isA<Exception>()));
    expect(await db.select(db.supplierPayments).get(), isEmpty);
    expect(await db.select(db.operationLog).get(), isEmpty);
  });
}
