# Polyhouse OS — Commits & release history

All work is on the **`main`** branch, committed as **Rakeshkumar-369 &lt;k.rakeshkumar369@gmail.com&gt;**. There are no other branches.

---

## Release history

### 4.0 — Bills & receipts on WhatsApp, multi-item delivery, easier daily work (latest commit on `main`)

**New**
- **Bills** — every delivery (or every week / month) becomes a numbered bill, `XYZ/2026-27/0001`, restarting each April. **Send on WhatsApp** in one tap: the vendor's chat opens with the bill message and a link. The link opens a printable bill **without any login** — farm details, items, amount in words, total due, **UPI QR with the amount**, bank details, *Print / Save PDF*. Vendors no longer need a login (vendor login is now an optional module).
- **Receipts** — every payment received gets a receipt number (`XYZ-R/2026-27/0001`) and the same one-tap send.
- **Statements** — *Vendors → Send statement*: running statement link on WhatsApp with links to each bill.
- **Bills screen** (web + mobile) — all bills with search, period and *Not sent* filter; **To bill** makes one bill per vendor for unbilled sales (*Bill all*); **Receipts**; owner / manager can cancel a bill (its sales can be billed again).
- **Multi-item Sell** — vendor first, then *Add another item* for each crop / grade, *Same as last time*, open orders added with one tap, running total, **Save & make bill**.
- **Settings → Bills & receipts** — bill every delivery or later, number prefix, bill heading, UPI ID, bank details, footer, show total due.
- **Setup wizard** asks how you bill, your UPI ID and whether vendors will log in.
- Dashboard: **Share today's summary** on WhatsApp; reminder bar for sales not yet on a bill.
- Mobile app: the same Sell → bill → WhatsApp flow, Bills screen with tabs, receipt after payment, send statement, share today's summary.

**Easier to use**
- *Payment received* opens straight on the receipt form with the vendor's balance pre-filled.
- Phone layout: fixed pages that were wider than the screen (dashboard crop cycles, Sell, Spend).
- Delivery staff see *Bills* as a bottom tab; vendor / labour roles are hidden from *Add login* while their module is off.

**Fixed (found in the code review)**
- A recurring payment could be posted twice when two dashboards loaded at the same moment — now claimed atomically before posting.
- Attendance accepted future dates and unknown statuses — now refused.
- Deleting a sale tried to fulfil its order — now only on create / edit.

**Server / database**
- New tables `bills`, `doc_counters`; new columns `sales.bill_id`, `payments_received.receipt_no` / `token`, `parties.share_token` (added automatically on start).
- New routes `/api/bills…`, `/api/receipts/:id`, `/api/statement-link/:id`, `/api/share/today`, public `/api/public/bill|receipt|statement/:token`.
- Optional `APP_URL` setting for the address used in links.
- `npm run scenarios` now 85 checks (32 new for bills, receipts, statements and input checks); mobile widget test for the bill sheet.

### 3.0 — Mobile app, smart suggestions, simpler navigation, hardening

**New**
- **Flutter mobile app** (`mobile/`) for Android and iOS — every role: owner dashboard, smart suggestions with season calendar, Sell, Harvest, Spend, Reports, Vendors (statement, payment, WhatsApp reminder, prices), Labour (attendance, wage run), all 30 record lists with add / edit / delete, Settings (modules, team logins), vendor app, labour app, super admin. English / Telugu, brand app icon, unit + widget tests.
- **Smart suggestions** (`server/src/suggestionsService.js`, `/api/suggestions`, web page *Smart suggestions*, dashboard card): learns each crop's yield per m² by month together with the month's average temperature, humidity and price, then tells the owner what to expect this month and next month, each crop's best season and temperature range, when to transplant, price peaks and weak months.
- Demo data now has **14 months of seasonal history** (incl. Iceberg lettuce) so suggestions have something to learn from.
- `npm run scenarios` — 53 edge-case tests; `npm test` runs smoke + scenarios.
- Docs: `docs/USER_MANUAL.md`, this file, README build-commands table and mobile section.

