// Generic list + add / edit / delete for any record type (farms, crops, workers, assets, EC/pH log ...).
// Fields, labels and permissions come from the server (/api/meta -> server/src/resources.js), exactly like the web app.
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

final _moneyField = RegExp(r'amount|price|rate|cost|rent|wage|salary|gross|net_paid|bonus|deductions|principal|emi|outstanding|book_value|budget|balance');
const _tones = {'done': Brand.green, 'accepted': Brand.green, 'fulfilled': Brand.green, 'present': Brand.green, 'harvesting': Brand.green,
  'disputed': Brand.red, 'absent': Brand.red, 'high': Brand.red, 'open': Brand.amber, 'todo': Brand.amber, 'half': Brand.amber, 'medium': Brand.amber};

String cleanLabel(String l) => tr(l).replaceAll(RegExp(r'\s*\(.*\)'), '');

String fmtField(Map f, Map row, String cur) {
  final v = row[f['name']];
  if (f['type'] == 'ref') return '${row['${f['name']}_label'] ?? '—'}';
  if (v == null || '$v'.isEmpty) return '—';
  switch (f['type']) {
    case 'date': return fdate(v);
    case 'bool': return v == 1 || v == true ? 'Yes' : 'No';
    case 'number': return _moneyField.hasMatch('${f['name']}') ? money(v, cur) : numf(v, 2);
    case 'select': return tr('$v').replaceAll('_', ' ');
    case 'file': return '📎';
    default: return '$v';
  }
}

class RecordsScreen extends StatefulWidget {
  final String resKey;
  final Map<String, dynamic>? presetFilters;
  final bool openNew;
  final bool embedded;
  const RecordsScreen({super.key, required this.resKey, this.presetFilters, this.openNew = false, this.embedded = false});
  @override
  State<RecordsScreen> createState() => _RecordsScreenState();
}

class _RecordsScreenState extends State<RecordsScreen> {
  final _loader = GlobalKey<LoaderState<List<dynamic>>>();
  late Period _period = periods().firstWhere((p) => p.key == 'last_30');
  String _q = '';

  @override
  void initState() {
    super.initState();
    if (widget.openNew) WidgetsBinding.instance.addPostFrameCallback((_) => _edit(null));
  }

  Map get _def => SessionScope.read(context).resources[widget.resKey] ?? {};

  Future<void> _edit(Map? row) async {
    final def = _def;
    if (def.isEmpty) return;
    if (row == null && def['canWrite'] != true) return;
    final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => RecordForm(def: Map<String, dynamic>.from(def), row: row == null ? null : Map<String, dynamic>.from(row), presets: widget.presetFilters)));
    if (saved == true) _loader.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final def = s.resources[widget.resKey];
    final body = def == null
        ? const EmptyView(text: 'This screen is off or not allowed for your role.', icon: Icons.lock_outline)
        : _list(s, Map<String, dynamic>.from(def));
    if (widget.embedded) return body;
    return Scaffold(
      appBar: AppBar(title: Text(def == null ? '' : tr('${def['title']}'))),
      body: body,
      floatingActionButton: def != null && def['canWrite'] == true
          ? FloatingActionButton.extended(onPressed: () => _edit(null), icon: const Icon(Icons.add), label: Text(tr('Add')), backgroundColor: Brand.green, foregroundColor: Colors.white)
          : null,
    );
  }

  Widget _list(Session s, Map<String, dynamic> def) {
    final fields = List<Map>.from(def['fields']);
    final cols = fields.where((f) => f['list'] == true).toList();
    final hasDate = def['dateField'] != null;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
        child: Row(children: [
          if (hasDate) ...[PeriodDropdown(value: _period, onChanged: (p) { setState(() => _period = p); _loader.currentState?.reload(); }), const SizedBox(width: 8)],
          Expanded(child: TextField(decoration: InputDecoration(hintText: tr('Search'), prefixIcon: const Icon(Icons.search)), onSubmitted: (v) { _q = v; _loader.currentState?.reload(); })),
          if (widget.embedded && def['canWrite'] == true) IconButton.filled(onPressed: () => _edit(null), icon: const Icon(Icons.add)),
        ]),
      ),
      Expanded(
        child: Loader<List<dynamic>>(
          key: _loader,
          load: () async => List<dynamic>.from(await s.api.get('/r/${widget.resKey}', {
                ...?widget.presetFilters, 'q': _q, 'limit': 1000,
                if (hasDate) 'from': _period.from, if (hasDate) 'to': _period.to,
              })),
          builder: (context, rows, reload) {
            if (rows.isEmpty) return ListView(children: const [EmptyView(text: 'No entries yet')]);
            final totals = <String, double>{};
            for (final f in cols.where((f) => f['type'] == 'number' && RegExp(r'amount|quantity|net_paid|gross|cost').hasMatch('${f['name']}'))) {
              totals['${f['name']}'] = rows.fold<double>(0, (a, r) => a + toD(r[f['name']]));
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 100),
              itemCount: rows.length + (totals.isEmpty ? 0 : 1),
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                if (totals.isNotEmpty && i == 0) {
                  return Card(
                    color: Brand.greenSoft,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Wrap(spacing: 14, runSpacing: 4, children: [
                        Text('${tr('Total')} · ${rows.length}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        for (final e in totals.entries)
                          Text('${cleanLabel('${cols.firstWhere((c) => c['name'] == e.key)['label']}')}: ${_moneyField.hasMatch(e.key) ? money(e.value, s.cur) : numf(e.value)}'),
                      ]),
                    ),
                  );
                }
                final r = rows[i - (totals.isEmpty ? 0 : 1)] as Map;
                final status = cols.firstWhere((c) => c['type'] == 'select' && _tones.containsKey(r[c['name']]), orElse: () => {});
                return Card(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => _edit(r),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(fmtField(cols[0], r, s.cur), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))),
                          if (cols.length > 1) Text(fmtField(cols[1], r, s.cur), style: const TextStyle(fontWeight: FontWeight.w600)),
                          if (status.isNotEmpty) ...[const SizedBox(width: 8), Pill(tr('${r[status['name']]}'), color: _tones[r[status['name']]]!)],
                        ]),
                        const SizedBox(height: 4),
                        Wrap(spacing: 12, runSpacing: 2, children: [
                          for (final f in cols.skip(2).where((f) => f != status && r[f['name']] != null && '${r[f['name']]}'.isNotEmpty))
                            Text('${cleanLabel('${f['label']}')}: ${fmtField(f, r, s.cur)}', style: const TextStyle(color: Brand.muted, fontSize: 13)),
                        ]),
                      ]),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    ]);
  }
}

