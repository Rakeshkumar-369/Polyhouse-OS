// Sell / deliver: vendor -> items (crop, grade, quantity; "Add another item") -> Save & make bill -> Send on WhatsApp.
// Prices come from the vendor's price list (only owner / manager can change the rate).
// "Same as last time" copies the vendor's previous bill. Open orders for the vendor can be added with one tap.
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'entry_screens.dart' show loadLists, bigNumber, dropdown;
import 'bills_screen.dart';

class _Item {
  String crop, grade;
  double qty, rate;
  String? source, order;
  _Item(this.crop, this.grade, this.qty, this.rate, {this.source, this.order});
}

class SellScreen extends StatefulWidget {
  const SellScreen({super.key});
  @override
  State<SellScreen> createState() => _SellScreenState();
}

class _SellScreenState extends State<SellScreen> {
  Map<String, List<dynamic>>? _lists;
  String? _crop, _vendor, _farm;
  late String _grade;
  final _qty = TextEditingController();
  final _rate = TextEditingController();
  String? _priceSource;
  bool _busy = false;
  final List<_Item> _items = [];
  List<dynamic> _today = [];
  Map<String, dynamic>? _last;

  @override
  void initState() {
    super.initState();
    _qty.addListener(_refresh);
    _rate.addListener(_refresh);
  }

