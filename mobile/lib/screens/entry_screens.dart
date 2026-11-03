// Daily entry screens - each record in a few taps:
//   Sell    : crop -> grade -> vendor -> quantity (price comes from the vendor's price list)
//   Harvest : crop -> grade -> quantity (+ farm / bay / picker), respects spray locks
//   Spend   : category -> amount (+ supplier / farm / stock item)
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

// Loads the dropdown lists an entry screen needs (crops, vendors, farms ...)
Future<Map<String, List<dynamic>>> loadLists(Session s, Map<String, String> wanted) async {
  final out = <String, List<dynamic>>{};
  await Future.wait(wanted.entries.map((e) async {
    try {
      out[e.key] = List<dynamic>.from(await s.api.get(e.value));
    } catch (_) {
      out[e.key] = [];
    }
  }));
  return out;
}

Widget bigNumber(TextEditingController c, String label, {bool enabled = true}) => TextField(
      controller: c, enabled: enabled,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
      decoration: InputDecoration(labelText: label, hintText: '0'),
    );

Widget dropdown(String label, String? value, List<dynamic> opts, ValueChanged<String?> onChanged, {String empty = '—'}) => DropdownButtonFormField<String>(
      initialValue: opts.any((o) => '${o['id']}' == value) ? value : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: tr(label)),
      items: [DropdownMenuItem(value: null, child: Text(empty)), for (final o in opts) DropdownMenuItem(value: '${o['id']}', child: Text('${o['label'] ?? o['name']}', overflow: TextOverflow.ellipsis))],
      onChanged: onChanged,
    );

// ------------------------------------------------------------------ SELL
class SellScreen extends StatefulWidget {
  const SellScreen({super.key});
  @override
  State<SellScreen> createState() => _SellScreenState();
}

