import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_by_boat/main.dart';

void main() {
  testWidgets('empty-state guidance is readable on iPhone', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: InfoPanel(
          icon: Icons.sailing_outlined,
          title: 'No boats found',
          detail: 'Try another destination.',
        ),
      ),
    ));
    expect(find.text('No boats found'), findsOneWidget);
    expect(find.text('Try another destination.'), findsOneWidget);
  });
}