  void _refresh() => setState(() {});

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_lists == null) _load();
  }

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

  Future<Map<String, dynamic>> _priceOf(String crop, String grade) async {
    final s = SessionScope.read(context);
    try {
      return Map<String, dynamic>.from(await s.api.get('/ops/price', {'party_id': _vendor, 'crop_id': crop, 'grade': grade, 'date': todayIso()}));
    } catch (_) {
      return {};
    }
  }

  Future<void> _price() async {
    if (_crop == null || _vendor == null) return;
    final p = await _priceOf(_crop!, _grade);
    if (mounted && p.isNotEmpty) setState(() { _rate.text = '${p['price']}'; _priceSource = '${p['source']}'; });
  }

  Future<void> _pickVendor(String v) async {
    final s = SessionScope.read(context);
    setState(() { _vendor = v; _last = null; });
    _price();
    for (final it in _items) {
      final p = await _priceOf(it.crop, it.grade);
      if (p.isNotEmpty) it.rate = toD(p['price']);
    }
    if (mounted) setState(() {});
    if (!s.on('billing')) return;
    try {
      final b = List<dynamic>.from(await s.api.get('/bills', {'party_id': v, 'status': 'issued', 'limit': 1}));
      if (b.isNotEmpty) {
        final d = Map<String, dynamic>.from(await s.api.get('/bills/${b[0]['id']}'));
        if (mounted && _vendor == v) setState(() => _last = d);
      }
    } catch (_) {}
  }

  Future<void> _sameAsLast() async {
    final crops = _lists!['crops']!;
    final out = <_Item>[];
    for (final l in _last!['lines']) {
      final c = crops.where((x) => x['name'] == l['crop']).firstOrNull;
      if (c == null) continue;
      final p = await _priceOf('${c['id']}', '${l['grade']}');
      out.add(_Item('${c['id']}', '${l['grade']}', toD(l['quantity']), toD(p['price']), source: p['source']));
    }
    if (mounted) setState(() => _items..clear()..addAll(out));
  }

  Future<void> _addOrder(dynamic o) async {
    if (_vendor != '${o['party_id']}') await _pickVendor('${o['party_id']}');
    final p = await _priceOf('${o['crop_id']}', '${o['grade']}');
    if (mounted) setState(() => _items.add(_Item('${o['crop_id']}', '${o['grade']}', toD(o['quantity']), toD(p['price']), source: p['source'], order: '${o['id']}')));
  }

  bool get _draftOk => _crop != null && toD(_qty.text) > 0;

  void _addDraft() {
    if (!_draftOk) return toast(context, 'Pick a crop and enter the quantity', error: true);
    setState(() {
      _items.add(_Item(_crop!, _grade, toD(_qty.text), toD(_rate.text), source: _priceSource));
      _qty.clear();
      _crop = null;
      _priceSource = null;
    });
  }

  Future<void> _save() async {
    final s = SessionScope.read(context);
    final all = [..._items, if (_draftOk) _Item(_crop!, _grade, toD(_qty.text), toD(_rate.text))];
    if (_vendor == null) return toast(context, 'Pick the vendor', error: true);
    if (all.isEmpty) return toast(context, 'Add at least one item', error: true);
    final lines = [for (final x in all) {'crop_id': x.crop, 'grade': x.grade, 'quantity': x.qty, 'order_id': x.order ?? '', if (s.isManager) 'rate': x.rate}];
    final billNow = s.on('billing') && '${(s.settings['billing'] ?? {})['when'] ?? 'each_delivery'}' != 'later';
    setState(() => _busy = true);
    try {
      Map<String, dynamic>? doc;
      if (billNow) {
        doc = Map<String, dynamic>.from(await s.api.post('/bills', {'party_id': _vendor, 'date': todayIso(), 'farm_id': _farm ?? '', 'lines': lines}));
      } else {
        for (final l in lines) {
          await s.api.post('/r/sales', {...l, 'party_id': _vendor, 'date': todayIso(), 'farm_id': _farm ?? ''});
        }
      }
      if (!mounted) return;
      setState(() { _items.clear(); _qty.clear(); _crop = null; });
      _loadToday();
      if (doc != null) {
        await showDocSheet(context, doc);
      } else {
        toast(context, '${tr('Saved')}: ${lines.length} item(s)${s.on('billing') ? ' · bill it later from Bills' : ''}');
      }
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
    Map? cropOf(String? id) => crops.where((c) => '${c['id']}' == id).firstOrNull;
    final crop = cropOf(_crop);
    final orders = (_lists!['orders'] ?? []).where((o) => _vendor == null || '${o['party_id']}' == _vendor).toList();
    final all = [..._items, if (_draftOk) _Item(_crop!, _grade, toD(_qty.text), toD(_rate.text))];
    final amount = all.fold<double>(0, (a, x) => a + x.qty * x.rate);
    final billNow = s.on('billing') && '${(s.settings['billing'] ?? {})['when'] ?? 'each_delivery'}' != 'later';
    final total = _today.fold<double>(0, (a, x) => a + toD(x['amount']));
    return Stack(children: [
      ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 190), children: [
        SectionLabel('1. Vendor'),
        _lists!['vendors']!.isEmpty
            ? const Text('No vendors yet. The owner must add vendors first.')
            : ChipPicker(options: [for (final v in _lists!['vendors']!) Choice('${v['id']}', '${v['label']}')], value: _vendor, onChanged: _pickVendor),
        if (_last != null && _items.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: ActionChip(
              avatar: const Icon(Icons.repeat, size: 18),
              label: Text('${tr('Same as last time')}: ${[for (final l in (_last!['lines'] as List).take(3)) '${l['crop']} ${numf(l['quantity'])}'].join(', ')}', overflow: TextOverflow.ellipsis),
              onPressed: _sameAsLast,
            ),
          ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(18), color: Colors.white),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [Expanded(child: SectionLabel('2. Items')), if (_items.isNotEmpty) Pill('${_items.length} ${tr('added')}', color: Brand.green)]),
            crops.isEmpty
                ? const Text('No crops yet. The owner must add crops first.')
                : ChipPicker(options: [for (final c in crops) Choice('${c['id']}', '${c['name']}', hexColor(c['color']))], value: _crop, onChanged: (v) { setState(() => _crop = v); _price(); }),
            const SizedBox(height: 10),
            ChipPicker(options: [for (final g in s.grades) Choice(g, g)], value: _grade, onChanged: (v) { setState(() => _grade = v); _price(); }),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: bigNumber(_qty, '${tr('Quantity')} (${crop?['unit'] ?? 'kg'})')),
              const SizedBox(width: 10),
              Expanded(child: bigNumber(_rate, tr('Rate'), enabled: s.isManager)),
            ]),
            if (_priceSource != null && _priceSource != 'vendor price list')
              Padding(padding: const EdgeInsets.only(top: 6), child: Text('No price set for this vendor — using the crop\'s usual price${s.isManager ? '' : '. Tell the owner.'}', style: const TextStyle(fontSize: 12, color: Brand.amber))),
            const SizedBox(height: 10),
            OutlinedButton.icon(onPressed: _draftOk ? _addDraft : null, icon: const Icon(Icons.add), label: Text(tr('Add another item'))),
          ]),
        ),
        if (_items.isNotEmpty) ...[
          const SizedBox(height: 10),
          Card(child: Column(children: [
            for (final it in List.of(_items))
              ListTile(
                dense: true,
                leading: CircleAvatar(radius: 6, backgroundColor: hexColor(cropOf(it.crop)?['color'])),
                title: Text('${cropOf(it.crop)?['name'] ?? ''} ${it.grade}${it.order != null ? ' · order' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('${numf(it.qty)} ${cropOf(it.crop)?['unit'] ?? ''} × ${money(it.rate, s.cur)}'),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(money(it.qty * it.rate, s.cur), style: const TextStyle(fontWeight: FontWeight.w800)),
                  IconButton(onPressed: () => setState(() => _items.remove(it)), icon: const Icon(Icons.close, color: Brand.red), tooltip: 'Remove'),
                ]),
                onTap: () => setState(() { _items.remove(it); _crop = it.crop; _grade = it.grade; _qty.text = numf(it.qty).replaceAll(',', ''); _rate.text = '${it.rate}'; }),
              ),
          ])),
        ],
        if (_lists!['farms']!.length > 1) ...[const SizedBox(height: 12), dropdown('From farm', _farm, _lists!['farms']!, (v) => setState(() => _farm = v))],
        if (orders.isNotEmpty) ...[
          const SizedBox(height: 14),
          AppCard(title: tr('Open orders'), subtitle: 'Tap to add to this delivery', child: Column(children: [
            for (final o in orders.take(8))
              ListTile(dense: true, contentPadding: EdgeInsets.zero, onTap: () => _addOrder(o),
                  title: Text('${o['party_id_label']} · ${o['crop_id_label']} ${o['grade']}', overflow: TextOverflow.ellipsis),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [Text(numf(o['quantity']), style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(width: 4), const Icon(Icons.add_circle_outline, color: Brand.green)])),
          ])),
        ],
        const SizedBox(height: 14),
        AppCard(
          title: tr('Sales today'), action: Padding(padding: const EdgeInsets.only(right: 8), child: Pill(money(total, s.cur), color: Brand.green)),
          child: _today.isEmpty ? const EmptyView(text: 'No sales yet') : Column(children: [
            for (final x in _today)
              ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${x['party_id_label']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text('${x['crop_id_label']} ${x['grade']} · ${numf(x['quantity'])} × ${money(x['rate'], s.cur)}${x['bill_no'] != null ? ' · ${x['bill_no']}' : ''}'),
                  trailing: Text(money(x['amount'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800))),
          ]),
        ),
      ]),
      Positioned(
        left: 12, right: 12, bottom: (Scaffold.maybeOf(context)?.hasFloatingActionButton ?? false) ? 84 : 12,
        child: Material(
          elevation: 6, borderRadius: BorderRadius.circular(18), color: Brand.ink,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 10, 10),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text('${tr('Amount')}${all.length > 1 ? ' · ${all.length} ${tr('items')}' : ''}', style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                Text(money(amount, s.cur), style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
              ])),
              FilledButton.icon(
                onPressed: _busy || _vendor == null || all.isEmpty ? null : _save,
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF22C55E), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14)),
                icon: Icon(billNow ? Icons.receipt_long : Icons.check_circle_outline),
                label: Text(billNow ? tr('Save & make bill') : tr('Save sale')),
              ),
            ]),
          ),
        ),
      ),
    ]);
  }
}
