// Reports by period: overview, crops, vendors, expenses, P&L and balance sheet (same numbers as the web reports).
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final _loader = GlobalKey<LoaderState<Map<String, dynamic>>>();
  late Period _period = periods().firstWhere((p) => p.key == 'this_month');
  String _tab = 'overview';

  Future<Map<String, dynamic>> _load(Session s) async {
    final p = {'from': _period.from, 'to': _period.to, 'group': _period.group};
    final out = <String, dynamic>{'summary': await s.api.get('/reports/summary', p)};
    if (_tab == 'pnl') out['pnl'] = await s.api.get('/reports/pnl', p);
    if (_tab == 'balance') out['balance'] = await s.api.get('/reports/balance', {'date': todayIso()});
    return out;
  }

  Widget _line(String a, dynamic b, String cur, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [Expanded(child: Text(a, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w400))), Text(money(b, cur), style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600))]),
      );

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final tabs = [const Choice('overview', 'Overview'), const Choice('crops', 'Crops'), const Choice('vendors', 'Vendors'), const Choice('expenses', 'Expenses'),
      if (s.on('finance')) ...[const Choice('pnl', 'P&L'), const Choice('balance', 'Balance sheet')]];
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          PeriodDropdown(value: _period, onChanged: (p) { setState(() => _period = p); _loader.currentState?.reload(); }),
          const SizedBox(height: 8),
          SingleChildScrollView(scrollDirection: Axis.horizontal, child: ChipPicker(options: tabs, value: _tab, onChanged: (v) { setState(() => _tab = v); _loader.currentState?.reload(); })),
        ]),
      ),
      Expanded(child: Loader<Map<String, dynamic>>(
        key: _loader,
        load: () => _load(s),
        builder: (context, d, _) {
          final sum = Map<String, dynamic>.from(d['summary']);
          final t = Map<String, dynamic>.from(sum['totals']);
          final cur = s.cur;
          final children = <Widget>[];
          switch (_tab) {
            case 'crops':
              for (final c in List<Map>.from(sum['byCrop'])) {
                children.add(AppCard(title: '${c['crop']}', subtitle: '${numf(c['harvested'])} ${c['unit']} harvested · ${c['a_grade_pct']}% A grade', child: Column(children: [
                  _line('Sold ${numf(c['sold'])} (rejected ${numf(c['rejected'])})', c['revenue'], cur),
                  _line('Average price / unit', c['avg_price'], cur),
                  _line('Cost / unit', c['cost_per_unit'], cur),
                  _line('${tr('Profit')} · ${c['margin']}% margin', c['profit'], cur, bold: true),
                ])));
                children.add(const SizedBox(height: 10));
              }
            case 'vendors':
              for (final v in List<Map>.from(sum['byVendor'])) {
                children.add(AppCard(title: '${v['name']}', subtitle: '${v['deliveries']} deliveries · ${numf(v['qty'])} units · ${v['rejection_pct']}% rejected', child: Column(children: [
                  _line(tr('Sales'), v['revenue'], cur), _line('Received', v['payments'], cur), _line('Due now', v['balance'], cur, bold: true),
                  if (toD(v['overdue']) > 0) _line(tr('Overdue'), v['overdue'], cur),
                ])));
                children.add(const SizedBox(height: 10));
              }
            case 'expenses':
              final cats = List<Map>.from(sum['byCategory']);
              final total = cats.fold<double>(0, (a, c) => a + toD(c['amount']));
              children.add(AppCard(title: tr('Expenses'), subtitle: money(total, cur), child: Column(children: [
                for (final c in cats) ShareBar(label: '${c['category']}', value: money(c['amount'], cur), fraction: total == 0 ? 0 : toD(c['amount']) / total),
                if (cats.isEmpty) const EmptyView(),
              ])));
            case 'pnl':
              final p = Map<String, dynamic>.from(d['pnl']);
              children.add(AppCard(title: 'Profit & Loss', subtitle: '${fdate(p['from'])} – ${fdate(p['to'])}', child: Column(children: [
                for (final i in List<Map>.from(p['income'])) _line('${i['name']}', i['amount'], cur),
                for (final i in List<Map>.from(p['other_income'])) _line('${i['source']}', i['amount'], cur),
                _line('Total income', p['total_income'], cur, bold: true),
                const Divider(),
                for (final e in List<Map>.from(p['expenses'])) _line('${e['name']}', e['amount'], cur),
                if (toD(p['depreciation']) > 0) _line('Depreciation', p['depreciation'], cur),
                _line('Total expenses', p['total_expenses'], cur, bold: true),
                const Divider(),
                _line(toD(p['net_profit']) >= 0 ? 'Net profit' : 'Net loss', p['net_profit'], cur, bold: true),
              ])));
            case 'balance':
              final b = Map<String, dynamic>.from(d['balance']);
              children.add(AppCard(title: 'Balance sheet', subtitle: 'As on ${fdate(b['as_on'])}', child: Column(children: [
                for (final a in List<Map>.from(b['assets'])) _line('${a['name']}', a['amount'], cur),
                _line('Total assets', b['total_assets'], cur, bold: true),
                const Divider(),
                for (final a in List<Map>.from(b['liabilities'])) _line('${a['name']}', a['amount'], cur),
                _line('Total liabilities', b['total_liabilities'], cur, bold: true),
                const Divider(),
                _line('Net worth', b['net_worth'], cur, bold: true),
              ])));
            default:
              final trend = List<Map>.from(sum['trend']);
              children.addAll([
                TileGrid(children: [
                  StatTile(label: tr('Sales'), value: money(t['revenue'], cur), sub: 'avg ${money(t['avg_price'], cur)}/unit', icon: Icons.trending_up, color: Brand.revenue),
                  StatTile(label: tr('Expenses'), value: money(t['expenses'], cur), sub: '+ depr. ${shortMoney(t['depreciation'], cur)}', icon: Icons.account_balance_wallet_outlined, color: Brand.expenses),
                  StatTile(label: tr('Profit'), value: money(t['profit'], cur), sub: '${t['margin']}% margin', icon: Icons.savings_outlined, color: toD(t['profit']) >= 0 ? Brand.green : Brand.red),
                  StatTile(label: tr('Harvested'), value: numf(t['harvested'], 0), sub: '${t['wastage_pct']}% waste', icon: Icons.shopping_basket_outlined),
                  StatTile(label: tr('Collected'), value: money(t['collected'], cur), icon: Icons.payments_outlined, color: Brand.revenue),
                  StatTile(label: tr('Overdue'), value: money(t['overdue'], cur), sub: 'of ${shortMoney(t['receivable'], cur)} due', icon: Icons.alarm, color: Brand.red),
                ]),
                const SizedBox(height: 12),
                AppCard(title: tr('Sales vs expenses'), child: trend.isEmpty ? const EmptyView() : BarsChart(
                  labels: [for (final r in trend) shortDate('${r['bucket']}')],
                  bars: [Series(tr('Sales'), Brand.revenue, [for (final r in trend) toD(r['revenue'])]), Series(tr('Expenses'), Brand.expenses, [for (final r in trend) toD(r['expenses'])])],
                  line: Series(tr('Profit'), Brand.profit, [for (final r in trend) toD(r['profit'])]), fmt: (v) => shortMoney(v, cur),
                )),
                const SizedBox(height: 12),
                AppCard(title: tr('In one line'), child: Text('${sum['finding'] ?? ''}')),
              ]);
          }
          if (children.isEmpty) children.add(const EmptyView());
          return ListView(padding: const EdgeInsets.fromLTRB(14, 6, 14, 100), children: children);
        },
      )),
    ]);
  }
}
