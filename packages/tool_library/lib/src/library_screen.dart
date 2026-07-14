import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Library')),
      body: Center(
        child: Text(
          'Import songs to get started',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
      ),
    );
  }
}
