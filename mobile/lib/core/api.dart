// HTTP client for the Polyhouse OS server (same REST API as the web app).
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class Api {
  String baseUrl;
  String? token;
  void Function()? onUnauthorized;
  Api(this.baseUrl);

  Uri _uri(String path, [Map<String, dynamic>? params]) {
    final q = <String, String>{};
    params?.forEach((k, v) {
      if (v != null && '$v'.isNotEmpty) q[k] = '$v';
    });
    final base = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    return Uri.parse('$base/api$path').replace(queryParameters: q.isEmpty ? null : q);
  }

  Future<dynamic> _send(String method, String path, {Map<String, dynamic>? params, Object? body}) async {
    final headers = {'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};
    http.Response res;
    try {
      final uri = _uri(path, params);
      final payload = body == null ? null : jsonEncode(body);
      res = await (switch (method) {
        'GET' => http.get(uri, headers: headers),
        'POST' => http.post(uri, headers: headers, body: payload ?? '{}'),
        'PUT' => http.put(uri, headers: headers, body: payload ?? '{}'),
        _ => http.delete(uri, headers: headers),
      }).timeout(const Duration(seconds: 25));
    } catch (_) {
      throw ApiException(0, 'Cannot reach the server. Check the internet connection and the server address.');
    }
    dynamic data;
    try {
      data = res.body.isEmpty ? {} : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = {};
    }
    if (res.statusCode == 401 && !path.startsWith('/auth/login')) onUnauthorized?.call();
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, data is Map && data['error'] != null ? '${data['error']}' : 'Something went wrong (${res.statusCode})');
    }
    return data;
  }

  Future<dynamic> get(String path, [Map<String, dynamic>? params]) => _send('GET', path, params: params);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body ?? {});
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body: body ?? {});
  Future<dynamic> delete(String path) => _send('DELETE', path);
}
