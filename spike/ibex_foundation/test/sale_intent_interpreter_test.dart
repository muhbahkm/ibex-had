import 'package:flutter_test/flutter_test.dart';
import 'package:ibex_foundation_spike/agent/sale_intent_interpreter.dart';

void main() {
  const interpreter = SaleIntentInterpreter();

  test('parses a complete Arabic sale command into bounded structured intent', () {
    final intent = interpreter.interpret(
      'أنشئ فاتورة مبيعات لصنف السدر عبوة كيلو، بكمية 1، والوحدة جالون، بسعر 500 ريال سعودي، وعلى حساب محمد عبدالله باحكم',
    );

    expect(intent, isA<CreateSaleConversationIntent>());
    final sale = (intent as CreateSaleConversationIntent).sale;
    expect(sale.productQuery, 'السدر عبوة كيلو');
    expect(sale.quantityText, '1');
    expect(sale.unitQuery, 'جالون');
    expect(sale.unitPriceText, '500');
    expect(sale.currencyCode, 'SAR');
    expect(sale.customerQuery, 'محمد عبدالله باحكم');
  });

  test('supports common Arabic quantity words while keeping canonical numeric output', () {
    final intent = interpreter.interpret(
      'انشئ فاتورة بيع لصنف سدر، بكمية واحد، الوحدة جالون، بسعر 80 ريال يمني، على حساب زبون عام',
    );
    final sale = (intent as CreateSaleConversationIntent).sale;
    expect(sale.quantityText, '1');
    expect(sale.currencyCode, 'YER');
  });

  test('recognizes safe lifecycle commands', () {
    expect(interpreter.interpret('اعتمدها'), isA<ApproveSaleDraftIntent>());
    expect(interpreter.interpret('رحّل الفاتورة'), isA<PostSaleDraftIntent>());
    expect(interpreter.interpret('إلغاء المسودة'), isA<CancelSaleDraftIntent>());
    expect(interpreter.interpret('اجعل السعر 400'), isA<ReviseSalePriceIntent>());
    expect(interpreter.interpret('عدّل الكمية 2'), isA<ReviseSaleQuantityIntent>());
  });

  test('does not invent an unsupported intent', () {
    expect(interpreter.interpret('افعل شيئا مناسبا'), isA<UnsupportedSaleIntent>());
  });
}
