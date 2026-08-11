import 'package:flutter/material.dart';

void main() {
  runApp(const IbexFoundationSpikeApp());
}

class IbexFoundationSpikeApp extends StatelessWidget {
  const IbexFoundationSpikeApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF0D6B57);
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.light,
      surface: const Color(0xFFF7F8F6),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'IBEX 2.0',
      locale: const Locale('ar'),
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: scheme,
        scaffoldBackgroundColor: const Color(0xFFF7F8F6),
        fontFamilyFallback: const ['Noto Sans Arabic', 'Noto Sans'],
        textTheme: const TextTheme(
          headlineSmall: TextStyle(fontWeight: FontWeight.w700, height: 1.35),
          titleMedium: TextStyle(fontWeight: FontWeight.w700, height: 1.4),
          bodyLarge: TextStyle(height: 1.55),
          bodyMedium: TextStyle(height: 1.5),
        ),
        cardTheme: const CardThemeData(
          elevation: 0,
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(24),
            borderSide: const BorderSide(color: Color(0xFFE1E5E2)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(24),
            borderSide: const BorderSide(color: Color(0xFFE1E5E2)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(24),
            borderSide: BorderSide(color: scheme.primary, width: 1.5),
          ),
        ),
      ),
      home: const Directionality(
        textDirection: TextDirection.rtl,
        child: IbexChatPrototype(),
      ),
    );
  }
}

class IbexChatPrototype extends StatefulWidget {
  const IbexChatPrototype({super.key});

  @override
  State<IbexChatPrototype> createState() => _IbexChatPrototypeState();
}

class _IbexChatPrototypeState extends State<IbexChatPrototype> {
  final _composer = TextEditingController();
  final _scroll = ScrollController();
  DraftVisualStatus _draftStatus = DraftVisualStatus.awaitingApproval;
  String? _lastUserMessage;

