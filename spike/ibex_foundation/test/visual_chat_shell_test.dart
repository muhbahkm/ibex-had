import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ibex_foundation_spike/ui/ibex_chat_shell.dart';

Future<void> pumpPhoneViewport(
  WidgetTester tester,
  Widget app,
) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(app);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('chat-first shell renders Arabic RTL sale draft preview', (tester) async {
    await pumpPhoneViewport(tester, const IbexVisualApp());

    expect(find.text('ماذا تريد أن تنجز اليوم؟'), findsOneWidget);
    expect(find.text('مسودة فاتورة بيع'), findsOneWidget);
    expect(find.text('محمد عبدالله باحكم'), findsOneWidget);
    expect(find.text('500 SAR'), findsOneWidget);
    expect(find.text('بانتظار الموافقة'), findsOneWidget);

    final context = tester.element(find.byType(IbexChatShell));
    expect(Directionality.of(context), TextDirection.rtl);
  });

  testWidgets('approval and material edit visibly require a new review state', (tester) async {
    await pumpPhoneViewport(tester, const IbexVisualApp());

    final approve = find.text('اعتماد');
    await tester.scrollUntilVisible(
      approve,
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(approve);
    await tester.pumpAndSettle();
    expect(find.text('تمت الموافقة'), findsOneWidget);
    expect(find.text('موافق عليها'), findsOneWidget);

    final edit = find.text('تعديل');
    await tester.scrollUntilVisible(
      edit,
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(edit);
    await tester.pumpAndSettle();
    expect(find.text('تحتاج مراجعة جديدة'), findsOneWidget);
    expect(find.text('اعتماد'), findsOneWidget);
  });

  testWidgets('composer accepts Arabic operational text without posting truth', (tester) async {
    await pumpPhoneViewport(tester, const IbexVisualApp());

    const message = 'اعرض مخزون السدر في المستودع الرئيسي';
    final composer = find.byKey(const ValueKey('ibex-composer'));
    await tester.ensureVisible(composer);
    await tester.enterText(composer, message);
    await tester.tap(find.byKey(const ValueKey('ibex-send')));
    await tester.pumpAndSettle();

    final messageFinder = find.text(message);
    await tester.scrollUntilVisible(
      messageFinder,
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(messageFinder, findsOneWidget);
    expect(find.textContaining('هذه نسخة بصرية تجريبية'), findsOneWidget);
  });
}
