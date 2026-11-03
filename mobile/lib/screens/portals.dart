// Vendor app (deliveries, dues, prices, orders) and Labour app (check-in, earnings, tasks, payslips).
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class PortalScaffold extends StatelessWidget {
  final Widget body;
  final Widget? fab;
  const PortalScaffold({super.key, required this.body, this.fab});
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Brand.green, foregroundColor: Colors.white,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${s.user['name']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          Text('${s.org?['name'] ?? ''}', style: const TextStyle(color: Color(0xFFBBF7D0), fontSize: 12)),
        ]),
        actions: [
          TextButton(onPressed: () => s.setLang(s.lang == 'en' ? 'te' : 'en'), child: Text(s.lang == 'en' ? 'తెలుగు' : 'English', style: const TextStyle(color: Colors.white))),
          IconButton(onPressed: s.logout, icon: const Icon(Icons.logout), tooltip: tr('Logout')),
        ],
      ),
      body: body,
      floatingActionButton: fab,
    );
  }
}

// ---------------------------------------------------------------- VENDOR
class VendorApp extends StatefulWidget {
  const VendorApp({super.key});
  @override
  State<VendorApp> createState() => _VendorAppState();
}

class _VendorAppState extends State<VendorApp> {
  final _loader = GlobalKey<LoaderState<Map<String, dynamic>>>();
  String _tab = 'deliveries';

