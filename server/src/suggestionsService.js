// =====================================================================
// Smart suggestions - learns from the farm's own history:
//   month-by-month yield of every crop (kg per m² per 30 days), the average temperature & humidity
//   recorded in that month (climate log) and the price realised.
// From that it tells the owner, in plain words:
//   * NOW      - is this month's temperature inside each growing crop's best range?
//   * UPCOMING - how did each crop do in the coming month last year? (plan area / planting)
//   * SEASON   - each crop's best month and best temperature range, and when to transplant
//   * PRICE    - the month each crop fetched its best price
//   * AVOID    - the month each crop did worst
// e.g. "Lettuce did best in Dec 2025 (4.3 kg/m², 22 °C average). Transplant by Oct to harvest then."
// Needs at least MIN_MONTHS months of harvests for a crop; until then it says how much more data it needs.
// =====================================================================
const { q } = require('./db');

const MIN_MONTHS = 4;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const r1 = (x) => Math.round(x * 10) / 10;
const ym = (d) => d.slice(0, 7);
const label = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const monthName = (m) => MONTHS[(m + 12) % 12];
const daysIn = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();

async function suggestions(org, today = new Date().toISOString().slice(0, 10)) {
  const o = org.id;
  const [crops, harvest, sales, climate, cycles, firstDay] = await Promise.all([
    q('SELECT id, name, unit, color FROM crops WHERE org_id=?', [o]),
    q(`SELECT h.crop_id, DATE_FORMAT(h.date,'%Y-%m') m, SUM(h.quantity) qty, SUM(COALESCE(h.culls,0)) culls,
         COALESCE(SUM(DISTINCT c.area_sqm),0) area, MIN(h.date) first, MAX(h.date) last
       FROM harvests h LEFT JOIN crop_cycles c ON c.id=h.crop_cycle_id WHERE h.org_id=? GROUP BY h.crop_id, m`, [o]),
    q(`SELECT crop_id, DATE_FORMAT(date,'%Y-%m') m, SUM(amount) amt, SUM(quantity - COALESCE(rejected_qty,0)) qty
       FROM sales WHERE org_id=? GROUP BY crop_id, m`, [o]),
    q(`SELECT DATE_FORMAT(date,'%Y-%m') m, AVG(temperature) t, AVG(humidity) h, COUNT(*) n FROM climate_logs WHERE org_id=? GROUP BY m`, [o]),
    q(`SELECT crop_id, AVG(DATEDIFF(harvest_start, transplant_date)) lead, MAX(status IN ('growing','harvesting')) active
       FROM crop_cycles WHERE org_id=? AND transplant_date IS NOT NULL GROUP BY crop_id`, [o]),
    q('SELECT MIN(date) d FROM harvests WHERE org_id=?', [o]),
  ]);
  const start = firstDay[0]?.d;
  const clim = Object.fromEntries(climate.map((c) => [c.m, { t: c.t === null ? null : r1(c.t), h: c.h === null ? null : Math.round(c.h) }]));
  const thisMonth = ym(today);

  // yield per m² per 30 days for every crop & month (partial first / current month are scaled)
  const byCrop = {};
  for (const row of harvest) {
    let days = daysIn(row.m);
    if (row.m === thisMonth) days = Number(today.slice(8, 10));
    if (start && row.m === ym(start)) days = days - Number(start.slice(8, 10)) + 1;
    const perArea = row.area > 0 ? row.qty / row.area : null;
    const value = (perArea ?? row.qty) * (30 / Math.max(days, 1));
    const s = sales.find((x) => x.crop_id === row.crop_id && x.m === row.m);
    (byCrop[row.crop_id] = byCrop[row.crop_id] || []).push({
      m: row.m, cal: Number(row.m.slice(5, 7)) - 1, value, perArea: perArea !== null, waste: row.qty ? (100 * row.culls) / row.qty : 0,
      t: clim[row.m]?.t ?? null, h: clim[row.m]?.h ?? null, price: s && s.qty ? s.amt / s.qty : null, partial: days < 20,
    });
  }

  const out = []; const profiles = [];
  const nowT = clim[thisMonth]?.t ?? null;
  const nextCal = (Number(thisMonth.slice(5, 7))) % 12; // 0-based next month

  for (const c of crops) {
    const rows = (byCrop[c.id] || []).filter((r) => !r.partial).sort((a, b) => a.m.localeCompare(b.m));
    const cyc = cycles.find((x) => x.crop_id === c.id);
    const unit = rows.some((r) => r.perArea) ? `${c.unit}/m²` : c.unit;
    if (!rows.length) continue;
    if (rows.length < MIN_MONTHS) {
      profiles.push({ crop_id: c.id, crop: c.name, color: c.color, months: rows.length, learning: true });
      out.push({ type: 'learning', priority: 9, crop: c.name, color: c.color, title: `Learning ${c.name}`, detail: `${rows.length} month(s) of harvest so far. Smart suggestions for ${c.name} start after ${MIN_MONTHS} months of harvest and temperature records.`, confidence: 'low' });
      continue;
    }
    const avg = rows.reduce((a, r) => a + r.value, 0) / rows.length;
    const best = rows.reduce((a, r) => (r.value > a.value ? r : a));
    const worst = rows.reduce((a, r) => (r.value < a.value ? r : a));
    // best temperature range = temperatures of the top third of months
    const withT = rows.filter((r) => r.t !== null).sort((a, b) => b.value - a.value);
    const top = withT.slice(0, Math.max(2, Math.ceil(withT.length / 3)));
    const range = top.length ? [Math.min(...top.map((r) => r.t)), Math.max(...top.map((r) => r.t))] : null;
    const bestMonths = [...new Set(top.map((r) => r.cal))].sort((a, b) => a - b);
    const lead = Math.round(cyc?.lead || 45);
    const conf = rows.length >= 10 ? 'high' : rows.length >= 6 ? 'medium' : 'low';
    const pctOf = (v) => Math.round((100 * (v - avg)) / avg);
    const profile = { crop_id: c.id, crop: c.name, color: c.color, unit, months: rows.length, average: r1(avg), best: { month: label(best.m), value: r1(best.value), t: best.t }, worst: { month: label(worst.m), value: r1(worst.value), t: worst.t }, range, bestMonths: bestMonths.map(monthName), lead, active: !!cyc?.active, confidence: conf,
      byMonth: Array.from({ length: 12 }, (_, i) => {
        const latest = rows.filter((r) => r.cal === i).pop();
        return latest ? { month: MONTHS[i], index: Math.round((100 * latest.value) / avg), value: r1(latest.value), t: latest.t, price: latest.price === null ? null : Math.round(latest.price) } : null;
      }) };
    profiles.push(profile);

    // NOW: this month's temperature vs the crop's best range (only for crops being grown)
    if (profile.active && nowT !== null && range) {
      const lo = range[0] - 1; const hi = range[1] + 1;
      if (nowT > hi) out.push({ type: 'now', level: 'warn', priority: 1, crop: c.name, color: c.color, title: `${c.name}: too hot this month`, detail: `Average so far ${nowT} °C; ${c.name} did best at ${range[0]}–${range[1]} °C. Use shade net, foggers and morning irrigation to bring it down.`, confidence: conf });
      else if (nowT < lo) out.push({ type: 'now', level: 'warn', priority: 1, crop: c.name, color: c.color, title: `${c.name}: cooler than it likes`, detail: `Average so far ${nowT} °C; ${c.name} did best at ${range[0]}–${range[1]} °C. Close side curtains at night and reduce misting.`, confidence: conf });
      else out.push({ type: 'now', level: 'good', priority: 3, crop: c.name, color: c.color, title: `${c.name}: weather is in its sweet spot`, detail: `Average so far ${nowT} °C is inside its best range ${range[0]}–${range[1]} °C. Keep harvest and sales teams ready for good volumes.`, confidence: conf });
    }

    // UPCOMING: next month last year
    const nxt = rows.filter((r) => r.cal === nextCal).pop();
    if (nxt) {
      const d = pctOf(nxt.value);
      if (Math.abs(d) >= 10) out.push({ type: 'upcoming', level: d > 0 ? 'good' : 'warn', priority: 2, crop: c.name, color: c.color,
        title: `${MONTHS[nextCal]}: ${c.name} ${d > 0 ? `did ${d}% better` : `dropped ${-d}%`} last year`,
        detail: `In ${label(nxt.m)} ${c.name} gave ${r1(nxt.value)} ${unit}${nxt.t !== null ? ` at ${nxt.t} °C average` : ''} (${d > 0 ? '+' : ''}${d}% vs its normal month). ${d > 0 ? 'Line up buyers and pickers for extra volume.' : 'Plan for lower volume, or give that area to a crop that likes the weather.'}`, confidence: conf });
    }

    // SEASON: best months + when to transplant
    const plantBy = Math.max(1, Math.round(lead / 30));
    out.push({ type: 'season', level: 'info', priority: 4, crop: c.name, color: c.color,
      title: `${c.name} grows best in ${bestMonths.map(monthName).join(', ')}`,
      detail: `${c.name} did best in ${label(best.m)}: ${r1(best.value)} ${unit} (${pctOf(best.value) > 0 ? '+' : ''}${pctOf(best.value)}% vs its average)${best.t !== null ? ` when the average temperature was ${best.t} °C` : ''}${range ? `; its best range is ${range[0]}–${range[1]} °C` : ''}. To be picking in ${MONTHS[best.cal]}, transplant in ${monthName(best.cal - plantBy)} (about ${lead} days from transplant to first harvest).`,
      confidence: conf, best: label(best.m) });

    // AVOID: worst month
    if (pctOf(worst.value) <= -25) out.push({ type: 'avoid', level: 'warn', priority: 6, crop: c.name, color: c.color,
      title: `${c.name} struggles in ${MONTHS[worst.cal]}`,
      detail: `In ${label(worst.m)} yield fell to ${r1(worst.value)} ${unit} (${pctOf(worst.value)}%)${worst.t !== null ? ` at ${worst.t} °C` : ''}${worst.waste > 5 ? ` and ${Math.round(worst.waste)}% was wasted` : ''}. Avoid having this crop at peak harvest then, or plan cooling/heating.`, confidence: conf,
      month: MONTHS[worst.cal], drop: pctOf(worst.value), t: worst.t });

    // PRICE: best price month
    const priced = rows.filter((r) => r.price);
    if (priced.length >= MIN_MONTHS) {
      const pAvg = priced.reduce((a, r) => a + r.price, 0) / priced.length;
      const pBest = priced.reduce((a, r) => (r.price > a.price ? r : a));
      const up = Math.round((100 * (pBest.price - pAvg)) / pAvg);
      if (up >= 10) out.push({ type: 'price', level: 'info', priority: 5, crop: c.name, color: c.color,
        title: `${c.name} fetches the best price in ${MONTHS[pBest.cal]}`,
        detail: `Average price in ${label(pBest.m)} was ₹${Math.round(pBest.price)}/${c.unit}, ${up}% above its usual ₹${Math.round(pAvg)}. Having stock to sell in ${MONTHS[pBest.cal]} pays more, even if the yield is lower.`, confidence: conf,
        month: MONTHS[pBest.cal], price: Math.round(pBest.price), up });
    }
  }

  // Merge same-kind messages so the list stays short: one line for all crops in their sweet spot,
  // one line per month for price peaks and for weak months.
  const merged = []; const groups = {};
  for (const s of out) {
    const key = s.type === 'now' && s.level === 'good' ? 'now-good' : ['price', 'avoid'].includes(s.type) ? `${s.type}-${s.month}` : null;
    if (key) (groups[key] = groups[key] || []).push(s); else merged.push(s);
  }
  for (const list of Object.values(groups)) {
    if (list.length === 1) { merged.push(list[0]); continue; }
    const f = list[0]; const names = list.map((x) => x.crop).join(', ');
    if (f.type === 'now') merged.push({ ...f, crop: names, color: null, title: `Weather is in the sweet spot for ${names}`, detail: `This month's average so far is ${nowT} °C — inside the best range of each of these crops. Keep harvest and sales teams ready for good volumes.` });
    if (f.type === 'price') merged.push({ ...f, crop: names, color: null, title: `${f.month} fetches the best prices`, detail: `Last year: ${list.map((x) => `${x.crop} ₹${x.price} (+${x.up}%)`).join(', ')}. Supply is low in ${f.month}; crops that can still be picked then earn more.` });
    if (f.type === 'avoid') merged.push({ ...f, crop: names, color: null, title: `${f.month} is the weakest month for ${names}`, detail: `Yields fell by ${list.map((x) => `${x.crop} ${x.drop}%`).join(', ')}${f.t !== null ? ` at about ${f.t} °C` : ''}. Avoid peak harvest of these crops then, or plan shade, foggers and cooling.` });
  }
  out.length = 0; out.push(...merged);
  out.sort((a, b) => a.priority - b.priority || String(a.crop).localeCompare(String(b.crop)));
  const tempRow = Array.from({ length: 12 }, (_, i) => {
    const keys = Object.keys(clim).filter((k) => Number(k.slice(5, 7)) - 1 === i).sort();
    const k = keys.pop();
    return k ? { month: MONTHS[i], t: clim[k].t, h: clim[k].h } : null;
  });
  return { generated: today, thisMonth: label(thisMonth), currentTemp: nowT, minMonths: MIN_MONTHS, suggestions: out, profiles, tempRow, months: MONTHS };
}

module.exports = { suggestions };
