// Owner settings on the phone: modules on/off and team logins (with a WhatsApp share of the login). My account: language & password.
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/session.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

Future<void> shareLogin(Session s, String name, String login, String password, {String phone = ''}) async {
  var p = phone.replaceAll(RegExp(r'\D'), '');
  if (p.length == 10) p = '91$p';
  final msg = 'Namaste $name, your Polyhouse OS login for ${s.org?['name'] ?? ''}:\n\nServer: ${s.server}\nUser ID: $login\nPassword: $password\n\nPlease change the password after your first login.';
  await launchUrl(Uri.parse('https://wa.me/$p?text=${Uri.encodeComponent(msg)}'), mode: LaunchMode.externalApplication);
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _tab = 'modules';
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(14, 12, 14, 4), child: Align(alignment: Alignment.centerLeft, child: ChipPicker(options: const [Choice('modules', 'Modules on/off'), Choice('users', 'Users & logins')], value: _tab, onChanged: (v) => setState(() => _tab = v)))),
      Expanded(child: _tab == 'modules' ? const _Modules() : const _Users()),
    ]);
  }
}

class _Modules extends StatelessWidget {
  const _Modules();
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Loader<Map<String, dynamic>>(
      load: () async => Map<String, dynamic>.from(await s.api.get('/settings')),
      builder: (context, d, reload) {
        final mods = List<Map>.from(d['modules']);
        final on = Map<String, dynamic>.from(d['org']['settings']['modules'] ?? {});
        return ListView(padding: const EdgeInsets.fromLTRB(14, 8, 14, 60), children: [
          const Text('Turn on only what your farm uses. Data is kept when a module is off.', style: TextStyle(color: Brand.muted)),
          const SizedBox(height: 8),
          for (final m in mods)
            Card(margin: const EdgeInsets.only(bottom: 8), child: SwitchListTile(
              title: Text('${m['label']}', style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text('${m['desc']}'),
              value: on[m['key']] != false,
              onChanged: (v) async {
                try {
                  await s.api.put('/settings', {'settings': {'modules': {m['key']: v}}});
                  await s.reload();
                  await reload();
                } catch (e) {
                  if (context.mounted) toast(context, '$e', error: true);
                }
              },
            )),
        ]);
      },
    );
  }
}

const _roles = {'manager': 'Manager', 'supervisor': 'Supervisor', 'delivery': 'Delivery', 'vendor': 'Vendor', 'labour': 'Labour', 'admin': 'Owner / admin'};

class _Users extends StatefulWidget {
  const _Users();
  @override
  State<_Users> createState() => _UsersState();
}

class _UsersState extends State<_Users> {
  final _loader = GlobalKey<LoaderState<List<dynamic>>>();

