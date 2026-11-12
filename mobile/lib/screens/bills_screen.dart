// Bills & receipts on the phone:
//   showDocSheet()  - bill / receipt / statement summary with one-tap "Send on WhatsApp", Open / PDF, copy link, cancel bill
//   recordPayment() - money received from a vendor -> numbered receipt -> send it
//   BillsScreen     - Bills (period, not-sent filter) · To bill (one bill per vendor for unbilled sales) · Receipts
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'sell_screen.dart';

const whatsappGreen = Color(0xFF16A34A);

Future<void> openLink(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

// The send sheet. Returns true when something changed (sent / cancelled) so lists can reload.
Future<bool> showDocSheet(BuildContext context, Map<String, dynamic> doc) async {
  final r = await showModalBottomSheet<bool>(
    context: context, isScrollControlled: true, showDragHandle: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false, initialChildSize: .75, maxChildSize: .95, minChildSize: .4,
      builder: (c, scroll) => DocSheet(doc: doc, scroll: scroll),
    ),
  );
  return r == true;
}

class DocSheet extends StatefulWidget {
  final Map<String, dynamic> doc;
  final ScrollController? scroll;
  const DocSheet({super.key, required this.doc, this.scroll});
  @override
  State<DocSheet> createState() => _DocSheetState();
}

class _DocSheetState extends State<DocSheet> {
  bool _changed = false, _busy = false;
  Map<String, dynamic> get d => widget.doc;
  String get kind => '${d['kind']}';

  Future<void> _send() async {
    final s = SessionScope.read(context);
    await openLink('${d['share']['whatsapp']}');
    if (kind == 'bill') {
      try { await s.api.post('/bills/${d['bill']['id']}/sent'); _changed = true; } catch (_) {}
    }
  }

  Future<void> _cancel() async {
    final s = SessionScope.read(context);
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(tr('Cancel bill')), content: const Text('Its sale lines stay and can be billed again.'),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('No')), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('Cancel bill')))],
    ));
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await s.api.post('/bills/${d['bill']['id']}/cancel');
      if (mounted) { toast(context, 'Bill cancelled'); Navigator.pop(context, true); }
    } catch (e) {
      if (mounted) { toast(context, '$e', error: true); setState(() => _busy = false); }
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final isBill = kind == 'bill';
    final cancelled = isBill && d['bill']['status'] == 'cancelled';
    final no = isBill ? '${d['bill']['bill_no']}' : kind == 'receipt' ? '${d['payment']['receipt_no']}' : '${d['party']['name']}';
    final date = isBill ? d['bill']['date'] : kind == 'receipt' ? d['payment']['date'] : d['to'];
    final amount = isBill ? d['totals']['amount'] : kind == 'receipt' ? d['payment']['amount'] : d['closing'];
    final heading = isBill ? '${d['header']['title'] ?? 'Bill'}' : kind == 'receipt' ? 'Payment receipt' : 'Statement';
    final bal = d['balance'] is Map ? toD(d['balance']['balance']) : 0.0;
    return ListView(controller: widget.scroll, padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: cancelled ? const Color(0xFFFEF2F2) : Brand.greenSoft, borderRadius: BorderRadius.circular(18)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(heading.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Brand.muted, letterSpacing: .6)),
                Text(no, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                Text('${d['party']?['name'] ?? ''} · ${fdate(date)}', style: const TextStyle(color: Brand.muted), overflow: TextOverflow.ellipsis),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(money(amount, s.cur), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                if (cancelled) Pill(tr('cancelled'), color: Brand.red)
                else if (isBill && toD(d['bill']['sent_count']) > 0) Pill('${tr('sent')} ${d['bill']['sent_count']}×', color: Brand.green),
              ]),
            ]),
            if (isBill) ...[
              const SizedBox(height: 8),
              for (final l in d['lines'])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(children: [
                    Expanded(child: Text('${l['crop']} ${l['grade']} · ${numf(toD(l['quantity']) - toD(l['rejected_qty']))} ${l['unit'] ?? ''} × ${money(l['rate'], s.cur)}', overflow: TextOverflow.ellipsis)),
                    Text(money(l['amount'], s.cur), style: const TextStyle(fontWeight: FontWeight.w700)),
                  ]),
                ),
            ],
            if (bal > 0) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Total due from ${d['party']?['name']}: ${money(bal, s.cur)}', style: const TextStyle(color: Brand.muted))),
          ]),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: _send,
          style: FilledButton.styleFrom(backgroundColor: whatsappGreen, minimumSize: const Size.fromHeight(54), textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          icon: const Icon(Icons.chat),
          label: Text('${tr('Send on WhatsApp')}${'${d['share']['phone'] ?? ''}'.isEmpty ? ' (choose chat)' : ''}'),
        ),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: () => openLink('${d['share']['url']}'), icon: const Icon(Icons.print_outlined), label: Text(tr('Open / PDF')))),
          const SizedBox(width: 10),
          Expanded(child: OutlinedButton.icon(
            onPressed: () async { await Clipboard.setData(ClipboardData(text: '${d['share']['url']}')); if (context.mounted) toast(context, tr('Link copied')); },
            icon: const Icon(Icons.link), label: Text(tr('Copy link')))),
        ]),
        if (isBill && !cancelled && s.isManager) ...[
          const SizedBox(height: 10),
          TextButton.icon(onPressed: _busy ? null : _cancel, style: TextButton.styleFrom(foregroundColor: Brand.red), icon: const Icon(Icons.cancel_outlined), label: Text(tr('Cancel bill'))),
        ],
        const SizedBox(height: 6),
        ExpansionTile(
          tilePadding: EdgeInsets.zero, title: Text(tr('Message preview'), style: const TextStyle(color: Brand.muted, fontSize: 14)),
          children: [Container(width: double.infinity, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)), child: Text('${d['share']['text']}', style: const TextStyle(fontSize: 12.5)))],
        ),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: () => Navigator.pop(context, _changed), child: Text(tr('Done'))),
      ]);
  }
}

