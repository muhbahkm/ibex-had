import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../core/errors/domain_error.dart';
import '../core/value_objects/exchange_rate.dart';
import '../core/value_objects/money.dart';
import '../core/value_objects/scaled_math.dart';
import '../database/spike_database.dart';
import 'document_sequence_service.dart';
import 'post_sale_command.dart';

class PostSaleService {
  PostSaleService(this.db, {Uuid? uuid})
      : _uuid = uuid ?? const Uuid(),
        _sequence = DocumentSequenceService(db);

  final SpikeDatabase db;
  final Uuid _uuid;
  final DocumentSequenceService _sequence;

  Future<PostSaleResult> execute(PostSaleCommand command) async {
    if (command.lines.isEmpty) {
      throw const DomainError('SALE_LINES_REQUIRED', 'Sale requires at least one line.');
    }
    if (command.exchangeRateScaled <= 0) {
      throw const DomainError('FX_RATE_INVALID', 'Exchange rate must be positive.');
    }

    return db.transaction(() async {
      final existingOperation = await (db.select(db.operationLog)
            ..where((t) => t.operationId.equals(command.operationId)))
          .getSingleOrNull();

      if (existingOperation != null) {
        final existingSale = await (db.select(db.sales)
              ..where((t) => t.operationId.equals(command.operationId)))
            .getSingleOrNull();
        if (existingSale == null) {
          throw const DomainError(
            'OPERATION_STATE_CORRUPT',
            'Operation exists without its canonical sale result.',
          );
        }
        final existingPayment = await (db.select(db.payments)
              ..where((t) => t.operationId.equals(command.operationId)))
            .getSingle();
        return PostSaleResult(
          saleId: existingSale.id,
          documentNo: existingSale.documentNo,
          journalEntryId: existingSale.journalEntryId,
          stockMovementId: existingSale.stockMovementId,
          paymentId: existingPayment.id,
          idempotentReplay: true,
        );
      }

      final saleId = _uuid.v4();
      final journalId = _uuid.v4();
      final movementId = _uuid.v4();
      final paymentId = _uuid.v4();
      final now = DateTime.now().toUtc();
      final currency = command.currencyCode.trim().toUpperCase();
      final rate = ExchangeRate.fromScaled(
        scaled: command.exchangeRateScaled,
        fromCurrency: currency,
        toCurrency: 'YER',
      );

      var saleTotalScaled = 0;
      var cogsTotalScaled = 0;
      final lineSnapshots = <_LineSnapshot>[];

      for (final line in command.lines) {
        if (line.quantityScaled <= 0) {
          throw const DomainError('SALE_QTY_INVALID', 'Sale quantity must be positive.');
        }
        if (line.unitPriceScaled < 0) {
          throw const DomainError('SALE_PRICE_INVALID', 'Sale price cannot be negative.');
        }

        final balance = await (db.select(db.inventoryBalances)
              ..where((t) =>
                  t.warehouseId.equals(command.warehouseId) &
                  t.productId.equals(line.productId)))
            .getSingleOrNull();

        if (balance == null || balance.quantityScaled < line.quantityScaled) {
          throw const DomainError('INV_INSUFFICIENT_STOCK', 'Insufficient stock for sale posting.');
        }

        final lineNet = divideHalfAwayFromZero(
          line.quantityScaled * line.unitPriceScaled,
          1000000,
        );
        final lineCogs = divideHalfAwayFromZero(
          line.quantityScaled * balance.wacUnitCostScaled,
          1000000,
        );

        saleTotalScaled = checkedInt64(saleTotalScaled + lineNet);
        cogsTotalScaled = checkedInt64(cogsTotalScaled + lineCogs);
        lineSnapshots.add(
          _LineSnapshot(
            input: line,
            netScaled: lineNet,
            cogsUnitCostScaled: balance.wacUnitCostScaled,
            cogsTotalScaled: lineCogs,
            oldBalanceQty: balance.quantityScaled,
            oldBalanceValue: balance.inventoryValueScaled,
          ),
        );
      }

      final saleMoney = Money.fromScaled(saleTotalScaled, currency);
      final baseSaleMoney = rate.convert(saleMoney);
      final baseCogsScaled = cogsTotalScaled;

      final documentNo = await _sequence.nextNumber(
        businessId: command.businessId,
        documentType: 'sale',
        year: command.saleAt.toLocal().year,
        prefix: 'SAL',
      );

      await db.into(db.sales).insert(
            SalesCompanion.insert(
              id: saleId,
              businessId: command.businessId,
              documentNo: documentNo,
              warehouseId: command.warehouseId,
              currencyCode: currency,
              exchangeRateScaled: command.exchangeRateScaled,
              totalScaled: saleTotalScaled,
              baseTotalScaled: baseSaleMoney.scaled,
              status: 'posted',
              saleAt: command.saleAt.toUtc(),
              journalEntryId: journalId,
              stockMovementId: movementId,
              operationId: command.operationId,
            ),
          );

      await db.into(db.stockMovements).insert(
            StockMovementsCompanion.insert(
              id: movementId,
              businessId: command.businessId,
              warehouseId: command.warehouseId,
              movementType: 'SALE_OUT',
              referenceType: 'sale',
              referenceId: saleId,
              status: 'posted',
              movementAt: command.saleAt.toUtc(),
              operationId: command.operationId,
            ),
          );

      for (final snapshot in lineSnapshots) {
        final saleItemId = _uuid.v4();
        await db.into(db.saleItems).insert(
              SaleItemsCompanion.insert(
                id: saleItemId,
                saleId: saleId,
                productId: snapshot.input.productId,
                quantityScaled: snapshot.input.quantityScaled,
                baseQuantityScaled: snapshot.input.quantityScaled,
                unitPriceScaled: snapshot.input.unitPriceScaled,
                netScaled: snapshot.netScaled,
                cogsUnitCostScaled: snapshot.cogsUnitCostScaled,
                cogsTotalScaled: snapshot.cogsTotalScaled,
              ),
            );
        await db.into(db.stockMovementItems).insert(
              StockMovementItemsCompanion.insert(
                id: _uuid.v4(),
                stockMovementId: movementId,
                productId: snapshot.input.productId,
                quantityScaled: -snapshot.input.quantityScaled,
                unitCostScaled: snapshot.cogsUnitCostScaled,
                totalCostScaled: -snapshot.cogsTotalScaled,
              ),
            );

        final newQty = checkedInt64(snapshot.oldBalanceQty - snapshot.input.quantityScaled);
        final newValue = checkedInt64(snapshot.oldBalanceValue - snapshot.cogsTotalScaled);
        await (db.update(db.inventoryBalances)
              ..where((t) =>
                  t.warehouseId.equals(command.warehouseId) &
                  t.productId.equals(snapshot.input.productId)))
            .write(
          InventoryBalancesCompanion(
            quantityScaled: Value(newQty),
            inventoryValueScaled: Value(newValue),
            updatedAt: Value(now),
          ),
        );
      }

      await db.into(db.journalEntries).insert(
            JournalEntriesCompanion.insert(
              id: journalId,
              businessId: command.businessId,
              sourceType: 'sale',
              sourceId: saleId,
              status: 'posted',
              entryAt: command.saleAt.toUtc(),
              operationId: command.operationId,
            ),
          );

      final journalLines = [
        JournalLinesCompanion.insert(
          id: _uuid.v4(),
          journalEntryId: journalId,
          accountId: command.cashLedgerAccountId,
          baseDebitScaled: Value(baseSaleMoney.scaled),
          description: const Value('Cash sale receipt'),
        ),
        JournalLinesCompanion.insert(
          id: _uuid.v4(),
          journalEntryId: journalId,
          accountId: command.salesRevenueAccountId,
          baseCreditScaled: Value(baseSaleMoney.scaled),
          description: const Value('Sales revenue'),
        ),
        JournalLinesCompanion.insert(
          id: _uuid.v4(),
          journalEntryId: journalId,
          accountId: command.cogsLedgerAccountId,
          baseDebitScaled: Value(baseCogsScaled),
          description: const Value('Cost of goods sold'),
        ),
        JournalLinesCompanion.insert(
          id: _uuid.v4(),
          journalEntryId: journalId,
          accountId: command.inventoryLedgerAccountId,
          baseCreditScaled: Value(baseCogsScaled),
          description: const Value('Inventory relief'),
        ),
      ];
      for (final line in journalLines) {
        await db.into(db.journalLines).insert(line);
      }

      final debit = baseSaleMoney.scaled + baseCogsScaled;
      final credit = baseSaleMoney.scaled + baseCogsScaled;
      if (debit != credit) {
        throw const DomainError('ACC_ENTRY_UNBALANCED', 'Journal entry is not balanced.');
      }

      await db.into(db.payments).insert(
            PaymentsCompanion.insert(
              id: paymentId,
              businessId: command.businessId,
              saleId: saleId,
              cashAccountId: command.cashAccountId,
              currencyCode: currency,
              amountScaled: saleTotalScaled,
              baseAmountScaled: baseSaleMoney.scaled,
              paymentAt: command.saleAt.toUtc(),
              operationId: command.operationId,
            ),
          );

      await db.into(db.operationLog).insert(
            OperationLogCompanion.insert(
              operationId: command.operationId,
              businessId: command.businessId,
              commandName: 'PostSale',
              entityType: const Value('sale'),
              entityId: Value(saleId),
              status: 'committed',
              createdAt: now,
            ),
          );

      await db.into(db.auditLogs).insert(
            AuditLogsCompanion.insert(
              id: _uuid.v4(),
              businessId: command.businessId,
              userId: command.userId,
              entityType: 'sale',
              entityId: saleId,
              action: 'POST_SALE',
              operationId: command.operationId,
              occurredAt: now,
              metadataJson: jsonEncode({
                'document_no': documentNo,
                'line_count': command.lines.length,
                'total_scaled': saleTotalScaled,
              }),
            ),
          );

      return PostSaleResult(
        saleId: saleId,
        documentNo: documentNo,
        journalEntryId: journalId,
        stockMovementId: movementId,
        paymentId: paymentId,
        idempotentReplay: false,
      );
    });
  }
}

class _LineSnapshot {
  const _LineSnapshot({
    required this.input,
    required this.netScaled,
    required this.cogsUnitCostScaled,
    required this.cogsTotalScaled,
    required this.oldBalanceQty,
    required this.oldBalanceValue,
  });

  final PostSaleLineInput input;
  final int netScaled;
  final int cogsUnitCostScaled;
  final int cogsTotalScaled;
  final int oldBalanceQty;
  final int oldBalanceValue;
}
