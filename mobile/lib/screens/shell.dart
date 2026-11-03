// Main app frame for owner / manager / supervisor / delivery:
//   bottom tabs (depends on role), a "+" button for every daily entry, and "More" with all screens + search.
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'dashboard_screen.dart';
import 'entry_screens.dart';
import 'records_screen.dart';
import 'reports_screen.dart';
import 'vendors_screen.dart';
import 'labour_screen.dart';
import 'suggestions_screen.dart';
import 'settings_screen.dart';

const _owner = ['admin', 'manager'];
const _field = ['admin', 'manager', 'supervisor'];
const _staff = ['admin', 'manager', 'supervisor', 'delivery'];

class MenuItem {
  final String label;
  final IconData icon;
  final List<String>? roles;
  final String? module;
  final String? resource; // generic record list (needs this resource in /api/meta)
  final Widget Function()? page;
  const MenuItem(this.label, this.icon, {this.roles, this.module, this.resource, this.page});

  bool visible(Session s) {
    if (roles != null && !roles!.contains(s.role)) return false;
    if (!s.on(module)) return false;
    if (resource != null) return s.resources.containsKey(resource);
    return true;
  }

  Widget build() => page != null ? page!() : RecordsScreen(resKey: resource!);
}

final mainMenu = <MenuItem>[
  MenuItem('Home', Icons.space_dashboard_outlined, roles: _field, page: () => const DashboardScreen()),
  MenuItem('Sell', Icons.local_shipping_outlined, roles: _staff, module: 'sales', page: () => const SellScreen()),
  MenuItem('Harvest', Icons.shopping_basket_outlined, roles: _staff, module: 'harvest', page: () => const HarvestScreen()),
  MenuItem('Spend', Icons.account_balance_wallet_outlined, roles: _field, module: 'expenses', page: () => const SpendScreen()),
  MenuItem('Reports', Icons.insights_outlined, roles: _owner, page: () => const ReportsScreen()),
  MenuItem('Vendors', Icons.storefront_outlined, roles: _owner, module: 'sales', page: () => const VendorsScreen()),
  MenuItem('Labour', Icons.groups_outlined, roles: _field, module: 'labour', page: () => const LabourScreen()),
  MenuItem('Smart suggestions', Icons.lightbulb_outline, roles: _field, module: 'suggestions', page: () => const SuggestionsScreen()),
  MenuItem('Alerts', Icons.notifications_none, roles: _field, module: 'alerts', page: () => const AlertsScreen()),
];