  Future<void> _confirm(Map sale) async {
    final s = SessionScope.read(context);
    final rej = TextEditingController(text: '0'), note = TextEditingController();
    final ok = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, showDragHandle: true, builder: (c) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(c).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('${sale['crop']} ${sale['grade']} · ${numf(sale['quantity'])} ${sale['unit']} · ${fdate(sale['date'])}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            TextField(controller: rej, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Rejected quantity (0 if all good)')),
            const SizedBox(height: 10),
            TextField(controller: note, decoration: const InputDecoration(labelText: 'Remark')),
            const SizedBox(height: 14),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('Confirm'))),
          ]),
        ));
    if (ok != true) return;
    try {
      await s.api.put('/portal/vendor/sales/${sale['id']}', {'rejected_qty': rej.text, 'vendor_note': note.text});
      if (mounted) { toast(context, 'Thank you, recorded'); _loader.currentState?.reload(); }
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  Future<void> _order() async {
    final s = SessionScope.read(context);
    final crops = List<dynamic>.from(await s.api.get('/r/crops/options'));
    if (!mounted) return;
    String? crop; String grade = s.grades.first;
    final qty = TextEditingController();
    DateTime date = DateTime.now().add(const Duration(days: 1));
    final ok = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, showDragHandle: true, builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(c).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr('Place an order'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            ChipPicker(options: [for (final o in crops) Choice('${o['id']}', '${o['label']}')], value: crop, onChanged: (v) => set(() => crop = v)),
            const SizedBox(height: 10),
            ChipPicker(options: [for (final g in s.grades) Choice(g, g)], value: grade, onChanged: (v) => set(() => grade = v)),
            const SizedBox(height: 10),
            TextField(controller: qty, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr('Quantity'))),
            const SizedBox(height: 10),
            OutlinedButton.icon(icon: const Icon(Icons.calendar_today, size: 16), label: Text('Needed on ${fdate(iso(date))}'), onPressed: () async {
              final d = await showDatePicker(context: c, initialDate: date, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 90)));
              if (d != null) set(() => date = d);
            }),
            const SizedBox(height: 14),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Send order')),
          ]),
        )));
    if (ok != true || crop == null) return;
    try {
      await s.api.post('/portal/vendor/orders', {'crop_id': crop, 'grade': grade, 'quantity': qty.text, 'date': iso(date)});
      if (mounted) { toast(context, 'Order sent to the farm'); _loader.currentState?.reload(); }
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return PortalScaffold(
      fab: FloatingActionButton.extended(onPressed: _order, icon: const Icon(Icons.add_shopping_cart), label: Text(tr('Place an order')), backgroundColor: Brand.green, foregroundColor: Colors.white),
      body: Loader<Map<String, dynamic>>(
        key: _loader,
        load: () async => Map<String, dynamic>.from(await s.api.get('/portal/vendor')),
        builder: (context, d, _) {
          final lines = List<dynamic>.from(d['lines']);
          final sales = lines.where((l) => l['kind'] == 'sale').toList().reversed.toList();
          final week = iso(DateTime.now().subtract(const Duration(days: 7)));
          return ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 100), children: [
            Row(children: [
              Expanded(child: StatTile(label: tr('You owe'), value: money(d['closing'], s.cur), icon: Icons.account_balance_wallet_outlined, color: Brand.revenue)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(label: tr('Overdue'), value: money(d['overdue'], s.cur), icon: Icons.alarm, color: toD(d['overdue']) > 0 ? Brand.red : Brand.muted)),
            ]),
            const SizedBox(height: 12),
            ChipPicker(options: const [Choice('deliveries', 'Deliveries'), Choice('statement', 'Statement'), Choice('prices', 'Prices'), Choice('orders', 'My orders')], value: _tab, onChanged: (v) => setState(() => _tab = v)),
            const SizedBox(height: 12),
            if (_tab == 'deliveries') ...[
              if (sales.isEmpty) const EmptyView(text: 'No deliveries in the last 30 days'),
              for (final x in sales)
                Card(margin: const EdgeInsets.only(bottom: 8), child: ListTile(
                  title: Text('${x['crop']} ${x['grade']} · ${numf(x['quantity'])} ${x['unit']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${fdate(x['date'])} · ${money(x['rate'], s.cur)}/${x['unit']}${toD(x['rejected_qty']) > 0 ? ' · rejected ${numf(x['rejected_qty'])}' : ''}'),
                  trailing: x['status'] == 'delivered' && '${x['date']}'.compareTo(week) >= 0
                      ? FilledButton(onPressed: () => _confirm(x), style: FilledButton.styleFrom(minimumSize: const Size(70, 36)), child: Text(tr('Confirm')))
                      : Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [Text(money(x['amount'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800)), Pill('${x['status']}', color: x['status'] == 'disputed' ? Brand.red : Brand.green)]),
                )),
            ],
            if (_tab == 'statement') ...[
              for (final l in lines.reversed)
                ListTile(dense: true, title: Text(l['kind'] == 'sale' ? '${l['crop']} ${numf(l['quantity'])} × ${money(l['rate'], s.cur)}' : 'Paid · ${l['mode']}'),
                    subtitle: Text('${fdate(l['date'])} · balance ${money(l['balance'], s.cur)}'),
                    trailing: Text('${l['kind'] == 'payment' ? '−' : ''}${money(l['amount'], s.cur)}', style: TextStyle(fontWeight: FontWeight.w700, color: l['kind'] == 'payment' ? Brand.green : Brand.ink))),
            ],
            if (_tab == 'prices') ...[
              for (final p in List<dynamic>.from(d['prices']))
                Card(margin: const EdgeInsets.only(bottom: 8), child: ListTile(title: Text('${p['crop']} · ${tr('Grade')} ${p['grade']}'), trailing: Text('${money(p['price'], s.cur)}/${p['unit']}', style: const TextStyle(fontWeight: FontWeight.w800)))),
              if ((d['prices'] as List).isEmpty) const EmptyView(text: 'No prices set'),
            ],
            if (_tab == 'orders') ...[
              for (final o in List<dynamic>.from(d['orders']))
                Card(margin: const EdgeInsets.only(bottom: 8), child: ListTile(
                  title: Text('${o['crop']} ${o['grade']} · ${numf(o['quantity'])} ${o['unit']}'), subtitle: Text('for ${fdate(o['date'])}${o['notes'] != null ? ' · ${o['notes']}' : ''}'),
                  trailing: o['status'] == 'open'
                      ? TextButton(onPressed: () async { await s.api.delete('/portal/vendor/orders/${o['id']}'); _loader.currentState?.reload(); }, child: Text(tr('Cancel')))
                      : Pill('${o['status']}', color: o['status'] == 'fulfilled' ? Brand.green : Brand.muted),
                )),
              if ((d['orders'] as List).isEmpty) const EmptyView(text: 'No orders yet'),
            ],
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- LABOUR
class LabourApp extends StatefulWidget {
  const LabourApp({super.key});
  @override
  State<LabourApp> createState() => _LabourAppState();
}

class _LabourAppState extends State<LabourApp> {
  final _loader = GlobalKey<LoaderState<Map<String, dynamic>>>();
  static const _colors = {'present': Color(0xFFDCFCE7), 'half': Color(0xFFFEF3C7), 'absent': Color(0xFFFEE2E2), 'leave': Color(0xFFF1F5F9)};

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return PortalScaffold(
      body: Loader<Map<String, dynamic>>(
        key: _loader,
        load: () async => Map<String, dynamic>.from(await s.api.get('/portal/labour')),
        builder: (context, d, reload) {
          final t = d['today'];
          final label = t == null || t['check_in'] == null ? tr('Check in') : t['check_out'] == null ? tr('Check out') : tr('Done for today');
          final week = d['week'], month = d['month'];
          final locks = List<dynamic>.from(d['locks']);
          return ListView(padding: const EdgeInsets.all(14), children: [
            SizedBox(
              height: 110,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: t?['check_in'] == null ? Brand.green : Brand.ink, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
                onPressed: t?['check_out'] != null ? null : () async {
                  try {
                    await s.api.post('/portal/labour/checkin');
                    reload();
                  } catch (e) {
                    if (context.mounted) toast(context, '$e', error: true);
                  }
                },
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(t?['check_in'] == null ? Icons.fingerprint : Icons.logout, size: 30), const SizedBox(width: 10), Text(label, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800))]),
                  if (t?['check_in'] != null) Text('In ${'${t['check_in']}'.substring(0, 5)}${t['check_out'] != null ? ' · Out ${'${t['check_out']}'.substring(0, 5)}' : ''}', style: const TextStyle(fontSize: 14)),
                ]),
              ),
            ),
            if (locks.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(14)),
                  child: Text('⛔ ${tr('Do not enter / pick:')} ${locks.map((l) => '${l['farm_name']}${l['bay_name'] != null ? ' ${l['bay_name']}' : ''}').join(', ')}', style: const TextStyle(color: Brand.red, fontWeight: FontWeight.w700))),
            ],
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: StatTile(label: tr('This week'), value: money(toD(week['gross']) + toD(week['bonus']), s.cur), sub: '${numf(week['days_worked'])} ${tr('Days')}', icon: Icons.calendar_view_week)),
              const SizedBox(width: 10),
              Expanded(child: StatTile(label: tr('This month'), value: money(toD(month['gross']) + toD(month['bonus']), s.cur), sub: '${tr('Paid')} ${money(month['paid'], s.cur)}', icon: Icons.calendar_month, color: Brand.revenue)),
            ]),
            if (toD(month['advance_due']) > 0) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Advance to be adjusted: ${money(month['advance_due'], s.cur)}', style: const TextStyle(color: Brand.amber, fontWeight: FontWeight.w600))),
            if ((d['tasks'] as List).isNotEmpty) ...[
              const SizedBox(height: 12),
              AppCard(title: tr('My work today'), child: Column(children: [
                for (final k in List<dynamic>.from(d['tasks']))
                  ListTile(contentPadding: EdgeInsets.zero, title: Text('${k['title']}', style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text([k['farm'], k['bay']].where((x) => x != null).join(' / ')),
                      trailing: k['status'] == 'done' ? const Pill('done', color: Brand.green) : FilledButton(onPressed: () async { await s.api.put('/portal/labour/tasks/${k['id']}'); reload(); }, style: FilledButton.styleFrom(minimumSize: const Size(60, 36)), child: Text(tr('Mark done')))),
              ])),
            ],
            const SizedBox(height: 12),
            AppCard(title: tr('My attendance'), child: Wrap(spacing: 6, runSpacing: 6, children: [
              for (final a in List<dynamic>.from(d['attendance']).take(28).toList().reversed)
                Container(width: 40, height: 34, alignment: Alignment.center, decoration: BoxDecoration(color: _colors[a['status']], borderRadius: BorderRadius.circular(8)),
                    child: Text('${a['date']}'.substring(8), style: const TextStyle(fontWeight: FontWeight.w700))),
            ])),
            const SizedBox(height: 12),
            AppCard(title: tr('Payslips'), child: Column(children: [
              for (final p in List<dynamic>.from(d['payslips']))
                ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${fdate(p['period_start'])} – ${fdate(p['period_end'])}'), subtitle: Text('Gross ${money(p['gross'], s.cur)}${toD(p['deductions']) > 0 ? ' · cut ${money(p['deductions'], s.cur)}' : ''}'), trailing: Text(money(p['net_paid'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800))),
              if ((d['payslips'] as List).isEmpty) const EmptyView(text: 'No payments yet'),
            ])),
          ]);
        },
      ),
    );
  }
}
