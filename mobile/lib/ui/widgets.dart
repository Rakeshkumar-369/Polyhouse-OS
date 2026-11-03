// Shared building blocks: cards, KPI tiles, chip pickers, loading / error / empty states, simple charts.
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import 'theme.dart';

void toast(BuildContext context, String msg, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), backgroundColor: error ? Brand.red : Brand.ink));
}

class AppCard extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final Widget? action;
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  const AppCard({super.key, this.title, this.subtitle, this.action, required this.child, this.padding = const EdgeInsets.fromLTRB(16, 4, 16, 16), this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15.5)),
                if (subtitle != null) Text(subtitle!, style: const TextStyle(color: Brand.muted, fontSize: 12)),
              ])),
              ?action,
            ]),
          ),
        Padding(padding: title == null ? const EdgeInsets.all(16) : padding, child: child),
      ]),
    );
  }
}

class StatTile extends StatelessWidget {
  final String label, value;
  final String? sub;
  final IconData icon;
  final Color color;
  final int? delta;
  final bool goodUp;
  const StatTile({super.key, required this.label, required this.value, this.sub, required this.icon, this.color = Brand.green, this.delta, this.goodUp = true});

  @override
  Widget build(BuildContext context) {
    final good = delta == null ? null : (goodUp ? delta! >= 0 : delta! <= 0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(label.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Brand.muted, letterSpacing: .6))),
            Container(width: 30, height: 30, decoration: BoxDecoration(color: color.withValues(alpha: .1), borderRadius: BorderRadius.circular(10)), child: Icon(icon, size: 17, color: color)),
          ]),
          const SizedBox(height: 6),
          FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Brand.ink))),
          const SizedBox(height: 2),
          Row(children: [
            if (delta != null) ...[
              Icon(delta! >= 0 ? Icons.north_east : Icons.south_east, size: 13, color: good! ? Brand.green : Brand.red),
              Text('${delta!.abs()}% ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: good ? Brand.green : Brand.red)),
            ],
            if (sub != null) Expanded(child: Text(sub!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Brand.muted))),
          ]),
        ]),
      ),
    );
  }
}

// Two-column grid of KPI tiles that grows to 3/4 columns on tablets
class TileGrid extends StatelessWidget {
  final List<Widget> children;
  const TileGrid({super.key, required this.children});
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final cols = c.maxWidth > 900 ? 4 : c.maxWidth > 600 ? 3 : 2;
      const gap = 10.0;
      final w = (c.maxWidth - gap * (cols - 1)) / cols;
      return Wrap(spacing: gap, runSpacing: gap, children: [for (final ch in children) SizedBox(width: w, child: ch)]);
    });
  }
}

class Choice {
  final String value, label;
  final Color? color;
  const Choice(this.value, this.label, [this.color]);
}

// Big tappable chips to pick one value (crop, grade, vendor ...)
class ChipPicker extends StatelessWidget {
  final List<Choice> options;
  final String? value;
  final ValueChanged<String> onChanged;
  const ChipPicker({super.key, required this.options, required this.value, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final o in options)
        ChoiceChip(
          label: Text(tr(o.label)),
          selected: o.value == value,
          showCheckmark: false,
          avatar: o.color == null ? null : CircleAvatar(radius: 6, backgroundColor: o.color),
          labelStyle: TextStyle(color: o.value == value ? Colors.white : Brand.ink, fontWeight: FontWeight.w600),
          selectedColor: Brand.green,
          backgroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          onSelected: (_) => onChanged(o.value),
        ),
    ]);
  }
}

class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6, top: 4),
        child: Text(tr(text).toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Brand.muted, letterSpacing: .7)),
      );
}

class EmptyView extends StatelessWidget {
  final String text;
  final IconData icon;
  const EmptyView({super.key, this.text = 'Nothing here yet', this.icon = Icons.inbox_outlined});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(children: [Icon(icon, size: 40, color: const Color(0xFFCBD5E1)), const SizedBox(height: 8), Text(tr(text), textAlign: TextAlign.center, style: const TextStyle(color: Brand.muted))]),
      );
}

class ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const ErrorView({super.key, required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off, size: 44, color: Brand.muted),
            const SizedBox(height: 10),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: Text(tr('Retry'))),
          ]),
        ),
      );
}

// Loads data once, shows a spinner / error, supports pull-to-refresh.  Use a GlobalKey<LoaderState> to reload.
class Loader<T> extends StatefulWidget {
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;
  const Loader({super.key, required this.load, required this.builder});
  @override
  State<Loader<T>> createState() => LoaderState<T>();
}

class LoaderState<T> extends State<Loader<T>> {
  T? data;
  String? error;
  bool busy = true;

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    setState(() { busy = true; error = null; });
    try {
      final d = await widget.load();
      if (mounted) setState(() { data = d; busy = false; });
    } catch (e) {
      if (mounted) setState(() { error = '$e'; busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (data == null && busy) return const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()));
    if (data == null && error != null) return ErrorView(message: error!, onRetry: reload);
    return RefreshIndicator(onRefresh: reload, child: widget.builder(context, data as T, reload));
  }
}

class Pill extends StatelessWidget {
  final String text;
  final Color color;
  const Pill(this.text, {super.key, this.color = Brand.muted});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(20)),
        child: Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
      );
}

// Thin labelled share bar ("Fertiliser  ₹50,171  66%")
class ShareBar extends StatelessWidget {
  final String label, value;
  final double fraction;
  final Color color;
  const ShareBar({super.key, required this.label, required this.value, required this.fraction, this.color = Brand.expenses});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text(label, overflow: TextOverflow.ellipsis)), Text(value, style: const TextStyle(fontWeight: FontWeight.w600))]),
          const SizedBox(height: 4),
          ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: fraction.clamp(0, 1), minHeight: 7, color: color, backgroundColor: const Color(0xFFF1F5F9))),
        ]),
      );
}

class Series {
  final String name;
  final Color color;
  final List<double> values;
  const Series(this.name, this.color, this.values);
}

// Grouped bar chart with an optional line, tap a column to see its values.
class BarsChart extends StatefulWidget {
  final List<String> labels;
  final List<Series> bars;
  final Series? line;
  final String Function(double) fmt;
  final double height;
  const BarsChart({super.key, required this.labels, required this.bars, this.line, required this.fmt, this.height = 190});
  @override
  State<BarsChart> createState() => _BarsChartState();
}

class _BarsChartState extends State<BarsChart> {
  int? active;
  @override
  Widget build(BuildContext context) {
    final all = [...widget.bars, if (widget.line != null) widget.line!];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(
        height: widget.height,
        child: LayoutBuilder(builder: (context, c) => GestureDetector(
              onTapDown: (d) {
                final n = widget.labels.length;
                if (n == 0) return;
                final i = ((d.localPosition.dx - 36) / ((c.maxWidth - 36) / n)).floor().clamp(0, n - 1);
                setState(() => active = active == i ? null : i);
              },
              child: CustomPaint(size: Size(c.maxWidth, widget.height), painter: _BarsPainter(widget.labels, widget.bars, widget.line, widget.fmt, active)),
            )),
      ),
      const SizedBox(height: 6),
      Wrap(alignment: WrapAlignment.center, spacing: 14, children: [
        for (final s in all) Row(mainAxisSize: MainAxisSize.min, children: [CircleAvatar(radius: 5, backgroundColor: s.color), const SizedBox(width: 5), Text(s.name, style: const TextStyle(fontSize: 12, color: Brand.muted))]),
      ]),
      if (active != null && active! < widget.labels.length)
        Container(
          margin: const EdgeInsets.only(top: 8),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: Brand.line)),
          child: Wrap(spacing: 14, runSpacing: 4, children: [
            Text(widget.labels[active!], style: const TextStyle(fontWeight: FontWeight.w700)),
            for (final s in all) Text('${s.name}: ${widget.fmt(s.values[active!])}', style: TextStyle(color: s.color, fontWeight: FontWeight.w600)),
          ]),
        ),
    ]);
  }
}

