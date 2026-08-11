import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ibex_foundation_spike/ui/ibex_chat_shell.dart';

Future<void> _scrollPrimaryListToBottom(WidgetTester tester) async {
  final list = find.byType(ListView);
  expect(list, findsOneWidget);
  await tester.drag(list, const Offset(0, -900));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('chat-first shell renders Arabic RTL sale draft preview', (tester) async {
    await tester.binding.setSurfaceSize(const Size(432, 960));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(const IbexVisualApp());
    await tester.pumpAndSettle();

    expect(find.text('ماذا تريد أن تنجز اليوم؟'), findsOneWidget);
    expect(find.text('مسودة فاتورة بيع'), findsOneWidget);
    expect(find.text('محمد عبدالله باحكم'), findsOneWidget);
    expect(find.text('500 SAR'), findsOneWidget);
    expect(find.text('بانتظار الموافقة'), findsOneWidget);

    final context = tester.element(find.byType(IbexChatShell));
    expect(Directionality.of(context), TextDirection.rtl);
  });

  testWidgets('approval and material edit visibly require a new review state', (tester) async {
    await tester.binding.setSurfaceSize(const Size(432, 960));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(const IbexVisualApp());
    await tester.pumpAndSettle();
    await _scrollPrimaryListToBottom(tester);

    final approve = find.text('اعتماد');
    expect(approve, findsOneWidget);
    await tester.tap(approve);
    await tester.pumpAndSettle();
    expect(find.text('تمت الموافقة'), findsOneWidget);
    expect(find.text('موافق عليها'), findsOneWidget);

    final edit = find.text('تعديل');
    expect(edit, findsOneWidget);
    await tester.tap(edit);
    await tester.pumpAndSettle();
    expect(find.text('تحتاج مراجعة جديدة'), findsOneWidget);
    expect(find.text('اعتماد'), findsOneWidget);
  });

  testWidgets('composer accepts Arabic operational text without posting truth', (tester) async {
    await tester.binding.setSurfaceSize(const Size(432, 960));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(const IbexVisualApp());
    await tester.pumpAndSettle();

    const message = 'اعرض مخزون السدر في المستودع الرئيسي';
    final composer = find.byKey(const ValueKey('ibex-composer'));
    await tester.enterText(composer, message);
    await tester.tap(find.byKey(const ValueKey('ibex-send')));
    await tester.pumpAndSettle();
    await _scrollPrimaryListToBottom(tester);

    expect(find.text(message), findsOneWidget);
    expect(find.textContaining('هذه نسخة بصرية تجريبية'), findsOneWidget);
  });
}