  @override
  void dispose() {
    _composer.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _composer.text.trim();
    if (value.isEmpty) return;
    setState(() {
      _lastUserMessage = value;
      _draftStatus = DraftVisualStatus.awaitingApproval;
      _composer.clear();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 920;
        return Scaffold(
          drawer: wide ? null : const Drawer(child: _Sidebar()),
          body: SafeArea(
            child: Row(
              textDirection: TextDirection.ltr,
              children: [
                if (wide)
                  const SizedBox(
                    width: 258,
                    child: _Sidebar(),
                  ),
                Expanded(
                  child: Column(
                    children: [
                      _TopBar(showMenu: !wide),
                      Expanded(
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 820),
                            child: ListView(
                              controller: _scroll,
                              padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                              children: [
                                const _AssistantIntro(),
                                const SizedBox(height: 22),
                                const _UserBubble(
                                  text:
                                      'أنشئ فاتورة مبيعات لصنف السدر عبوة كيلو، الكمية 1، السعر 500 ريال سعودي، على حساب محمد عبدالله باحكم.',
                                ),
                                const SizedBox(height: 14),
                                _AssistantDraftMessage(
                                  status: _draftStatus,
                                  onApprove: () => setState(() =>
                                      _draftStatus = DraftVisualStatus.approved),
                                  onEdit: () => setState(() =>
                                      _draftStatus = DraftVisualStatus.edited),
                                  onCancel: () => setState(() =>
                                      _draftStatus = DraftVisualStatus.cancelled),
                                ),
                                if (_lastUserMessage != null) ...[
                                  const SizedBox(height: 18),
                                  _UserBubble(text: _lastUserMessage!),
                                  const SizedBox(height: 14),
                                  const _AssistantText(
                                    text:
                                        'فهمت الطلب. في هذه النسخة البصرية أعرض لك مسودة قبل أي اعتماد. عند ربط الـAgent الفعلي سيتم حل العميل والصنف والوحدة ثم تمرير الأمر إلى IBEX Operating Engine.',
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                      _Composer(
                        controller: _composer,
                        onSubmit: _submit,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

enum DraftVisualStatus { awaitingApproval, approved, edited, cancelled }

class _TopBar extends StatelessWidget {
  const _TopBar({required this.showMenu});
  final bool showMenu;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 66,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      decoration: const BoxDecoration(
        color: Color(0xFFF7F8F6),
        border: Border(bottom: BorderSide(color: Color(0xFFE7EAE7))),
      ),
      child: Row(
        children: [
          if (showMenu)
            Builder(
              builder: (context) => IconButton(
                tooltip: 'القائمة',
                onPressed: () => Scaffold.of(context).openDrawer(),
                icon: const Icon(Icons.menu_rounded),
              ),
            ),
          const SizedBox(width: 6),
          const Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('IBEX', style: TextStyle(fontWeight: FontWeight.w800)),
                Text(
                  'المساعد التشغيلي',
                  style: TextStyle(fontSize: 12, color: Color(0xFF68736D)),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFEAF4F0),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined, size: 15, color: Color(0xFF0D6B57)),
                SizedBox(width: 5),
                Text(
                  'محلي وآمن',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0D6B57),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            tooltip: 'المزيد',
            onPressed: () {},
            icon: const Icon(Icons.more_horiz_rounded),
          ),
        ],
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar();

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.receipt_long_outlined, 'المبيعات'),
      (Icons.shopping_bag_outlined, 'المشتريات'),
      (Icons.people_alt_outlined, 'العملاء'),
      (Icons.inventory_2_outlined, 'المخزون'),
      (Icons.account_balance_wallet_outlined, 'النقدية'),
      (Icons.bar_chart_rounded, 'التقارير'),
    ];

    return Container(
      color: const Color(0xFFF0F3F0),
      padding: const EdgeInsets.fromLTRB(14, 18, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFF0D6B57),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'I',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 20,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('IBEX 2.0', style: TextStyle(fontWeight: FontWeight.w800)),
                    Text(
                      'تشغيل ذكي',
                      style: TextStyle(fontSize: 12, color: Color(0xFF68736D)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.add_rounded),
            label: const Text('محادثة جديدة'),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              alignment: Alignment.centerRight,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'مساحة العمل',
            style: TextStyle(
              color: Color(0xFF7A847F),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          for (final item in items)
            _SideItem(icon: item.$1, label: item.$2),
          const Spacer(),
          const Divider(),
          const _SideItem(icon: Icons.settings_outlined, label: 'الإعدادات'),
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Row(
              children: [
                CircleAvatar(
                  radius: 17,
                  backgroundColor: Color(0xFFE1E9E5),
                  child: Icon(Icons.person_outline_rounded, size: 19),
                ),
                SizedBox(width: 9),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('المستخدم', style: TextStyle(fontWeight: FontWeight.w700)),
                      Text(
                        'وضع تجريبي محلي',
                        style: TextStyle(fontSize: 11, color: Color(0xFF68736D)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SideItem extends StatelessWidget {
  const _SideItem({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: TextButton.icon(
        onPressed: () {},
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: TextButton.styleFrom(
          alignment: Alignment.centerRight,
          foregroundColor: const Color(0xFF26322C),
          minimumSize: const Size.fromHeight(43),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}

class _AssistantIntro extends StatelessWidget {
  const _AssistantIntro();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF0D6B57),
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(height: 14),
        Text(
          'ماذا تريد أن تنجز اليوم؟',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontSize: 23,
                color: const Color(0xFF18221D),
              ),
        ),
        const SizedBox(height: 6),
        const Text(
          'اطلب إجراءً تشغيليًا بلغة طبيعية. سأجهز المسودة وأعرضها عليك قبل أي اعتماد.',
          style: TextStyle(color: Color(0xFF66716B)),
        ),
        const SizedBox(height: 14),
        const Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _PromptChip('أنشئ فاتورة بيع'),
            _PromptChip('كم رصيد محمد؟'),
            _PromptChip('اعرض مخزون السدر'),
          ],
        ),
      ],
    );
  }
}

class _PromptChip extends StatelessWidget {
  const _PromptChip(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE1E5E2)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 620),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFE9EEEB),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text, style: const TextStyle(fontSize: 15)),
      ),
    );
  }
}

class _AssistantText extends StatelessWidget {
  const _AssistantText({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF0D6B57),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 17),
        ),
        const SizedBox(width: 10),
        Expanded(child: Padding(padding: const EdgeInsets.only(top: 4), child: Text(text))),
      ],
    );
  }
}

class _AssistantDraftMessage extends StatelessWidget {
  const _AssistantDraftMessage({
    required this.status,
    required this.onApprove,
    required this.onEdit,
    required this.onCancel,
  });

  final DraftVisualStatus status;
  final VoidCallback onApprove;
  final VoidCallback onEdit;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF0D6B57),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 17),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2, bottom: 10),
                child: Text(
                  'جهزت مسودة الفاتورة. راجعها قبل الاعتماد.',
                  style: TextStyle(fontSize: 14.5),
                ),
              ),
              _SaleDraftCard(
                status: status,
                onApprove: onApprove,
                onEdit: onEdit,
                onCancel: onCancel,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SaleDraftCard extends StatelessWidget {
  const _SaleDraftCard({
    required this.status,
    required this.onApprove,
    required this.onEdit,
    required this.onCancel,
  });

  final DraftVisualStatus status;
  final VoidCallback onApprove;
  final VoidCallback onEdit;
  final VoidCallback onCancel;

  String get _statusLabel => switch (status) {
        DraftVisualStatus.awaitingApproval => 'بانتظار الموافقة',
        DraftVisualStatus.approved => 'تمت الموافقة',
        DraftVisualStatus.edited => 'تحتاج مراجعة جديدة',
        DraftVisualStatus.cancelled => 'ملغاة',
      };

  IconData get _statusIcon => switch (status) {
        DraftVisualStatus.awaitingApproval => Icons.schedule_rounded,
        DraftVisualStatus.approved => Icons.check_circle_outline_rounded,
        DraftVisualStatus.edited => Icons.edit_note_rounded,
        DraftVisualStatus.cancelled => Icons.cancel_outlined,
      };

  @override
  Widget build(BuildContext context) {
    final disabled = status == DraftVisualStatus.cancelled;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFDDE3DF)),
        boxShadow: const [
          BoxShadow(
            blurRadius: 24,
            offset: Offset(0, 8),
            color: Color(0x0D1C2B24),
          ),
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(17),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEAF4F0),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.receipt_long_outlined,
                        color: Color(0xFF0D6B57),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'مسودة فاتورة بيع',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                          SizedBox(height: 1),
                          Text(
                            'لم تُرحّل محاسبيًا أو مخزنيًا',
                            style: TextStyle(fontSize: 11.5, color: Color(0xFF6A756F)),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
                      decoration: BoxDecoration(
                        color: status == DraftVisualStatus.approved
                            ? const Color(0xFFEAF4F0)
                            : const Color(0xFFF4F1E8),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_statusIcon, size: 14),
                          const SizedBox(width: 5),
                          Text(
                            _statusLabel,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                const _InfoRow(label: 'العميل', value: 'محمد عبدالله باحكم'),
                const _InfoRow(label: 'المستودع', value: 'المستودع الرئيسي'),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F8F6),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            flex: 4,
                            child: Text('الصنف', style: TextStyle(fontSize: 11, color: Color(0xFF748078))),
                          ),
                          Expanded(
                            child: Text('الكمية', style: TextStyle(fontSize: 11, color: Color(0xFF748078))),
                          ),
                          Expanded(
                            flex: 2,
                            child: Text('السعر', style: TextStyle(fontSize: 11, color: Color(0xFF748078))),
                          ),
                        ],
                      ),
                      SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            flex: 4,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('سدر — عبوة كيلو', style: TextStyle(fontWeight: FontWeight.w700)),
                                Text('الوحدة: جالون', style: TextStyle(fontSize: 11.5, color: Color(0xFF6A756F))),
                              ],
                            ),
                          ),
                          Expanded(child: Text('1')),
                          Expanded(flex: 2, child: Text('500 SAR')),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Divider(height: 1),
                const SizedBox(height: 13),
                const Row(
                  children: [
                    Expanded(
                      child: Text('الإجمالي', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                    Text(
                      '500 SAR',
                      textDirection: TextDirection.ltr,
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 11, 12, 12),
            decoration: const BoxDecoration(
              color: Color(0xFFFAFBF9),
              border: Border(top: BorderSide(color: Color(0xFFE6EAE7))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: disabled ? null : onApprove,
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: Text(status == DraftVisualStatus.approved ? 'موافق عليها' : 'اعتماد'),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: disabled ? null : onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 17),
                  label: const Text('تعديل'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(96, 44),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(width: 6),
                IconButton.outlined(
                  tooltip: 'إلغاء المسودة',
                  onPressed: disabled ? null : onCancel,
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF748078))),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w650))),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.onSubmit});
  final TextEditingController controller;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 13),
      decoration: const BoxDecoration(
        color: Color(0xFFF7F8F6),
        border: Border(top: BorderSide(color: Color(0xFFE7EAE7))),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: controller,
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                onSubmitted: (_) => onSubmit(),
                decoration: InputDecoration(
                  hintText: 'اطلب من IBEX تنفيذ إجراء…',
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                  prefixIcon: IconButton(
                    tooltip: 'إرفاق',
                    onPressed: () {},
                    icon: const Icon(Icons.add_circle_outline_rounded),
                  ),
                  suffixIcon: Padding(
                    padding: const EdgeInsets.all(5),
                    child: IconButton.filled(
                      tooltip: 'إرسال',
                      onPressed: onSubmit,
                      icon: const Icon(Icons.arrow_upward_rounded),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'المعاينة لا تُنشئ قيودًا أو حركات مخزون حتى يتم الاعتماد.',
                style: TextStyle(fontSize: 10.5, color: Color(0xFF7A847F)),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
