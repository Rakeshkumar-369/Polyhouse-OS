// =====================================================================
// Bills, payment receipts and vendor statements - for farms whose vendors do NOT log in.
//   * A bill groups the sale lines of one delivery (or of a week / month) for one vendor,
//     gets a running number per financial year (XYZ/2026-27/0042) and a secret public link
//     /b/<token> that opens a printable bill with a pay-by-UPI QR code.
//   * Every payment received gets a receipt number and a public link /r/<token>.
//   * Each vendor has a statement link /s/<token> with the running balance.
//   * share() builds the WhatsApp message + wa.me link used by the web and mobile apps.
// Amounts are always summed from the sales rows, so edits / rejections show on the bill.
// =====================================================================
const crypto = require('crypto');
const { q, one } = require('./db');
const { createRecord } = require('./routes/crud');
const { receivables } = require('./reportService');

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const newToken = () => crypto.randomBytes(15).toString('base64url');
const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;
const rupees = (v) => `₹${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fdate = (d) => (d ? `${d.slice(8, 10)} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}` : '');
const num = (v) => Number(Number(v || 0).toFixed(2)).toLocaleString('en-IN');

// Indian financial year of a date: 2026-11-11 -> "2026-27"
function fyOf(date) {
  const y = Number(date.slice(0, 4)); const start = Number(date.slice(5, 7)) >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

// Bill number prefix: Settings value, else the farm's short name ("XYZ Polyhouse" -> "XYZ")
function prefixOf(org) {
  const p = org.settings?.billing?.prefix;
  if (p) return p;
  const words = String(org.name || 'BILL').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  return (words[0] && words[0].length <= 4 ? words[0] : words.slice(0, 3).map((w) => w[0]).join('')) || 'BILL';
}

// Atomic running number per org / kind / financial year (safe when two people save at once)
async function nextNo(org, kind, date) {
  const fy = fyOf(date);
  const r = await q(`INSERT INTO doc_counters (org_id, kind, fy, last_no) VALUES (?,?,?,LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_no = LAST_INSERT_ID(last_no + 1)`, [org.id, kind, fy]);
  const n = String(r.insertId).padStart(4, '0');
  return kind === 'receipt' ? `${prefixOf(org)}-R/${fy}/${n}` : `${prefixOf(org)}/${fy}/${n}`;
}

// WhatsApp link: to the vendor's number when known, else WhatsApp asks which chat
function waLink(phone, text) {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.length === 10) p = '91' + p;
  if (p.length === 11 && p.startsWith('0')) p = '91' + p.slice(1);
  return `https://wa.me/${p.length >= 11 ? p : ''}?text=${encodeURIComponent(text)}`;
}

async function orgHeader(orgId) {
  const o = await one('SELECT * FROM organizations WHERE id=?', [orgId]);
  const { mergeSettings } = require('./middleware/auth');
  o.settings = mergeSettings(o.settings);
  const b = o.settings.billing;
  return {
    org: o,
    header: { name: o.name, company: o.company_name, address: [o.address, o.district, o.state].filter(Boolean).join(', '), phone: o.phone, email: o.email, gstin: o.gstin,
      title: b.title, upi_id: b.upi_id, bank_details: b.bank_details, footer: b.footer, show_balance: b.show_balance !== false, currency: o.settings.currency || '₹' },
  };
}

async function partyBalance(orgId, partyId) {
  const r = (await receivables(orgId)).find((x) => x.party_id === Number(partyId));
  return r ? { balance: r2(r.balance), overdue: r2(r.overdue), credit_days: r.credit_days } : { balance: 0, overdue: 0, credit_days: 0 };
}