class _SellScreenState extends State<SellScreen> {
  Map<String, List<dynamic>>? _lists;
  String? _crop, _vendor, _farm, _order;
  late String _grade;
  final _qty = TextEditingController();
  final _rate = TextEditingController();
  String? _priceSource;
  bool _busy = false;
  List<dynamic> _today = [];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_lists == null) _load();
  }

  @override
  void initState() {
    super.initState();
    // live amount = quantity x rate while typing
    _qty.addListener(_refreshAmount);
    _rate.addListener(_refreshAmount);
  }

  void _refreshAmount() => setState(() {});

  @override
  void dispose() {
    _qty.dispose();
    _rate.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final s = SessionScope.read(context);
    _grade = s.grades.first;
    final l = await loadLists(s, {
      'crops': '/r/crops', 'vendors': '/r/parties/options?kind=buyer', 'farms': '/r/farms/options',
      if (s.on('orders')) 'orders': '/r/orders?status=open',
    });
    if (!mounted) return;
    setState(() {
      _lists = l;
      if (l['farms']!.length == 1) _farm = '${l['farms']![0]['id']}';
    });
    _loadToday();
  }

  Future<void> _loadToday() async {
    final s = SessionScope.read(context);
    try {
      final t = await s.api.get('/r/sales', {'from': todayIso(), 'to': todayIso()});
      if (mounted) setState(() => _today = List<dynamic>.from(t));
    } catch (_) {}
  }

  Future<void> _price() async {
    if (_crop == null || _vendor == null) return;
    final s = SessionScope.read(context);
    try {
      final p = await s.api.get('/ops/price', {'party_id': _vendor, 'crop_id': _crop, 'grade': _grade, 'date': todayIso()});
      if (mounted) setState(() { _rate.text = '${p['price']}'; _priceSource = '${p['source']}'; });
    } catch (_) {}
  }

  Future<void> _save() async {
    final s = SessionScope.read(context);
    if (_crop == null || _vendor == null || toD(_qty.text) <= 0) return toast(context, 'Pick crop, vendor and quantity', error: true);
    setState(() => _busy = true);
    try {
      final r = await s.api.post('/r/sales', {
        'date': todayIso(), 'crop_id': _crop, 'party_id': _vendor, 'grade': _grade, 'quantity': _qty.text, 'farm_id': _farm ?? '', 'order_id': _order ?? '',
        if (s.isManager) 'rate': _rate.text,
      });
      if (!mounted) return;
      toast(context, '${numf(r['quantity'])} → ${r['party_id_label']} = ${money(r['amount'], s.cur)}');
      setState(() { _qty.clear(); _order = null; });
      _loadToday();
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    if (_lists == null) return const Center(child: CircularProgressIndicator());
    final crops = _lists!['crops']!.where((c) => c['active'] == 1).toList();
    final crop = crops.where((c) => '${c['id']}' == _crop).firstOrNull;
    final orders = (_lists!['orders'] ?? []).where((o) => '${o['party_id']}' == _vendor && '${o['crop_id']}' == _crop).toList();
    final amount = toD(_qty.text) * toD(_rate.text);
    final total = _today.fold<double>(0, (a, x) => a + toD(x['amount']));
    return ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 120), children: [
      SectionLabel('1. Crop'),
      crops.isEmpty ? const Text('No crops yet. The owner must add crops first.') : ChipPicker(options: [for (final c in crops) Choice('${c['id']}', '${c['name']}', hexColor(c['color']))], value: _crop, onChanged: (v) { setState(() { _crop = v; _order = null; }); _price(); }),
      const SizedBox(height: 14),
      SectionLabel('Grade'),
      ChipPicker(options: [for (final g in s.grades) Choice(g, g)], value: _grade, onChanged: (v) { setState(() => _grade = v); _price(); }),
      const SizedBox(height: 14),
      SectionLabel('2. Vendor'),
      _lists!['vendors']!.isEmpty ? const Text('No vendors yet. The owner must add vendors first.') : ChipPicker(options: [for (final v in _lists!['vendors']!) Choice('${v['id']}', '${v['label']}')], value: _vendor, onChanged: (v) { setState(() { _vendor = v; _order = null; }); _price(); }),
      const SizedBox(height: 16),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: bigNumber(_qty, '${tr('3. Quantity')} (${crop?['unit'] ?? 'kg'})')),
        const SizedBox(width: 10),
        Expanded(child: bigNumber(_rate, tr('Rate'), enabled: s.isManager)),
      ]),
      if (_priceSource != null)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(_priceSource == 'vendor price list' ? 'Price from the vendor price list' : 'No price set for this vendor — using the crop\'s default price${s.isManager ? '' : '. Tell the owner.'}',
              style: TextStyle(fontSize: 12, color: _priceSource == 'vendor price list' ? Brand.muted : Brand.amber)),
        ),
      if (orders.isNotEmpty) ...[
        const SizedBox(height: 12),
        SectionLabel('Against order'),
        ChipPicker(options: [const Choice('', 'None'), for (final o in orders) Choice('${o['id']}', '#${o['id']} · ${numf(o['quantity'])} ${o['grade']}')], value: _order ?? '', onChanged: (v) => setState(() => _order = v.isEmpty ? null : v)),
      ],
      if (_lists!['farms']!.length > 1) ...[const SizedBox(height: 12), dropdown('From farm', _farm, _lists!['farms']!, (v) => setState(() => _farm = v))],
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 10, 10),
        decoration: BoxDecoration(color: Brand.ink, borderRadius: BorderRadius.circular(18)),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Amount'), style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
            Text(money(amount, s.cur), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
          ])),
          FilledButton.icon(onPressed: _busy ? null : _save, style: FilledButton.styleFrom(backgroundColor: const Color(0xFF22C55E)), icon: const Icon(Icons.check_circle_outline), label: Text(tr('Save sale'))),
        ]),
      ),
      const SizedBox(height: 18),
      AppCard(
        title: tr('Sales today'), action: Padding(padding: const EdgeInsets.only(right: 8), child: Pill(money(total, s.cur), color: Brand.green)),
        child: _today.isEmpty ? const EmptyView(text: 'No sales yet') : Column(children: [
          for (final x in _today)
            ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${x['party_id_label']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text('${x['crop_id_label']} ${x['grade']} · ${numf(x['quantity'])} × ${money(x['rate'], s.cur)}'),
                trailing: Text(money(x['amount'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800))),
        ]),
      ),
    ]);
  }
}

// ------------------------------------------------------------------ HARVEST
class HarvestScreen extends StatefulWidget {
  const HarvestScreen({super.key});
  @override
  State<HarvestScreen> createState() => _HarvestScreenState();
}

