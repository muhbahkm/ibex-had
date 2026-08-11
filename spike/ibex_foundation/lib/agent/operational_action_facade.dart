import '../operating_engine/pay_supplier_command.dart';
import '../operating_engine/pay_supplier_service.dart';
import '../operating_engine/post_purchase_command.dart';
import '../operating_engine/post_purchase_service.dart';
import '../operating_engine/post_sale_return_command.dart';
import '../operating_engine/post_sale_return_service.dart';
import '../operating_engine/transfer_stock_command.dart';
import '../operating_engine/transfer_stock_service.dart';
import 'command_registry.dart';

class OperationalActionFacade {
  const OperationalActionFacade({
    required this.registry,
    required this.postPurchase,
    required this.paySupplier,
    required this.transferStock,
    required this.postSaleReturn,
  });

  static const postPurchaseCommand = 'PostPurchase';
  static const paySupplierCommand = 'PaySupplier';
  static const transferStockCommand = 'TransferStock';
  static const postSaleReturnCommand = 'PostSaleReturn';

  final AgentCommandRegistry registry;
  final PostPurchaseService postPurchase;
  final PaySupplierService paySupplier;
  final TransferStockService transferStock;
  final PostSaleReturnService postSaleReturn;

  Future<PostPurchaseResult> executePostPurchase(PostPurchaseCommand command) {
    registry.requireRegistered(postPurchaseCommand);
    return postPurchase.execute(command);
  }

  Future<PaySupplierResult> executePaySupplier(PaySupplierCommand command) {
    registry.requireRegistered(paySupplierCommand);
    return paySupplier.execute(command);
  }

  Future<TransferStockResult> executeTransferStock(TransferStockCommand command) {
    registry.requireRegistered(transferStockCommand);
    return transferStock.execute(command);
  }

  Future<PostSaleReturnResult> executePostSaleReturn(PostSaleReturnCommand command) {
    registry.requireRegistered(postSaleReturnCommand);
    return postSaleReturn.execute(command);
  }
}
