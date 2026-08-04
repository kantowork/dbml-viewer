import * as fs from 'fs';
import * as path from 'path';
import {
  ParsedDbml,
  TableMeta,
  ColumnMeta,
  IndexMeta,
  RefMeta,
  EnumMeta,
  TableGroupMeta,
  StickyNoteMeta,
  DiagramViewMeta
} from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dbmlCore = require('@dbml/core');

export function parseDbmlContent(content: string, currentFilePath?: string): ParsedDbml {
  const result: ParsedDbml = {
    tables: [],
    refs: [],
    enums: [],
    tableGroups: [],
    stickyNotes: [],
    diagramViews: [],
    tablePartials: {}
  };

  // 1. Resolve TablePartial imports and inline definitions
  const workingDir = currentFilePath ? path.dirname(currentFilePath) : undefined;
  parseTablePartials(content, workingDir, result);

  // 2. Expand TablePartial inclusions (~partial_name) in DBML content
  const expandedContent = expandTablePartialsInContent(content, result.tablePartials);

  // 3. Try parsing full content via @dbml/core Parser AST
  try {
    const parser = new dbmlCore.Parser();
    const parsedAst = parser.parse(expandedContent, 'dbml');
    if (parsedAst) {
      extractFromAst(parsedAst, result);
    }
  } catch (err) {
    // AST Parser fallback
  }

  // 4. Run regex parser to ensure all custom metadata, inline attributes, metadata blocks, and fallback tables are captured
  enhanceWithRegex(expandedContent, result);

  // 5. Associate TableGroups with Tables
  associateTableGroups(result);

  // 6. Map indexes to columns
  mapIndexesToColumns(result);

  return result;
}

