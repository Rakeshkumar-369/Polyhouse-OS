// Hand-written SVG charts (no chart library). One y-axis per chart, thin marks, hover / tap tooltips, legends.
//   <BarChart data x="bucket" series={[{key,name,color}]} stacked line={{key,name,color}} />
//   <LineChart data x="bucket" series={[...]} />
//   <ShareBars data labelKey valueKey />      <Sparkline values color />
import { useLayoutEffect, useRef, useState } from 'react';
import { short, tickDate, money, PALETTE } from '../lib/format';

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const lo = Math.floor(min / step) * step; const hi = Math.ceil(max / step) * step;
  const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

// bar with rounded data-end (top for positive, bottom for negative), flat on the baseline
function barPath(x, y0, w, y1, r = 3) {
  const up = y1 < y0; const h = Math.abs(y1 - y0); r = Math.min(r, w / 2, h);
  if (h < 0.5) return '';
  if (up) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

function Legend({ items }) {
  if (items.length < 2) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600">
      {items.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>)}
    </div>
  );
}

function Tooltip({ x, w, title, rows, fmt }) {
  const left = Math.max(4, Math.min(x - 80, w - 164));
  return (
    <div className="absolute top-0 z-10 pointer-events-none rounded-xl border border-slate-200 bg-white/95 shadow-lg px-3 py-2 text-xs w-40" style={{ left }}>
      <div className="font-semibold text-slate-700 mb-1">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-slate-600 truncate"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />{r.name}</span>
          <span className="font-semibold tabular-nums text-slate-800">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function BarChart({ data, x = 'bucket', series, stacked = false, line, height = 240, fmt = short, tipFmt, xFmt = tickDate }) {
  const [ref, W] = useWidth();
  const [active, setActive] = useState(null);
  const tf = tipFmt || ((v) => (v === null || v === undefined ? '—' : fmt(v)));
  const S = series.map((s, i) => ({ color: PALETTE[i], ...s }));
  const all = [];
  data.forEach((d) => {
    if (stacked) { let p = 0; let n = 0; S.forEach((s) => { const v = Number(d[s.key]) || 0; if (v > 0) p += v; else n += v; }); all.push(p, n); } else S.forEach((s) => all.push(Number(d[s.key]) || 0));
    if (line) all.push(Number(d[line.key]) || 0);
  });
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all, 1));
  const lo = ticks[0]; const hi = ticks[ticks.length - 1];
  const pl = 40; const pr = 6; const pt = 8; const pb = 22;
  const iw = Math.max(10, W - pl - pr); const ih = height - pt - pb;
  const Y = (v) => pt + ih - ((v - lo) / (hi - lo)) * ih;
  const n = data.length || 1; const band = iw / n;
  const groupW = Math.min(band * 0.78, stacked ? 28 : 14 * S.length + 2 * (S.length - 1));
  const barW = stacked ? groupW : Math.max(2, (groupW - 2 * (S.length - 1)) / S.length);
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 54))));
  const legend = [...S, ...(line ? [{ ...line, color: line.color || PALETTE[S.length] }] : [])];

  return (
    <div ref={ref} className="relative select-none">
      {W > 0 && (
        <svg width={W} height={height} role="img" onMouseLeave={() => setActive(null)}>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={pl} x2={W - pr} y1={Y(tk)} y2={Y(tk)} stroke={tk === 0 ? '#cbd5e1' : '#eef2f6'} />
              <text x={pl - 6} y={Y(tk) + 3.5} textAnchor="end" fontSize="10.5" fill="#94a3b8">{fmt(tk)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pl + band * i + band / 2; const gx = cx - groupW / 2;
            let pos = 0; let neg = 0;
            return (
              <g key={i} opacity={active === null || active === i ? 1 : 0.55}>
                {S.map((s, j) => {
                  const v = Number(d[s.key]) || 0;
                  if (stacked) {
                    const base = v >= 0 ? pos : neg; const top = base + v;
                    if (v >= 0) pos = top; else neg = top;
                    return <path key={s.key} d={barPath(gx, Y(base), barW, Y(top), 2)} fill={s.color} stroke="#fff" strokeWidth={stacked ? 1 : 0} />;
                  }
                  return <path key={s.key} d={barPath(gx + j * (barW + 2), Y(0), barW, Y(v))} fill={s.color} />;
                })}
                {i % every === 0 && <text x={cx} y={height - 6} textAnchor="middle" fontSize="10.5" fill="#94a3b8">{xFmt(d[x])}</text>}
              </g>
            );
          })}
          {line && (
            <polyline fill="none" stroke={legend[legend.length - 1].color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              points={data.map((d, i) => `${pl + band * i + band / 2},${Y(Number(d[line.key]) || 0)}`).join(' ')} />
          )}
          {active !== null && <line x1={pl + band * active + band / 2} x2={pl + band * active + band / 2} y1={pt} y2={pt + ih} stroke="#94a3b8" strokeDasharray="3 3" />}
          {data.map((d, i) => (
            <rect key={i} x={pl + band * i} y={pt} width={band} height={ih} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)} />
          ))}
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip x={pl + band * active + band / 2} w={W} title={xFmt(data[active][x])} fmt={tf}
          rows={legend.map((s) => ({ name: s.name, color: s.color, value: data[active][s.key] }))} />
      )}
      <Legend items={legend} />
    </div>
  );
}