// Money received -> receipt sheet. `party` = a receivables row ({party_id, name, balance}) or null to pick the vendor.
Future<bool> recordPayment(BuildContext context, {Map<String, dynamic>? party}) async {
  final s = SessionScope.read(context);
  List<dynamic> vendors = [];
  if (party == null) {
    try { vendors = List<dynamic>.from(await s.api.get('/r/parties/options', {'kind': 'buyer'})); } catch (_) {}
  }
  if (!context.mounted) return false;
  String? vendor = party == null ? null : '${party['party_id']}';
  final bal = party == null ? 0.0 : toD(party['balance']);
  final amount = TextEditingController(text: bal > 0 ? bal.toStringAsFixed(bal.truncateToDouble() == bal ? 0 : 2) : '');
  final ref = TextEditingController();
  String mode = 'upi';
  final ok = await showModalBottomSheet<bool>(
    context: context, isScrollControlled: true, showDragHandle: true,
    builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(c).viewInsets.bottom),
      child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(party == null ? tr('Payment received') : '${tr('Payment received')} · ${party['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        if (party == null) ...[
          SectionLabel('Vendor'),
          ChipPicker(options: [for (final v in vendors) Choice('${v['id']}', '${v['label']}')], value: vendor, onChanged: (v) => set(() => vendor = v)),
          const SizedBox(height: 10),
        ],
        TextField(controller: amount, autofocus: party != null, keyboardType: const TextInputType.numberWithOptions(decimal: true), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800), decoration: InputDecoration(labelText: tr('Amount received'))),
        const SizedBox(height: 10),
        ChipPicker(options: const [Choice('cash', 'Cash'), Choice('upi', 'UPI'), Choice('bank', 'Bank'), Choice('cheque', 'Cheque')], value: mode, onChanged: (v) => set(() => mode = v)),
        const SizedBox(height: 10),
        TextField(controller: ref, decoration: const InputDecoration(labelText: 'UTR / reference')),
        const SizedBox(height: 14),
        FilledButton.icon(onPressed: () => Navigator.pop(c, true), icon: const Icon(Icons.payments_outlined), label: Text(s.on('billing') ? tr('Save & make receipt') : tr('Save'))),
      ])),
    )),
  );
  if (ok != true || !context.mounted) return false;
  if (vendor == null || toD(amount.text) <= 0) { toast(context, 'Pick the vendor and enter the amount', error: true); return false; }
  try {
    final row = await s.api.post('/r/payments_received', {'party_id': vendor, 'amount': amount.text, 'mode': mode, 'reference': ref.text, 'date': todayIso()});
    if (!context.mounted) return true;
    toast(context, '${money(amount.text, s.cur)} ${tr('recorded')}');
    if (s.on('billing')) {
      final doc = Map<String, dynamic>.from(await s.api.get('/receipts/${row['id']}'));
      if (context.mounted) await showDocSheet(context, doc);
    }
    return true;
  } catch (e) {
    if (context.mounted) toast(context, '$e', error: true);
    return false;
  }
}

// ------------------------------------------------------------------ Bills screen
class BillsScreen extends StatefulWidget {
  final int initialTab;
  final bool newPayment;
  const BillsScreen({super.key, this.initialTab = 0, this.newPayment = false});
  @override
  State<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends State<BillsScreen> {
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final tabs = [tr('Bills'), if (s.isManager) tr('To bill'), if (s.isManager) tr('Receipts')];
    return DefaultTabController(
      length: tabs.length, initialIndex: widget.initialTab.clamp(0, tabs.length - 1),
      child: Column(children: [
        Material(color: Colors.white, child: TabBar(tabs: [for (final t in tabs) Tab(text: t)], labelStyle: const TextStyle(fontWeight: FontWeight.w700))),
        Expanded(child: TabBarView(children: [
          const _BillList(),
          if (s.isManager) const _ToBill(),
          if (s.isManager) _Receipts(startNew: widget.newPayment),
        ])),
      ]),
    );
  }
}