// ---------------------------------------------------------------- bills
async function billData(bill, base) {
  const { header } = await orgHeader(bill.org_id);
  const party = await one('SELECT id, name, phone, email, address, gstin, credit_days FROM parties WHERE id=?', [bill.party_id]);
  const lines = await q(`SELECT s.id, s.date, s.grade, s.quantity, s.rejected_qty, s.rate, s.amount, s.status, s.vendor_note,
      c.name crop, c.variety, c.unit FROM sales s JOIN crops c ON c.id=s.crop_id WHERE s.bill_id=? ORDER BY s.date, s.id`, [bill.id]);
  const totals = {
    lines: lines.length,
    quantity: r2(lines.reduce((a, l) => a + Number(l.quantity), 0)),
    rejected: r2(lines.reduce((a, l) => a + Number(l.rejected_qty || 0), 0)),
    gross: r2(lines.reduce((a, l) => a + Number(l.quantity) * Number(l.rate), 0)),
    rejected_value: r2(lines.reduce((a, l) => a + Number(l.rejected_qty || 0) * Number(l.rate), 0)),
    amount: r2(lines.reduce((a, l) => a + Number(l.amount), 0)),
  };
  const bal = header.show_balance ? await partyBalance(bill.org_id, bill.party_id) : null;
  const url = `${base}/b/${bill.token}`;
  const multiDate = new Set(lines.map((l) => l.date)).size > 1;
  const text = [
    `*${header.name}*`,
    `${header.title || 'Bill'} No. ${bill.bill_no} · ${fdate(bill.date)}`,
    `To: ${party.name}`,
    '',
    ...lines.map((l) => `${multiDate ? fdate(l.date) + ' ' : ''}${l.crop} ${l.grade} – ${num(Number(l.quantity) - Number(l.rejected_qty || 0))} ${l.unit} × ${rupees(l.rate)} = ${rupees(l.amount)}`),
    '',
    `*Bill amount: ${rupees(totals.amount)}*`,
    ...(bal && bal.balance > 0 ? [`Total due: ${rupees(bal.balance)}`] : []),
    ...(header.upi_id ? [`Pay by UPI: ${header.upi_id}`] : []),
    `View / download: ${url}`,
    ...(bill.status === 'cancelled' ? ['(This bill is CANCELLED)'] : []),
  ].join('\n');
  return { kind: 'bill', header, bill: { id: bill.id, bill_no: bill.bill_no, date: bill.date, status: bill.status, notes: bill.notes, sent_count: bill.sent_count, sent_at: bill.sent_at },
    party, lines, totals, balance: bal, share: { url, text, whatsapp: waLink(party.phone, text), phone: party.phone } };
}

async function getBill(orgId, id) {
  const b = await one('SELECT * FROM bills WHERE org_id=? AND id=?', [orgId, id]);
  if (!b) throw bad('Bill not found', 404);
  return b;
}

async function checkParty(org, partyId) {
  const p = await one("SELECT id FROM parties WHERE org_id=? AND id=? AND type IN ('buyer','both')", [org.id, partyId]);
  if (!p) throw bad('Pick a buyer vendor for the bill');
}

// Create a bill. Either `lines` (new sale lines, created with all the usual sale rules)
// or `sale_ids` (existing unbilled sales of this vendor).
async function createBill(org, user, { party_id: partyId, date, farm_id: farmId, notes, lines, sale_ids: saleIds }) {
  await checkParty(org, partyId);
  const day = date || new Date().toISOString().slice(0, 10);
  let ids = [];
  if (Array.isArray(lines) && lines.length) {
    if (lines.length > 50) throw bad('A bill can have at most 50 lines');
    try {
      for (const l of lines) {
        const s = await createRecord('sales', { ...l, party_id: partyId, date: day, farm_id: l.farm_id || farmId || '' }, { user, org });
        ids.push(s.id);
      }
    } catch (e) {
      if (ids.length) await q('DELETE FROM sales WHERE org_id=? AND id IN (?)', [org.id, ids]);
      throw e;
    }
  } else if (Array.isArray(saleIds) && saleIds.length) {
    const rows = await q('SELECT id FROM sales WHERE org_id=? AND party_id=? AND bill_id IS NULL AND id IN (?)', [org.id, partyId, saleIds.map(Number)]);
    ids = rows.map((r) => r.id);
    if (!ids.length) throw bad('These sales are already on a bill');
  } else throw bad('Add at least one item');

  const billNo = await nextNo(org, 'bill', day);
  const r = await q('INSERT INTO bills SET ?', [{ org_id: org.id, bill_no: billNo, date: day, party_id: partyId, farm_id: farmId || null, notes: notes ? String(notes).slice(0, 300) : null, token: newToken(), created_by: user.id }]);
  await q('UPDATE sales SET bill_id=? WHERE org_id=? AND id IN (?)', [r.insertId, org.id, ids]);
  return getBill(org.id, r.insertId);
}

