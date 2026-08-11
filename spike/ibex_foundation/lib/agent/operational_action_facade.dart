import '../operating_engine/pay_supplier_command.dart';
import '../operating_engine/pay_supplier_service.dart';
import '../operating_engine/post_purchase_command.dart';
import '../operating_engine/post_purchase_return_command.dart';
import '../operating_engine/post_purchase_return_service.dart';
import '../operating_engine/post_purchase_service.dart';
import '../operating_engine/post_sale_return_command.dart';
import '../operating_engine/post_sale_return_service.dart';
import '../operating_engine/transfer_stock_command.dart';
import '../operating_engine/transfer_stock_service.dart';
import '../security/authorization_service.dart';
import 'command_registry.dart';

class OperationalActionFacade {
  const OperationalActionFacade({
    required this.registry,
    required this.authorization,
    required this.postPurchase,
    required this.paySupplier,
    required this.transferStock,
    required this.postSaleReturn,
    required this.postPurchaseReturn,
  });

  static const postPurchaseCommand = 'PostPurchase';
  static const paySupplierCommand = 'PaySupplier';
  static const transferStockCommand = 'TransferStock';
  static const postSaleReturnCommand = 'PostSaleReturn';
  static const postPurchaseReturnCommand = 'PostPurchaseReturn';

  final AgentCommandRegistry registry;
  final AuthorizationService authorization;
  final PostPurchaseService postPurchase;
  final PaySupplierService paySupplier;
  final TransferStockService transferStock;
  final PostSaleReturnService postSaleReturn;
  final PostPurchaseReturnService postPurchaseReturn;

  Future<PostPurchaseResult> executePostPurchase(PostPurchaseCommand command) async {
    registry.requireRegistered(postPurchaseCommand);
    await authorization.requirePermission(
      businessId: command.businessId,
      userId: command.userId,
      permission: OperationalPermissions.postPurchase,
    );
    return postPurchase.execute(command);
  }

  Future<PaySupplierResult> executePaySupplier(PaySupplierCommand command) async {
    registry.requireRegistered(paySupplierCommand);
    await authorization.requirePermission(
      businessId: command.businessId,
      userId: command.userId,
      permission: OperationalPermissions.paySupplier,
    );
    return paySupplier.execute(command);
  }

  Future<TransferStockResult> executeTransferStock(TransferStockCommand command) async {
    registry.requireRegistered(transferStockCommand);
    await authorization.requirePermission(
      businessId: command.businessId,
      userId: command.userId,
      permission: OperationalPermissions.transferStock,
    );
    return transferStock.execute(command);
  }

  Future<PostSaleReturnResult> executePostSaleReturn(PostSaleReturnCommand command) async {
    registry.requireRegistered(postSaleReturnCommand);
    await authorization.requirePermission(
      businessId: command.businessId,
      userId: command.userId,
      permission: OperationalPermissions.postSaleReturn,
    );
    return postSaleReturn.execute(command);
  }

  Future<PostPurchaseReturnResult> executePostPurchaseReturn(
    PostPurchaseReturnCommand command,
  ) async {
    registry.requireRegistered(postPurchaseReturnCommand);
    await authorization.requirePermission(
      businessId: command.businessId,
      userId: command.userId,
      permission: OperationalPermissions.postPurchaseReturn,
    );
    return postPurchaseReturn.execute(command);
  }
}
