// Login state: server address, token, and /api/meta (user, organisation, modules, form definitions).
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'i18n.dart';

// Server address can be preset at build time:  flutter build apk --dart-define=API_URL=https://your-site
const presetServer = String.fromEnvironment('API_URL');

class Session extends ChangeNotifier {
  late SharedPreferences _prefs;
  final Api api = Api('');
  Map<String, dynamic>? meta;
  bool loading = true;
  String lang = 'en';

  String get server => api.baseUrl;
  bool get loggedIn => meta != null;
  Map<String, dynamic> get user => Map<String, dynamic>.from(meta?['user'] ?? {});
  Map<String, dynamic>? get org => meta?['org'] == null ? null : Map<String, dynamic>.from(meta!['org']);
  Map<String, dynamic> get settings => Map<String, dynamic>.from(org?['settings'] ?? {});
  String get role => '${user['role'] ?? ''}';
  String get cur => '${settings['currency'] ?? '₹'}';
  Map<String, dynamic> get resources => Map<String, dynamic>.from(meta?['resources'] ?? {});
  List<String> get grades => List<String>.from(settings['grades'] ?? ['A', 'B', 'C']);
  bool get isManager => role == 'admin' || role == 'manager';
  bool get isField => isManager || role == 'supervisor';

  bool on(String? module) {
    if (module == null || org == null) return true;
    final m = settings['modules'];
    return m is! Map || m[module] != false;
  }

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    var saved = _prefs.getString('server') ?? '';
    if (saved.isEmpty) saved = presetServer.isNotEmpty ? presetServer : (kIsWeb ? Uri.base.origin : '');
    api.baseUrl = saved;
    api.token = _prefs.getString('token');
    lang = _prefs.getString('lang') ?? 'en';
    I18n.lang = lang;
    api.onUnauthorized = () => logout();
    if (api.token != null && api.baseUrl.isNotEmpty) {
      try {
        await reload();
      } catch (_) {
        meta = null;
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> reload() async {
    meta = Map<String, dynamic>.from(await api.get('/meta'));
    final l = user['lang'];
    if (l is String && l.isNotEmpty && l != lang) {
      lang = l;
      I18n.lang = l;
      await _prefs.setString('lang', l);
    }
    notifyListeners();
  }

  Future<void> login(String serverUrl, String login, String password) async {
    var url = serverUrl.trim();
    if (url.isNotEmpty && !url.startsWith('http')) url = 'https://$url';
    api.baseUrl = url;
    api.token = null;
    final r = await api.post('/auth/login', {'login': login.trim(), 'password': password});
    api.token = r['token'];
    await _prefs.setString('server', url);
    await _prefs.setString('token', api.token!);
    await reload();
  }

  Future<void> logout() async {
    api.token = null;
    meta = null;
    await _prefs.remove('token');
    notifyListeners();
  }

  Future<void> setLang(String l) async {
    lang = l;
    I18n.lang = l;
    await _prefs.setString('lang', l);
    notifyListeners();
    if (api.token != null) {
      try {
        await api.put('/auth/lang', {'lang': l});
      } catch (_) {}
    }
  }
}

// Gives every screen access to the session: Session s = SessionScope.of(context)
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);
  static Session of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;
  static Session read(BuildContext context) => context.getInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}