class _BillList extends StatefulWidget {
  const _BillList();
  @override
  State<_BillList> createState() => _BillListState();
}

class _BillListState extends State<_BillList> {
  final _loader = GlobalKey<LoaderState<List<dynamic>>>();
  late Period _period = periods().firstWhere((p) => p.key == 'this_month');
  String _show = 'all';

  Future<void> _open(dynamic b) async {
    final s = SessionScope.read(context);
    try {
      final doc = Map<String, dynamic>.from(await s.api.get('/bills/${b['id']}'));
      if (!mounted) return;
      await showDocSheet(context, doc);
      _loader.currentState?.reload();
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 4), child: Row(children: [
        PeriodDropdown(value: _period, onChanged: (v) { setState(() => _period = v); _loader.currentState?.reload(); }),
        const Spacer(),
        FilledButton.icon(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => Scaffold(appBar: AppBar(title: Text(tr('Sell'))), body: const SellScreen()))).then((_) => _loader.currentState?.reload()),
            icon: const Icon(Icons.add), label: Text(tr('New sale'))),
      ])),
      Expanded(child: Loader<List<dynamic>>(
        key: _loader,
        load: () async => List<dynamic>.from(await s.api.get('/bills', {'from': _period.from, 'to': _period.to})),
        builder: (context, rows, reload) {
          final live = rows.where((b) => b['status'] == 'issued').toList();
          final unsent = live.where((b) => toD(b['sent_count']) == 0).length;
          final list = rows.where((b) => switch (_show) { 'unsent' => b['status'] == 'issued' && toD(b['sent_count']) == 0, 'cancelled' => b['status'] == 'cancelled', _ => true }).toList();
          return ListView(padding: const EdgeInsets.fromLTRB(14, 8, 14, 100), children: [
            Row(children: [
              Expanded(child: StatTile(label: tr('Bills'), value: '${live.length}', icon: Icons.receipt_long_outlined, color: Brand.revenue)),
              const SizedBox(width: 8),
              Expanded(child: StatTile(label: tr('Amount'), value: money(live.fold<double>(0, (a, b) => a + toD(b['amount'])), s.cur), icon: Icons.currency_rupee, color: Brand.green)),
            ]),
            const SizedBox(height: 8),
            ChipPicker(options: [const Choice('all', 'All'), Choice('unsent', '${tr('Not sent')} ($unsent)'), const Choice('cancelled', 'Cancelled')], value: _show, onChanged: (v) => setState(() => _show = v)),
            const SizedBox(height: 8),
            if (list.isEmpty) const EmptyView(text: 'No bills in this period', icon: Icons.receipt_long_outlined),
            for (final b in list)
              Card(child: ListTile(
                onTap: () => _open(b),
                title: Text('${b['party']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('${b['bill_no']} · ${fdate(b['date'])} · ${b['line_count']} ${tr('items')}'),
                trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(money(b['amount'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  b['status'] == 'cancelled' ? Pill(tr('cancelled'), color: Brand.red) : toD(b['sent_count']) > 0 ? Pill(tr('sent'), color: Brand.green) : Pill(tr('not sent'), color: Brand.amber),
                ]),
              )),
          ]);
        },
      )),
    ]);
  }
}

class _ToBill extends StatefulWidget {
  const _ToBill();
  @override
  State<_ToBill> createState() => _ToBillState();
}

class _ToBillState extends State<_ToBill> {
  final _loader = GlobalKey<LoaderState<List<dynamic>>>();
  final List<Map<String, dynamic>> _made = [];
  final Set<int> _sent = {};
  bool _busy = false;

