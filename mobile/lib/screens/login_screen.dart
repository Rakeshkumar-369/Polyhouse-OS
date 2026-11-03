// Login for every role. The server address is remembered (or preset with --dart-define=API_URL=...).
import 'package:flutter/material.dart';
import '../core/session.dart';
import '../core/i18n.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _server = TextEditingController();
  final _login = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false, _show = false, _editServer = false;
  String? _error;
  List<dynamic> _demos = [];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final s = SessionScope.read(context);
    if (_server.text.isEmpty) {
      _server.text = s.server;
      _editServer = s.server.isEmpty;
      _loadDemos();
    }
  }

  Future<void> _loadDemos() async {
    final s = SessionScope.read(context);
    if (_server.text.trim().isEmpty) return;
    try {
      s.api.baseUrl = _server.text.trim();
      final d = await s.api.get('/public/demo-accounts');
      if (mounted) setState(() => _demos = d is List ? d : []);
    } catch (_) {
      if (mounted) setState(() => _demos = []);
    }
  }

  Future<void> _go(String login, String password) async {
    if (_server.text.trim().isEmpty) {
      setState(() { _error = 'Enter the server address (ask the farm owner).'; _editServer = true; });
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await SessionScope.read(context).login(_server.text, login, password);
    } catch (e) {
      if (mounted) setState(() { _error = '$e'; _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AutofillGroup(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(children: [
                    ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.asset('assets/icon.png', width: 46, height: 46)),
                    const SizedBox(width: 10),
                    const Expanded(child: Text('Polyhouse OS', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800))),
                    TextButton.icon(onPressed: () => s.setLang(s.lang == 'en' ? 'te' : 'en'), icon: const Icon(Icons.translate, size: 18), label: Text(s.lang == 'en' ? 'తెలుగు' : 'English')),
                  ]),
                  const SizedBox(height: 32),
                  Text(tr('Welcome back'), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
                  Text(tr('Login with your phone number or user ID'), style: const TextStyle(color: Brand.muted)),
                  const SizedBox(height: 22),
                  if (_editServer)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TextField(
                        controller: _server, keyboardType: TextInputType.url,
                        decoration: InputDecoration(labelText: tr('Server address'), hintText: 'https://your-farm.onrender.com', prefixIcon: const Icon(Icons.dns_outlined)),
                        onSubmitted: (_) => _loadDemos(),
                      ),
                    )
                  else
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(onPressed: () => setState(() => _editServer = true), icon: const Icon(Icons.dns_outlined, size: 16), label: Text(_server.text, overflow: TextOverflow.ellipsis)),
                    ),
                  TextField(controller: _login, autofillHints: const [AutofillHints.username], keyboardType: TextInputType.text, decoration: InputDecoration(labelText: tr('Phone / User ID'), prefixIcon: const Icon(Icons.person_outline))),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password, obscureText: !_show, autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _go(_login.text, _password.text),
                    decoration: InputDecoration(labelText: tr('Password'), prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(icon: Icon(_show ? Icons.visibility_off : Icons.visibility), onPressed: () => setState(() => _show = !_show))),
                  ),
                  if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Brand.red))),
                  const SizedBox(height: 18),
                  FilledButton(onPressed: _busy ? null : () => _go(_login.text, _password.text), child: Text(_busy ? '…' : tr('Login'))),
                  if (_demos.isNotEmpty) ...[
                    const SizedBox(height: 28),
                    const SectionLabel('Try a demo account'),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final d in _demos)
                        ActionChip(
                          avatar: const Icon(Icons.play_circle_outline, size: 18),
                          label: Text('${d['role']} · ${d['name']}'),
                          onPressed: _busy ? null : () => _go('${d['login']}', '${d['password']}'),
                        ),
                    ]),
                  ],
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
