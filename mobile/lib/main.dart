// Polyhouse OS mobile app - entry point. Talks to the same server as the web app.
import 'package:flutter/material.dart';
import 'core/session.dart';
import 'ui/theme.dart';
import 'screens/login_screen.dart';
import 'screens/shell.dart';
import 'screens/portals.dart';
import 'screens/super_admin.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = Session();
  await session.init();
  runApp(PolyhouseApp(session: session));
}

class PolyhouseApp extends StatelessWidget {
  final Session session;
  const PolyhouseApp({super.key, required this.session});

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: ListenableBuilder(
        listenable: session,
        builder: (context, _) => MaterialApp(
          title: 'Polyhouse OS',
          debugShowCheckedModeBanner: false,
          theme: buildTheme(),
          home: _home(),
        ),
      ),
    );
  }

  Widget _home() {
    if (session.loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (!session.loggedIn) return const LoginScreen();
    // A new key per user/org rebuilds every screen after login, logout or language change
    final key = ValueKey('${session.user['id']}-${session.lang}');
    switch (session.role) {
      case 'superadmin':
        return SuperAdminScreen(key: key);
      case 'vendor':
        return VendorApp(key: key);
      case 'labour':
        return LabourApp(key: key);
      default:
        return FarmShell(key: key);
    }
  }
}
