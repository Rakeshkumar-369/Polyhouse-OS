// Vendors: who owes what (overdue first) -> statement with running balance, record payment (+ receipt to send),
// send statement on WhatsApp, bill unbilled sales, prices.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'records_screen.dart';
import 'bills_screen.dart';

class VendorsScreen extends StatelessWidget {
  const VendorsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Loader<List<dynamic>>(
      load: () async {
        final r = List<dynamic>.from(await s.api.get('/reports/receivables'));
        r.sort((a, b) => toD(b['overdue']).compareTo(toD(a['overdue'])) != 0 ? toD(b['overdue']).compareTo(toD(a['overdue'])) : toD(b['balance']).compareTo(toD(a['balance'])));
        return r;
      },
      builder: (context, rows, reload) {
        final due = rows.fold<double>(0, (a, r) => a + (toD(r['balance']) > 0 ? toD(r['balance']) : 0));
        final over = rows.fold<double>(0, (a, r) => a + toD(r['overdue']));
        return ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 100), children: [
          Row(children: [
            Expanded(child: StatTile(label: 'Receivable', value: money(due, s.cur), icon: Icons.account_balance_wallet_outlined, color: Brand.revenue)),
            const SizedBox(width: 10),
            Expanded(child: StatTile(label: tr('Overdue'), value: money(over, s.cur), icon: Icons.alarm, color: over > 0 ? Brand.red : Brand.muted)),
          ]),
          const SizedBox(height: 12),
          if (rows.isEmpty) const EmptyView(text: 'No buyer vendors yet'),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () async {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => VendorDetail(party: Map<String, dynamic>.from(r))));
                    reload();
                  },
                  child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      Text('Last sale ${fdate(r['last_sale'])} · paid ${fdate(r['last_payment'])} · ${r['credit_days']}d credit', style: const TextStyle(color: Brand.muted, fontSize: 12)),
                    ])),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(money(r['balance'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      if (toD(r['overdue']) > 0) Pill('${tr('Overdue')} ${money(r['overdue'], s.cur)}', color: Brand.red) else Pill(toD(r['balance']) > 0 ? 'Due' : 'Clear', color: toD(r['balance']) > 0 ? Brand.amber : Brand.green),
                    ]),
                  ])),
                ),
              ),
            ),
        ]);
      },
    );
  }
}

class VendorDetail extends StatefulWidget {
  final Map<String, dynamic> party;
  const VendorDetail({super.key, required this.party});
  @override
  State<VendorDetail> createState() => _VendorDetailState();
}

class _VendorDetailState extends State<VendorDetail> {
  final _loader = GlobalKey<LoaderState<Map<String, dynamic>>>();
  late Period _period = periods().firstWhere((p) => p.key == 'last_30');

  Future<void> _remind() async {
    final s = SessionScope.read(context);
    final p = widget.party;
    var phone = '${p['phone'] ?? ''}'.replaceAll(RegExp(r'\D'), '');
    if (phone.length == 10) phone = '91$phone';
    final msg = 'Namaste ${p['name']}, your balance with ${s.org?['name']} is ${money(p['balance'], s.cur)}${toD(p['overdue']) > 0 ? ' (overdue ${money(p['overdue'], s.cur)})' : ''}. Kindly arrange payment. Thank you.';
    await launchUrl(Uri.parse('https://wa.me/$phone?text=${Uri.encodeComponent(msg)}'), mode: LaunchMode.externalApplication);
  }

  Future<void> _payment() async {
    if (await recordPayment(context, party: widget.party)) _loader.currentState?.reload();
  }

