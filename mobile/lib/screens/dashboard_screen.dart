// Home: owner/manager get money & decisions for a period; supervisor gets today's field view.
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'suggestions_screen.dart';

String greeting() {
  final h = DateTime.now().hour;
  return tr(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _loader = GlobalKey<LoaderState<Map<String, dynamic>>>();
  late Period _period = periods().firstWhere((p) => p.key == 'this_month');

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Loader<Map<String, dynamic>>(
      key: _loader,
      load: () async => Map<String, dynamic>.from(await s.api.get('/dashboard', {'from': _period.from, 'to': _period.to, 'group': _period.group})),
      builder: (context, d, reload) => d['role'] == 'field' ? _field(s, d) : _owner(s, d),
    );
  }

  Widget _field(Session s, Map d) => ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 100), children: [
        Text('${greeting()}, ${'${s.user['name']}'.split(' ').first}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        TodayCards(today: Map<String, dynamic>.from(d['today'])),
        const SizedBox(height: 12),
        AppCard(title: tr('Alerts'), child: AlertList(alerts: List<dynamic>.from(d['alerts']))),
      ]);

  Widget _owner(Session s, Map d) {
    final sum = Map<String, dynamic>.from(d['summary']);
    final t = Map<String, dynamic>.from(sum['totals']);
    final p = Map<String, dynamic>.from(d['prev']);
    final ins = Map<String, dynamic>.from(d['insights']);
    final trend = List<Map>.from(sum['trend']);
    final crops = List<Map>.from(sum['byCrop']);
    final cur = s.cur;
    return ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 100), children: [
      Row(children: [
        Expanded(child: Text('${greeting()}, ${'${s.user['name']}'.split(' ').first}', style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800))),
        PeriodDropdown(value: _period, onChanged: (v) { setState(() => _period = v); _loader.currentState?.reload(); }),
      ]),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(gradient: const LinearGradient(colors: [Brand.greenDark, Brand.green]), borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr('In one line').toUpperCase(), style: const TextStyle(color: Color(0xFFBBF7D0), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .8)),
          const SizedBox(height: 6),
          Text('${d['finding']}', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600, height: 1.35)),
        ]),
      ),
      const SizedBox(height: 12),
      TileGrid(children: [
        StatTile(label: tr('Sales'), value: money(t['revenue'], cur), sub: 'vs prev.', delta: pctChange(t['revenue'], p['revenue']), icon: Icons.trending_up, color: Brand.revenue),
        StatTile(label: tr('Expenses'), value: money(t['expenses'], cur), sub: 'vs prev.', delta: pctChange(t['expenses'], p['expenses']), goodUp: false, icon: Icons.account_balance_wallet_outlined, color: Brand.expenses),
        StatTile(label: tr(toD(t['profit']) >= 0 ? 'Profit' : 'Loss'), value: money(t['profit'], cur), sub: '${t['margin']}% margin', icon: Icons.savings_outlined, color: toD(t['profit']) >= 0 ? Brand.green : Brand.red),
        StatTile(label: tr('Harvested'), value: numf(t['harvested'], 0), sub: '${t['sell_through']}% sold', delta: pctChange(t['harvested'], p['harvested']), icon: Icons.shopping_basket_outlined),
        StatTile(label: 'Avg price', value: money(t['avg_price'], cur), sub: '${t['rejection_pct']}% rejected', icon: Icons.sell_outlined, color: const Color(0xFF6250D6)),
        ins['cash'] != null
            ? StatTile(label: tr('Cash in hand'), value: money(ins['cash'], cur), sub: '${shortMoney(t['collected'], cur)} collected', icon: Icons.payments_outlined, color: Brand.revenue)
            : StatTile(label: tr('Collected'), value: money(t['collected'], cur), icon: Icons.payments_outlined, color: Brand.revenue),
      ]),
      if ((d['suggestions'] as List).isNotEmpty) ...[
        const SizedBox(height: 12),
        AppCard(title: '💡 ${tr('Smart suggestions')}', subtitle: 'Learned from your past seasons', child: SuggestionList(items: List<dynamic>.from(d['suggestions']), limit: 3)),
      ],
      const SizedBox(height: 12),
      AppCard(
        title: tr('Sales vs expenses'),
        child: trend.isEmpty
            ? const EmptyView()
            : BarsChart(
                labels: [for (final r in trend) shortDate('${r['bucket']}')],
                bars: [Series(tr('Sales'), Brand.revenue, [for (final r in trend) toD(r['revenue'])]), Series(tr('Expenses'), Brand.expenses, [for (final r in trend) toD(r['expenses'])])],
                line: Series(tr('Profit'), Brand.profit, [for (final r in trend) toD(r['profit'])]),
                fmt: (v) => shortMoney(v, cur),
              ),
      ),
      const SizedBox(height: 12),
      AppCard(title: tr('Needs attention'), child: AlertList(alerts: List<dynamic>.from(d['alerts']), limit: 4)),
      const SizedBox(height: 12),
      AppCard(
        title: tr('Crops'), subtitle: 'Price vs cost per unit',
        child: crops.isEmpty ? const EmptyView() : Column(children: [
          for (final c in crops)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                CircleAvatar(radius: 6, backgroundColor: hexColor(c['color'])),
                const SizedBox(width: 8),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${c['crop']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('${numf(c['harvested'])} ${c['unit']} · price ${money(c['avg_price'], cur)} · cost ${money(c['cost_per_unit'], cur)}', style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
                ])),
                Text(money(c['profit'], cur), style: TextStyle(fontWeight: FontWeight.w800, color: toD(c['profit']) < 0 ? Brand.red : Brand.green)),
              ]),
            ),
        ]),
      ),
      const SizedBox(height: 12),
      AppCard(
        title: tr('Who owes how long'), subtitle: '${money(ins['receivable'], cur)} due · ~${ins['dso']} days to collect',
        child: Column(children: [
          for (final a in List<Map>.from(ins['ageing']).where((a) => toD(a['amount']) > 0))
            ShareBar(label: '${a['label']}', value: money(a['amount'], cur), fraction: toD(a['amount']) / (toD(ins['receivable']) == 0 ? 1 : toD(ins['receivable'])), color: Brand.red),
          if (List<Map>.from(ins['ageing']).every((a) => toD(a['amount']) == 0)) const EmptyView(text: 'Nobody owes you money', icon: Icons.sentiment_satisfied_alt),
        ]),
      ),
      const SizedBox(height: 12),
      AppCard(
        title: tr('Best paying vendor per crop'),
        child: Column(children: [
          for (final b in List<Map>.from(sum['bestVendor']))
            ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${b['crop']}', style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text('${b['vendor']}'), trailing: Text(money(b['rate'], cur), style: const TextStyle(fontWeight: FontWeight.w800))),
          if ((sum['bestVendor'] as List).isEmpty) const EmptyView(),
        ]),
      ),
      const SizedBox(height: 12),
      Text(tr('Today'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      TodayCards(today: Map<String, dynamic>.from(d['today'])),
    ]);
  }
}

