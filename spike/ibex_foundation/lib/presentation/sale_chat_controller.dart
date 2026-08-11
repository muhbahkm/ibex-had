import 'package:flutter/foundation.dart';

import '../agent/command_registry.dart';
import '../agent/create_sale_draft_service.dart';
import '../agent/operational_draft.dart';
import '../agent/revise_sale_draft_service.dart';
import '../core/errors/domain_error.dart';

class SaleChatMessage {
  const SaleChatMessage({required this.role, required this.text});
  final String role;
  final String text;
}

class SaleDraftViewData {
  const SaleDraftViewData({
    required this.customerName,
    required this.warehouseName,
    required this.productName,
    required this.unitName,
    required this.quantityScaled,
    required this.quantityPrecision,
    required this.unitPriceScaled,
    required this.currencyCode,
    required this.version,
    required this.state,
  });

  final String customerName;
  final String warehouseName;
  final String productName;
  final String unitName;
  final int quantityScaled;
  final int quantityPrecision;
  final int unitPriceScaled;
  final String currencyCode;
  final int version;
  final OperationalDraftState state;

  String get quantityText {
    const scale = 1000000;
    final whole = quantityScaled ~/ scale;
    final fraction = (quantityScaled % scale).abs().toString().padLeft(6, '0');
    if (quantityPrecision == 0) return '$whole';
    return '$whole.${fraction.substring(0, quantityPrecision)}';
  }

  String get unitPriceText {
    const scale = 10000;
    final whole = unitPriceScaled ~/ scale;
    final remainder = (unitPriceScaled % scale).abs();
    if (remainder == 0) return '$whole';
    final fraction = remainder.toString().padLeft(4, '0').replaceFirst(RegExp(r'0+$'), '');
    return '$whole.$fraction';
  }

  String get totalText {
    final totalScaled = (unitPriceScaled * quantityScaled) ~/ 1000000;
    final whole = totalScaled ~/ 10000;
    final remainder = (totalScaled % 10000).abs();
    if (remainder == 0) return '$whole';
    final fraction = remainder.toString().padLeft(4, '0').replaceFirst(RegExp(r'0+$'), '');
    return '$whole.$fraction';
  }
}

class SaleChatController extends ChangeNotifier {
  SaleChatController({
    required CreateSaleDraftService createSaleDraft,
    ReviseSaleDraftService reviseSaleDraft = const ReviseSaleDraftService(),
  })  : _createSaleDraft = createSaleDraft,
        _reviseSaleDraft = reviseSaleDraft;

  factory SaleChatController.demo() {
    return SaleChatController(
      createSaleDraft: CreateSaleDraftService(
        catalog: const _DemoCatalog(),
        registry: const AgentCommandRegistry({CreateSaleDraftService.commandName}),
      ),
    );
  }

  final CreateSaleDraftService _createSaleDraft;
  final ReviseSaleDraftService _reviseSaleDraft;
  OperationalDraft? _draft;
  bool _busy = false;
  String? _lastError;
  final List<SaleChatMessage> _messages = [];

  bool get busy => _busy;
  String? get lastError => _lastError;
  OperationalDraft? get draft => _draft;
  List<SaleChatMessage> get messages => List.unmodifiable(_messages);

