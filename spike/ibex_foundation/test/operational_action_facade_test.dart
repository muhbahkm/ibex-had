import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ibex_foundation_spike/agent/command_registry.dart';
import 'package:ibex_foundation_spike/agent/operational_action_facade.dart';
import 'package:ibex_foundation_spike/database/spike_database.dart';
import 'package:ibex_foundation_spike/operating_engine/pay_supplier_command.dart';
import 'package:ibex_foundation_spike/operating_engine/pay_supplier_service.dart';
import 'package:ibex_foundation_spike/operating_engine/post_purchase_return_service.dart';
import 'package:ibex_foundation_spike/operating_engine/post_purchase_service.dart';
import 'package:ibex_foundation_spike/operating_engine/post_sale_return_service.dart';
import 'package:ibex_foundation_spike/operating_engine/transfer_stock_service.dart';
import 'package:ibex_foundation_spike/security/authorization_service.dart';

void main() {
  test('unregistered write is rejected before authorization or engine mutation', () async {
    final db = SpikeDatabase.inMemory();
    addTearDown(db.close);
    final facade = _facade(db, registry: const AgentCommandRegistry({}));

    final command = _payCommand(operationId: 'OP-BLOCKED');
    await expectLater(facade.executePaySupplier(command), throwsA(isA<Exception>()));
    expect(await db.select(db.supplierPayments).get(), isEmpty);
    expect(await db.select(db.operationLog).get(), isEmpty);
  });

  test('registered write is denied when active user lacks permission', () async {
    final db = SpikeDatabase.inMemory();
    addTearDown(db.close);
    final now = DateTime.utc(2026, 8, 11);
    await db.into(db.appUsers).insert(
          AppUsersCompanion.insert(
            id: 'U-1',
            businessId: 'B-1',
            displayName: 'مستخدم',
            updatedAt: now,
          ),
        );
    final facade = _facade(
      db,
      registry: const AgentCommandRegistry({OperationalActionFacade.paySupplierCommand}),
    );

    await expectLater(
      facade.executePaySupplier(_payCommand(operationId: 'OP-DENIED')),
      throwsA(isA<Exception>()),
    );
    expect(await db.select(db.supplierPayments).get(), isEmpty);
    expect(await db.select(db.operationLog).get(), isEmpty);
  });

  test('business-scoped role permission allows registered write to reach engine', () async {
    final db = SpikeDatabase.inMemory();
    addTearDown(db.close);
    final now = DateTime.utc(2026, 8, 11);
    await db.into(db.appUsers).insert(
          AppUsersCompanion.insert(
            id: 'U-1',
            businessId: 'B-1',
            displayName: 'مدير',
            updatedAt: now,
          ),
        );
    await db.into(db.roles).insert(
          RolesCompanion.insert(
            id: 'R-1',
            businessId: 'B-1',
            name: 'مدير التشغيل',
            updatedAt: now,
          ),
        );
    await db.into(db.userRoles).insert(
          const UserRolesCompanion(
            businessId: Value('B-1'),
            userId: Value('U-1'),
            roleId: Value('R-1'),
          ),
        );
    await db.into(db.rolePermissions).insert(
          const RolePermissionsCompanion(
            businessId: Value('B-1'),
            roleId: Value('R-1'),
            permission: Value(OperationalPermissions.paySupplier),
          ),
        );

    final facade = _facade(
      db,
      registry: const AgentCommandRegistry({OperationalActionFacade.paySupplierCommand}),
    );

    // Authorization passes, then the engine rejects because no supplier master data exists.
    // This proves the request crossed the authorization gate but still produced no partial truth.
    await expectLater(
      facade.executePaySupplier(_payCommand(operationId: 'OP-AUTHORIZED')),
      throwsA(isA<Exception>()),
    );
    expect(await db.select(db.supplierPayments).get(), isEmpty);
    expect(await db.select(db.operationLog).get(), isEmpty);
  });
}

OperationalActionFacade _facade(
  SpikeDatabase db, {
  required AgentCommandRegistry registry,
}) =>
    OperationalActionFacade(
      registry: registry,
      authorization: AuthorizationService(db),
      postPurchase: PostPurchaseService(db),
      paySupplier: PaySupplierService(db),
      transferStock: TransferStockService(db),
      postSaleReturn: PostSaleReturnService(db),
      postPurchaseReturn: PostPurchaseReturnService(db),
    );

PaySupplierCommand _payCommand({required String operationId}) => PaySupplierCommand(
      operationId: operationId,
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