  Future<void> _add() async {
    final s = SessionScope.read(context);
    final name = TextEditingController(), login = TextEditingController();
    final password = TextEditingController(text: 'pos${DateTime.now().millisecondsSinceEpoch % 100000}');
    String role = 'delivery';
    String? link;
    List<dynamic> workers = [], vendors = [];
    try {
      workers = List<dynamic>.from(await s.api.get('/r/workers/options'));
    } catch (_) {}
    try {
      vendors = List<dynamic>.from(await s.api.get('/r/parties/options', {'kind': 'buyer'}));
    } catch (_) {}
    if (!mounted) return;
    final ok = await showModalBottomSheet<bool>(
      context: context, isScrollControlled: true, showDragHandle: true,
      builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(c).viewInsets.bottom),
            child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('New login', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              ChipPicker(options: [for (final e in _roles.entries.where((e) => e.key != 'admin')) Choice(e.key, e.value)], value: role, onChanged: (v) => set(() { role = v; link = null; })),
              if (role == 'labour' || role == 'vendor') ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: link, isExpanded: true, decoration: InputDecoration(labelText: role == 'labour' ? 'Which worker?' : 'Which vendor?'),
                  items: [for (final o in role == 'labour' ? workers : vendors) DropdownMenuItem(value: '${o['id']}', child: Text('${o['label']}'))],
                  onChanged: (v) => set(() {
                    link = v;
                    final o = (role == 'labour' ? workers : vendors).firstWhere((x) => '${x['id']}' == v);
                    if (name.text.isEmpty) name.text = '${o['label']}';
                  }),
                ),
              ],
              const SizedBox(height: 10),
              TextField(controller: name, decoration: InputDecoration(labelText: tr('Name'))),
              const SizedBox(height: 10),
              TextField(controller: login, decoration: InputDecoration(labelText: tr('Phone / User ID'))),
              const SizedBox(height: 10),
              TextField(controller: password, decoration: InputDecoration(labelText: tr('Password'))),
              const SizedBox(height: 14),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('Save'))),
            ])),
          )),
    );
    if (ok != true) return;
    try {
      await s.api.post('/users', {'name': name.text, 'login': login.text, 'password': password.text, 'role': role, if (role == 'labour') 'worker_id': link, if (role == 'vendor') 'party_id': link});
      _loader.currentState?.reload();
      if (!mounted) return;
      final share = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
            title: const Text('Login created'), content: Text('User ID: ${login.text}\nPassword: ${password.text}'),
            actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Close')), FilledButton.icon(onPressed: () => Navigator.pop(c, true), icon: const Icon(Icons.chat), label: const Text('Send on WhatsApp'))]));
      if (share == true) await shareLogin(s, name.text, login.text, password.text, phone: login.text);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Stack(children: [
      Loader<List<dynamic>>(
        key: _loader,
        load: () async => List<dynamic>.from(await s.api.get('/users')),
        builder: (context, rows, reload) => ListView(padding: const EdgeInsets.fromLTRB(14, 8, 14, 100), children: [
          for (final u in rows)
            Card(margin: const EdgeInsets.only(bottom: 8), child: ListTile(
              leading: CircleAvatar(backgroundColor: Brand.greenSoft, child: Text('${u['name']}'[0], style: const TextStyle(color: Brand.green, fontWeight: FontWeight.w800))),
              title: Text('${u['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${u['login']}${u['worker_name'] != null ? ' · ${u['worker_name']}' : ''}${u['party_name'] != null ? ' · ${u['party_name']}' : ''}'),
              trailing: Pill(_roles[u['role']] ?? '${u['role']}', color: u['active'] == 1 ? Brand.green : Brand.red),
            )),
        ]),
      ),
      Positioned(right: 16, bottom: 16, child: FloatingActionButton.extended(heroTag: 'adduser', onPressed: _add, icon: const Icon(Icons.person_add_alt), label: const Text('Add login'), backgroundColor: Brand.green, foregroundColor: Colors.white)),
    ]);
  }
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final _cur = TextEditingController(), _next = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return ListView(padding: const EdgeInsets.all(16), children: [
      Card(child: ListTile(leading: const Icon(Icons.person_outline), title: Text('${s.user['name']}'), subtitle: Text('${s.user['login']} · ${s.role}'))),
      const SizedBox(height: 10),
      Card(child: ListTile(leading: const Icon(Icons.translate), title: Text(tr('Language')), trailing: SegmentedButton<String>(
        segments: const [ButtonSegment(value: 'en', label: Text('English')), ButtonSegment(value: 'te', label: Text('తెలుగు'))],
        selected: {s.lang}, onSelectionChanged: (v) => s.setLang(v.first),
      ))),
      const SizedBox(height: 16),
      const SectionLabel('Change password'),
      TextField(controller: _cur, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
      const SizedBox(height: 10),
      TextField(controller: _next, obscureText: true, decoration: const InputDecoration(labelText: 'New password (min 6)')),
      const SizedBox(height: 12),
      FilledButton(onPressed: () async {
        try {
          await s.api.post('/auth/change-password', {'current': _cur.text, 'next': _next.text});
          if (context.mounted) { toast(context, 'Password changed'); _cur.clear(); _next.clear(); }
        } catch (e) {
          if (context.mounted) toast(context, '$e', error: true);
        }
      }, child: const Text('Change password')),
      const SizedBox(height: 24),
      OutlinedButton.icon(onPressed: s.logout, icon: const Icon(Icons.logout), label: Text(tr('Logout'))),
    ]);
  }
}
