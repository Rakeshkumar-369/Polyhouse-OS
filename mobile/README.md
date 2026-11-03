# Polyhouse OS — mobile app (Flutter)

Android / iOS app for owners, managers, supervisors, delivery staff, vendors and labour. It talks to the same server as the web app (`server/`), so everything entered on the phone appears on the web dashboards instantly and vice versa.

See the main [README](../README.md#6-mobile-app-flutter) for build & install commands and [docs/USER_MANUAL.md](../docs/USER_MANUAL.md) for how to use it.

```
lib/
  main.dart                  app start, picks the app for the user's role
  core/api.dart              HTTP client (Bearer token)
  core/session.dart          login state, server address, /api/meta, language
  core/format.dart           ₹ formatting (Indian grouping), dates, Day/Week/Month/FY periods
  core/i18n.dart             English / Telugu words
  ui/theme.dart              brand colours, Material 3 theme
  ui/widgets.dart            cards, KPI tiles, chip pickers, loader, charts
  screens/login_screen.dart  server address + login + demo accounts
  screens/shell.dart         bottom tabs by role, "+" quick entry, More (all screens + search), menu definitions
  screens/dashboard_screen.dart   owner dashboard / supervisor "today", alerts
  screens/suggestions_screen.dart smart suggestions + season calendar
  screens/entry_screens.dart      Sell, Harvest, Spend
  screens/labour_screen.dart      attendance, wage run, workers
  screens/vendors_screen.dart     dues, statement, payment, WhatsApp reminder, prices
  screens/reports_screen.dart     overview, crops, vendors, expenses, P&L, balance sheet
  screens/records_screen.dart     generic list + form for all 30 record types (from the server's field definitions)
  screens/settings_screen.dart    modules on/off, team logins (WhatsApp share), my account
  screens/portals.dart            vendor app, labour app
  screens/super_admin.dart        customers, create customer + admin login, leads
test/app_test.dart           unit + widget tests (flutter test)
```