class _HarvestScreenState extends State<HarvestScreen> {
  Map<String, List<dynamic>>? _lists;
  String? _crop, _farm, _bay, _worker;
  late String _grade;
  List<dynamic> _bays = [], _locks = [], _today = [];
  final _qty = TextEditingController();
  final _culls = TextEditingController();
  bool _busy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_lists == null) _load();
  }

  Future<void> _load() async {
    final s = SessionScope.read(context);
    _grade = s.grades.first;
    final l = await loadLists(s, {'crops': '/r/crops', 'farms': '/r/farms/options', if (s.on('labour')) 'workers': '/r/workers/options'});
    if (!mounted) return;
    setState(() => _lists = l);
    if (l['farms']!.length == 1) _pickFarm('${l['farms']![0]['id']}');
    _refresh();
  }

  Future<void> _refresh() async {
    final s = SessionScope.read(context);
    final l = await loadLists(s, {'today': '/r/harvests?from=${todayIso()}&to=${todayIso()}', if (s.on('scouting')) 'locks': '/ops/locks'});
    if (mounted) setState(() { _today = l['today']!; _locks = l['locks'] ?? []; });
  }

  Future<void> _pickFarm(String? id) async {
    setState(() { _farm = id; _bay = null; _bays = []; });
    if (id == null) return;
    final s = SessionScope.read(context);
    final b = await s.api.get('/r/bays/options', {'farm_id': id});
    if (mounted) setState(() => _bays = List<dynamic>.from(b));
  }

  Future<void> _save({bool override = false}) async {
    final s = SessionScope.read(context);
    if (_crop == null || toD(_qty.text) <= 0) return toast(context, 'Pick crop and enter quantity', error: true);
    setState(() => _busy = true);
    try {
      await s.api.post('/r/harvests', {
        'date': todayIso(), 'crop_id': _crop, 'grade': _grade, 'quantity': _qty.text, 'culls': _culls.text,
        'farm_id': _farm ?? '', 'bay_id': _bay ?? '', 'worker_id': _worker ?? '', if (override) 'override_lock': 1,
      });
      if (!mounted) return;
      toast(context, '${tr('Saved')}: ${_qty.text}');
      setState(() { _qty.clear(); _culls.clear(); });
      _refresh();
    } catch (e) {
      if (!mounted) return;
      final msg = '$e';
      if (msg.startsWith('Harvest locked') && s.isManager) {
        final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: const Text('Spray lock'), content: Text(msg),
            actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr('Cancel'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Save anyway'))]));
        if (ok == true) return _save(override: true);
      } else {
        toast(context, msg, error: true);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    if (_lists == null) return const Center(child: CircularProgressIndicator());
    final crops = _lists!['crops']!.where((c) => c['active'] == 1).toList();
    final crop = crops.where((c) => '${c['id']}' == _crop).firstOrNull;
    return ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 120), children: [
      if (_locks.isNotEmpty)
        Container(
          margin: const EdgeInsets.only(bottom: 14), padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFFECACA))),
          child: Text('🔒 ${tr('Do not pick:')} ${_locks.map((l) => '${l['farm_name']}${l['bay_name'] != null ? ' / ${l['bay_name']}' : ''} (till ${fdate(l['lock_until'])})').join(', ')}', style: const TextStyle(color: Brand.red, fontWeight: FontWeight.w600)),
        ),
      SectionLabel('Crop'),
      crops.isEmpty ? const Text('No crops yet. The owner must add crops first.') : ChipPicker(options: [for (final c in crops) Choice('${c['id']}', '${c['name']}', hexColor(c['color']))], value: _crop, onChanged: (v) => setState(() => _crop = v)),
      const SizedBox(height: 14),
      SectionLabel('Grade'),
      ChipPicker(options: [for (final g in s.grades) Choice(g, g)], value: _grade, onChanged: (v) => setState(() => _grade = v)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: bigNumber(_qty, '${tr('Quantity')} (${crop?['unit'] ?? 'kg'})')),
        const SizedBox(width: 10),
        Expanded(child: bigNumber(_culls, tr('Culls / waste'))),
      ]),
      const SizedBox(height: 12),
      dropdown('Farm', _farm, _lists!['farms']!, _pickFarm),
      if (_bays.isNotEmpty) ...[const SizedBox(height: 12), dropdown('Bay', _bay, _bays, (v) => setState(() => _bay = v))],
      if ((_lists!['workers'] ?? []).isNotEmpty) ...[const SizedBox(height: 12), dropdown('Picked by', _worker, _lists!['workers']!, (v) => setState(() => _worker = v))],
      const SizedBox(height: 18),
      FilledButton.icon(onPressed: _busy ? null : () => _save(), icon: const Icon(Icons.check_circle_outline), label: Text(tr('Save harvest'))),
      const SizedBox(height: 18),
      AppCard(
        title: tr('Plucked today'),
        child: _today.isEmpty ? const EmptyView(text: 'Nothing recorded yet') : Column(children: [
          for (final h in _today)
            ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${h['crop_id_label']} · ${h['grade']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text([h['farm_id_label'], h['bay_id_label'], h['worker_id_label']].where((x) => x != null).join(' · ')),
                trailing: Text(numf(h['quantity']), style: const TextStyle(fontWeight: FontWeight.w800))),
        ]),
      ),
    ]);
  }
}

// ------------------------------------------------------------------ SPEND
class SpendScreen extends StatefulWidget {
  const SpendScreen({super.key});
  @override
  State<SpendScreen> createState() => _SpendScreenState();
}