  Future<void> _make(List<dynamic> rows, [dynamic partyId]) async {
    final s = SessionScope.read(context);
    final list = rows.where((u) => partyId == null || u['party_id'] == partyId).toList();
    if (list.isEmpty) return;
    final from = (list.map((u) => '${u['first_date']}').toList()..sort()).first;
    setState(() => _busy = true);
    try {
      final r = await s.api.post('/bills/from-sales', {'party_id': partyId, 'from': from.substring(0, 10), 'to': todayIso()});
      if (!mounted) return;
      setState(() => _made.insertAll(0, [for (final b in r['bills']) Map<String, dynamic>.from(b)]));
      toast(context, '${r['created']} ${tr('bill(s) made')}');
      _loader.currentState?.reload();
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send(Map<String, dynamic> b) async {
    final s = SessionScope.read(context);
    await openLink('${b['share']['whatsapp']}');
    try { await s.api.post('/bills/${b['bill']['id']}/sent'); } catch (_) {}
    if (mounted) setState(() => _sent.add(b['bill']['id'] as int));
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Loader<List<dynamic>>(
      key: _loader,
      load: () async => List<dynamic>.from(await s.api.get('/bills/unbilled')),
      builder: (context, rows, reload) {
        final total = rows.fold<double>(0, (a, u) => a + toD(u['amount']));
        return ListView(padding: const EdgeInsets.fromLTRB(14, 12, 14, 100), children: [
          if (_made.isNotEmpty)
            AppCard(
              title: tr('Bills made — send them'), subtitle: 'One tap opens WhatsApp with the bill',
              child: Column(children: [
                for (final b in _made)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    onTap: () => showDocSheet(context, b),
                    title: Text('${b['party']['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${b['bill']['bill_no']} · ${money(b['totals']['amount'], s.cur)}'),
                    trailing: FilledButton.icon(
                      onPressed: () => _send(b),
                      style: FilledButton.styleFrom(backgroundColor: _sent.contains(b['bill']['id']) ? Brand.muted : whatsappGreen),
                      icon: Icon(_sent.contains(b['bill']['id']) ? Icons.check : Icons.chat, size: 18),
                      label: Text(_sent.contains(b['bill']['id']) ? tr('Sent') : tr('Send')),
                    ),
                  ),
              ]),
            ),
          AppCard(
            title: tr('Sales not on a bill yet'), subtitle: 'For vendors you bill weekly or monthly',
            action: rows.length > 1 ? Padding(padding: const EdgeInsets.only(right: 8), child: FilledButton(onPressed: _busy ? null : () => _make(rows), child: Text('${tr('Bill all')} ${money(total, s.cur)}'))) : null,
            child: rows.isEmpty ? const EmptyView(text: 'Everything is billed', icon: Icons.check_circle_outline) : Column(children: [
              for (final u in rows)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${u['party']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${u['line_count']} ${tr('sale(s)')} · ${fdate(u['first_date'])} – ${fdate(u['last_date'])} · ${money(u['amount'], s.cur)}'),
                  trailing: OutlinedButton(onPressed: _busy ? null : () => _make(rows, u['party_id']), child: Text(tr('Make bill'))),
                ),
            ]),
          ),
        ]);
      },
    );
  }
}

class _Receipts extends StatefulWidget {
  final bool startNew;
  const _Receipts({this.startNew = false});
  @override
  State<_Receipts> createState() => _ReceiptsState();
}

class _ReceiptsState extends State<_Receipts> {
  final _loader = GlobalKey<LoaderState<List<dynamic>>>();
  late Period _period = periods().firstWhere((p) => p.key == 'this_month');

  @override
  void initState() {
    super.initState();
    if (widget.startNew) WidgetsBinding.instance.addPostFrameCallback((_) => _new());
  }

  Future<void> _new() async {
    if (await recordPayment(context)) _loader.currentState?.reload();
  }

  Future<void> _open(dynamic p) async {
    final s = SessionScope.read(context);
    try {
      final doc = Map<String, dynamic>.from(await s.api.get('/receipts/${p['id']}'));
      if (mounted) await showDocSheet(context, doc);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 4), child: Row(children: [
        PeriodDropdown(value: _period, onChanged: (v) { setState(() => _period = v); _loader.currentState?.reload(); }),
        const Spacer(),
        FilledButton.icon(onPressed: _new, icon: const Icon(Icons.add), label: Text(tr('Payment'))),
      ])),
      Expanded(child: Loader<List<dynamic>>(
        key: _loader,
        load: () async => List<dynamic>.from(await s.api.get('/r/payments_received', {'from': _period.from, 'to': _period.to})),
        builder: (context, rows, reload) => ListView(padding: const EdgeInsets.fromLTRB(14, 8, 14, 100), children: [
          Card(child: ListTile(title: Text('${rows.length} ${tr('payments')}'), trailing: Text(money(rows.fold<double>(0, (a, r) => a + toD(r['amount'])), s.cur), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)))),
          if (rows.isEmpty) const EmptyView(text: 'No payments in this period', icon: Icons.payments_outlined),
          for (final p in rows)
            Card(child: ListTile(
              onTap: () => _open(p),
              title: Text('${p['party_id_label']}', style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text('${p['receipt_no'] ?? '—'} · ${fdate(p['date'])} · ${'${p['mode'] ?? ''}'.toUpperCase()}'),
              trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(money(p['amount'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.green, fontSize: 15)),
                Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.chat, size: 13, color: whatsappGreen), const SizedBox(width: 3), Text(tr('Send'), style: const TextStyle(color: whatsappGreen, fontSize: 12, fontWeight: FontWeight.w600))]),
              ]),
            )),
        ]),
      )),
    ]);
  }
}
