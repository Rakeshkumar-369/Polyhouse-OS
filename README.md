# Polyhouse OS — the operating system for polyhouses and farms

Polyhouse OS is a complete, mobile-first platform for growers: one **Farm OS** that runs the day (harvest by crop and grade, sales to many vendors at each vendor's own price, every rupee spent, attendance and wages, crop logs) and turns it into **dashboards the owner can act on the same evening** — profit, cost per kg vs price per kg, who owes how much for how long, and what needs attention today.

It is built from the *Polyhouse Industry Problems & Product Blueprint*: every module exists because a problem costs a grower money, and every screen shows the number it moves (yield per m², price realised per kg, cost per kg, days to collect, labour cost per kg, rejection %).

It is sold to five kinds of customers: **one-polyhouse owners, crop-field owners, owners with many polyhouses, Farmer Producer Organisations (FPOs) and farmers with land at different places.**

> **Stack:** React 18 + Vite + Tailwind CSS (no UI library, 60-line router, hand-written SVG charts, inline Bootstrap Icons) · Node.js + Express · MySQL 8
> **Languages:** English and తెలుగు (switch on any screen) · **No payment gateway needed** — money is recorded as line entries.

---

## Contents

1. [Quick start (local)](#1-quick-start-local)
2. [Demo logins](#2-demo-logins)
3. [The apps](#3-the-apps)
4. [Onboarding a new customer (2 minutes)](#4-onboarding-a-new-customer-2-minutes)
5. [Guided 10-minute demo](#5-guided-10-minute-demo)
6. [Blueprint → module map](#6-blueprint--module-map)
7. [Free hosting — go live today](#7-free-hosting--go-live-today)
8. [Architecture & performance](#8-architecture--performance)
9. [Project structure](#9-project-structure)
10. [API overview](#10-api-overview)
11. [Scripts & testing](#11-scripts--testing)
12. [Configuration (.env)](#12-configuration-env)
13. [Roadmap](#13-roadmap)

---

## 1. Quick start (local)

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18.18 or newer (20/22 recommended) |
| MySQL | 8.0 (MariaDB 10.6+ also works) |
| npm | 9+ |

### Steps

```bash
# 1. Clone
git clone https://github.com/Rakeshkumar-369/Polyhouse-OS.git
cd Polyhouse-OS

# 2. Create a MySQL user (once). Use your MySQL root login:
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS polyhouse_os; CREATE USER IF NOT EXISTS 'poly'@'localhost' IDENTIFIED BY 'poly123';
GRANT ALL PRIVILEGES ON polyhouse_os.* TO 'poly'@'localhost'; FLUSH PRIVILEGES;"

# 3. Configure
cp .env.example .env          # edit DB_* if your MySQL user/password differ

# 4. Install (server + web app) and load demo data (~20 seconds)
npm install
npm run db:reset

# 5. Run API + web app with live reload
npm run dev
```

Open **http://localhost:5173** — the product website. Click **Log in** and tap any demo account.

The API runs on http://localhost:4000 (Vite proxies `/api` to it during development).

> **Windows:** the same commands work in PowerShell. If `mysql` is not on your PATH, run the `CREATE USER` statement from MySQL Workbench.

### One-command alternative: Docker

```bash
SEED_DEMO=true DEMO_MODE=true docker compose up -d --build
```

Then open **http://localhost:4000**. The first start creates the tables, the super admin and (with `SEED_DEMO=true`) the demo farm. To start again with fresh data: `docker compose down -v && docker compose up -d --build`.

### Refreshing demo data

Demo data is generated **relative to today** (60 days of history), so dashboards always look current. Re-run `npm run db:reset` any time to get a fresh "today".

---

## 2. Demo logins

The login page shows one-tap buttons for all of these when `DEMO_MODE=true`.

| App | Role | Name | Login | Password | What to look at |
|---|---|---|---|---|---|
| Platform | Super admin | Platform owner | `superadmin` | `admin123` | Customers, create customer + admin login, WhatsApp the login, leads from the website |
| Farm OS | Owner (admin) | XYZ Polyhouse | `xyz` | `xyz123` | Dashboard, reports, vendors, labour, settings & module toggles |
| Farm OS | Supervisor | Venkatesh | `super1` | `demo123` | "My farm today", harvest, attendance, EC/pH, sprays — no money reports |
| Farm OS | Delivery | Raju | `delivery1` | `demo123` | Sell screen: crop → vendor → quantity, price auto-applied |
| Vendor app | Vendor | FreshMart Retail | `vendor1` | `demo123` | Deliveries to confirm / reject, statement, dues, prices, orders |
| Labour app | Labour | Lakshmi | `labour1` | `demo123` | Check-in button, earnings this week / month, payslips |

### What the demo data contains

2 polyhouses (one leased) with 6 bays · 4 crops (Capsicum Red & Yellow, English Cucumber, Cherry Tomato) in running crop cycles · 4 buyers with different prices and credit terms (a retail chain that rejects a little, a hotel that pays late, a mandi agent who buys B grade, a B2B aggregator) and 1 input supplier · ~1,000 sales and ~500 harvest entries · 5 workers (daily, monthly and per-kg pay) with attendance, weekly wage payments and an advance · fertiliser, transport, rent, electricity, salary and loan EMI expenses · stock purchases on credit · EC/pH, climate and scouting logs · an active spray lock · a subsidy instalment · assets with a polyfilm due for replacement · a vendor order waiting · 2 demo leads.

The simulation is shaped so the insights mean something: the hotel pays the best price but is badly overdue, drain EC creeps up in Polyhouse 1 (salt build-up alert), calcium nitrate is running low, and one polyhouse bay is locked for harvest after a spray.

---

## 3. The apps

| App | URL | For | Highlights |
|---|---|---|---|
| **Website** | `/` | Prospects | Problem → module → number, who it's for, one login per person, plans, **Request a demo** form (lands in Super admin → Leads) |
| **Farm OS** | `/` after login | Owner, manager, supervisor, delivery | Dashboard with a one-line finding, KPIs vs previous period, sales vs expenses, cost vs price by crop, price trend, ageing of dues, best-paying vendor per crop, crop cycles vs target, best selling days, labour; **Sell**, **Harvest**, **Spend** quick-entry screens; Reports; Vendors; Labour; Alerts; 30 list screens; Settings with **module on/off toggles** |
| **Setup wizard** | `/setup` | New owner (first login) | 5 steps: farm (acres, L×W×H, rent) → crops → vendors & their prices → workers & pay + monthly bills → start. Every step skippable |
| **Vendor app** | `/` as vendor | Buyers | Deliveries with confirm / report rejected qty, statement with running balance, dues & overdue, today's prices, place / cancel orders |
| **Labour app** | `/` as labour | Workers | Big check-in / check-out button, "do not enter" spray warning, earnings this week and month, tasks, 4-week attendance calendar, payslips — in Telugu |
| **Platform** | `/` as super admin | You | Create customer + admin login in one form, **send the login on WhatsApp**, open any customer to set it up for them, reset password, suspend, leads from the website |

---

## 4. Onboarding a new customer (2 minutes)

1. Log in as **super admin** → **New customer + admin login**.
2. Pick the customer type (single polyhouse / crop field / many polyhouses / FPO / land at many places) — this switches on the right modules.
3. Enter the farm name (e.g. *XYZ Polyhouse*), owner name and phone. The owner's **User ID** defaults to the phone and a password is generated.
4. **Create** → a card shows the link, User ID and password with **Send on WhatsApp** and **Copy**.
5. The owner logs in and the **setup wizard** opens: farm details → crops → vendors & prices → workers & pay → done. They can record harvest and sales the same minute.
6. From **Settings → Users & logins** the owner creates logins for supervisor, delivery person, vendors and labour (again with a WhatsApp share button), and turns modules on or off to match their way of working.

---

## 5. Guided 10-minute demo

1. **Website** → `http://localhost:5173` → scroll to *Request a free demo* → submit.
2. **Super admin** → *Leads* shows the request → **Create account** pre-fills the form from the lead → create → *Send on WhatsApp*.
3. Log out, log in as the new owner → walk the **setup wizard** (tick Capsicum Red, give a vendor ₹95/kg, add a worker).
4. **Delivery** → *Sell* → tap Capsicum Red → the vendor → 40 kg → the price fills in by itself → *Save sale*.
5. **Owner (xyz)** → *Home*: the one-line finding, Cash in hand, *Needs attention* (salt build-up, overdue hotel, low stock, polyfilm replacement), *Who owes how long*, *Best paying vendor per crop*, *Crop cycles vs target*. Switch the period dropdown to *Last month* or *This financial year*.
6. **Reports** → *Vendors* → the price matrix (best price in green); *P&L*; *Balance sheet*; *Day book*; download any table to Excel.
7. **Vendors** → *Hotel Grand Deccan* → statement → *Reminder* (WhatsApp) → *Record payment*.
8. **Labour** → mark attendance → *Wage run* → *Pay* (posts to expenses, recovers the advance).
9. **Vendor (vendor1)** → confirm a delivery and report 2 kg rejected → the owner's amount and rejection % update.
10. **Labour (labour1)** → switch to తెలుగు → *Check in*.
11. **Settings → Modules on/off** → turn off *Labour & wages* → its screens disappear for everyone; turn it back on.

---

## 6. Blueprint → module map

| Problem (blueprint) | Module | Where in the app | Number it moves |
|---|---|---|---|
| No true P&L or cost per kg | Expense ledger charged to crop cycles, harvest & sales ledger, P&L and balance sheet for any dates | Spend · Reports → Crops / P&L / Balance sheet | Cost per kg vs price per kg |
| Many buyers, many dues | Vendor price list, sale → vendor confirmation → payment → statement, overdue by credit days, WhatsApp reminder | Sell · Vendors · Vendor app | Days to collect, rejection % |
| Price crashes, dependence on middlemen | Price trend by crop, price matrix by vendor, best-paying vendor per crop | Dashboard · Reports → Vendors | Price realised per kg |
| Harvest not tied to bays | Harvest by crop, grade, farm, bay and picker | Harvest | Yield by bay, A-grade share |
| Matching harvest to orders | Vendor orders, produce stock (harvested − sold), fulfil from Sell | Sell · Vendor app | Order fill rate |
| Labour cost invisible, wage disputes | Attendance in one screen, daily / monthly / per-kg wage engine, advances recovered, payslips, labour login | Labour · Labour app | Labour cost per kg |
| Crop losses found too late | EC/pH feed & drain log with recipe bands, climate log, scouting trap counts, alerts | Grow menu · Alerts | Days in target band |
| Spray residue & worker exposure | Spray log with pre-harvest interval → harvest lock and "do not enter" warning | Spray log · Harvest · Labour app | Residue rejections |
| Input stock-outs | Stock items, purchases add stock, issue to farm, low-stock alert | Spend · Input stock | Stock-out days |
| Heavy capital and debt | Loans with repayments (interest booked as expense), assets with depreciation and replacement date | Loans · Assets · Balance sheet | Months of EMI covered |
| Replacement cycles unplanned | Asset life and replacement alerts (e.g. polyfilm) | Assets · Alerts | Replacement fund |
| Absentee owner | One-line finding, KPI home, alerts, supervisor & delivery logins | Dashboard · Alerts | Problems caught within 24 hours |
| Subsidy and audit paperwork | Document vault with expiry alerts, other income (subsidy) | Documents · Other income | Hours on paperwork |
| FPO / multi-location reporting | Farms with member name and location, farm-wise P&L and profit per acre | Reports → Farms | Profit per acre |

---

## 7. Free hosting — go live today

Two free paths are documented. **A** is the quickest; **B** never sleeps.

### A. Render (app) + TiDB Cloud (MySQL) — free, about 15 minutes, no server to manage

**1. Free MySQL database (TiDB Cloud Serverless)**
1. Sign up at **tidbcloud.com** → *Create Cluster* → **Serverless** (free) → region *Mumbai (ap-south-1)* or *Singapore*.
2. Open the cluster → **Connect** → *Generate password* → choose connection type **General** and copy the values: host, port (4000), user, password.
3. Create a database called `polyhouse_os` (*SQL Editor* → `CREATE DATABASE polyhouse_os;`).
4. Your connection string is `mysql://USER:PASSWORD@HOST:4000/polyhouse_os` (put the user in exactly as shown, e.g. `xxxx.root`).

> Alternatives that also work: **Aiven for MySQL** (free plan, set `DB_SSL=true`, download the CA certificate and set `DB_SSL_CA`, or `DB_SSL_VERIFY=false`), or any MySQL 8 you already have.

**2. Put the code on GitHub** — this repository (fork it or push your copy).

**3. Deploy on Render**
1. Sign up at **render.com** with GitHub → **New → Blueprint** → choose this repository. Render reads `render.yaml`.
2. When asked, fill in:
   - `DATABASE_URL` = the connection string from step 1
   - `SUPERADMIN_PASSWORD` = a strong password for you
   (`JWT_SECRET` is generated automatically, `DB_SSL=true` is preset.)
3. Click **Apply**. The first build takes 3–5 minutes.
4. Open `https://polyhouse-os.onrender.com` (your URL is shown on Render) → **Log in** with `superadmin` and your password.
5. Create your first customer (section 4) and send them the login. **Done.**

*(Without the Blueprint: New → Web Service → this repo → Build `npm install && npm run build` → Start `npm start` → add the same environment variables.)*

**Good to know on the free plan**
- The free web service **sleeps after 15 minutes without visitors**; the next visit takes ~30–50 seconds to wake. Upgrading to Render *Starter* (~$7/month) keeps it always on — or use path B.
- The free disk is temporary: **bill photos and documents uploaded on Render free are lost on each redeploy/restart**. All business data lives in MySQL and is safe. For permanent photos use path B or a paid Render disk.
- Tables and the super admin are created automatically on the first start — there is no migration step.

### B. Oracle Cloud "Always Free" VM + Docker — free forever, always on

1. Create an account at **cloud.oracle.com** (a card is needed for verification; Always-Free resources are not charged).
2. *Compute → Instances → Create*: image **Ubuntu 22.04**, shape **VM.Standard.A1.Flex** (Ampere, 1 OCPU / 6 GB is enough) or **VM.Standard.E2.1.Micro**. Download the SSH key.
3. In the instance's *Virtual Cloud Network → Security List*, add an **Ingress rule** for TCP port **80** (and 443 if you add HTTPS) from `0.0.0.0/0`.
4. SSH in and install Docker:
   ```bash
   ssh -i your-key.key ubuntu@<PUBLIC_IP>
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu && newgrp docker
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT && sudo netfilter-persistent save
   ```
5. Get the code and set your secrets:
   ```bash
   git clone https://github.com/Rakeshkumar-369/Polyhouse-OS.git && cd Polyhouse-OS
   cat > .env <<'EOF'
   APP_PORT=80
   DB_PASSWORD=change-me-db
   DB_ROOT_PASSWORD=change-me-root
   JWT_SECRET=paste-a-long-random-string-here
   SUPERADMIN_LOGIN=superadmin
   SUPERADMIN_PASSWORD=change-me-now
   EOF
   docker compose up -d --build
   ```
6. Open `http://<PUBLIC_IP>` → log in as super admin. MySQL data and uploads are kept in Docker volumes and survive restarts.
7. **Optional HTTPS with your domain:** point an A record to the IP, then run Caddy in front:
   `docker run -d --name caddy --network host -v caddy:/data caddy caddy reverse-proxy --from yourdomain.in --to localhost:80` (set `APP_PORT=8080` and use `--to localhost:8080` so ports don't clash).
8. Update later: `git pull && docker compose up -d --build`. Back up: `docker compose exec db mysqldump -uroot -p polyhouse_os > backup.sql`.

The same Docker steps work on **any** VPS (Hostinger, DigitalOcean, AWS Lightsail, a PC in the office).

---

## 8. Architecture & performance

```
Phone / browser (React PWA)  ──/api──▶  Express API  ──▶  MySQL 8
   │  lazy chunk per screen               │  resources registry (generic CRUD + business hooks)
   │  stale-while-revalidate cache        │  reportService (P&L, cost/kg, dues ageing, alerts)
   └─ service worker (installable)        └─ auto schema + super admin on boot
```

**Why it loads fast**

- No UI framework and no chart library: a small design system on Tailwind (6.8 KB CSS gzipped) and SVG charts written by hand (3 KB).
- A 60-line router instead of a routing library; icons are inline SVG (no icon-font download).
- **First visit downloads ~82 KB gzipped** (React 44 KB + app core 31 KB incl. icons & Telugu + CSS 7 KB). Every screen is its own lazy chunk of **0.4–5 KB**; a vendor or worker never downloads the owner's reports.
- Stale-while-revalidate data cache: screens you have visited render instantly while fresh data loads.
- Hashed assets cached for a year, gzip on every response, PWA manifest + service worker (installable on Android, opens instantly).
- System fonts (no web-font download); works on a ₹8,000 Android phone.

**Security**

- Passwords hashed with bcrypt; JWT sessions (30 days); failed-login rate limiting (10 per 10 minutes per IP); demo-request rate limiting.
- Multi-tenant: every row carries `org_id`; every query is scoped to the user's organisation; foreign keys sent by the browser are checked to belong to the same organisation.
- Role checks on the server for every route (owner, manager, supervisor, delivery, vendor, labour, super admin); switched-off modules are blocked on the server too.
- Delivery staff cannot change prices; vendors see only their own deliveries; workers see only their own pay.
- Parameterised SQL everywhere, Helmet security headers with a strict Content-Security-Policy, upload type/size limits, uploaded files served only to the same organisation.

**Money rules**

- Sale amount = (quantity − rejected) × rate; the rate comes from the vendor's price list (latest effective date), else the crop's default price.
- Overdue = vendor balance minus sales still inside that vendor's credit days; dues are aged oldest-first (0–7 / 8–15 / 16–30 / 31–60 / 60+ days).
- Cost per crop = direct costs tagged to its crop cycle + a share of all other costs (incl. depreciation) by area × days of each running crop cycle.
- Wages: daily = days × wage; monthly = salary ÷ 30 × days − absent days; per-kg = kg picked × rate; overtime = hours × day wage ÷ 8. Paying posts the wage to expenses and recovers advances.
- Balance-sheet cash = opening cash (Settings) + money in − money out since the books-start date. It is a management view, not a statutory audit.

---

## 9. Project structure

```
Polyhouse-OS/
├─ server/                      Node.js + Express API
│  └─ src/
│     ├─ index.js / app.js      boot (auto schema + super admin), security, gzip, static hosting
│     ├─ env.js / db.js         .env & DATABASE_URL, MySQL pool (TLS for cloud MySQL)
│     ├─ schema.sql             33 tables
│     ├─ migrate.js / reset.js  create/upgrade tables · drop & reload demo data
│     ├─ seed.js                demo farm "XYZ Polyhouse" (60 days, relative to today)
│     ├─ config.js              modules, customer types, default categories, alert limits, roles
│     ├─ resources.js           registry of every table: fields, permissions, form metadata, business hooks
│     ├─ reportService.js       dashboards, P&L, balance sheet, receivables, ageing, alerts, finding
│     ├─ orgService.js          create customer + admin login
│     ├─ middleware/auth.js     JWT, roles, module guard, rate limit
│     └─ routes/                auth, public, superadmin, settings, crud, ops, reports, portal
├─ client/                      React + Vite PWA
│  └─ src/
│     ├─ lib/                   api (cache), router, auth, i18n (English/Telugu), format, nav
│     ├─ ui/                    kit, charts, icons, Form, ResourcePage, PeriodPicker, Shell, LangSwitch
│     └─ apps/                  public (Landing, Login), farm (Dashboard, Sell, Harvest, Spend, Reports,
│                               Vendors, Labour, Alerts, Settings, Setup, Account), super, vendor, labour
├─ scripts/                     smoke.js (API test), build-icons.js
├─ Contents1.html               map of every file: what is where and what to edit for a change
├─ Dockerfile, docker-compose.yml, render.yaml
└─ .env.example
```

---

## 10. API overview

All endpoints are under `/api`. Authenticated calls use `Authorization: Bearer <token>` from `POST /api/auth/login`.

| Group | Base path | Examples |
|---|---|---|
| Public | `/public` | `POST /demo-request`, `GET /demo-accounts` |
| Auth | `/auth` | `POST /login`, `POST /change-password`, `PUT /lang` |
| Meta | `/meta` | user, organisation, modules, every form's field definitions |
| Generic records | `/r/:resource` | `GET` list (`from`, `to`, filters, `q`), `GET /options`, `POST`, `PUT /:id`, `DELETE /:id` for 30 resources (farms, crops, sales, harvests, expenses, workers, …) |
| Operations | `/ops` | `price`, `produce-stock`, `locks`, `attendance-sheet`, `wage-calc`, `wage-run`, `recurring/post`, `upload`, `file/:name` |
| Dashboards & reports | `/` | `dashboard`, `reports/summary`, `reports/pnl`, `reports/balance`, `reports/receivables`, `reports/vendor/:id`, `reports/daybook`, `alerts` |
| Settings | `/` | `GET/PUT settings`, `GET/POST/PUT/DELETE users` |
| Portals | `/portal` | `vendor`, `vendor/sales/:id`, `vendor/orders`, `labour`, `labour/checkin`, `labour/tasks/:id` |
| Super admin | `/super` | `orgs` (create/edit/reset-admin/impersonate/suspend), `leads` |

---

## 11. Scripts & testing

| Command | What it does |
|---|---|
| `npm install` | Installs root, server and web app packages |
| `npm run dev` | API (auto-reload) on :4000 + Vite on :5173 |
| `npm run db:reset` | Recreate all tables and load fresh demo data (`node server/src/reset.js --no-seed` for an empty database) |
| `npm run migrate` | Create / upgrade tables only (also runs automatically on every start) |
| `npm run build` | Production build of the web app into `client/dist` |
| `npm start` | Production server on :4000 (API + built web app) |
| `npm run smoke` | Logs in as every role and exercises ~110 API calls — every list, report and permission check, plus write flows (sale with automatic price, harvest, expense, payment, vendor confirmation, vendor order, labour check-in, demo request). `npm run smoke -- --read-only` skips the writes. `BASE=https://your-site npm run smoke -- --read-only` checks a deployed site. |

---

## 12. Configuration (.env)

| Key | Meaning |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:port/dbname` — or use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| `DB_SSL` | `true` for cloud MySQL (TiDB Cloud, Aiven). `DB_SSL_VERIFY=false` / `DB_SSL_CA=/path/ca.pem` if the provider needs it |
| `JWT_SECRET` | Long random string that signs logins — **change in production** |
| `SUPERADMIN_LOGIN`, `SUPERADMIN_PASSWORD` | Your platform login, created on first start if no super admin exists |
| `DEMO_MODE` | `true` shows one-tap demo logins on the login page (needs demo data) |
| `SEED_DEMO` | `true` loads the demo farm once into an empty database on start (Docker) |
| `PORT` | Port to listen on (default 4000) |

---

## 13. Roadmap

From the blueprint's "later" list and natural next steps:

- Offline entry inside the polyhouse with sync at the gate; voice entry in Telugu.
- WhatsApp Cloud API: evening digest to the owner, payslips to workers, automatic dues reminders.
- IoT sensors for EC/pH, temperature and humidity; connected weighing scale for harvest.
- GST invoices and Tally export; UPI payment links on vendor statements.
- Buyer marketplace: weekly availability forecast and multi-farm sourcing for retail chains and exporters.
- Hindi and more languages; peer benchmarks for FPOs.