// Add / edit / delete form built from the field definitions
class RecordForm extends StatefulWidget {
  final Map<String, dynamic> def;
  final Map<String, dynamic>? row;
  final Map<String, dynamic>? presets;
  const RecordForm({super.key, required this.def, this.row, this.presets});
  @override
  State<RecordForm> createState() => _RecordFormState();
}

class _RecordFormState extends State<RecordForm> {
  final Map<String, dynamic> _v = {};
  final Map<String, List<dynamic>> _options = {};
  bool _busy = false;
  String? _error;

  List<Map> get _fields => List<Map>.from(widget.def['fields']).where((f) => widget.row != null || (f['virtual'] != true && f['readonly'] != true)).toList();

  @override
  void initState() {
    super.initState();
    for (final f in List<Map>.from(widget.def['fields'])) {
      final n = '${f['name']}';
      if (widget.row != null) {
        _v[n] = widget.row![n];
      } else if (f['default'] != null) {
        _v[n] = f['default'] == 'today' ? todayIso() : f['default'];
      }
    }
    widget.presets?.forEach((k, v) => _v[k] = v);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadOptions());
  }

  Future<void> _loadOptions([String? onlyDependent]) async {
    final api = SessionScope.read(context).api;
    for (final f in _fields.where((f) => f['type'] == 'ref')) {
      if (onlyDependent != null && f['dependsOn'] != onlyDependent) continue;
      final dep = f['dependsOn'];
      try {
        final o = await api.get('/r/${f['ref']}/options', {if (dep != null) '$dep': _v[dep]});
        if (mounted) setState(() => _options['${f['name']}'] = List<dynamic>.from(o));
      } catch (_) {}
    }
  }

  Future<void> _save() async {
    setState(() { _busy = true; _error = null; });
    final s = SessionScope.read(context);
    final body = {for (final f in List<Map>.from(widget.def['fields']).where((f) => f['readonly'] != true && f['virtual'] != true)) '${f['name']}': _v['${f['name']}'] ?? ''};
    try {
      if (widget.row == null) {
        await s.api.post('/r/${widget.def['key']}', body);
      } else {
        await s.api.put('/r/${widget.def['key']}/${widget.row!['id']}', body);
      }
      if (mounted) { toast(context, tr('Saved')); Navigator.pop(context, true); }
    } catch (e) {
      setState(() { _error = '$e'; _busy = false; });
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
          title: const Text('Delete this entry?'), content: const Text('This cannot be undone.'),
          actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr('Cancel'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('Delete')))],
        ));
    if (ok != true || !mounted) return;
    try {
      await SessionScope.read(context).api.delete('/r/${widget.def['key']}/${widget.row!['id']}');
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = '$e');
    }
  }

  Widget _input(Map f) {
    final n = '${f['name']}';
    final label = '${tr('${f['label']}')}${f['required'] == true ? ' *' : ''}';
    final ro = f['readonly'] == true || f['virtual'] == true || widget.def['canWrite'] != true;
    final deco = InputDecoration(labelText: label, helperText: f['help'] == null ? null : '${f['help']}', helperMaxLines: 2);
    switch (f['type']) {
      case 'select':
        final opts = List<String>.from(f['options']);
        return DropdownButtonFormField<String>(
          initialValue: opts.contains(_v[n]) ? _v[n] : null, isExpanded: true, decoration: deco,
          items: [for (final o in opts) DropdownMenuItem(value: o, child: Text(tr(o).replaceAll('_', ' ')))],
          onChanged: ro ? null : (v) => setState(() => _v[n] = v),
        );
      case 'ref':
        final opts = _options[n] ?? [];
        final ids = opts.map((o) => o['id']).toList();
        return DropdownButtonFormField<int>(
          initialValue: ids.contains(_v[n]) ? _v[n] as int : null, isExpanded: true, decoration: deco,
          items: [for (final o in opts) DropdownMenuItem(value: o['id'] as int, child: Text('${o['label']}', overflow: TextOverflow.ellipsis))],
          onChanged: ro ? null : (v) {
            setState(() {
              _v[n] = v;
              for (final d in _fields.where((x) => x['dependsOn'] == n)) { _v['${d['name']}'] = null; }
            });
            _loadOptions(n);
          },
        );
      case 'bool':
        return SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(label), value: _v[n] == 1 || _v[n] == true, onChanged: ro ? null : (b) => setState(() => _v[n] = b ? 1 : 0));
      case 'date':
        return InkWell(
          onTap: ro ? null : () async {
            final cur = DateTime.tryParse('${_v[n] ?? ''}') ?? DateTime.now();
            final d = await showDatePicker(context: context, initialDate: cur, firstDate: DateTime(2015), lastDate: DateTime(2040));
            if (d != null) setState(() => _v[n] = iso(d));
          },
          child: InputDecorator(decoration: deco.copyWith(suffixIcon: const Icon(Icons.calendar_today, size: 18)), child: Text(_v[n] == null || '${_v[n]}'.isEmpty ? '—' : fdate(_v[n]))),
        );
      case 'time':
        return InkWell(
          onTap: ro ? null : () async {
            final t = await showTimePicker(context: context, initialTime: TimeOfDay.now());
            if (t != null) setState(() => _v[n] = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}:00');
          },
          child: InputDecorator(decoration: deco.copyWith(suffixIcon: const Icon(Icons.schedule, size: 18)), child: Text('${_v[n] ?? '—'}'.length >= 5 ? '${_v[n]}'.substring(0, 5) : '—')),
        );
      case 'file':
        return InputDecorator(decoration: deco, child: Text(_v[n] == null || '${_v[n]}'.isEmpty ? 'Upload photos from the web app' : '📎 ${_v[n]}', style: const TextStyle(color: Brand.muted)));
      default:
        return TextFormField(
          initialValue: _v[n] == null ? '' : '${_v[n]}', readOnly: ro, maxLines: f['type'] == 'textarea' ? 3 : 1, decoration: deco,
          keyboardType: f['type'] == 'number' ? const TextInputType.numberWithOptions(decimal: true, signed: true) : TextInputType.text,
          onChanged: (v) => _v[n] = v,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final canWrite = widget.def['canWrite'] == true;
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.row == null ? tr('Add') : tr('Edit')} · ${tr('${widget.def['title']}')}', overflow: TextOverflow.ellipsis),
        actions: [if (widget.row != null && canWrite) IconButton(tooltip: tr('Delete'), onPressed: _busy ? null : _delete, icon: const Icon(Icons.delete_outline, color: Brand.red))],
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 120), children: [
        for (final f in _fields) Padding(padding: const EdgeInsets.only(bottom: 14), child: _input(f)),
        if (_error != null) Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(12)), child: Text(_error!, style: const TextStyle(color: Brand.red))),
      ]),
      bottomNavigationBar: canWrite
          ? SafeArea(child: Padding(padding: const EdgeInsets.all(12), child: FilledButton.icon(onPressed: _busy ? null : _save, icon: const Icon(Icons.check), label: Text(tr('Save')))))
          : null,
    );
  }
}