**Simpler to use**
- One **+ New entry** button (centre of the phone tab bar, top of the desktop menu) for every daily record.
- Menu groups fold away; the group of the open screen stays open.
- Back button on inner phone screens; search box on *More*; offline banner.
- Sell warns when a vendor has no price set (with a link for the owner).

**Fixed (found by the new scenario tests)**
- Delivery / supervisor could set their own sale price through the API — now only owner / manager can; everyone else always gets the vendor price list.
- Negative quantities / amounts and impossible dates (e.g. 2026-13-45) were accepted or caused a server error — now refused with a clear message.
- Rejected quantity larger than the delivered quantity, paid amount larger than the bill, and deductions larger than pay are refused.
- Deleting a crop, vendor, farm or worker that has records is blocked (it broke reports) with a hint to mark it inactive.
- A worker already marked present by the supervisor could not self check-in.
- Mobile Sell screen did not update the amount while typing.

**Server**
- CORS for the mobile app; selected options validated; text inputs trimmed and length-limited.

### 2.0 — Lightweight rebuild, onboarding, Telugu, free hosting — `bb4785c`
- Web app rebuilt without chart / router / icon libraries: first load ~82 KB gzipped (was ~390 KB), each screen a 0.4–5 KB lazy chunk, cached reads, installable PWA.
- Public website with *Request a demo* → super admin *Leads*.
- Super admin creates customer + admin login in one step and shares it on WhatsApp; owner gets a 5-step setup wizard.
- English / Telugu; richer dashboard (cash in hand, price trend, dues ageing, best vendor per crop, crop cycles vs target, best selling days, profit per acre).
- Auto database setup + super admin on first start, `DATABASE_URL` + TLS for cloud MySQL, gzip, security headers, login rate limit.
- Docker, docker-compose, Render blueprint; API smoke test.

### 1.0 — Farm management platform — `457af2b`
- Multi-tenant platform: super admin, owner, manager, supervisor, delivery, vendor, labour roles.
- Farms / bays / crops / crop cycles; harvest; sales with vendor-specific prices; orders; payments; expenses with stock; recurring bills; workers, attendance, advances, wages; EC/pH, climate, scouting, sprays with harvest lock; assets, loans, documents.
- Dashboards, reports (P&L, balance sheet, day book, price matrix), alerts, module on/off toggles.

---

## How to commit and push your own changes

One-time setup on your computer:

```bash
git config --global user.name  "Rakeshkumar-369"
git config --global user.email "k.rakeshkumar369@gmail.com"
git clone https://github.com/Rakeshkumar-369/Polyhouse-OS.git
cd Polyhouse-OS
```

Every change:

```bash
git pull origin main                 # get the latest first
# ... edit files (Contents1.html tells you which ones) ...
npm run build                        # if you changed the web app (client/)
npm start   # in another terminal, then:
npm test                             # API smoke + scenario tests must pass
cd mobile && flutter analyze && flutter test && cd ..   # if you changed the mobile app
git status                           # review what changed
git add -A
git commit -m "Short summary of the change

- what changed and why (one line per point)"
git push origin main
```

**Commit message style used in this repository**
- First line: a short summary in plain English (under ~70 characters), e.g. `Sell: warn when a vendor has no price`.
- Blank line, then bullet points with the details.
- One topic per commit; keep unrelated changes in separate commits.
- Never commit `.env` (it holds passwords) — it is already in `.gitignore`.

**Undo a mistake before pushing**: `git restore <file>` (discard a file's changes) or `git reset --soft HEAD~1` (undo the last commit, keep the changes).

**After pushing** — Render redeploys automatically from `main` (if auto-deploy is on). On a Docker server: `git pull && docker compose up -d --build`.