  Future<void> initializeDemoDraft() async {
    if (_draft != null || _busy) return;
    _busy = true;
    _lastError = null;
    notifyListeners();
    try {
      _draft = await _createSaleDraft.execute(
        CreateSaleDraftRequest(
          draftId: 'draft-sale-demo-1',
          customerQuery: 'محمد عبدالله باحكم',
          productQuery: 'سدر عبوة كيلو',
          unitQuery: 'جالون',
          quantityText: '1',
          unitPriceText: '500',
          currencyCode: 'SAR',
          warehouseId: 'warehouse-main',
          createdAtUtc: DateTime.now().toUtc(),
        ),
      );
    } on DomainError catch (error) {
      _lastError = error.code;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  void approve() {
    final current = _draft;
    if (current == null) return;
    try {
      _draft = current.approve();
      _lastError = null;
    } on DomainError catch (error) {
      _lastError = error.code;
    }
    notifyListeners();
  }

  void cancel() {
    final current = _draft;
    if (current == null) return;
    try {
      _draft = current.cancel();
      _lastError = null;
    } on DomainError catch (error) {
      _lastError = error.code;
    }
    notifyListeners();
  }

  void requestEditTo400() => revisePrice('400');

  void revisePrice(String priceText) {
    final current = _draft;
    if (current == null) return;
    try {
      _draft = _reviseSaleDraft.execute(
        ReviseSaleDraftRequest(draft: current, unitPriceText: priceText),
      );
      _lastError = null;
    } on DomainError catch (error) {
      _lastError = error.code;
    }
    notifyListeners();
  }

  void submitNaturalLanguage(String text) {
    final value = text.trim();
    if (value.isEmpty) return;
    _messages.add(SaleChatMessage(role: 'user', text: value));

    final requestedPrice = _extractPriceRevision(value);
    if (requestedPrice != null && _draft != null) {
      revisePrice(requestedPrice);
      _messages.add(
        SaleChatMessage(
          role: 'assistant',
          text: 'عدّلت سعر المسودة إلى $requestedPrice ${viewData?.currencyCode ?? ''}. ألغيت الموافقة السابقة تلقائيًا، وتحتاج المسودة إلى مراجعة جديدة.',
        ),
      );
    } else {
      _messages.add(
        const SaleChatMessage(
          role: 'assistant',
          text: 'وصل الطلب. في هذه المرحلة التجريبية لا أنفذ إلا أوامر تعديل السعر المحددة؛ بقية النوايا ستُربط تباعًا بعقود تشغيلية آمنة.',
        ),
      );
    }
    notifyListeners();
  }

  SaleDraftViewData? get viewData {
    final current = _draft;
    if (current == null) return null;
    final lines = current.payload['lines'];
    if (lines is! List || lines.length != 1 || lines.single is! Map) return null;
    final line = lines.single as Map;
    final customerName = current.payload['customer_name'];
    final currencyCode = current.payload['currency_code'];
    final productName = line['product_name'];
    final unitName = line['unit_name'];
    final quantityScaled = line['quantity_scaled'];
    final quantityPrecision = line['quantity_precision'];
    final unitPriceScaled = line['unit_price_scaled'];
    if (customerName is! String ||
        currencyCode is! String ||
        productName is! String ||
        unitName is! String ||
        quantityScaled is! int ||
        quantityPrecision is! int ||
        unitPriceScaled is! int) {
      return null;
    }
    return SaleDraftViewData(
      customerName: customerName,
      warehouseName: 'المستودع الرئيسي',
      productName: productName,
      unitName: unitName,
      quantityScaled: quantityScaled,
      quantityPrecision: quantityPrecision,
      unitPriceScaled: unitPriceScaled,
      currencyCode: currencyCode,
      version: current.version,
      state: current.state,
    );
  }

  String? _extractPriceRevision(String value) {
    final normalized = value.replaceAll('،', ' ').replaceAll(',', ' ');
    final mentionsPrice = normalized.contains('السعر') ||
        normalized.contains('المبلغ') ||
        normalized.contains('اجعل') ||
        normalized.contains('عدّل') ||
        normalized.contains('عدل');
    if (!mentionsPrice) return null;
    final matches = RegExp(r'(?<![\d.])(\d+(?:\.\d{1,4})?)(?![\d.])').allMatches(normalized).toList();
    if (matches.length != 1) return null;
    return matches.single.group(1);
  }
}

class _DemoCatalog implements SaleDraftCatalog {
  const _DemoCatalog();

  @override
  Future<List<SaleDraftCustomer>> findCustomers(String query) async => const [
        SaleDraftCustomer(id: 'customer-1', name: 'محمد عبدالله باحكم'),
      ];

  @override
  Future<List<SaleDraftProduct>> findProducts(String query) async => const [
        SaleDraftProduct(id: 'product-1', name: 'سدر — عبوة كيلو'),
      ];

  @override
  Future<List<SaleDraftUnit>> findUnitsForProduct(String productId, String query) async => const [
        SaleDraftUnit(id: 'unit-1', name: 'جالون', quantityPrecision: 0),
      ];
}
