export function rebuildTable(
  table: string,
  createNextSql: string,
  columns: readonly string[],
): readonly string[] {
  const next = `${table}_next`;
  const list = columns.join(', ');
  return [
    createNextSql,
    `INSERT INTO ${next} (${list})
   SELECT ${list} FROM ${table}`,
    `DELETE FROM sqlite_sequence WHERE name = '${next}'`,
    `INSERT INTO sqlite_sequence (name, seq)
   SELECT '${next}', seq FROM sqlite_sequence WHERE name = '${table}'`,
    `DROP TABLE ${table}`,
    `ALTER TABLE ${next} RENAME TO ${table}`,
  ];
}
