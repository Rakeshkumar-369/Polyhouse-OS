// Smart suggestions learned from past harvest, temperature and price (server/src/suggestionsService.js)
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const _kinds = {
  'now': (Icons.thermostat, 'This month'),
  'upcoming': (Icons.event, 'Next month'),
  'season': (Icons.local_florist_outlined, 'Best season'),
  'price': (Icons.sell_outlined, 'Price'),
  'avoid': (Icons.warning_amber_rounded, 'Weak month'),
  'learning': (Icons.hourglass_bottom, 'Learning'),
};
const _tone = {'warn': Brand.amber, 'good': Brand.green, 'info': Brand.revenue};

class SuggestionList extends StatelessWidget {
  final List<dynamic> items;
  final int? limit;
  const SuggestionList({super.key, required this.items, this.limit});
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const EmptyView(text: 'Suggestions appear after a few months of harvest and temperature records.', icon: Icons.lightbulb_outline);
    return Column(children: [
      for (final s in items.take(limit ?? items.length))
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: (_tone[s['level']] ?? Brand.muted).withValues(alpha: .06),
            borderRadius: BorderRadius.circular(12),
            border: Border(left: BorderSide(color: _tone[s['level']] ?? Brand.muted, width: 4)),
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(_kinds[s['type']]?.$1 ?? Icons.lightbulb_outline, size: 20, color: _tone[s['level']] ?? Brand.muted),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('${s['title']}', style: const TextStyle(fontWeight: FontWeight.w700))),
                Pill(tr(_kinds[s['type']]?.$2 ?? ''), color: _tone[s['level']] ?? Brand.muted),
              ]),
              const SizedBox(height: 3),
              Text('${s['detail']}', style: const TextStyle(color: Color(0xFF475569), fontSize: 13, height: 1.35)),
            ])),
          ]),
        ),
    ]);
  }
}

Color _heat(int? i) => i == null ? const Color(0xFFF8FAFC) : i >= 130 ? Brand.green : i >= 110 ? const Color(0xFFBBF7D0) : i >= 90 ? const Color(0xFFF1F5F9) : i >= 70 ? const Color(0xFFFEF3C7) : const Color(0xFFFEE2E2);

class SuggestionsScreen extends StatefulWidget {
  const SuggestionsScreen({super.key});
  @override
  State<SuggestionsScreen> createState() => _SuggestionsScreenState();
}

class _SuggestionsScreenState extends State<SuggestionsScreen> {
  String _kind = 'all';
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Loader<Map<String, dynamic>>(
      load: () async => Map<String, dynamic>.from(await s.api.get('/suggestions')),
      builder: (context, d, _) {
        final all = List<dynamic>.from(d['suggestions']);
        final kinds = ['all', ..._kinds.keys.where((k) => all.any((x) => x['type'] == k))];
        final profiles = List<Map>.from(d['profiles']).where((p) => p['learning'] != true).toList();
        final months = List<String>.from(d['months']);
        final cur = '${d['thisMonth']}'.substring(0, 3);
        return ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 100), children: [
          Text('Learned from your own harvest, temperature and price records · ${d['thisMonth']}${d['currentTemp'] != null ? ' · ${d['currentTemp']} °C so far' : ''}', style: const TextStyle(color: Brand.muted)),
          const SizedBox(height: 12),
          AppCard(
            title: tr('Season calendar'), subtitle: 'Yield in each month as % of the crop\'s normal month',
            child: profiles.isEmpty
                ? const EmptyView(text: 'The season calendar fills in after a few months of records.')
                : SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Table(
                      defaultColumnWidth: const FixedColumnWidth(40),
                      columnWidths: const {0: FixedColumnWidth(110)},
                      children: [
                        TableRow(children: [const SizedBox(), for (final m in months) Center(child: Padding(padding: const EdgeInsets.all(4), child: Text(m, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: m == cur ? Brand.green : Brand.muted))))]),
                        for (final p in profiles)
                          TableRow(children: [
                            Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [CircleAvatar(radius: 4, backgroundColor: hexColor(p['color'])), const SizedBox(width: 5), Expanded(child: Text('${p['crop']}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis))])),
                            for (final m in List<dynamic>.from(p['byMonth']))
                              Container(
                                margin: const EdgeInsets.all(2), height: 28, alignment: Alignment.center,
                                decoration: BoxDecoration(color: _heat(m?['index']), borderRadius: BorderRadius.circular(6)),
                                child: Text(m == null ? '·' : '${m['index']}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: m != null && m['index'] >= 130 ? Colors.white : Brand.ink)),
                              ),
                          ]),
                        TableRow(children: [
                          const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Avg °C', style: TextStyle(fontSize: 12, color: Brand.muted))),
                          for (final m in List<dynamic>.from(d['tempRow'])) Center(child: Text(m == null ? '·' : '${toD(m['t']).round()}', style: const TextStyle(fontSize: 11.5, color: Brand.muted))),
                        ]),
                      ],
                    ),
                  ),
          ),
          const SizedBox(height: 12),
          ChipPicker(options: [for (final k in kinds) Choice(k, k == 'all' ? 'All' : _kinds[k]!.$2)], value: _kind, onChanged: (v) => setState(() => _kind = v)),
          const SizedBox(height: 12),
          SuggestionList(items: all.where((x) => _kind == 'all' || x['type'] == _kind).toList()),
          const SizedBox(height: 6),
          Text('The more you record — daily harvest by bay, a temperature reading each day, crop cycles with area — the sharper these become.', style: const TextStyle(color: Brand.muted, fontSize: 12)),
        ]);
      },
    );
  }
}