class TodayCards extends StatelessWidget {
  final Map<String, dynamic> today;
  const TodayCards({super.key, required this.today});
  @override
  Widget build(BuildContext context) {
    final harvest = List<Map>.from(today['harvest']);
    final unsold = List<Map>.from(today['produce']).where((p) => toD(p['available']) > 0).toList();
    final att = today['attendance'];
    final tasks = List<Map>.from(today['tasks']);
    final locks = List<Map>.from(today['locks']);
    final orders = List<Map>.from(today['openOrders']);
    return Column(children: [
      AppCard(
        title: tr('Plucked today'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (harvest.isEmpty) const Text('No harvest entered today.', style: TextStyle(color: Brand.muted)),
          for (final h in harvest)
            Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [CircleAvatar(radius: 5, backgroundColor: hexColor(h['color'])), const SizedBox(width: 8), Expanded(child: Text('${h['crop']}')), Text('${numf(h['qty'])} ${h['unit']}', style: const TextStyle(fontWeight: FontWeight.w700))])),
          if (unsold.isNotEmpty)
            Container(margin: const EdgeInsets.only(top: 8), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(12)),
                child: Text('Not sold yet: ${unsold.map((u) => '${u['crop']} ${u['grade']} ${numf(u['available'])}').join(' · ')}')),
        ]),
      ),
      if (att != null) ...[
        const SizedBox(height: 10),
        AppCard(title: tr('Labour today'), child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
          _count('${att['present'] ?? 0}', 'present', Brand.green),
          _count('${att['half'] ?? 0}', 'half day', Brand.amber),
          _count('${(toD(att['workers']) - toD(att['present']) - toD(att['half'])).clamp(0, 9999).round()}', 'not marked', Brand.muted),
        ])),
      ],
      if (orders.isNotEmpty) ...[
        const SizedBox(height: 10),
        AppCard(title: 'Open vendor orders', child: Column(children: [
          for (final o in orders.take(6)) ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${o['party']} · ${o['crop']} ${o['grade']}'), trailing: Text('${numf(o['quantity'])} · ${fdate(o['date'])}')),
        ])),
      ],
      if (tasks.isNotEmpty) ...[
        const SizedBox(height: 10),
        AppCard(title: "Today's tasks", child: Column(children: [
          for (final k in tasks.take(6)) ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${k['title']}'), subtitle: k['worker'] == null ? null : Text('${k['worker']}'), trailing: Pill('${k['status']}', color: k['status'] == 'done' ? Brand.green : Brand.amber)),
        ])),
      ],
      if (locks.isNotEmpty) ...[
        const SizedBox(height: 10),
        AppCard(title: '🔒 Harvest locked (spray)', child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final l in locks) Text('${l['farm_name']}${l['bay_name'] != null ? ' / ${l['bay_name']}' : ''} — safe from ${fdate(l['lock_until'])}'),
        ])),
      ],
    ]);
  }

  Widget _count(String n, String l, Color c) => Column(children: [Text(n, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c)), Text(l, style: const TextStyle(color: Brand.muted, fontSize: 12))]);
}

