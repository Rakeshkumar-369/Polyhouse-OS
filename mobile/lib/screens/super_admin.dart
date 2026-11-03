// Platform owner on the phone: customers, create a customer + admin login (share on WhatsApp), leads from the website.
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/session.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class SuperAdminScreen extends StatefulWidget {
  const SuperAdminScreen({super.key});
  @override
  State<SuperAdminScreen> createState() => _SuperAdminScreenState();
}

class _SuperAdminScreenState extends State<SuperAdminScreen> {
  final _loader = GlobalKey<LoaderState<Map<String, dynamic>>>();
  int _tab = 0;

  Future<void> _create(Map types, {Map? lead}) async {
    final s = SessionScope.read(context);
    final name = TextEditingController(text: lead == null ? '' : '${lead['name']} Farms');
    final owner = TextEditingController(text: '${lead?['name'] ?? ''}');
    final phone = TextEditingController(text: '${lead?['phone'] ?? ''}');
    final login = TextEditingController(text: '${lead?['phone'] ?? ''}');
    final pw = TextEditingController(text: 'pos${1000 + Random().nextInt(8999)}');
    String type = '${lead?['farm_type'] ?? 'single_polyhouse'}';
    if (!types.containsKey(type)) type = 'single_polyhouse';
    final ok = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, showDragHandle: true, builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(c).viewInsets.bottom),
          child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('New customer + admin login', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            ChipPicker(options: [for (final e in types.entries) Choice('${e.key}', '${e.value['label']}')], value: type, onChanged: (v) => set(() => type = v)),
            const SizedBox(height: 10),
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Polyhouse / farm name')),
            const SizedBox(height: 10),
            TextField(controller: owner, decoration: const InputDecoration(labelText: 'Owner name')),
            const SizedBox(height: 10),
            TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Owner phone')),
            const SizedBox(height: 10),
            TextField(controller: login, decoration: const InputDecoration(labelText: 'Admin user ID (blank = phone)')),
            const SizedBox(height: 10),
            TextField(controller: pw, decoration: const InputDecoration(labelText: 'Password (min 6)')),
            const SizedBox(height: 14),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Create customer & login')),
          ])),
        )));
    if (ok != true) return;
    try {
      await s.api.post('/super/orgs', {'name': name.text, 'owner_name': owner.text, 'phone': phone.text, 'customer_type': type, 'admin_login': login.text.isEmpty ? phone.text : login.text, 'admin_password': pw.text});
      if (lead != null) await s.api.put('/super/leads/${lead['id']}', {'status': 'converted'});
      _loader.currentState?.reload();
      if (!mounted) return;
      final msg = 'Namaste ${owner.text}, your Polyhouse OS account for ${name.text} is ready.\n\nServer: ${s.server}\nUser ID: ${login.text.isEmpty ? phone.text : login.text}\nPassword: ${pw.text}\n\nLog in and follow the setup steps. Please change the password from My account.';
      final share = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: Text('${name.text} is ready'), content: Text('User ID: ${login.text}\nPassword: ${pw.text}'),
          actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Close')), FilledButton.icon(onPressed: () => Navigator.pop(c, true), icon: const Icon(Icons.chat), label: const Text('Send on WhatsApp'))]));
      var p = phone.text.replaceAll(RegExp(r'\D'), '');
      if (p.length == 10) p = '91$p';
      if (share == true) await launchUrl(Uri.parse('https://wa.me/$p?text=${Uri.encodeComponent(msg)}'), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Polyhouse OS · Platform'), actions: [IconButton(onPressed: s.logout, icon: const Icon(Icons.logout), tooltip: tr('Logout'))]),
      body: Loader<Map<String, dynamic>>(
        key: _loader,
        load: () async => {'orgs': await s.api.get('/super/orgs'), 'leads': await s.api.get('/super/leads')},
        builder: (context, d, reload) {
          final o = Map<String, dynamic>.from(d['orgs']);
          final orgs = List<dynamic>.from(o['orgs']);
          final types = Map<String, dynamic>.from(o['customerTypes']);
          final leads = List<dynamic>.from(d['leads']);
          return Scaffold(
            floatingActionButton: FloatingActionButton.extended(onPressed: () => _create(types), icon: const Icon(Icons.add), label: const Text('New customer'), backgroundColor: Brand.green, foregroundColor: Colors.white),
            bottomNavigationBar: NavigationBar(selectedIndex: _tab, onDestinationSelected: (i) => setState(() => _tab = i), destinations: [
              const NavigationDestination(icon: Icon(Icons.apartment), label: 'Customers'),
              NavigationDestination(icon: Badge(isLabelVisible: o['newLeads'] != 0, label: Text('${o['newLeads']}'), child: const Icon(Icons.campaign_outlined)), label: 'Leads'),
            ]),
            body: ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 100), children: _tab == 0
                ? [
                    Row(children: [
                      Expanded(child: StatTile(label: 'Customers', value: '${orgs.length}', sub: '${orgs.where((x) => x['status'] == 'active').length} active', icon: Icons.apartment)),
                      const SizedBox(width: 10),
                      Expanded(child: StatTile(label: 'Sales 30d', value: shortMoney(orgs.fold<double>(0, (a, x) => a + toD(x['sales_30d']))), sub: 'all customers', icon: Icons.trending_up, color: Brand.revenue)),
                    ]),
                    const SizedBox(height: 12),
                    for (final x in orgs)
                      Card(margin: const EdgeInsets.only(bottom: 8), child: ListTile(
                        title: Text('${x['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${types[x['customer_type']]?['label'] ?? ''}\nadmin: ${x['admin_login']} · ${x['farms']} farms · ${numf(x['acres'])} acres'),
                        isThreeLine: true,
                        trailing: PopupMenuButton<String>(
                          itemBuilder: (_) => [const PopupMenuItem(value: 'reset', child: Text('Reset password')), PopupMenuItem(value: 'toggle', child: Text(x['status'] == 'active' ? 'Suspend' : 'Activate'))],
                          onSelected: (v) async {
                            if (v == 'toggle') { await s.api.put('/super/orgs/${x['id']}', {'status': x['status'] == 'active' ? 'suspended' : 'active'}); reload(); }
                            if (v == 'reset') {
                              final pw = 'pos${1000 + Random().nextInt(8999)}';
                              await s.api.post('/super/orgs/${x['id']}/reset-admin', {'password': pw});
                              if (context.mounted) showDialog(context: context, builder: (c) => AlertDialog(title: const Text('Password reset'), content: Text('User ID: ${x['admin_login']}\nNew password: $pw')));
                            }
                          },
                          child: Pill('${x['status']}', color: x['status'] == 'active' ? Brand.green : Brand.red),
                        ),
                      )),
                  ]
                : [
                    if (leads.isEmpty) const EmptyView(text: 'No demo requests yet', icon: Icons.campaign_outlined),
                    for (final l in leads)
                      Card(margin: const EdgeInsets.only(bottom: 8), child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [Expanded(child: Text('${l['name']}', style: const TextStyle(fontWeight: FontWeight.w700))), Pill('${l['status']}', color: l['status'] == 'new' ? Brand.amber : Brand.green)]),
                        Text('${l['phone']} · ${l['farm_type'] ?? ''} · ${l['acres'] ?? '?'} acres · ${l['location'] ?? ''}', style: const TextStyle(color: Brand.muted)),
                        if (l['message'] != null) Text('“${l['message']}”'),
                        const SizedBox(height: 8),
                        Wrap(spacing: 8, children: [
                          OutlinedButton.icon(onPressed: () => launchUrl(Uri.parse('tel:${l['phone']}')), icon: const Icon(Icons.call, size: 16), label: const Text('Call')),
                          if (l['status'] != 'converted') FilledButton.icon(onPressed: () => _create(types, lead: l), icon: const Icon(Icons.person_add_alt, size: 16), label: const Text('Create account')),
                        ]),
                      ]))),
                  ]),
          );
        },
      ),
    );
  }
}
