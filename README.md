# Polyhouse OS

A mobile-first farm operating system for **polyhouse owners, crop-field owners, owners of many polyhouses, Farmer Producer Organisations and farmers with land at many places**.

Record every harvest, sale, expense and wage once — from a phone at the farm — and see profit, cost per kg, vendor dues and alerts the same day. No payment gateway: money is recorded as line entries.

**Stack:** React 18 + Vite + Tailwind CSS + Bootstrap Icons + Recharts · Node.js + Express · MySQL

## Roles
| Role | Can do |
|---|---|
| Super admin | Create customer organisations (e.g. "XYZ Polyhouse") with the owner's admin login; suspend, reset, open |
| Admin (owner) | Set up farms (acres, size, rent), crops, workers & salaries, vendors & vendor prices, turn modules on/off, everything |
| Manager | Everything except settings |
| Supervisor | Harvest, sell, attendance, EC/pH, climate, scouting, sprays, tasks, stock |
| Delivery | Sell (crop → vendor → qty, price auto from vendor price list) and harvest |
| Vendor | Own deliveries, confirm/reject, statement & dues, prices, place orders |
| Labour | Check-in/out, tasks, earnings, attendance, payslips |

## Quick start
```bash
npm run setup                          # install everything
cp server/.env.example server/.env     # set MySQL credentials + JWT secret
npm run migrate                        # create tables
npm run demo                           # super admin + demo farm (or `npm run seed` for super admin only)
npm run dev                            # API :4000, app :5173
```
Production: `npm run build && npm start` (Express serves the app on :4000).

Demo logins: `superadmin/admin123`, owner `xyz/xyz123`, `super1`, `delivery1`, `vendor1`, `labour1` (password `demo123`).

See **Contents1.html** for a map of every file and where to change what.