const _levelColor = {'red': Brand.red, 'amber': Brand.amber, 'info': Brand.revenue};
const _levelIcon = {'red': Icons.error, 'amber': Icons.warning_amber_rounded, 'info': Icons.info};

class AlertList extends StatelessWidget {
  final List<dynamic> alerts;
  final int? limit;
  const AlertList({super.key, required this.alerts, this.limit});
  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) return const EmptyView(text: 'All clear — nothing needs attention.', icon: Icons.sentiment_satisfied_alt);
    return Column(children: [
      for (final a in alerts.take(limit ?? alerts.length))
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(border: Border(left: BorderSide(color: _levelColor[a['level']] ?? Brand.muted, width: 4)), color: (_levelColor[a['level']] ?? Brand.muted).withValues(alpha: .05), borderRadius: BorderRadius.circular(10)),
          padding: const EdgeInsets.all(10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(_levelIcon[a['level']] ?? Icons.info, color: _levelColor[a['level']], size: 20),
            const SizedBox(width: 8),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${a['title']}', style: const TextStyle(fontWeight: FontWeight.w700)),
              Text('${a['detail']}', style: const TextStyle(color: Brand.muted, fontSize: 12.5)),
            ])),
          ]),
        ),
    ]);
  }
}

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Loader<List<dynamic>>(
      load: () async => List<dynamic>.from(await s.api.get('/alerts')),
      builder: (context, a, _) => ListView(padding: const EdgeInsets.all(14), children: [AlertList(alerts: a)]),
    );
  }
}