export function LineChart({ data, x = 'bucket', series, height = 220, fmt = short, tipFmt, xFmt = tickDate }) {
  const [ref, W] = useWidth();
  const [active, setActive] = useState(null);
  const tf = tipFmt || ((v) => (v === null || v === undefined ? '—' : fmt(v)));
  const S = series.map((s, i) => ({ color: PALETTE[i], ...s }));
  const vals = data.flatMap((d) => S.map((s) => d[s.key]).filter((v) => v !== undefined && v !== null).map(Number));
  const ticks = niceTicks(Math.min(...vals, Infinity) === Infinity ? 0 : Math.min(...vals) * 0.9, Math.max(1, ...vals));
  const lo = ticks[0]; const hi = ticks[ticks.length - 1];
  const pl = 40; const pr = 10; const pt = 8; const pb = 22;
  const iw = Math.max(10, W - pl - pr); const ih = height - pt - pb;
  const n = data.length; const X = (i) => pl + (n <= 1 ? iw / 2 : (iw * i) / (n - 1));
  const Y = (v) => pt + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(iw / 54))));
  const segs = (key) => {
    const out = []; let cur = [];
    data.forEach((d, i) => { const v = d[key]; if (v === undefined || v === null) { if (cur.length) out.push(cur); cur = []; } else cur.push(`${X(i)},${Y(Number(v))}`); });
    if (cur.length) out.push(cur);
    return out;
  };
  return (
    <div ref={ref} className="relative select-none">
      {W > 0 && (
        <svg width={W} height={height} role="img" onMouseLeave={() => setActive(null)}>
          {ticks.map((tk) => (
            <g key={tk}><line x1={pl} x2={W - pr} y1={Y(tk)} y2={Y(tk)} stroke="#eef2f6" /><text x={pl - 6} y={Y(tk) + 3.5} textAnchor="end" fontSize="10.5" fill="#94a3b8">{fmt(tk)}</text></g>
          ))}
          {data.map((d, i) => i % every === 0 && <text key={i} x={X(i)} y={height - 6} textAnchor="middle" fontSize="10.5" fill="#94a3b8">{xFmt(d[x])}</text>)}
          {S.map((s) => segs(s.key).map((p, k) => (
            p.length === 1 ? <circle key={s.key + k} cx={p[0].split(',')[0]} cy={p[0].split(',')[1]} r="3" fill={s.color} />
              : <polyline key={s.key + k} points={p.join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )))}
          {active !== null && (
            <g>
              <line x1={X(active)} x2={X(active)} y1={pt} y2={pt + ih} stroke="#94a3b8" strokeDasharray="3 3" />
              {S.map((s) => data[active][s.key] != null && <circle key={s.key} cx={X(active)} cy={Y(Number(data[active][s.key]))} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />)}
            </g>
          )}
          {data.map((d, i) => {
            const half = n <= 1 ? iw / 2 : iw / (n - 1) / 2;
            return <rect key={i} x={X(i) - half} y={pt} width={half * 2} height={ih} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)} />;
          })}
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip x={X(active)} w={W} title={xFmt(data[active][x])} fmt={tf} rows={S.map((s) => ({ name: s.name, color: s.color, value: data[active][s.key] }))} />
      )}
      <Legend items={S} />
    </div>
  );
}

// Share of a total as labelled horizontal bars (reads better than a pie on phones)
export function ShareBars({ data, labelKey, valueKey, cur, max = 8, color = PALETTE[1] }) {
  const top = data.slice(0, max);
  const rest = data.slice(max).reduce((a, b) => a + Number(b[valueKey]), 0);
  const rows = rest ? [...top, { [labelKey]: 'Other', [valueKey]: rest }] : top;
  const total = rows.reduce((a, b) => a + Number(b[valueKey]), 0) || 1;
  const maxV = Math.max(...rows.map((r) => Number(r[valueKey])), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r[labelKey]}>
          <div className="flex justify-between gap-2 text-sm mb-1"><span className="truncate">{r[labelKey]}</span><span className="tabular-nums font-medium shrink-0">{money(r[valueKey], cur)} <span className="text-slate-400 font-normal">{Math.round((100 * r[valueKey]) / total)}%</span></span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(100 * r[valueKey]) / maxV}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = PALETTE[0], height = 28 }) {
  const [ref, W] = useWidth();
  const v = values.map(Number);
  const lo = Math.min(...v, 0); const hi = Math.max(...v, 1);
  const pts = v.map((y, i) => `${(W * i) / Math.max(1, v.length - 1)},${height - 2 - ((y - lo) / (hi - lo || 1)) * (height - 4)}`).join(' ');
  return <div ref={ref} className="mt-1">{W > 0 && v.length > 1 && <svg width={W} height={height}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>}</div>;
}
