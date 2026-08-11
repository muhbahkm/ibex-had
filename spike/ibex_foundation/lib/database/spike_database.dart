import 'package:drift/drift.dart';
import 'package:drift/native.dart';

import 'spike_tables.dart';

part 'spike_database.g.dart';

@DriftDatabase(
  tables: [
    DocumentSequences,
    OperationLog,
    InventoryBalances,
    Sales,
    SaleItems,
    StockMovements,
    StockMovementItems,
    JournalEntries,
    JournalLines,
    Payments,
    AuditLogs,
  ],
)
class SpikeDatabase extends _$SpikeDatabase {
  SpikeDatabase(QueryExecutor executor) : super(executor);

  factory SpikeDatabase.inMemory() => SpikeDatabase(NativeDatabase.memory());

  @override
  int get schemaVersion => 2;

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
        },
        beforeOpen: (_) async {
          await customStatement('PRAGMA foreign_keys = ON');
        },
      );
}
