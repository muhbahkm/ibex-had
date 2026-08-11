import '../agent/sale_operational_workflow.dart';
import 'sale_chat_controller.dart';

class PersistentSaleChatController extends SaleChatController {
  PersistentSaleChatController({
    required SaleOperationalWorkflow workflow,
    required SalePostingContextFactory postingContextFactory,
    String defaultWarehouseId = 'WH-1',
  }) : super(
          createSaleDraft: workflow.createSaleDraft,
          workflow: workflow,
          postingContextFactory: postingContextFactory,
          defaultWarehouseId: defaultWarehouseId,
        );

  @override
  Future<void> initializeDemoDraft() => initialize();
}