  Future<void> _statement() async {
    final s = SessionScope.read(context);
    try {
      final doc = Map<String, dynamic>.from(await s.api.get('/statement-link/${widget.party['party_id']}', {'from': _period.from, 'to': _period.to}));
      if (mounted) await showDocSheet(context, doc);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  Future<void> _makeBill(Map<String, dynamic> u) async {
    final s = SessionScope.read(context);
    try {
      final r = await s.api.post('/bills/from-sales', {'party_id': widget.party['party_id'], 'from': '${u['first_date']}'.substring(0, 10), 'to': todayIso()});
      final bills = List<dynamic>.from(r['bills']);
      setState(() => _unbilled = null);
      if (mounted && bills.isNotEmpty) await showDocSheet(context, Map<String, dynamic>.from(bills.first));
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  Map<String, dynamic>? _unbilled;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final s = SessionScope.read(context);
      if (!s.on('billing')) return;
      try {
        final u = List<dynamic>.from(await s.api.get('/bills/unbilled')).where((x) => '${x['party_id']}' == '${widget.party['party_id']}').firstOrNull;
        if (mounted && u != null) setState(() => _unbilled = Map<String, dynamic>.from(u));
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final p = widget.party;
    return Scaffold(
      appBar: AppBar(title: Text('${p['name']}'), actions: [
        if (s.on('billing')) IconButton(tooltip: tr('Send statement'), onPressed: _statement, icon: const Icon(Icons.chat, color: Color(0xFF16A34A)))
        else if ('${p['phone'] ?? ''}'.isNotEmpty) IconButton(tooltip: 'WhatsApp reminder', onPressed: _remind, icon: const Icon(Icons.chat, color: Color(0xFF16A34A))),
        IconButton(tooltip: tr('Prices'), onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => RecordsScreen(resKey: 'price_list', presetFilters: {'party_id': p['party_id']}))), icon: const Icon(Icons.sell_outlined)),
      ]),
      floatingActionButton: FloatingActionButton.extended(onPressed: _payment, icon: const Icon(Icons.payments_outlined), label: Text(tr('Payment received')), backgroundColor: Brand.green, foregroundColor: Colors.white),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 4), child: Row(children: [
          Expanded(child: Text('Due ${money(p['balance'], s.cur)} · overdue ${money(p['overdue'], s.cur)}', style: const TextStyle(fontWeight: FontWeight.w700))),
          PeriodDropdown(value: _period, onChanged: (v) { setState(() => _period = v); _loader.currentState?.reload(); }),
        ])),
        if (_unbilled != null)
          Container(
            margin: const EdgeInsets.fromLTRB(14, 6, 14, 0), padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
            decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              Expanded(child: Text('${_unbilled!['line_count']} ${tr('sale(s) not on a bill')} · ${money(_unbilled!['amount'], s.cur)}')),
              FilledButton(onPressed: () => _makeBill(_unbilled!), child: Text(tr('Make bill'))),
            ]),
          ),
        Expanded(child: Loader<Map<String, dynamic>>(
          key: _loader,
          load: () async => Map<String, dynamic>.from(await s.api.get('/reports/vendor/${p['party_id']}', {'from': _period.from, 'to': _period.to})),
          builder: (context, st, _) {
            final lines = List<dynamic>.from(st['lines']).reversed.toList();
            return ListView(padding: const EdgeInsets.fromLTRB(14, 8, 14, 100), children: [
              Card(child: ListTile(title: const Text('Closing balance'), subtitle: Text('Opening ${money(st['opening'], s.cur)} · sales ${money(st['total_sales'], s.cur)} · received ${money(st['total_paid'], s.cur)}'), trailing: Text(money(st['closing'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)))),
              const SizedBox(height: 8),
              for (final l in lines)
                ListTile(
                  dense: true,
                  leading: Icon(l['kind'] == 'sale' ? Icons.local_shipping_outlined : Icons.payments_outlined, color: l['kind'] == 'sale' ? Brand.revenue : Brand.green),
                  title: Text(l['kind'] == 'sale' ? '${l['crop']} ${l['grade']} · ${numf(l['quantity'])} × ${money(l['rate'], s.cur)}${toD(l['rejected_qty']) > 0 ? ' (−${numf(l['rejected_qty'])})' : ''}' : 'Payment · ${l['mode']}'),
                  subtitle: Text('${fdate(l['date'])} · balance ${money(l['balance'], s.cur)}${l['status'] == 'disputed' ? ' · disputed' : ''}'),
                  trailing: Text('${l['kind'] == 'payment' ? '−' : ''}${money(l['amount'], s.cur)}', style: TextStyle(fontWeight: FontWeight.w700, color: l['kind'] == 'payment' ? Brand.green : Brand.ink)),
                ),
              if (lines.isEmpty) const EmptyView(),
            ]);
          },
        )),
      ]),
    );
  }
}
