import 'package:flutter/material.dart';

void main() {
  runApp(const IbexFoundationSpikeApp());
}

class IbexFoundationSpikeApp extends StatelessWidget {
  const IbexFoundationSpikeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(
        body: Center(child: Text('IBEX Foundation Runtime Gate')),
      ),
    );
  }
}