final menuGroups = <String, List<MenuItem>>{
  'Farm setup': const [
    MenuItem('Farms / polyhouses', Icons.house_outlined, resource: 'farms'),
    MenuItem('Bays / plots', Icons.grid_view, resource: 'bays'),
    MenuItem('Crops', Icons.local_florist_outlined, resource: 'crops'),
    MenuItem('Crop cycles', Icons.autorenew, resource: 'crop_cycles'),
  ],
  'Grow': const [
    MenuItem('Daily tasks', Icons.checklist, resource: 'tasks'),
    MenuItem('EC / pH log', Icons.water_drop_outlined, resource: 'fertigation_logs'),
    MenuItem('Fertigation recipes', Icons.menu_book_outlined, resource: 'fertigation_recipes'),
    MenuItem('Climate log', Icons.thermostat, resource: 'climate_logs'),
    MenuItem('Scouting', Icons.bug_report_outlined, resource: 'scouting_logs'),
    MenuItem('Spray log', Icons.sanitizer_outlined, resource: 'spray_logs'),
  ],
  'Sell': const [
    MenuItem('All sales', Icons.receipt_long_outlined, resource: 'sales'),
    MenuItem('Vendor orders', Icons.shopping_cart_checkout, resource: 'orders'),
    MenuItem('Vendor price list', Icons.sell_outlined, resource: 'price_list'),
    MenuItem('Payments received', Icons.payments_outlined, resource: 'payments_received'),
    MenuItem('All harvests', Icons.inventory_2_outlined, resource: 'harvests'),
    MenuItem('Vendors & suppliers', Icons.contact_page_outlined, resource: 'parties'),
  ],
  'Spend & stock': const [
    MenuItem('All expenses', Icons.request_quote_outlined, resource: 'expenses'),
    MenuItem('Recurring payments', Icons.event_repeat, resource: 'recurring_expenses'),
    MenuItem('Input stock', Icons.inventory_outlined, resource: 'inventory_items'),
    MenuItem('Stock in / out', Icons.swap_horiz, resource: 'stock_moves'),
    MenuItem('Expense categories', Icons.label_outline, resource: 'expense_categories'),
  ],
  'Work': const [
    MenuItem('Workers & salaries', Icons.badge_outlined, resource: 'workers'),
    MenuItem('Attendance records', Icons.event_available, resource: 'attendance'),
    MenuItem('Advances & bonus', Icons.savings_outlined, resource: 'advances'),
    MenuItem('Wage payments', Icons.wallet_outlined, resource: 'wage_payments'),
  ],
  'Money & records': const [
    MenuItem('Other income', Icons.trending_up, resource: 'other_income'),
    MenuItem('Loans', Icons.account_balance_outlined, resource: 'loans'),
    MenuItem('Loan repayments', Icons.keyboard_return, resource: 'loan_repayments'),
    MenuItem('Assets & maintenance', Icons.build_outlined, resource: 'assets'),
    MenuItem('Document vault', Icons.folder_open_outlined, resource: 'documents'),
  ],
  'Admin': [
    MenuItem('Settings', Icons.settings_outlined, roles: const ['admin'], page: () => const SettingsScreen()),
    MenuItem('My account', Icons.person_outline, page: () => const AccountScreen()),
  ],
};

// The "+" sheet: everyday records in one place (opens the right screen / form)
final quickItems = <MenuItem>[
  MenuItem('Sale', Icons.local_shipping_outlined, roles: _staff, module: 'sales', page: () => const SellScreen()),
  MenuItem('Harvest', Icons.shopping_basket_outlined, roles: _staff, module: 'harvest', page: () => const HarvestScreen()),
  MenuItem('Expense', Icons.account_balance_wallet_outlined, roles: _field, module: 'expenses', page: () => const SpendScreen()),
  MenuItem('Payment received', Icons.payments_outlined, resource: 'payments_received', page: () => const RecordsScreen(resKey: 'payments_received', openNew: true)),
  MenuItem('Attendance', Icons.groups_outlined, roles: _field, module: 'labour', page: () => const LabourScreen()),
  MenuItem('Temperature', Icons.thermostat, resource: 'climate_logs', page: () => const RecordsScreen(resKey: 'climate_logs', openNew: true)),
  MenuItem('EC / pH', Icons.water_drop_outlined, resource: 'fertigation_logs', page: () => const RecordsScreen(resKey: 'fertigation_logs', openNew: true)),
  MenuItem('Spray', Icons.sanitizer_outlined, resource: 'spray_logs', page: () => const RecordsScreen(resKey: 'spray_logs', openNew: true)),
  MenuItem('Task', Icons.checklist, resource: 'tasks', page: () => const RecordsScreen(resKey: 'tasks', openNew: true)),
];

// Record lists are full pages; every other screen gets an app bar with its title
void openPage(BuildContext context, MenuItem item) {
  final w = item.build();
  Navigator.of(context).push(MaterialPageRoute(builder: (_) => w is RecordsScreen ? w : Scaffold(appBar: AppBar(title: Text(tr(item.label))), body: w)));
}

class FarmShell extends StatefulWidget {
  const FarmShell({super.key});
  @override
  State<FarmShell> createState() => _FarmShellState();
}

class _FarmShellState extends State<FarmShell> {
  int _index = 0;

  List<MenuItem> _tabs(Session s) {
    final pick = switch (s.role) {
      'delivery' => ['Sell', 'Harvest'],
      'supervisor' => ['Home', 'Harvest', 'Sell', 'Labour'],
      _ => ['Home', 'Sell', 'Harvest', 'Reports'],
    };
    return [for (final p in pick) ...mainMenu.where((m) => m.label == p && m.visible(s))];
  }

