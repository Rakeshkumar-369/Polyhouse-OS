// Unit + widget tests for the mobile app (run: flutter test)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:polyhouse_os/core/format.dart';
import 'package:polyhouse_os/core/i18n.dart';
import 'package:polyhouse_os/core/session.dart';
import 'package:polyhouse_os/main.dart';
import 'package:polyhouse_os/ui/widgets.dart';

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
}
