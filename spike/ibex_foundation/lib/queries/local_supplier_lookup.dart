import 'package:drift/drift.dart';

import '../core/text/arabic_search_normalizer.dart';
import '../database/spike_database.dart';

class SupplierLookupResult {
  const SupplierLookupResult({required this.id, required this.name});
  final String id;
  final String name;
}

class LocalSupplierLookup {
  const LocalSupplierLookup({required this.db, required this.businessId});

  final SpikeDatabase db;
  final String businessId;

  Future<List<SupplierLookupResult>> find(String query) async {
    final normalized = ArabicSearchNormalizer.normalize(query);
    if (normalized.isEmpty) return const [];
    final alternatives = ArabicSearchNormalizer.searchAlternatives(query);
    final clauses = <String>[];
    final variables = <Variable<Object>>[Variable.withString(businessId)];
    for (final alternative in alternatives) {
      clauses.add('normalized_name LIKE ?');
      variables.add(Variable.withString('%$alternative%'));
    }
    final rows = await db.customSelect(
      '''
      SELECT id, name
      FROM suppliers
      WHERE business_id = ? AND active = 1
        AND (${clauses.join(' OR ')})
      ORDER BY CASE WHEN normalized_name = ? THEN 0 ELSE 1 END, name
      LIMIT 8
      ''',
      variables: [
        ...variables,
        Variable.withString(normalized),
      ],
      readsFrom: {db.suppliers},
    ).get();
    return rows
        .map((row) => SupplierLookupResult(
              id: row.read<String>('id'),
              name: row.read<String>('name'),
            ))
        .toList(growable: false);
  }
}
