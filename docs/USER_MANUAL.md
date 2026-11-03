# Polyhouse OS — User Manual

This manual explains how each person uses Polyhouse OS, on the **web app** (any browser, phone or computer) and the **mobile app** (Android / iOS). Both show the same data — an entry made on one appears on the other immediately.

---

## Contents

1. [Getting started](#1-getting-started)
2. [Super admin (platform owner)](#2-super-admin-platform-owner)
3. [Owner (admin) — first day](#3-owner-admin--first-day)
4. [Owner — every day](#4-owner--every-day)
5. [Reading the dashboard](#5-reading-the-dashboard)
6. [Smart suggestions](#6-smart-suggestions)
7. [Reports](#7-reports)
8. [Vendors, prices and money owed](#8-vendors-prices-and-money-owed)
9. [Labour, attendance and wages](#9-labour-attendance-and-wages)
10. [Expenses, stock and monthly bills](#10-expenses-stock-and-monthly-bills)
11. [Crop care logs](#11-crop-care-logs)
12. [Settings, modules and team logins](#12-settings-modules-and-team-logins)
13. [Manager](#13-manager)
14. [Supervisor](#14-supervisor)
15. [Delivery person](#15-delivery-person)
16. [Vendor](#16-vendor)
17. [Labour (worker)](#17-labour-worker)
18. ["I want to…" — quick finder](#18-i-want-to--quick-finder)
19. [Troubleshooting & FAQ](#19-troubleshooting--faq)

---

## 1. Getting started

**Web app** — open the link you were given (for example `https://your-farm.onrender.com`) and tap **Log in**. On Android you can tap *Add to Home screen* so it opens like an app.

**Mobile app** — install the APK (sent on WhatsApp) or from the store. On the login screen:
- **Server address** — already filled in; if not, enter the same link as the web app.
- **Phone / User ID** and **Password** — given by the owner (or by the platform owner for the owner).

**Language** — tap **తెలుగు / English** (top of the screen) at any time. The choice is remembered for your login.

**Change your password** — *More → My account → Change password* (web: *My account* in the menu).

**Move around**
| Web (computer) | Web (phone) and mobile app |
|---|---|
| Menu on the left; groups (Farm setup, Grow, Sell…) open with a tap | Bottom tabs for the main screens, **More** for everything else (with a search box) |
| **+ New entry** button at the top of the menu | Big **+** button — every daily entry in one place |
| | **‹** back arrow at the top of inner screens (web); system back button (mobile app) |

Pull down on a screen in the mobile app to refresh it.

---

## 2. Super admin (platform owner)

You create customers and their first login. Customers never see each other's data.

**Create a customer**
1. **New customer + admin login**.
2. Pick the type: *Single polyhouse owner, Crop field owner, Owner with many polyhouses, Farmer Producer Organisation, Farmer with land at many places*. This switches on suitable modules (the owner can change them later).
3. Enter the farm name (e.g. *XYZ Polyhouse*), owner name and phone. The **User ID** defaults to the phone; a password is generated (you can change it).
4. **Create** → a card shows the link, User ID and password → **Send on WhatsApp** (or *Copy*). The owner can log in straight away.
5. Optional: **Open & set up for them** to enter their farm details yourself; use *Back to super admin* at the top to return.

**Other actions on a customer card** — *Reset password* (shows the new password to share), *Suspend / Activate* (a suspended customer cannot log in; data is kept), *Edit*.

**Leads** — requests from the website's *Request a demo* form. Call or WhatsApp them, *Mark contacted*, and **Create account** fills the new-customer form from the lead.

---

## 3. Owner (admin) — first day

On your first login a **5-step setup guide** opens. Every step can be skipped and changed later.

1. **Farm details** — polyhouse / field name, location, acres, length × width × height, owned or leased (monthly rent is then posted automatically every month), how often you sell.
2. **Crops you grow** — tap the crops (or type another), choose the unit (kg, bunch…) and a usual price.
3. **Vendors & prices** — each buyer's name, phone, credit days, and **their price for each crop**. Your delivery person never types prices.
4. **Workers & pay** — name, phone and pay: per day, per month, or per kg picked. Optional monthly electricity bill (posted automatically).
5. **Done** — jump to *Record today's harvest*, *Record a sale* or *Create team logins*.

Then create logins for your team (section 12) and add more farms, bays, crops or vendors any time from *More → Farm setup / Sell*.

> Run the guide again from *Settings → Farm profile → Run setup wizard again*.

---

## 4. Owner — every day

A typical day takes a few minutes:

| When | What | Where |
|---|---|---|
| Morning | Mark attendance (P / ½ / A / L for each worker, *Mark rest present*) | **Labour → Attendance** (or **+ → Attendance**) |
| After picking | Record the harvest: crop → grade → quantity (+ farm / bay / picker) | **Harvest** (or **+ → Harvest**) |
| At each delivery | Record the sale: crop → grade → vendor → quantity. The vendor's price fills in | **Sell** (or **+ → Sale**) |
| When paying | Record the expense: category → amount (+ supplier, farm, stock item, bill photo) | **Spend** (or **+ → Expense**) |
| When paid by a vendor | Record the payment | **Vendors → vendor → Record payment** (or **+ → Payment received**) |
| Once a day | Temperature reading (needed for smart suggestions), EC / pH | **+ → Temperature**, **+ → EC / pH** |
| Evening | Read the dashboard and *Needs attention* | **Home** |

---

## 5. Reading the dashboard

Choose the period at the top (*Today, This week, This month, Last month, Last 30 / 90 days, This financial year, Custom*), and on multi-farm accounts a single farm.

- **In one line** — the headline: profit or loss, change in sales, the best crop, the top vendor, and money overdue.
- **Smart suggestions** — the top 3 learned suggestions (section 6).
- **Tiles** — Sales, Expenses, Profit (with margin), Harvested (% sold), Average price (% rejected), Cash in hand. Arrows compare with the previous period of the same length; the tiny line shows the trend.
- **Sales vs expenses** — bars by day / week / month with the profit line. Tap or hover a bar to see the numbers.
- **Needs attention** — red = act now (vendor overdue, salt build-up, cost above price…), amber = watch (low stock, high rejection, temperature off, lease ending…), blue = information (spray lock, service due).
- **Cost vs price per unit** — if the orange bar is taller than the blue, that crop is losing money.
- **Price trend**, **Crops table**, **Who owes how long** (dues by age and days to collect), **Best paying vendor per crop**, **Where the money went**, **Crop cycles vs target**, **Best selling days**, **Labour tiles**.
- **Today** — what was plucked, what is not sold yet, open vendor orders, attendance, tasks and spray locks.

---

## 6. Smart suggestions

Polyhouse OS learns from **your own farm's history** — how much each crop yielded in each month, the **average temperature and humidity** you recorded in that month, and the **price** you got — and tells you what to plan.

Example: if lettuce gave its best yield in December 2025 when the average temperature was 21.9 °C, then in November 2026 you see:
- *Dec: Lettuce did 132% better last year (1.7 kg/m² at 21.9 °C) — line up buyers and pickers for extra volume.*
- *Lettuce grows best in Jan, Feb, Nov, Dec … to be picking in Dec, transplant in Nov (about 41 days to first harvest).*

**Kinds of suggestion**
| Label | Meaning |
|---|---|
| This month | Is this month's temperature inside each growing crop's best range? What to do if not |
| Next month | How each crop did in the coming month last year |
| Best season | Each crop's best months, best temperature range, and when to transplant |
| Price | The month each crop fetched its best price |
| Weak month | The month a crop did worst — avoid peak harvest then or plan cooling |

**Season calendar** — each row is a crop, each column a month. Green = better than the crop's normal month, red = worse; the number is the % of normal. The last row is the average temperature. This month is outlined.

**To get good suggestions**: record harvest every day (with farm / bay), one temperature reading a day (*+ → Temperature*), and create a **crop cycle** with its area for each crop (*More → Crop cycles*). Suggestions for a crop start after **4 months** of records and become more reliable after 6 and 10 months.

---

## 7. Reports

**Reports** (owner and manager) — pick the period at the top; every table has an **Excel** button; **Print / PDF** prints the page.

| Tab | Shows |
|---|---|
| Overview | Totals, the one-line finding, sales vs expenses chart and a day/week/month table |
| Crops | For each crop: harvested, A-grade %, culls, sold, rejected, sales, average price, direct and shared cost, cost per unit, profit, margin |
| Vendors | Each vendor's quantity, rejection %, sales, received, due, overdue, credit days; a **price matrix** (best price in green); price trend |
| Sales sheet | Every sale in the period |
| Expenses | By category with labour summary |
| Farms | By farm / FPO member / location, with profit per acre |
| P&L | Income, expenses, depreciation, net profit |
| Balance sheet | What you own (cash, receivables, stock, advances, assets) and owe (loans, suppliers), on any date |
| Day book | Everything entered on one date |

> Cash in the balance sheet starts from the *Opening cash* and *Books start date* in *Settings → Farm profile*. It is a management view, not an audit.

---

## 8. Vendors, prices and money owed

- **Set a vendor's price** — *Vendors → vendor → Prices* (or *More → Vendor price list*) → add crop, grade, price and the date it starts. A new row with a later date replaces the old price from that day; the old sales keep their price.
- **Overdue** — sales older than the vendor's credit days that are not yet paid. Vendors with overdue money are listed first, marked red.
- **Statement** — *Vendors → vendor*: opening balance, every sale and payment with running balance, closing balance; Excel download.
- **Reminder** — the WhatsApp button sends a polite message with the balance.
- **Record payment** — amount, mode (cash / UPI / bank / cheque), UTR.
- **Rejections** — the vendor can report rejected quantity from their login (or edit the sale yourself in *All sales*). The amount is recalculated.
- **Orders** — vendors can place orders; they appear on *Sell* and *Today*. Choosing *Against order* when selling marks the order fulfilled.

---

## 9. Labour, attendance and wages

- **Workers** — *Labour → Workers* (or *More → Workers & salaries*): pay per day, per month, or per kg picked.
- **Attendance** — *Labour → Attendance*: tap P (present), ½ (half day), A (absent), L (leave) for each person; add work done and overtime hours; **Save**. Workers can also check in from their own login.
- **Advances / bonus / deductions** — *More → Advances & bonus*.
- **Wage run** — *Labour → Wage run*, pick the week or month: the app calculates days, gross pay, overtime, bonus and the advance to recover. **Pay** records the payment, books it as a labour expense and recovers the advance. The worker sees it as a payslip.

How pay is calculated: daily = days × wage; monthly = salary ÷ 30 per day minus absent days; per kg = kg picked × rate; overtime = hours × (day wage ÷ 8).

---

## 10. Expenses, stock and monthly bills

- **Spend** — tap the category (seeds, trays, grow bags, grow slabs, threads, iron, fertiliser, pesticide, rent, current, transport…), enter the amount, choose how it was paid. Choose **credit (pay later)** for a bill you will pay later — it shows as *payable* in the balance sheet.
- **Stock** — if you bought a stock item (e.g. 500 grow bags), pick it and the quantity — stock goes up automatically. Record use with *+ → Stock use* / *More → Stock in / out*. Items below their alert level appear in *Needs attention*.
- **Monthly bills** — *More → Recurring payments*: rent, electricity, salaries, EMI. With *post automatically* on, each is added to expenses on its due date.
- **Farm / crop cycle** — leave *Farm* blank for shared costs; pick a *Crop cycle* for costs that belong to one crop (seeds, a crop-specific spray). This makes the cost per kg exact.
- **Bill photo** — attach on the web app (*Spend → Bill photo*).

---

## 11. Crop care logs

| Log | Use it for | Alerts it drives |
|---|---|---|
| EC / pH log | Feed and drain EC / pH after each fertigation run | EC/pH out of band, salt build-up |
| Fertigation recipes | Target EC / pH bands per crop stage | (sets the bands) |
| Climate log | Temperature and humidity — **one reading a day feeds smart suggestions** | Temperature / humidity out of range |
| Scouting | Sticky-trap counts, pest / disease, severity | Pest pressure |
| Spray log | Product, dose, **pre-harvest interval (days)** | Harvest lock: that bay cannot be harvested until safe; workers see "do not enter" |
| Daily tasks | Pruning, trellising, de-leafing… assigned to a worker | Shown on the worker's phone |
| Crop cycles | Crop, bay, transplant date, area, target yield | Crop cycles vs target, smart suggestions |

Alert limits (EC, pH, temperature, humidity, trap count…) are in *Settings → Alert limits*.

---

## 12. Settings, modules and team logins

*Settings* (owner only):
- **Farm profile** — company details, how often you sell, grades used (A, B, C…), currency, opening cash, books start date.
- **Modules on/off** — turn off anything your farm does not use (e.g. EC/pH, loans). Screens disappear for everyone; data is kept and returns when switched back on.
- **Alert limits** — EC, pH, temperature, humidity, trap counts, reminder days.
- **Users & logins** — **Add login**: choose the role, name, User ID (phone works best) and password. For *Labour* pick the worker; for *Vendor* pick the vendor. After saving, **Send on WhatsApp** shares the login. Edit to reset a password or disable a login.

| Role | Can do |
|---|---|
| Owner / admin | Everything, including settings and logins |
| Manager | Everything except settings |
| Supervisor | Harvest, sell, attendance, crop logs, tasks, stock — no money reports |
| Delivery | Sell and harvest only; cannot change prices |
| Vendor | Their own deliveries, statement, prices and orders |
| Labour | Their own check-in, tasks, earnings and payslips |

---

## 13. Manager

Same screens as the owner (dashboard, reports, vendors, labour, expenses, smart suggestions, all records) except **Settings**. Managers can change sale prices by hand when needed.

---

## 14. Supervisor

**Home** shows *My farm today*: harvest so far, unsold produce, open orders, attendance, tasks, spray locks and field alerts.

Daily: **Labour → Attendance** in the morning → **Harvest** after picking → **+ → Temperature / EC / pH / Pest check / Spray** during rounds → **Sell** if you dispatch. Supervisors do not see money reports. They cannot override a spray lock — only the owner can.

---

## 15. Delivery person

1. Open **Sell**.
2. Tap the **crop**, the **grade**, the **vendor**.
3. Type the **quantity**. The **rate comes from the vendor's price list** and cannot be changed by you; the amount appears.
4. If the vendor placed an order, tap it under *Against order*.
5. **Save sale**. The owner's dashboard updates at once. *Sales today* lists what you delivered.

If you see *"No price set for this vendor"*, the crop's default price is used — tell the owner.

---

## 16. Vendor

- **Deliveries** — each delivery the farm recorded for you. Tap **Confirm**, enter the rejected quantity (0 if all good) and a remark. You can confirm within 7 days.
- **Statement** — sales and payments with running balance; **You owe** and **Overdue** at the top.
- **Prices** — your price per crop and grade today.
- **My orders** — **Place an order** (crop, grade, quantity, date needed); cancel while it is open.

---

## 17. Labour (worker)

- Tap the big **Check in** button when you arrive and **Check out** when you leave.
- A red **Do not enter / pick** box means a bay was sprayed — stay out until the date shown.
- **This week / This month** — what you have earned; *Paid* shows what has been paid; an advance to be cut is shown in orange.
- **My work today** — tap **Mark done** when finished.
- **My attendance** — green = present, yellow = half day, red = absent, grey = leave.
- **Payslips** — each payment with gross and cuts.
- Tap **తెలుగు** to read everything in Telugu.

---

## 18. "I want to…" — quick finder

| I want to… | Go to |
|---|---|
| Record a sale | Sell, or **+ → Sale** |
| Record a harvest | Harvest, or **+ → Harvest** |
| Record a payment I made | Spend, or **+ → Expense** |
| Record money a vendor paid me | Vendors → vendor → Record payment, or **+ → Payment received** |
| Change a vendor's price | Vendors → vendor → Prices (or More → Vendor price list) |
| Correct a wrong entry | More → *All sales / All harvests / All expenses* → tap the entry → change → Save (or the bin icon to delete) |
| See who owes me money | Vendors, or Dashboard → Who owes how long |
| See profit for last month | Reports → choose *Last month* → Overview or P&L |
| Download for Excel | Any list or report → **Excel** |
| Pay wages | Labour → Wage run → Pay |
| Add a polyhouse / field | More → Farms / polyhouses → Add |
| Add a crop | More → Crops → Add |
| Know what to plant next | Smart suggestions |
| Give my team a login | Settings → Users & logins → Add login |
| Turn off a feature I don't use | Settings → Modules on/off |
| Switch to Telugu | తెలుగు button at the top |

---

## 19. Troubleshooting & FAQ

**"Cannot reach the server"** — check the internet, then the server address on the login screen (it must start with `https://`). On a free Render plan the first visit after a quiet period takes about 30–50 seconds while the server wakes up.

**"Wrong login or password"** — ask the owner to reset it (*Settings → Users & logins → edit*). Owners: ask the platform owner. After 10 wrong tries the login waits 10 minutes.

**"Harvest locked"** — a spray's pre-harvest interval is still running for that bay. Wait until the date shown; only the owner can save anyway.

**"Cannot delete: it is used in …"** — a crop, vendor, farm or worker that has records cannot be deleted (it would break reports). Untick **Active** to hide it instead.

**"No price set for this vendor"** — add the price in *Vendors → vendor → Prices*.

**A screen is missing** — the owner may have switched that module off (*Settings → Modules on/off*), or your role does not include it.

**Smart suggestions say "Learning"** — keep recording daily harvest and one temperature a day; suggestions start after 4 months for each crop.

**Numbers look different from my notebook** — check the period at the top and the farm filter; check *More → All sales* for that date range; rejected quantity reduces the sale amount.

**Offline** — the web app shows screens you opened before, but saving needs internet. Enter the record when the signal returns (at the gate).
