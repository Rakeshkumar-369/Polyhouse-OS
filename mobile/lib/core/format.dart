// Money, numbers, dates and the period presets (Day / Week / Month / FY ...)
String _group(int n) {
  // Indian digit grouping: 12,34,567
  final s = n.abs().toString();
  if (s.length <= 3) return s;
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '${parts.join(',')},$last3';
}

double toD(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

String money(dynamic v, [String cur = '₹']) {
  if (v == null || '$v'.isEmpty) return '—';
  final d = toD(v);
  return '${d < 0 ? '-' : ''}$cur${_group(d.round())}';
}

String shortMoney(dynamic v, [String cur = '₹']) {
  final d = toD(v);
  final a = d.abs();
  final s = a >= 1e7 ? '${(a / 1e7).toStringAsFixed(1)}Cr' : a >= 1e5 ? '${(a / 1e5).toStringAsFixed(1)}L' : a >= 1e3 ? '${(a / 1e3).toStringAsFixed(1)}k' : a.round().toString();
  return '${d < 0 ? '-' : ''}$cur$s';
}

String numf(dynamic v, [int digits = 1]) {
  if (v == null || '$v'.isEmpty) return '—';
  final d = toD(v);
  final parts = d.abs().toStringAsFixed(digits).split('.');
  var dec = parts.length > 1 ? parts[1].replaceAll(RegExp(r'0+$'), '') : '';
  return '${d < 0 ? '-' : ''}${_group(int.parse(parts[0]))}${dec.isEmpty ? '' : '.$dec'}';
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String iso(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String todayIso() => iso(DateTime.now());
String fdate(dynamic s) {
  if (s == null || '$s'.length < 10) return '—';
  final d = DateTime.tryParse('$s'.substring(0, 10));
  return d == null ? '—' : '${d.day.toString().padLeft(2, '0')} ${_months[d.month - 1]} ${'${d.year}'.substring(2)}';
}

class Period {
  final String key, label, from, to;
  const Period(this.key, this.label, this.from, this.to);
  String get group {
    final n = DateTime.parse(to).difference(DateTime.parse(from)).inDays;
    return n <= 31 ? 'day' : n <= 120 ? 'week' : 'month';
  }
}

List<Period> periods() {
  final t = DateTime.now();
  final today = DateTime(t.year, t.month, t.day);
  final monday = today.subtract(Duration(days: today.weekday - 1));
  final m0 = DateTime(t.year, t.month, 1);
  final fyYear = t.month >= 4 ? t.year : t.year - 1;
  return [
    Period('today', 'Today', iso(today), iso(today)),
    Period('this_week', 'This week', iso(monday), iso(today)),
    Period('this_month', 'This month', iso(m0), iso(today)),
    Period('last_month', 'Last month', iso(DateTime(t.year, t.month - 1, 1)), iso(m0.subtract(const Duration(days: 1)))),
    Period('last_30', 'Last 30 days', iso(today.subtract(const Duration(days: 29))), iso(today)),
    Period('last_90', 'Last 90 days', iso(today.subtract(const Duration(days: 89))), iso(today)),
    Period('this_fy', 'This financial year', '$fyYear-04-01', iso(today)),
  ];
}

int? pctChange(dynamic a, dynamic b) {
  final x = toD(a), y = toD(b);
  return y == 0 ? null : ((100 * (x - y)) / y.abs()).round();
}
