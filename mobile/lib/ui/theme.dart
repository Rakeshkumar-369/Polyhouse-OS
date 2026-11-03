// Brand colours and the Material 3 theme (same green as the web app)
import 'package:flutter/material.dart';

class Brand {
  static const green = Color(0xFF15803D);
  static const greenDark = Color(0xFF166534);
  static const greenSoft = Color(0xFFF0FDF4);
  static const bg = Color(0xFFF5F7F6);
  static const line = Color(0xFFE2E8F0);
  static const ink = Color(0xFF1E293B);
  static const muted = Color(0xFF64748B);
  static const revenue = Color(0xFF2A78D6);
  static const expenses = Color(0xFFEB6834);
  static const profit = Color(0xFF1BAF7A);
  static const red = Color(0xFFDC2626);
  static const amber = Color(0xFFD97706);
}

Color hexColor(dynamic hex, [Color fallback = Brand.green]) {
  final s = '${hex ?? ''}'.replaceAll('#', '');
  if (s.length != 6) return fallback;
  return Color(int.parse('FF$s', radix: 16));
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: Brand.green, primary: Brand.green, surface: Colors.white);
  final border = OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFCBD5E1)));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Brand.bg,
    appBarTheme: const AppBarTheme(backgroundColor: Colors.white, foregroundColor: Brand.ink, elevation: 0, scrolledUnderElevation: 1, centerTitle: false,
        titleTextStyle: TextStyle(color: Brand.ink, fontSize: 18, fontWeight: FontWeight.w700)),
    cardTheme: CardThemeData(color: Colors.white, elevation: 0, margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: Brand.line))),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: Colors.white, isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: border, enabledBorder: border,
      focusedBorder: border.copyWith(borderSide: const BorderSide(color: Brand.green, width: 2)),
      labelStyle: const TextStyle(color: Brand.muted),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(64, 52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)), textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 46), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
    chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)), side: const BorderSide(color: Brand.line), labelStyle: const TextStyle(fontWeight: FontWeight.w600)),
    navigationBarTheme: NavigationBarThemeData(backgroundColor: Colors.white, indicatorColor: Brand.greenSoft, elevation: 3,
        labelTextStyle: WidgetStateProperty.all(const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
