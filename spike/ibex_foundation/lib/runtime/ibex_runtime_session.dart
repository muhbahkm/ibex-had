import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../agent/approved_sale_draft_to_command.dart';
import '../agent/command_registry.dart';
import '../agent/create_sale_draft_service.dart';
import '../agent/local_sale_draft_catalog.dart';
import '../agent/operational_draft.dart';
import '../agent/operational_draft_repository.dart';
import '../agent/sale_operational_workflow.dart';
import '../database/encrypted_database_opener.dart';
import '../database/spike_database.dart';
import '../operating_engine/post_sale_service.dart';
import '../presentation/persistent_sale_chat_controller.dart';
import '../security/secure_database_key_store.dart';
import 'spike_runtime_config.dart';
import 'spike_seed_data.dart';

class IbexRuntimeSession {
  IbexRuntimeSession._({
    required this.db,
    required this.controller,
    required this.databaseFile,
  });

  final SpikeDatabase db;
  final PersistentSaleChatController controller;
  final File databaseFile;

  static Future<IbexRuntimeSession> open({
    SpikeRuntimeConfig config = const SpikeRuntimeConfig(),
  }) async {
    final directory = await getApplicationDocumentsDirectory();
    final file = File(p.join(directory.path, 'ibex2-local.db'));
    final key = await SecureDatabaseKeyStore().loadOrCreateHexKey();
    final db = SpikeDatabase(
      EncryptedDatabaseOpener.open(file: file, hexKey: key),
    );

    try {
      await SpikeSeedData.ensureSeeded(db, config: config);

      final catalog = LocalSaleDraftCatalog(
        db: db,
        businessId: config.businessId,
      );
      final createDraft = CreateSaleDraftService(
        catalog: catalog,
        registry: const AgentCommandRegistry({CreateSaleDraftService.commandName}),
      );
      final workflow = SaleOperationalWorkflow(
        createSaleDraft: createDraft,
        draftRepository: OperationalDraftRepository(db),
        postSaleService: PostSaleService(db),
      );
      const fx = SpikeSyntheticFxRateProvider();
      const uuid = Uuid();
      final controller = PersistentSaleChatController(
        workflow: workflow,
        defaultWarehouseId: config.defaultWarehouseId,
        postingContextFactory: (OperationalDraft draft) {
          final currency = draft.payload['currency_code'];
          if (currency is! String) {
            throw StateError('Approved draft has no currency code.');
          }
          return SalePostingContext(
            operationId: uuid.v4(),
            businessId: config.businessId,
            userId: config.userId,
            baseCurrencyCode: config.baseCurrencyCode,
            exchangeRateScaled: fx.rateScaled(
              from: currency,
              to: config.baseCurrencyCode,
            ),
            cashAccountId: config.cashAccountId,
            cashLedgerAccountId: config.cashLedgerAccountId,
            salesRevenueAccountId: config.salesRevenueAccountId,
            inventoryLedgerAccountId: config.inventoryLedgerAccountId,
            cogsLedgerAccountId: config.cogsLedgerAccountId,
            accountsReceivableLedgerAccountId:
                config.accountsReceivableLedgerAccountId,
            saleAt: DateTime.now().toUtc(),
          );
        },
      );
      await controller.initialize();
      return IbexRuntimeSession._(
        db: db,
        controller: controller,
        databaseFile: file,
      );
    } catch (_) {
      await db.close();
      rethrow;
    }
  }

  Future<void> close() async {
    controller.dispose();
    await db.close();
  }
}
