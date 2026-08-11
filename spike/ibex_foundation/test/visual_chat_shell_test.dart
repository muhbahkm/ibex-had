import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ibex_foundation_spike/ui/ibex_chat_shell.dart';

void main() {
  testWidgets('chat-first shell renders Arabic RTL sale draft preview', (tester) async {
    await tester.pumpWidget(const IbexVisualApp());
    await tester.pumpAndSettle();

    expect(find.text('ماذا تريد أن تنجز اليوم؟'), findsOneWidget);
    expect(find.text('مسودة فاتورة بيع'), findsOneWidget);
    expect(find.text('محمد عبدالله باحكم'), findsOneWidget);
    expect(find.text('500 SAR'), findsOneWidget);
    expect(find.text('بانتظار الموافقة'), findsOneWidget);

    final directionality = tester.widget<Directionality>(
      find.descendant(
        of: find.byType(IbexChatShell),
        matching: find.byType(Directionality),
      ).first,
    );
    expect(directionality.textDirection, TextDirection.rtl);
  });

  testWidgets('approval and material edit visibly require a new review state', (tester) async {
    await tester.pumpWidget(const IbexVisualApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('اعتماد'));
    await tester.pumpAndSettle();
    expect(find.text('تمت الموافقة'), findsOneWidget);
    expect(find.text('موافق عليها'), findsOneWidget);

    await tester.tap(find.text('تعديل'));
    await tester.pumpAndSettle();
    expect(find.text('تحتاج مراجعة جديدة'), findsOneWidget);
    expect(find.text('اعتماد'), findsOneWidget);
  });

  testWidgets('composer accepts Arabic operational text without posting truth', (tester) async {
    await tester.pumpWidget(const IbexVisualApp());
    await tester.pumpAndSettle();

    const message = 'اعرض مخزون السدر في المستودع الرئيسي';
    await tester.enterText(find.byKey(const ValueKey('ibex-composer')), message);
    await tester.tap(find.byKey(const ValueKey('ibex-send')));
    await tester.pumpAndSettle();

    expect(find.text(message), findsOneWidget);
    expect(
      find.textContaining('هذه نسخة بصرية تجريبية'),
      findsOneWidget,
    );
  });
}