// One bill per vendor for all unbilled sales in a date range (weekly / monthly billing)
async function billUnbilled(org, user, { party_id: partyId, from, to }) {
  const p = [org.id, from, to]; let extra = '';
  if (partyId) { extra = 'AND party_id=?'; p.push(partyId); }
  const groups = await q(`SELECT party_id, GROUP_CONCAT(id) ids FROM sales WHERE org_id=? AND bill_id IS NULL AND date BETWEEN ? AND ? ${extra} GROUP BY party_id`, p);
  const out = [];
  for (const g of groups) {
    const party = await one("SELECT id FROM parties WHERE id=? AND type IN ('buyer','both')", [g.party_id]);
    if (!party) continue;
    out.push(await createBill(org, user, { party_id: g.party_id, date: to, sale_ids: g.ids.split(',').map(Number) }));
  }
  return out;
}

// ---------------------------------------------------------------- receipts
async function ensureReceipt(org, paymentId) {
  const p = await one('SELECT * FROM payments_received WHERE org_id=? AND id=?', [org.id, paymentId]);
  if (!p) throw bad('Payment not found', 404);
  if (!p.receipt_no || !p.token) {
    p.receipt_no = p.receipt_no || await nextNo(org, 'receipt', p.date);
    p.token = p.token || newToken();
    await q('UPDATE payments_received SET receipt_no=?, token=? WHERE id=?', [p.receipt_no, p.token, p.id]);
  }
  return p;
}

async function receiptData(p, base) {
  const { header } = await orgHeader(p.org_id);
  const party = await one('SELECT id, name, phone, address, gstin FROM parties WHERE id=?', [p.party_id]);
  const bal = await partyBalance(p.org_id, p.party_id);
  const url = `${base}/r/${p.token}`;
  const text = [
    `*${header.name}*`,
    `Payment receipt No. ${p.receipt_no} · ${fdate(p.date)}`,
    `Received with thanks from ${party.name}: *${rupees(p.amount)}* by ${String(p.mode).toUpperCase()}${p.reference ? ` (Ref ${p.reference})` : ''}.`,
    ...(header.show_balance ? [bal.balance > 0 ? `Balance due: ${rupees(bal.balance)}` : 'No balance due. Thank you!'] : []),
    `Receipt: ${url}`,
  ].join('\n');
  return { kind: 'receipt', header, party, payment: { id: p.id, receipt_no: p.receipt_no, date: p.date, amount: p.amount, mode: p.mode, reference: p.reference, notes: p.notes },
    balance: header.show_balance ? bal : null, share: { url, text, whatsapp: waLink(party.phone, text), phone: party.phone } };
}

// ---------------------------------------------------------------- statements
async function ensurePartyToken(orgId, partyId) {
  const p = await one('SELECT * FROM parties WHERE org_id=? AND id=?', [orgId, partyId]);
  if (!p) throw bad('Vendor not found', 404);
  if (!p.share_token) { p.share_token = newToken(); await q('UPDATE parties SET share_token=? WHERE id=?', [p.share_token, p.id]); }
  return p;
}

async function statementData(party, base, from, to) {
  const { vendorStatement } = require('./routes/reports');
  const { header } = await orgHeader(party.org_id);
  const st = await vendorStatement(party, from, to);
  const bills = await q(`SELECT b.bill_no, b.date, b.token, COALESCE(SUM(s.amount),0) amount FROM bills b LEFT JOIN sales s ON s.bill_id=b.id
    WHERE b.party_id=? AND b.status='issued' AND b.date BETWEEN ? AND ? GROUP BY b.id ORDER BY b.date DESC LIMIT 60`, [party.id, from, to]);
  const url = `${base}/s/${party.share_token}`;
  const text = [
    `*${header.name}*`,
    `Statement for ${party.name} · ${fdate(from)} to ${fdate(to)}`,
    `Opening ${rupees(st.opening)} + sales ${rupees(st.total_sales)} − received ${rupees(st.total_paid)}`,
    `*Balance due: ${rupees(st.closing)}*${st.overdue > 0 ? ` (overdue ${rupees(st.overdue)})` : ''}`,
    ...(header.upi_id && st.closing > 0 ? [`Pay by UPI: ${header.upi_id}`] : []),
    `Details: ${url}`,
  ].join('\n');
  delete st.party.share_token; delete st.party.org_id; delete st.party.notes; delete st.party.opening_balance;
  return { kind: 'statement', header, ...st, bills: bills.map((b) => ({ ...b, url: `${base}/b/${b.token}`, token: undefined })),
    share: { url, text, whatsapp: waLink(party.phone, text), phone: party.phone } };
}

module.exports = { fyOf, prefixOf, nextNo, waLink, billData, getBill, createBill, billUnbilled, ensureReceipt, receiptData, ensurePartyToken, statementData, rupees, fdate };