function parseTablePartials(content: string, workingDir: string | undefined, result: ParsedDbml) {
  // Check for `use * from 'path'`
  const useImportRegex = /use\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = useImportRegex.exec(content)) !== null) {
    const relPath = match[1];
    if (workingDir) {
      try {
        const fullPath = path.resolve(workingDir, relPath);
        if (fs.existsSync(fullPath)) {
          const importedContent = fs.readFileSync(fullPath, 'utf8');
          // Parse imported content recursively for TablePartials, Enums, etc.
          parseTablePartials(importedContent, path.dirname(fullPath), result);
          
          // Parse Enum definitions in imported files
          const importedEnumRegex = /Enum\s+([A-Za-z0-9_.]+)\s*\{([\s\S]*?)\n\}/g;
          let enumMatch: RegExpExecArray | null;
          while ((enumMatch = importedEnumRegex.exec(importedContent)) !== null) {
            const enumFullName = enumMatch[1];
            const body = enumMatch[2];
            const nameParts = enumFullName.split('.');
            const enumName = nameParts.pop()!;
            const enumSchema = nameParts.length > 0 ? nameParts.join('.') : undefined;

            if (!result.enums.some((e) => e.name === enumName)) {
              const values: { name: string; note?: string }[] = [];
              const lines = body.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('//')) continue;
                const valMatch = /^([A-Za-z0-9_]+)(?:\s*\[\s*note:\s*['"]([^'"]+)['"]\s*\])?/.exec(trimmed);
                if (valMatch) {
                  values.push({
                    name: valMatch[1],
                    note: valMatch[2] || undefined
                  });
                }
              }
              result.enums.push({
                name: enumName,
                schema: enumSchema,
                values
              });
            }
          }
        }
      } catch (e) {
        // Ignore file read error
      }
    }
  }

  // Parse TablePartial blocks: TablePartial partial_name { ... }
  const partialRegex = /TablePartial\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g;
  while ((match = partialRegex.exec(content)) !== null) {
    const partialName = match[1];
    const body = match[2];
    const cols: ColumnMeta[] = [];

    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      const colMatch = /^([A-Za-z0-9_]+)\s+([A-Za-z0-9_().`'-]+)(?:\s*\[([^\]]+)\])?/.exec(trimmed);
      if (colMatch) {
        const colName = colMatch[1];
        const typeStr = colMatch[2];
        const settingsStr = colMatch[3];
        const col: ColumnMeta = {
          name: colName,
          type: typeStr,
          pk: false,
          notNull: false,
          unique: false,
          increment: false,
          metadata: {},
          rawSettings: {}
        };
        if (settingsStr) {
          const settings = parseSettingsString(settingsStr);
          for (const [k, v] of Object.entries(settings)) {
            if (k === 'pk' || k === 'primary key') col.pk = true;
            else if (k === 'not null') col.notNull = true;
            else if (k === 'unique') col.unique = true;
            else if (k === 'increment') col.increment = true;
            else if (k === 'note') col.note = v;
            else if (k === 'default') col.dbDefault = v;
            else {
              col.rawSettings[k] = v;
              col.metadata[k] = v;
            }
          }
        }
        cols.push(col);
      }
    }
    result.tablePartials[partialName] = cols;
  }
}

function expandTablePartialsInContent(content: string, partials: Record<string, ColumnMeta[]>): string {
  // Replace ~partial_name in Table blocks with actual column definitions
  return content.replace(/^\s*~([A-Za-z0-9_]+)\s*$/gm, (match, partialName) => {
    const cols = partials[partialName];
    if (!cols) return match;
    return cols
      .map((c) => {
        let line = `  ${c.name} ${c.type}`;
        const settings: string[] = [];
        if (c.pk) settings.push('pk');
        if (c.notNull) settings.push('not null');
        if (c.unique) settings.push('unique');
        if (c.increment) settings.push('increment');
        if (c.dbDefault) settings.push(`default: '${c.dbDefault}'`);
        if (c.note) settings.push(`note: '${c.note}'`);
        for (const [k, v] of Object.entries(c.metadata)) {
          settings.push(`${k}: '${v}'`);
        }
        if (settings.length > 0) {
          line += ` [${settings.join(', ')}]`;
        }
        return line;
      })
      .join('\n');
  });
}

function associateTableGroups(result: ParsedDbml) {
  for (const tg of result.tableGroups) {
    for (const tableName of tg.tables) {
      const table = result.tables.find((t) => t.name === tableName);
      if (table) {
        table.groupName = tg.name;
        table.groupColor = tg.color;
        table.groupNote = tg.note;
        table.groupMetadata = tg.metadata;
      }
    }
  }
}

function mapIndexesToColumns(result: ParsedDbml) {
  for (const table of result.tables) {
    for (const idx of table.indexes) {
      const indexDisplayName = idx.name ? idx.name : idx.columns.join(', ');
      for (const colName of idx.columns) {
        const col = table.columns.find((c) => c.name === colName);
        if (col) {
          if (col.indexName) {
            col.indexName += `, ${indexDisplayName}`;
          } else {
            col.indexName = indexDisplayName;
          }
          if (idx.note) col.indexNote = idx.note;
        }
      }
    }
  }
}

function extractFromAst(ast: any, result: ParsedDbml) {
  if (ast.database) {
    if (ast.database.name) {
      result.projectName = ast.database.name;
    }
    if (ast.database.note) {
      result.projectNote = ast.database.note;
    }
  }

  const schemas = ast.schemas || [];
  for (const schema of schemas) {
    // Tables
    for (const t of schema.tables || []) {
      const tableMeta: TableMeta = {
        name: t.name,
        schema: schema.name !== 'public' ? schema.name : undefined,
        alias: t.alias || undefined,
        note: t.note || undefined,
        headerColor: t.headerColor || undefined,
        metadata: extractMetadataDict(t.metadata),
        rawSettings: {},
        columns: [],
        indexes: []
      };

      // Fields
      const fieldsList = t.fields || t.columns || [];
      for (const f of fieldsList) {
        const col: ColumnMeta = {
          name: f.name,
          type: formatFieldType(f.type),
          pk: Boolean(f.pk),
          notNull: Boolean(f.not_null),
          unique: Boolean(f.unique),
          increment: Boolean(f.increment),
          dbDefault: f.dbdefault ? String(f.dbdefault.value !== undefined ? f.dbdefault.value : f.dbdefault) : undefined,
          note: f.note || undefined,
          metadata: extractMetadataDict(f.metadata),
          rawSettings: {}
        };
        tableMeta.columns.push(col);
      }

      // Indexes
      for (const idx of t.indexes || []) {
        const indexMeta: IndexMeta = {
          columns: (idx.columns || []).map((c: any) => c.value || c.type || c),
          name: idx.name || undefined,
          unique: Boolean(idx.unique),
          type: idx.type || undefined,
          pk: Boolean(idx.pk),
          note: idx.note || undefined,
          rawSettings: {}
        };
        tableMeta.indexes.push(indexMeta);
      }

      result.tables.push(tableMeta);
    }

    // Refs
    for (const r of schema.refs || []) {
      if (r.endpoints && r.endpoints.length === 2) {
        const ep1 = r.endpoints[0];
        const ep2 = r.endpoints[1];
        const refMeta: RefMeta = {
          name: r.name || undefined,
          color: r.color || undefined,
          inactive: Boolean(r.inactive),
          note: r.note || undefined,
          onDelete: r.onDelete || undefined,
          onUpdate: r.onUpdate || undefined,
          endpoints: [
            {
              tableName: ep1.tableName,
              schemaName: ep1.schemaName,
              fieldNames: ep1.fieldNames || [],
              relation: ep1.relation || '*'
            },
            {
              tableName: ep2.tableName,
              schemaName: ep2.schemaName,
              fieldNames: ep2.fieldNames || [],
              relation: ep2.relation || '1'
            }
          ]
        };
        result.refs.push(refMeta);
      }
    }

    // Enums
    for (const e of schema.enums || []) {
      const enumMeta: EnumMeta = {
        name: e.name,
        schema: schema.name !== 'public' ? schema.name : undefined,
        values: (e.values || []).map((v: any) => ({
          name: v.name,
          note: v.note || undefined
        }))
      };
      result.enums.push(enumMeta);
    }

    // TableGroups
    for (const tg of schema.tableGroups || []) {
      const tgMeta: TableGroupMeta = {
        name: tg.name,
        tables: (tg.tables || []).map((t: any) => t.name || t),
        color: tg.color || undefined,
        note: tg.note || undefined,
        metadata: extractMetadataDict(tg.metadata)
      };
      result.tableGroups.push(tgMeta);
    }
  }

  // Sticky Notes from Database level
  if (ast.database && ast.database.notes) {
    for (const noteObj of ast.database.notes) {
      result.stickyNotes.push({
        name: noteObj.name || undefined,
        content: noteObj.content || noteObj.value || '',
        color: noteObj.color || undefined,
        metadata: extractMetadataDict(noteObj.metadata)
      });
    }
  }

  // DiagramViews
  if (ast.database && ast.database.diagramViews) {
    for (const dv of ast.database.diagramViews) {
      result.diagramViews.push({
        name: dv.name,
        tables: dv.tables || [],
        notes: dv.notes || [],
        tableGroups: dv.tableGroups || [],
        schemas: dv.schemas || []
      });
    }
  }
}

function extractMetadataDict(metadata: unknown): Record<string, string> {
  if (!metadata) {
    return {};
  }
  const dict: Record<string, string> = {};
  if (typeof metadata === 'object' && metadata !== null) {
    for (const key of Object.keys(metadata as Record<string, unknown>)) {
      const val = (metadata as Record<string, unknown>)[key];
      if (val !== undefined && val !== null) {
        dict[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
    }
  }
  return dict;
}

function formatFieldType(typeObj: any): string {
  if (!typeObj) {
    return '';
  }
  if (typeof typeObj === 'string') {
    return typeObj;
  }
  if (typeObj.type_name) {
    let name = typeObj.type_name;
    if (typeObj.args) {
      name += `(${typeObj.args})`;
    }
    return name;
  }
  return String(typeObj);
}

function enhanceWithRegex(content: string, result: ParsedDbml) {
  // 1. Match inline settings like [owner: "data-team", sla_hours: "24", pii: "true", headercolor: #3498DB]
  // Parse Table settings
  const tableHeaderRegex = /Table\s+([A-Za-z0-9_]+)(?:\s+as\s+([A-Za-z0-9_]+))?(?:\s*\[([^\]]+)\])?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = tableHeaderRegex.exec(content)) !== null) {
    const tableName = match[1];
    const alias = match[2];
    const settingsStr = match[3];

    let table = result.tables.find((t) => t.name === tableName);
    if (!table) {
      table = {
        name: tableName,
        alias: alias || undefined,
        metadata: {},
        rawSettings: {},
        columns: [],
        indexes: []
      };
      result.tables.push(table);
    }

    if (settingsStr) {
      const settings = parseSettingsString(settingsStr);
      for (const [k, v] of Object.entries(settings)) {
        if (k === 'headercolor') {
          table.headerColor = v;
        } else if (k === 'note') {
          table.note = v;
        } else {
          table.rawSettings[k] = v;
          table.metadata[k] = v;
        }
      }
    }
  }

  // Extract column lines per table block by scanning balanced braces
  const tableHeaderStartRegex = /Table\s+([A-Za-z0-9_]+)(?:\s+as\s+([A-Za-z0-9_]+))?(?:\s*\[([^\]]+)\])?\s*\{/g;
  while ((match = tableHeaderStartRegex.exec(content)) !== null) {
    const tableName = match[1];
    const startIndex = match.index + match[0].length;
    let braceCount = 1;
    let endIndex = startIndex;

    while (endIndex < content.length && braceCount > 0) {
      if (content[endIndex] === '{') braceCount++;
      else if (content[endIndex] === '}') braceCount--;
      endIndex++;
    }

    const body = content.substring(startIndex, endIndex - 1);
    const table = result.tables.find((t) => t.name === tableName);
    if (!table) continue;

    const colLines = body.split('\n');
    let inNoteBlock = false;
    let inIndexesBlock = false;

    for (const line of colLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) {
        continue;
      }
      if (trimmed.startsWith('Note:') || trimmed.startsWith('Note {')) {
        inNoteBlock = true;
        continue;
      }
      if (trimmed.startsWith('indexes {')) {
        inIndexesBlock = true;
        continue;
      }
      if (trimmed === '}' && (inNoteBlock || inIndexesBlock)) {
        inNoteBlock = false;
        inIndexesBlock = false;
        continue;
      }
      if (inNoteBlock || inIndexesBlock) {
        continue;
      }

      const colMatch = /^\s*([A-Za-z0-9_]+)\s+([A-Za-z0-9_().`'-]+)(?:\s*\[([^\]]+)\])?/.exec(trimmed);
      if (colMatch) {
        const colName = colMatch[1];
        const typeStr = colMatch[2];
        const settingsStr = colMatch[3];

        let col = table.columns.find((c) => c.name === colName);
        if (!col) {
          col = {
            name: colName,
            type: typeStr,
            pk: false,
            notNull: false,
            unique: false,
            increment: false,
            metadata: {},
            rawSettings: {}
          };
          table.columns.push(col);
        } else if (!col.type) {
          col.type = typeStr;
        }

        if (settingsStr) {
          const settings = parseSettingsString(settingsStr);
          for (const [k, v] of Object.entries(settings)) {
            if (k === 'pk' || k === 'primary key') col.pk = true;
            else if (k === 'not null') col.notNull = true;
            else if (k === 'unique') col.unique = true;
            else if (k === 'increment') col.increment = true;
            else if (k === 'note') col.note = v;
            else if (k === 'default') col.dbDefault = v;
            else {
              col.rawSettings[k] = v;
              col.metadata[k] = v;
            }
          }
        }
      }
    }
  }

  // 2. Parse Metadata block
  // Metadata Table users { owner: 'scott', note: 'scott is owner' }
  // Metadata Column users.id { pii: 'true', masking: 'partial' }
  const metadataBlockRegex = /Metadata\s+(Table|Column|TableGroup|Note)\s+([A-Za-z0-9_.]+)\s*\{([^}]*)\}/g;
  while ((match = metadataBlockRegex.exec(content)) !== null) {
    const targetKind = match[1];
    const targetName = match[2];
    const body = match[3];
    const kvPairs = parseKeyValuePairs(body);

    if (targetKind === 'Table') {
      const table = result.tables.find((t) => t.name === targetName);
      if (table) {
        for (const [k, v] of Object.entries(kvPairs)) {
          if (k === 'note') table.note = v;
          else if (k === 'headercolor') table.headerColor = v;
          else {
            table.metadata[k] = v;
            table.rawSettings[k] = v;
          }
        }
      }
    } else if (targetKind === 'Column') {
      const [tName, cName] = targetName.split('.');
      const table = result.tables.find((t) => t.name === tName);
      if (table) {
        const col = table.columns.find((c) => c.name === cName);
        if (col) {
          for (const [k, v] of Object.entries(kvPairs)) {
            if (k === 'note') col.note = v;
            else {
              col.metadata[k] = v;
              col.rawSettings[k] = v;
            }
          }
        }
      }
    } else if (targetKind === 'TableGroup') {
      const tg = result.tableGroups.find((g) => g.name === targetName);
      if (tg) {
        for (const [k, v] of Object.entries(kvPairs)) {
          if (k === 'note') tg.note = v;
          else if (k === 'color') tg.color = v;
          else tg.metadata[k] = v;
        }
      }
    }
  }

  // 3. Parse Sticky Notes standalone: Note note_name [settings] { 'content' } or '''content'''
  const stickyNoteRegex = /Note(?:\s+([A-Za-z0-9_]+))?(?:\s*\[([^\]]+)\])?\s*\{\s*(?:'''([\s\S]*?)'''|'([^']*)'|"([^"]*)")\s*\}/g;
  while ((match = stickyNoteRegex.exec(content)) !== null) {
    const noteName = match[1];
    const settingsStr = match[2];
    const noteText = match[3] || match[4] || match[5] || '';

    if (noteName) {
      let existing = result.stickyNotes.find((n) => n.name === noteName);
      if (!existing) {
        existing = {
          name: noteName,
          content: noteText.trim(),
          metadata: {}
        };
        result.stickyNotes.push(existing);
      }
      if (settingsStr) {
        const settings = parseSettingsString(settingsStr);
        for (const [k, v] of Object.entries(settings)) {
          if (k === 'color') existing.color = v;
          else existing.metadata[k] = v;
        }
      }
    }
  }

  // 4. Parse TableGroup
  const tableGroupRegex = /TableGroup\s+([A-Za-z0-9_]+)(?:\s*\[([^\]]+)\])?\s*\{([^}]*)\}/g;
  while ((match = tableGroupRegex.exec(content)) !== null) {
    const tgName = match[1];
    const settingsStr = match[2];
    const body = match[3];

    let tg = result.tableGroups.find((g) => g.name === tgName);
    if (!tg) {
      const tablesInGroup: string[] = [];
      const lines = body.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t && !t.startsWith('//') && !t.startsWith('Note')) {
          tablesInGroup.push(t);
        }
      }
      tg = {
        name: tgName,
        tables: tablesInGroup,
        metadata: {}
      };
      result.tableGroups.push(tg);
    }

    if (settingsStr) {
      const settings = parseSettingsString(settingsStr);
      for (const [k, v] of Object.entries(settings)) {
        if (k === 'color') tg.color = v;
        else if (k === 'note') tg.note = v;
        else tg.metadata[k] = v;
      }
    }
  }

  // 5. Parse Enum definitions if missed by AST
  const enumRegex = /Enum\s+([A-Za-z0-9_.]+)\s*\{([\s\S]*?)\n\}/g;
  while ((match = enumRegex.exec(content)) !== null) {
    const enumFullName = match[1];
    const body = match[2];

    const nameParts = enumFullName.split('.');
    const enumName = nameParts.pop()!;
    const enumSchema = nameParts.length > 0 ? nameParts.join('.') : undefined;

    if (!result.enums.some((e) => e.name === enumName)) {
      const values: { name: string; note?: string }[] = [];
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        const valMatch = /^([A-Za-z0-9_]+)(?:\s*\[\s*note:\s*['"]([^'"]+)['"]\s*\])?/.exec(trimmed);
        if (valMatch) {
          values.push({
            name: valMatch[1],
            note: valMatch[2] || undefined
          });
        }
      }
      result.enums.push({
        name: enumName,
        schema: enumSchema,
        values
      });
    }
  }

  // 6. Parse Ref definitions if missed by AST
  // Examples: Ref: orders.user_id > users.id [color: #79AD51, delete: cascade]
  //           Ref ref_name: table1.col1 - table2.col2
  const refRegex = /Ref(?:\s+([A-Za-z0-9_]+))?:\s*([A-Za-z0-9_.]+)\s*([><\-])\s*([A-Za-z0-9_.]+)(?:\s*\[([^\]]+)\])?/g;
  while ((match = refRegex.exec(content)) !== null) {
    const refName = match[1];
    const leftStr = match[2];
    const relSymbol = match[3];
    const rightStr = match[4];
    const settingsStr = match[5];

    const [t1Name, f1Name] = leftStr.split('.');
    const [t2Name, f2Name] = rightStr.split('.');

    // Check if ref already extracted from AST
    const existing = result.refs.find(
      (r) =>
        r.endpoints.length === 2 &&
        r.endpoints[0].tableName === t1Name &&
        r.endpoints[1].tableName === t2Name
    );

    if (!existing) {
      const refMeta: RefMeta = {
        name: refName || undefined,
        inactive: false,
        endpoints: [
          {
            tableName: t1Name,
            fieldNames: f1Name ? [f1Name] : [],
            relation: relSymbol === '>' ? '*' : relSymbol === '<' ? '1' : '-'
          },
          {
            tableName: t2Name,
            fieldNames: f2Name ? [f2Name] : [],
            relation: relSymbol === '>' ? '1' : relSymbol === '<' ? '*' : '-'
          }
        ]
      };
      if (settingsStr) {
        const settings = parseSettingsString(settingsStr);
        if (settings['inactive'] === 'true' || settings['inactive']) {
          refMeta.inactive = true;
        }
        if (settings['note']) {
          refMeta.note = settings['note'];
        }
      }
      result.refs.push(refMeta);
    }
  }
}

function parseSettingsString(settingsStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  // split by comma, respecting quotes
  const parts = settingsStr.split(/,(?=(?:(?:[^'"]*['"]){2})*[^'"]*$)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      result[trimmed] = 'true';
    } else {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      // unquote string or hex color
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

function parseKeyValuePairs(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}
