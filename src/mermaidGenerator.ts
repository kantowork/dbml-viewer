import { ParsedDbml, RefMeta } from './types';

export function generateMermaidErDiagram(parsed: ParsedDbml): string {
  // Collect all table names present in the DBML
  const knownTableNames = new Set(parsed.tables.map((t) => t.name));

  // Determine which tables are referenced in relationships (refs)
  const tablesInEr = new Set<string>();
  const externalTables = new Set<string>();

  // Process all refs
  for (const ref of parsed.refs) {
    if (ref.endpoints.length === 2) {
      const [ep1, ep2] = ref.endpoints;
      if (ep1.tableName) {
        if (knownTableNames.has(ep1.tableName)) {
          tablesInEr.add(ep1.tableName);
        } else {
          externalTables.add(ep1.tableName);
        }
      }
      if (ep2.tableName) {
        if (knownTableNames.has(ep2.tableName)) {
          tablesInEr.add(ep2.tableName);
        } else {
          externalTables.add(ep2.tableName);
        }
      }
    }
  }

  // If no refs are defined, or no tables involved in refs, output message
  if (tablesInEr.size === 0 && externalTables.size === 0) {
    return '%% ER diagram omitted: No relationship (Ref) definitions found.';
  }

  // Collect columns involved in relationships for each table
  const refColsPerTable = new Map<string, Set<string>>();
  for (const ref of parsed.refs) {
    if (ref.endpoints.length === 2) {
      const [ep1, ep2] = ref.endpoints;
      if (ep1.tableName && ep1.fieldNames) {
        if (!refColsPerTable.has(ep1.tableName)) refColsPerTable.set(ep1.tableName, new Set());
        ep1.fieldNames.forEach((f) => refColsPerTable.get(ep1.tableName)!.add(f));
      }
      if (ep2.tableName && ep2.fieldNames) {
        if (!refColsPerTable.has(ep2.tableName)) refColsPerTable.set(ep2.tableName, new Set());
        ep2.fieldNames.forEach((f) => refColsPerTable.get(ep2.tableName)!.add(f));
      }
    }
  }

  // Build a map of column -> ref destination description string "schema.table.column"
  const colRefMap = new Map<string, string>(); // key: `${tableName}.${colName}` -> val: `destinationTable.destCol`
  for (const ref of parsed.refs) {
    if (ref.endpoints.length === 2) {
      const [ep1, ep2] = ref.endpoints;
      if (ep1.tableName && ep1.fieldNames && ep2.tableName && ep2.fieldNames) {
        for (let i = 0; i < Math.min(ep1.fieldNames.length, ep2.fieldNames.length); i++) {
          const f1 = ep1.fieldNames[i];
          const f2 = ep2.fieldNames[i];
          
          const t2Target = (ep2.schemaName ? `${ep2.schemaName}.` : '') + `${ep2.tableName}.${f2}`;
          colRefMap.set(`${ep1.tableName}.${f1}`, t2Target);

          const t1Target = (ep1.schemaName ? `${ep1.schemaName}.` : '') + `${ep1.tableName}.${f1}`;
          colRefMap.set(`${ep2.tableName}.${f2}`, t1Target);
        }
      }
    }
  }

  const lines: string[] = [];
  lines.push('erDiagram');

  // Render internal tables that are part of ER relationships
  for (const table of parsed.tables) {
    if (!tablesInEr.has(table.name)) {
      continue; // Skip tables that have no Ref relationships
    }

    const tableName = sanitizeName(table.name);
    lines.push(`  ${tableName} {`);

    const refCols = refColsPerTable.get(table.name) || new Set<string>();

    // Render columns that are PKs OR involved in relationships
    const targetCols = table.columns.filter((c) => c.pk || refCols.has(c.name));
    
    // If no PK or ref column matched, fallback to 'id' or first column
    if (targetCols.length === 0) {
      const fallback = table.columns.find((c) => c.name.toLowerCase() === 'id') || table.columns[0];
      if (fallback) targetCols.push(fallback);
    }

    for (const col of targetCols) {
      const typeStr = sanitizeType(col.type || 'string');
      const nameStr = sanitizeName(col.name);
      
      // Constraint badge: PK or FK
      let constraint = '';
      if (col.pk) {
        constraint = 'PK';
      } else if (refCols.has(col.name)) {
        constraint = 'FK';
      }

      // Ref target string or Note in comment quotes
      const refTarget = colRefMap.get(`${table.name}.${col.name}`);
      let commentStr = '';
      if (refTarget && col.note) {
        commentStr = `"${escapeComment(refTarget)} - ${escapeComment(col.note)}"`;
      } else if (refTarget) {
        commentStr = `"${escapeComment(refTarget)}"`;
      } else if (col.note) {
        commentStr = `"${escapeComment(col.note)}"`;
      }

      if (constraint && commentStr) {
        lines.push(`    ${typeStr} ${nameStr} ${constraint} ${commentStr}`);
      } else if (constraint) {
        lines.push(`    ${typeStr} ${nameStr} ${constraint}`);
      } else if (commentStr) {
        lines.push(`    ${typeStr} ${nameStr} ${commentStr}`);
      } else {
        lines.push(`    ${typeStr} ${nameStr}`);
      }
    }

    lines.push('  }');
  }

  // Render external/unresolvable tables (e.g. referenced tables from external files/schemas not loaded)
  for (const extTable of externalTables) {
    const extName = sanitizeName(extTable);
    lines.push(`  ${extName} {`);
    lines.push(`    string external_ref PK`);
    lines.push('  }');
  }

  // Render Relationships (Refs)
  for (const ref of parsed.refs) {
    if (ref.inactive) {
      continue; // Skip inactive relationships in ER diagram
    }
    if (ref.endpoints.length === 2) {
      const [ep1, ep2] = ref.endpoints;
      const t1 = sanitizeName(ep1.tableName);
      const t2 = sanitizeName(ep2.tableName);

      const leftSym = getLeftCardinality(ep1.relation);
      const rightSym = getRightCardinality(ep2.relation);

      // Label on the relationship line: use Ref note if provided, otherwise omit the label.
      const label = ref.note ? escapeComment(ref.note) : '';

      lines.push(`  ${t1} ${leftSym}--${rightSym} ${t2} : "${label ?? '" "'}"`);
    }
  }

  return lines.join('\n');
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function sanitizeType(type: string): string {
  // Mermaid ER attribute type must be alphanumeric/underscore only (no spaces, parentheses, commas, etc.)
  const clean = type.replace(/[^a-zA-Z0-9_]/g, '_');
  return clean || 'string';
}

function escapeComment(comment: string): string {
  return comment.replace(/["\n\r;]/g, ' ').trim();
}

function getLeftCardinality(rel: string): string {
  if (rel === '*' || rel === 'many' || rel === '>') {
    return '}o';
  } else if (rel === '1' || rel === 'one' || rel === '<' || rel === '-') {
    return '||';
  }
  return '||';
}

function getRightCardinality(rel: string): string {
  if (rel === '*' || rel === 'many' || rel === '>') {
    return 'o{';
  } else if (rel === '1' || rel === 'one' || rel === '<' || rel === '-') {
    return '||';
  }
  return '||';
}