  void _quick(BuildContext context, Session s) {
    final items = quickItems.where((i) => i.visible(s)).toList();
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr('Quick entry'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 3, shrinkWrap: true, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 1.05,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                for (final i in items)
                  InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () { Navigator.pop(ctx); openPage(context, i); },
                    child: Ink(
                      decoration: BoxDecoration(border: Border.all(color: Brand.line), borderRadius: BorderRadius.circular(16)),
                      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                        CircleAvatar(radius: 22, backgroundColor: Brand.greenSoft, child: Icon(i.icon, color: Brand.green)),
                        const SizedBox(height: 6),
                        Text(tr(i.label), textAlign: TextAlign.center, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  ),
              ],
            ),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final tabs = _tabs(s);
    final pages = [...tabs.map((t) => t.build()), const MoreScreen()];
    final idx = _index.clamp(0, pages.length - 1);
    final title = idx < tabs.length ? tabs[idx].label : 'More';
    final showAlerts = mainMenu.last.visible(s);
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.asset('assets/icon.png', width: 32, height: 32)),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(title), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            Text('${s.org?['name'] ?? ''}', style: const TextStyle(fontSize: 11.5, color: Brand.muted, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis),
          ])),
        ]),
        actions: [
          IconButton(tooltip: 'Language', icon: const Icon(Icons.translate), onPressed: () => s.setLang(s.lang == 'en' ? 'te' : 'en')),
          if (showAlerts) IconButton(tooltip: tr('Alerts'), icon: const Icon(Icons.notifications_none), onPressed: () => openPage(context, mainMenu.last)),
        ],
      ),
      body: IndexedStack(index: idx, children: pages),
      floatingActionButton: FloatingActionButton(onPressed: () => _quick(context, s), tooltip: tr('Quick entry'), backgroundColor: Brand.green, foregroundColor: Colors.white, child: const Icon(Icons.add, size: 30)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in tabs) NavigationDestination(icon: Icon(t.icon), label: tr(t.label)),
          NavigationDestination(icon: const Icon(Icons.apps), label: tr('More')),
        ],
      ),
    );
  }
}

class MoreScreen extends StatefulWidget {
  const MoreScreen({super.key});
  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    bool match(MenuItem i) => _q.isEmpty || i.label.toLowerCase().contains(_q) || tr(i.label).toLowerCase().contains(_q);
    final groups = <String, List<MenuItem>>{
      'Main': mainMenu.where((m) => m.visible(s) && match(m)).toList(),
      for (final e in menuGroups.entries) e.key: e.value.where((m) => m.visible(s) && match(m)).toList(),
    }..removeWhere((k, v) => v.isEmpty);
    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 100), children: [
      TextField(decoration: InputDecoration(hintText: tr('Search'), prefixIcon: const Icon(Icons.search)), onChanged: (v) => setState(() => _q = v.toLowerCase())),
      for (final g in groups.entries) ...[
        Padding(padding: const EdgeInsets.only(top: 16), child: SectionLabel(g.key)),
        GridView.count(
          crossAxisCount: MediaQuery.of(context).size.width > 600 ? 5 : 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.1,
          children: [
            for (final i in g.value)
              Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () => openPage(context, i),
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(i.icon, color: Brand.green, size: 26),
                      const SizedBox(height: 6),
                      Text(tr(i.label), textAlign: TextAlign.center, maxLines: 2, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ]),
                  ),
                ),
              ),
          ],
        ),
      ],
      const SizedBox(height: 20),
      OutlinedButton.icon(onPressed: () => s.logout(), icon: const Icon(Icons.logout), label: Text(tr('Logout'))),
      const SizedBox(height: 8),
      Center(child: Text('${s.user['name']} · ${s.role} · ${s.server}', style: const TextStyle(color: Brand.muted, fontSize: 12))),
    ]);
  }
}