class _SpendScreenState extends State<SpendScreen> {
  Map<String, List<dynamic>>? _lists;
  String? _cat, _party, _farm, _item;
  String _mode = 'cash';
  final _amount = TextEditingController();
  final _desc = TextEditingController();
  final _qty = TextEditingController();
  final _paid = TextEditingController();
  bool _busy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_lists == null) _load();
  }

  Future<void> _load() async {
    final s = SessionScope.read(context);
    final l = await loadLists(s, {
      'cats': '/r/expense_categories/options', 'parties': '/r/parties/options', 'farms': '/r/farms/options',
      if (s.on('inventory')) 'items': '/r/inventory_items/options', if (s.isManager) 'recent': '/r/expenses?limit=10',
    });
    if (mounted) setState(() => _lists = l);
  }

  Future<void> _save() async {
    final s = SessionScope.read(context);
    if (_cat == null || toD(_amount.text) <= 0) return toast(context, 'Pick category and enter amount', error: true);
    setState(() => _busy = true);
    try {
      await s.api.post('/r/expenses', {
        'date': todayIso(), 'category_id': _cat, 'amount': _amount.text, 'description': _desc.text, 'party_id': _party ?? '', 'farm_id': _farm ?? '',
        'item_id': _item ?? '', 'quantity': _item == null ? '' : _qty.text, 'payment_mode': _mode, 'paid_amount': _mode == 'credit' ? _paid.text : '',
      });
      if (!mounted) return;
      toast(context, '${tr('Saved')} ${money(_amount.text, s.cur)}');
      setState(() { _amount.clear(); _desc.clear(); _qty.clear(); _paid.clear(); _item = null; _lists = null; });
      _load();
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    if (_lists == null) return const Center(child: CircularProgressIndicator());
    final recent = _lists!['recent'] ?? [];
    return ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 120), children: [
      SectionLabel('What did you pay for?'),
      ChipPicker(options: [for (final c in _lists!['cats']!) Choice('${c['id']}', '${c['label']}')], value: _cat, onChanged: (v) => setState(() => _cat = v)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: bigNumber(_amount, '${tr('Amount')} (${s.cur})')),
        const SizedBox(width: 10),
        Expanded(child: DropdownButtonFormField<String>(
          initialValue: _mode, decoration: InputDecoration(labelText: tr('Paid by')),
          items: const [DropdownMenuItem(value: 'cash', child: Text('Cash')), DropdownMenuItem(value: 'upi', child: Text('UPI')), DropdownMenuItem(value: 'bank', child: Text('Bank')), DropdownMenuItem(value: 'cheque', child: Text('Cheque')), DropdownMenuItem(value: 'credit', child: Text('Credit (pay later)'))],
          onChanged: (v) => setState(() => _mode = v ?? 'cash'),
        )),
      ]),
      if (_mode == 'credit') ...[const SizedBox(height: 12), TextField(controller: _paid, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Paid now (rest is due)'))],
      const SizedBox(height: 12),
      TextField(controller: _desc, decoration: InputDecoration(labelText: tr('Description'), hintText: 'e.g. 500 grow bags, October current bill')),
      if ((_lists!['items'] ?? []).isNotEmpty) ...[
        const SizedBox(height: 12),
        Row(children: [
          Expanded(flex: 3, child: dropdown('Stock item (optional)', _item, _lists!['items']!, (v) => setState(() => _item = v))),
          const SizedBox(width: 10),
          Expanded(flex: 2, child: TextField(controller: _qty, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr('Quantity')))),
        ]),
      ],
      const SizedBox(height: 12),
      dropdown('Paid to / supplier', _party, _lists!['parties']!, (v) => setState(() => _party = v)),
      const SizedBox(height: 12),
      dropdown('Farm (blank = shared)', _farm, _lists!['farms']!, (v) => setState(() => _farm = v), empty: 'Shared'),
      const SizedBox(height: 18),
      FilledButton.icon(onPressed: _busy ? null : _save, icon: const Icon(Icons.check_circle_outline), label: Text(tr('Save expense'))),
      if (recent.isNotEmpty) ...[
        const SizedBox(height: 18),
        AppCard(title: tr('Recent expenses'), child: Column(children: [
          for (final e in recent)
            ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${e['category_id_label']}${e['description'] != null ? ' · ${e['description']}' : ''}', overflow: TextOverflow.ellipsis),
                subtitle: Text('${fdate(e['date'])}${e['party_id_label'] != null ? ' · ${e['party_id_label']}' : ''}'), trailing: Text(money(e['amount'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800))),
        ])),
      ],
    ]);
  }
}
