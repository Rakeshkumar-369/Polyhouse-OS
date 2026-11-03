// Labour: tap-to-mark attendance for everyone, and the wage run (calculate & pay) for owners.
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'records_screen.dart';

const _marks = [('present', 'P', Brand.green), ('half', '½', Brand.amber), ('absent', 'A', Brand.red), ('leave', 'L', Brand.muted)];

class LabourScreen extends StatefulWidget {
  const LabourScreen({super.key});
  @override
  State<LabourScreen> createState() => _LabourScreenState();
}

class _LabourScreenState extends State<LabourScreen> {
  String _tab = 'att';
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final tabs = [const Choice('att', 'Attendance'), if (s.isManager) ...[const Choice('wages', 'Wage run'), const Choice('workers', 'Workers')]];
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 4), child: Align(alignment: Alignment.centerLeft, child: ChipPicker(options: tabs, value: _tab, onChanged: (v) => setState(() => _tab = v)))),
      Expanded(child: switch (_tab) {
        'wages' => const _WageRun(),
        'workers' => const RecordsScreen(resKey: 'workers', embedded: true),
        _ => const _Attendance(),
      }),
    ]);
  }
}

class _Attendance extends StatefulWidget {
  const _Attendance();
  @override
  State<_Attendance> createState() => _AttendanceState();
}

class _AttendanceState extends State<_Attendance> {
  DateTime _date = DateTime.now();
  List<Map<String, dynamic>>? _rows;
  bool _busy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_rows == null) _load();
  }

  Future<void> _load() async {
    final s = SessionScope.read(context);
    try {
      final r = await s.api.get('/ops/attendance-sheet', {'date': iso(_date)});
      if (mounted) setState(() => _rows = [for (final x in r) Map<String, dynamic>.from(x)]);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await SessionScope.read(context).api.post('/ops/attendance-sheet', {'date': iso(_date), 'entries': _rows});
      if (mounted) toast(context, tr('Saved'));
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_rows == null) return const Center(child: CircularProgressIndicator());
    int count(String st) => _rows!.where((r) => r['status'] == st).length;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Row(children: [
          OutlinedButton.icon(
            icon: const Icon(Icons.calendar_today, size: 16), label: Text(fdate(iso(_date))),
            onPressed: () async {
              final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
              if (d != null) { setState(() { _date = d; _rows = null; }); _load(); }
            },
          ),
          const SizedBox(width: 8),
          TextButton(onPressed: () => setState(() { for (final r in _rows!) { r['status'] ??= 'present'; } }), child: Text(tr('Mark rest present'))),
          const Spacer(),
          Text('P${count('present')} ½${count('half')} A${count('absent')}', style: const TextStyle(color: Brand.muted, fontWeight: FontWeight.w600)),
        ]),
      ),
      Expanded(
        child: _rows!.isEmpty ? const EmptyView(text: 'Add workers first') : ListView.separated(
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 16),
          itemCount: _rows!.length, separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final r = _rows![i];
            return Card(child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  Text('${r['skill']} · ${r['pay_type']}${r['check_in'] != null ? ' · in ${'${r['check_in']}'.substring(0, 5)}' : ''}', style: const TextStyle(color: Brand.muted, fontSize: 12)),
                ])),
                for (final m in _marks)
                  Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => setState(() => r['status'] = r['status'] == m.$1 ? null : m.$1),
                      child: Container(
                        width: 42, height: 42, alignment: Alignment.center,
                        decoration: BoxDecoration(color: r['status'] == m.$1 ? m.$3 : const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
                        child: Text(m.$2, style: TextStyle(fontWeight: FontWeight.w800, color: r['status'] == m.$1 ? Colors.white : Brand.muted)),
                      ),
                    ),
                  ),
              ]),
            ));
          },
        ),
      ),
      if (_rows!.isNotEmpty) SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 12), child: SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: _busy ? null : _save, icon: const Icon(Icons.done_all), label: Text(tr('Save attendance')))))),
    ]);
  }
}

class _WageRun extends StatefulWidget {
  const _WageRun();
  @override
  State<_WageRun> createState() => _WageRunState();
}

class _WageRunState extends State<_WageRun> {
  final _loader = GlobalKey<LoaderState<List<dynamic>>>();
  late Period _period = periods().firstWhere((p) => p.key == 'this_week');

  Future<void> _pay(Map r) async {
    final s = SessionScope.read(context);
    final w = r['worker'];
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text('${tr('Pay')} ${w['name']}?'), content: Text('${money(r['net'], s.cur)} for ${fdate(_period.from)} – ${fdate(_period.to)}\n${r['basis']}'),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr('Cancel'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('Pay')))]));
    if (ok != true) return;
    try {
      await s.api.post('/r/wage_payments', {'worker_id': w['id'], 'date': todayIso(), 'period_start': _period.from, 'period_end': _period.to, 'days_worked': r['days_worked'], 'gross': r['gross'], 'bonus': r['bonus'], 'deductions': r['deductions'], 'mode': 'cash', 'notes': r['basis']});
      if (mounted) { toast(context, '${tr('Paid')}: ${w['name']}'); _loader.currentState?.reload(); }
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Column(children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 14), child: Align(alignment: Alignment.centerLeft, child: PeriodDropdown(value: _period, onChanged: (p) { setState(() => _period = p); _loader.currentState?.reload(); }))),
      Expanded(child: Loader<List<dynamic>>(
        key: _loader,
        load: () async => List<dynamic>.from(await s.api.get('/ops/wage-run', {'from': _period.from, 'to': _period.to})),
        builder: (context, rows, _) => ListView.separated(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 100), itemCount: rows.length, separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final r = rows[i];
            final paid = toD(r['paid']) > 0;
            return Card(child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${r['worker']['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                Text('${r['basis']}', style: const TextStyle(color: Brand.muted, fontSize: 12)),
                if (toD(r['deductions']) > 0) Text('Advance cut ${money(r['deductions'], s.cur)}', style: const TextStyle(color: Brand.amber, fontSize: 12)),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(money(r['net'], s.cur), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                if (paid) Pill('${tr('Paid')} ${money(r['paid'], s.cur)}', color: Brand.green)
                else if (toD(r['net']) > 0) FilledButton(onPressed: () => _pay(r), style: FilledButton.styleFrom(minimumSize: const Size(60, 34)), child: Text(tr('Pay'))),
              ]),
            ])));
          },
        ),
      )),
    ]);
  }
}
