import 'package:drift/drift.dart';
import 'package:drift/native.dart';

import 'customer_receipts_table.dart';
import 'master_data_tables.dart';
import 'operational_drafts_table.dart';
import 'spike_tables.dart';
import 'supplier_payments_table.dart';

part 'spike_database.g.dart';

@DriftDatabase(
  tables: [
    DocumentSequences,
    OperationLog,
    InventoryBalances,
    Sales,
    SaleItems,
    Purchases,
    PurchaseItems,
    StockMovements,
    StockMovementItems,
    JournalEntries,
    JournalLines,
    Payments,
    PurchasePayments,
    CustomerLedger,
    SupplierLedger,
    CustomerReceipts,
    SupplierPayments,
    AuditLogs,
    OperationalDraftRecords,
    Customers,
    Suppliers,
    Products,
    Units,
    ProductUnits,
    Warehouses,
  ],
)
class SpikeDatabase extends _$SpikeDatabase {
  SpikeDatabase(QueryExecutor executor) : super(executor);

  factory SpikeDatabase.inMemory() => SpikeDatabase(NativeDatabase.memory());

  @override
  int get schemaVersion => 8;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
          await customStatement('PRAGMA foreign_keys = ON');
        },
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.addColumn(sales, sales.baseCurrencyCode);
          }
          if (from < 3) {
            await m.createTable(operationalDraftRecords);
          }
          if (from < 4) {
            await m.createTable(customers);
            await m.createTable(products);
            await m.createTable(units);
            await m.createTable(productUnits);
            await m.createTable(warehouses);
          }
          if (from < 5) {
            await m.addColumn(sales, sales.customerId);
            await m.addColumn(sales, sales.settlementMode);
            await m.createTable(customerLedger);
          }
          if (from < 6) {
            await m.createTable(customerReceipts);
          }
          if (from < 7) {
            await m.createTable(suppliers);
            await m.createTable(purchases);
            await m.createTable(purchaseItems);
            await m.createTable(purchasePayments);
            await m.createTable(supplierLedger);
          }
          if (from < 8) {
            await m.createTable(supplierPayments);
          }
        },
        beforeOpen: (_) async {
          await customStatement('PRAGMA foreign_keys = ON');
        },
      );
}