class _BarsPainter extends CustomPainter {
  final List<String> labels;
  final List<Series> bars;
  final Series? line;
  final String Function(double) fmt;
  final int? active;
  _BarsPainter(this.labels, this.bars, this.line, this.fmt, this.active);

  @override
  void paint(Canvas canvas, Size size) {
    const left = 36.0, bottom = 18.0, top = 6.0;
    final values = [for (final s in bars) ...s.values, if (line != null) ...line!.values];
    if (values.isEmpty || labels.isEmpty) return;
    var hi = values.reduce(math.max);
    final lo = math.min(0.0, values.reduce(math.min));
    if (hi <= lo) hi = lo + 1;
    final h = size.height - bottom - top;
    final w = size.width - left;
    double y(double v) => top + h - ((v - lo) / (hi - lo)) * h;
    final grid = Paint()..color = const Color(0xFFEEF2F6)..strokeWidth = 1;
    final tp = TextPainter(textDirection: TextDirection.ltr);
    for (var i = 0; i <= 3; i++) {
      final v = lo + (hi - lo) * i / 3;
      canvas.drawLine(Offset(left, y(v)), Offset(size.width, y(v)), grid);
      tp.text = TextSpan(text: fmt(v), style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8)));
      tp.layout(maxWidth: left - 2);
      tp.paint(canvas, Offset(left - tp.width - 4, y(v) - 6));
    }
    final n = labels.length;
    final band = w / n;
    final groupW = math.min(band * .78, 12.0 * bars.length + 2);
    final barW = math.max(2.0, (groupW - 2 * (bars.length - 1)) / bars.length);
    final every = math.max(1, (n / (w / 42)).ceil());
    for (var i = 0; i < n; i++) {
      final cx = left + band * i + band / 2;
      final gx = cx - groupW / 2;
      for (var j = 0; j < bars.length; j++) {
        final v = bars[j].values[i];
        final x = gx + j * (barW + 2);
        final rect = Rect.fromLTRB(x, math.min(y(v), y(0)), x + barW, math.max(y(v), y(0)));
        final p = Paint()..color = bars[j].color.withValues(alpha: active == null || active == i ? 1 : .45);
        canvas.drawRRect(RRect.fromRectAndCorners(rect, topLeft: const Radius.circular(3), topRight: const Radius.circular(3)), p);
      }
      if (i % every == 0) {
        tp.text = TextSpan(text: labels[i], style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8)));
        tp.layout();
        tp.paint(canvas, Offset(cx - tp.width / 2, size.height - bottom + 4));
      }
    }
    if (line != null) {
      final path = Path();
      for (var i = 0; i < n; i++) {
        final pt = Offset(left + band * i + band / 2, y(line!.values[i]));
        i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
      }
      canvas.drawPath(path, Paint()..color = line!.color..style = PaintingStyle.stroke..strokeWidth = 2..strokeJoin = StrokeJoin.round);
    }
  }

  @override
  bool shouldRepaint(covariant _BarsPainter old) => true;
}

String shortDate(String s) => s.length == 10 ? '${s.substring(8)}/${s.substring(5, 7)}' : s.length == 7 ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][int.parse(s.substring(5, 7)) - 1] : s;

// Period dropdown used by dashboard and reports
class PeriodDropdown extends StatelessWidget {
  final Period value;
  final ValueChanged<Period> onChanged;
  const PeriodDropdown({super.key, required this.value, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    final list = periods();
    return DropdownButtonHideUnderline(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFCBD5E1))),
        child: DropdownButton<String>(
          value: value.key,
          borderRadius: BorderRadius.circular(14),
          items: [for (final p in list) DropdownMenuItem(value: p.key, child: Text(tr(p.label), style: const TextStyle(fontWeight: FontWeight.w600)))],
          onChanged: (k) => onChanged(list.firstWhere((p) => p.key == k)),
        ),
      ),
    );
  }
}
