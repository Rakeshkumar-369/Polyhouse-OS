// Chart wrappers (recharts). One y-axis per chart, thin marks, tooltips, legends.
// Revenue = blue, Expenses = orange, Profit = green - same colours on every screen.
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, ComposedChart } from 'recharts';
import { short, money, num, PALETTE } from '../utils';

export const C = { revenue: '#2a78d6', expenses: '#eb6834', profit: '#1baf7a', harvest: '#008300', sold: '#6250d6' };
const axis = { stroke: '#94a3b8', fontSize: 11, tickLine: false, axisLine: false };
const grid = <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />;
const tip = { contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }, cursor: { fill: 'rgba(148,163,184,.12)' } };
const tickDate = (v) => (v && v.length === 10 ? v.slice(8) + '/' + v.slice(5, 7) : v);

// Revenue vs expense bars + profit line (all in ₹ - one axis)
export function MoneyTrend({ data, height = 260, cur }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
        {grid}
        <XAxis dataKey="bucket" tickFormatter={tickDate} {...axis} />
        <YAxis tickFormatter={short} {...axis} />
        <Tooltip {...tip} formatter={(v) => money(v, cur)} labelFormatter={tickDate} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Sales" fill={C.revenue} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expenses" name="Expenses" fill={C.expenses} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Line dataKey="profit" name="Profit" stroke={C.profit} strokeWidth={2} dot={false} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Quantity sold per crop over time (stacked), each crop in its own colour
export function CropStack({ data, crops, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey="bucket" tickFormatter={tickDate} {...axis} />
        <YAxis tickFormatter={short} {...axis} />
        <Tooltip {...tip} formatter={(v) => num(v)} labelFormatter={tickDate} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {crops.map((c, i) => <Bar key={c.crop} dataKey={c.crop} stackId="a" fill={c.color || PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth={1} maxBarSize={28} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Cost per unit vs price per unit, by crop - the key decision chart
export function CostVsPrice({ data, height = 240, cur }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2}>
        {grid}
        <XAxis dataKey="crop" {...axis} interval={0} tick={{ fontSize: 11 }} />
        <YAxis {...axis} />
        <Tooltip {...tip} formatter={(v) => `${cur}${num(v, 2)}`} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="avg_price" name="Price / unit" fill={C.revenue} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="cost_per_unit" name="Cost / unit" fill={C.expenses} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Share of total (expense categories): horizontal bars read better than a pie on phones
export function ShareBars({ data, labelKey, valueKey, cur, max = 8 }) {
  const top = data.slice(0, max);
  const rest = data.slice(max).reduce((a, b) => a + Number(b[valueKey]), 0);
  const rows = rest ? [...top, { [labelKey]: 'Other', [valueKey]: rest }] : top;
  const total = rows.reduce((a, b) => a + Number(b[valueKey]), 0) || 1;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r[labelKey]} title={`${r[labelKey]}: ${money(r[valueKey], cur)}`}>
          <div className="flex justify-between text-sm mb-1"><span className="truncate">{r[labelKey]}</span><span className="tabular-nums font-medium">{money(r[valueKey], cur)} <span className="text-slate-400">· {Math.round((100 * r[valueKey]) / total)}%</span></span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(100 * r[valueKey]) / total}%`, background: i < PALETTE.length ? PALETTE[1] : '#94a3b8' }} /></div>
        </div>
      ))}
    </div>
  );
}

export function SimpleLine({ data, x, lines, height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        {grid}
        <XAxis dataKey={x} tickFormatter={tickDate} {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tip} labelFormatter={tickDate} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l, i) => <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color || PALETTE[i]} strokeWidth={2} dot={{ r: 3 }} type="monotone" connectNulls />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, nameKey, valueKey, height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="60%" outerRadius="90%" paddingAngle={1} stroke="#fff" strokeWidth={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tip} formatter={(v) => num(v)} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
