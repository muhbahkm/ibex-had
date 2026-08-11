import 'package:drift/drift.dart';
import 'package:drift/native.dart';

import 'operational_drafts_table.dart';
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
    OperationalDraftRecords,
  ],
)
class SpikeDatabase extends _$SpikeDatabase {
  SpikeDatabase(QueryExecutor executor) : super(executor);

  factory SpikeDatabase.inMemory() => SpikeDatabase(NativeDatabase.memory());

  @override
  int get schemaVersion => 3;

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
        },
        beforeOpen: (_) async {
          await customStatement('PRAGMA foreign_keys = ON');
        },
      );
}
