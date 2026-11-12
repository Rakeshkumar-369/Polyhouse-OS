// Unit + widget tests for the mobile app (run: flutter test)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:polyhouse_os/core/format.dart';
import 'package:polyhouse_os/core/i18n.dart';
import 'package:polyhouse_os/core/session.dart';
import 'package:polyhouse_os/main.dart';
import 'package:polyhouse_os/ui/widgets.dart';
import 'package:polyhouse_os/screens/bills_screen.dart';

void main() {
  group('format', () {
    test('Indian money grouping', () {
      expect(money(1234567), '₹12,34,567');
      expect(money(-500), '-₹500');
      expect(money(null), '—');
    });
    test('numbers and short money', () {
      expect(numf(1234.56), '1,234.6');
      expect(numf(12), '12');
      expect(shortMoney(250000), '₹2.5L');
    });
    test('dates and periods', () {
      expect(fdate('2026-11-03'), '03 Nov 26');
      final ps = periods();
      expect(ps.map((p) => p.key), contains('this_fy'));
      for (final p in ps) {
        expect(p.from.compareTo(p.to) <= 0, isTrue, reason: p.key);
      }
      expect(pctChange(120, 100), 20);
      expect(pctChange(5, 0), isNull);
    });
  });

  test('Telugu translation falls back to English', () {
    I18n.lang = 'te';
    expect(tr('Sell'), 'అమ్మకం');
    expect(tr('Some new text'), 'Some new text');
    I18n.lang = 'en';
    expect(tr('Sell'), 'Sell');
  });

  testWidgets('login screen shows server, user and password fields', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final s = Session();
    await s.init();
    await tester.pumpWidget(PolyhouseApp(session: s));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(3));
    await tester.tap(find.text('తెలుగు'));
    await tester.pumpAndSettle();
    expect(find.text('స్వాగతం'), findsOneWidget);
  });

  testWidgets('chip picker selects a value', (tester) async {
    String? picked;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ChipPicker(options: const [Choice('a', 'Capsicum'), Choice('b', 'Lettuce')], value: null, onChanged: (v) => picked = v))));
    await tester.tap(find.text('Lettuce'));
    expect(picked, 'b');
  });

  testWidgets('bill sheet shows bill number, lines and the WhatsApp button', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final s = Session();
    await s.init();
    s.meta = {'user': {'role': 'admin', 'name': 'Owner'}, 'org': {'name': 'XYZ', 'settings': {'currency': '₹', 'modules': {}}}, 'resources': {}};
    final doc = {
      'kind': 'bill',
      'header': {'title': 'Bill of Supply'},
      'bill': {'id': 1, 'bill_no': 'XYZ/2026-27/0007', 'date': '2026-11-10', 'status': 'issued', 'sent_count': 0},
      'party': {'name': 'FreshMart'},
      'lines': [{'crop': 'Capsicum Red', 'grade': 'A', 'quantity': 12, 'rejected_qty': 0, 'rate': 80, 'amount': 960, 'unit': 'kg'}],
      'totals': {'amount': 960},
      'balance': {'balance': 2500},
      'share': {'url': 'https://x/b/abc', 'text': 'Bill', 'whatsapp': 'https://wa.me/?text=Bill', 'phone': '9000000000'},
    };
    await tester.pumpWidget(SessionScope(session: s, child: MaterialApp(home: Scaffold(body: DocSheet(doc: doc)))));
    await tester.pumpAndSettle();
    expect(find.text('XYZ/2026-27/0007'), findsOneWidget);
    expect(find.textContaining('Capsicum Red A'), findsOneWidget);
    expect(find.text('Send on WhatsApp'), findsOneWidget);
    expect(find.text('Cancel bill'), findsOneWidget);
    expect(find.text('₹960'), findsNWidgets(2)); // bill total + the line
  });
}
