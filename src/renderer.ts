import { ParsedDbml, TableMeta, ColumnMeta, TableGroupMeta, StickyNoteMeta, EnumMeta } from './types';
import { generateMermaidErDiagram } from './mermaidGenerator';
import { getTranslations, Translations } from './i18n';

export function renderHtmlDocument(parsed: ParsedDbml, title: string, theme: string = 'system', lang: string = 'auto', pageSize: string = 'A4', orientation: string = 'portrait'): string {
  const t = getTranslations(lang);
  const mermaidDiagram = generateMermaidErDiagram(parsed);

  // Collect all unique Meta attribute keys across all columns in all tables,
  // excluding keys that are empty/unused in ALL tables.
  const customMetaKeysSet = new Set<string>();
  for (const table of parsed.tables) {
    for (const col of table.columns) {
      for (const [k, v] of Object.entries(col.metadata)) {
        if (k !== 'note' && k !== 'description' && v && String(v).trim() !== '') {
          customMetaKeysSet.add(k);
        }
      }
    }
  }
  // Sort custom meta keys alphabetically
  const customMetaKeys = Array.from(customMetaKeysSet).sort((a, b) => a.localeCompare(b));

  return `<!DOCTYPE html>
<html lang="ja" data-theme="${escapeHtml(theme)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - DBML Table Design</title>
  <style>
    /* Default System Theme (VS Code variables) - Simple & Monochromatic */
    :root {
      --bg-color: var(--vscode-editor-background, #1e1e1e);
      --text-color: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: transparent;
      --border-color: var(--vscode-widget-border, #3c3c3c);
      --header-bg: var(--vscode-editorGroupHeader-tabsBackground, #252526);
      --table-header-bg: rgba(255, 255, 255, 0.05);
      --table-alt-row: rgba(255, 255, 255, 0.02);
      --accent-color: var(--vscode-foreground, #cccccc);
      --tag-bg: rgba(255,255,255,0.06);
      --muted-text: #888888;
      --code-bg: rgba(255, 255, 255, 0.1);
      --code-text: var(--vscode-editor-foreground, #d4d4d4);
    }

    /* Dark Mode explicitly */
    html[data-theme="dark"] {
      --bg-color: #1e1e1e;
      --text-color: #d4d4d4;
      --card-bg: transparent;
      --border-color: #3c3c3c;
      --header-bg: #252526;
      --table-header-bg: rgba(255, 255, 255, 0.05);
      --table-alt-row: rgba(255, 255, 255, 0.02);
      --accent-color: #cccccc;
      --tag-bg: rgba(255,255,255,0.06);
      --muted-text: #888888;
      --code-bg: rgba(255, 255, 255, 0.1);
      --code-text: #d4d4d4;
    }

    /* Light Mode explicitly */
    html[data-theme="light"] {
      --bg-color: #ffffff;
      --text-color: #24292e;
      --card-bg: transparent;
      --border-color: #e1e4e8;
      --header-bg: #f6f8fa;
      --table-header-bg: #f1f3f5;
      --table-alt-row: #fafbfc;
      --accent-color: #24292e;
      --tag-bg: rgba(0,0,0,0.04);
      --muted-text: #586069;
      --code-bg: rgba(0, 0, 0, 0.05);
      --code-text: #24292e;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      margin: 0;
      padding: 24px;
      line-height: 1.6;
      overflow-x: auto;
      min-width: max-content;
      box-sizing: border-box;
    }

    .table-container {
      width: 100%;
      margin-top: 12px;
    }

    h1, h2, h3, h4 {
      color: var(--text-color);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
      margin-top: 32px;
    }

    .doc-header {
      margin-bottom: 24px;
    }

    .doc-title {
      font-size: 26px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-color);
      border-bottom: 2px solid var(--border-color);
    }

    code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      background-color: var(--code-bg);
      color: var(--code-text);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 85%;
    }

    .group-divider {
      border: 0;
      height: 3px;
      background-color: var(--text-color);
      margin: 40px 0 20px 0;
      opacity: 0.8;
    }

    .table-divider {
      border: 0;
      height: 1px;
      background-color: var(--border-color);
      margin: 28px 0;
    }

    .group-wrapper {
      margin-bottom: 32px;
      background-color: transparent;
    }

    .group-header {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-color);
      padding-bottom: 8px;
    }

    .card {
      background-color: var(--card-bg);
      padding: 10px 0;
      margin-bottom: 24px;
    }

    .table-title {
      font-size: 22px;
      font-weight: 600;
      margin-top: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .color-swatch {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: inline-block;
      border: 1px solid rgba(255,255,255,0.3);
    }

    .badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-pk { background-color: #d9534f; color: #fff; }
    .badge-nn { background-color: #f0ad4e; color: #000; }
    .badge-uk { background-color: #5bc0de; color: #fff; }
    .badge-inc { background-color: #5cb85c; color: #fff; }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
      background: rgba(0,0,0,0.08);
      padding: 12px;
      border-radius: 6px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-key {
      font-size: 11px;
      color: var(--muted-text);
      text-transform: uppercase;
      font-weight: 600;
    }

    .meta-val {
      font-size: 14px;
      font-weight: 500;
      word-break: break-all;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 13px;
    }

    table.data-table.external-table {
      border: 2px dotted var(--border-color);
    }

    table.data-table.external-table th, table.data-table.external-table td {
      border: 1px dotted var(--border-color);
    }

    table.data-table th, table.data-table td {
      border: 1px solid var(--border-color);
      padding: 10px 12px;
      text-align: left;
    }

    table.data-table th {
      background-color: var(--table-header-bg);
      font-weight: 600;
    }

    table.data-table tr:nth-child(even) {
      background-color: var(--table-alt-row);
    }

    .mermaid-container {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 24px;
      overflow-x: auto;
      text-align: center;
    }

    .index-notes-box {
      margin-top: 12px;
      padding: 10px 14px;
      background: rgba(0,0,0,0.05);
      border-left: 4px solid var(--accent-color);
      border-radius: 4px;
      font-size: 12px;
    }

    /* Print / PDF Styles */
    @page {
      size: ${escapeHtml(pageSize)} ${escapeHtml(orientation)};
      margin: 12mm;
    }

    @media print {
      body {
        background-color: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
        min-width: 100% !important;
      }
      .no-print {
        display: none !important;
      }
      .card {
        page-break-inside: avoid;
      }
      .mermaid-container {
        page-break-inside: avoid;
      }
      table.data-table th, table.data-table td {
        border-color: #cccccc !important;
      }
    }

    .export-pdf-toolbar {
      position: fixed;
      top: 12px;
      right: 20px;
      z-index: 9999;
    }

    .export-pdf-btn {
      background-color: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      transition: opacity 0.2s;
    }

    .export-pdf-btn:hover {
      opacity: 0.9;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener("DOMContentLoaded", function() {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light' || 
        (document.documentElement.getAttribute('data-theme') === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
      mermaid.initialize({
        startOnLoad: true,
        theme: isLight ? 'default' : 'dark',
        securityLevel: 'loose'
      });
    });

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'triggerPrint') {
        window.print();
      }
    });

    function requestExportPdf() {
      window.print();
    }
  </script>
</head>
<body>

  <div class="export-pdf-toolbar no-print">
    <button class="export-pdf-btn" onclick="requestExportPdf()">${escapeHtml(t.exportPdfBtn)}</button>
  </div>

  <div class="doc-header">
    <div class="doc-title">📋 ${t.docTitle}: ${escapeHtml(title)}</div>
    ${parsed.projectName ? `<div><strong>${t.projectName}:</strong> ${escapeHtml(parsed.projectName)}</div>` : ''}
    ${parsed.projectNote ? `<div><strong>${t.overview}:</strong> ${escapeHtml(parsed.projectNote)}</div>` : ''}
  </div>

  <!-- 1. テーブル定義 -->
  <section id="section-table-def">
    <h2>${t.sectionTableDef}</h2>
    ${renderTableDefinitionsGrouped(parsed, customMetaKeys, t)}
  </section>

  <!-- Enums (Enum定義) -->
  ${parsed.enums && parsed.enums.length > 0 ? `
  <section id="section-enum-def">
    <h2>${t.sectionEnumDef}</h2>
    ${renderEnumCards(parsed.enums, t)}
  </section>
  ` : ''}

  <!-- 2. ER図 (Mermaid) -->
  ${mermaidDiagram && !mermaidDiagram.startsWith('%%') ? `
  <section id="section-er-diagram">
    <h2>${t.sectionErDiagram}</h2>
    <div class="mermaid-container">
      <pre class="mermaid">
${mermaidDiagram}
      </pre>
    </div>
    <details style="margin-top: 12px; text-align: left;">
      <summary style="cursor: pointer; color: var(--accent-color); font-weight: bold;">${t.debugMermaidShow}</summary>
      <textarea readonly style="width: 100%; height: 160px; margin-top: 8px; font-family: monospace; background: var(--card-bg); color: var(--text-color); border: 1px solid var(--border-color); padding: 8px; border-radius: 4px;">${escapeHtml(mermaidDiagram)}</textarea>
    </details>
  </section>
  ` : ''}

  <!-- 3. Sticky Notes -->
  ${parsed.stickyNotes.length > 0 ? `
  <section id="section-sticky-notes">
    <h2>${t.sectionStickyNotes}</h2>
    ${parsed.stickyNotes.map(sn => renderStickyNoteCard(sn)).join('')}
  </section>
  ` : ''}

</body>
</html>`;
}

function renderTableDefinitionsGrouped(parsed: ParsedDbml, globalCustomMetaKeys: string[], t: Translations): string {
  // Group tables by groupName
  const grouped: Record<string, TableMeta[]> = {};
  const ungrouped: TableMeta[] = [];

  for (const table of parsed.tables) {
    if (table.groupName) {
      if (!grouped[table.groupName]) grouped[table.groupName] = [];
      grouped[table.groupName].push(table);
    } else {
      ungrouped.push(table);
    }
  }

  let html = '';

  // Render grouped tables first
  const groupEntries = Object.entries(grouped);
  for (let i = 0; i < groupEntries.length; i++) {
    const [groupName, tables] = groupEntries[i];
    const tg = parsed.tableGroups.find((g) => g.name === groupName);
    html += `
    <div class="group-wrapper">
      <hr class="group-divider" />
      <div class="group-header">
        ${tg && tg.color ? `<span class="color-swatch" style="background-color: ${escapeHtml(tg.color)}"></span>` : ''}
        <span>${escapeHtml(groupName)}</span>
        ${tg && tg.note ? `<div style="font-size: 14px; font-weight: normal; color: var(--muted-text); margin-top: 4px;">${escapeHtml(tg.note)}</div>` : ''}
      </div>
      ${tables.map((table) => renderTableDefinitionCard(table, parsed, globalCustomMetaKeys, t)).join('<hr class="table-divider" />')}
    </div>
    `;
  }

  // Render ungrouped tables
  if (ungrouped.length > 0) {
    if (groupEntries.length > 0) {
      html += '<hr class="group-divider" />';
    }
    html += ungrouped.map((table) => renderTableDefinitionCard(table, parsed, globalCustomMetaKeys, t)).join('<hr class="table-divider" />');
  }

  return html;
}

function renderTableDefinitionCard(table: TableMeta, parsed: ParsedDbml, globalCustomMetaKeys: string[], t: Translations): string {
  const indexNotesList: { name: string; note: string }[] = [];
  for (const idx of table.indexes) {
    if (idx.note) {
      const displayName = idx.name ? idx.name : idx.columns.join(', ');
      indexNotesList.push({ name: displayName, note: idx.note });
    }
  }

  // Find all Ref relationships involving this table
  const tableRefs = parsed.refs.filter((r) =>
    r.endpoints.some((ep) => ep.tableName === table.name)
  );

  // Get index list for this table in order of appearance
  const tableIndexes = table.indexes.map((idx) => ({
    name: idx.name ? idx.name : idx.columns.join(', '),
    columns: idx.columns
  }));

  // Build a map of column -> list of ref targets for display in column table 'ref' column
  const columnRefDisplayMap = new Map<string, string[]>(); // key: `${tableName}.${colName}` -> array of ref strings
  for (const ref of parsed.refs) {
    if (ref.endpoints.length === 2) {
      const [ep1, ep2] = ref.endpoints;
      if (ep1.tableName && ep1.fieldNames && ep2.tableName && ep2.fieldNames) {
        for (let i = 0; i < Math.min(ep1.fieldNames.length, ep2.fieldNames.length); i++) {
          const f1 = ep1.fieldNames[i];
          const f2 = ep2.fieldNames[i];

          const key1 = `${ep1.tableName}.${f1}`;
          const target1 = `${ep2.relation} ${ep2.tableName}.${f2}`;
          if (!columnRefDisplayMap.has(key1)) columnRefDisplayMap.set(key1, []);
          columnRefDisplayMap.get(key1)!.push(target1);

          const key2 = `${ep2.tableName}.${f2}`;
          const target2 = `${ep1.relation} ${ep1.tableName}.${f1}`;
          if (!columnRefDisplayMap.has(key2)) columnRefDisplayMap.set(key2, []);
          columnRefDisplayMap.get(key2)!.push(target2);
        }
      }
    }
  }

  // Filter meta keys (excluding ref) to only those actually used in THIS table, sorted alphabetically
  let tableCustomMetaKeys = globalCustomMetaKeys.filter(
    (key) => key !== 'ref' && table.columns.some((col) => col.metadata[key] && String(col.metadata[key]).trim() !== '')
  );

  // Check if description meta exists in THIS table
  const hasDescription = table.columns.some(
    (col) => col.metadata['description'] && String(col.metadata['description']).trim() !== ''
  );

  // Build meta columns list (description first if exists, then sorted custom meta keys alphabetically)
  const allDynamicMetaColumns: string[] = [];
  if (hasDescription) {
    allDynamicMetaColumns.push('description');
  }
  tableCustomMetaKeys = Array.from(new Set(tableCustomMetaKeys)).sort((a, b) => a.localeCompare(b));
  for (const k of tableCustomMetaKeys) {
    if (!allDynamicMetaColumns.includes(k)) {
      allDynamicMetaColumns.push(k);
    }
  }

  const indexCount = tableIndexes.length;
  const remarksCount = allDynamicMetaColumns.length;

  return `
  <div class="card" id="table-def-${escapeHtml(table.name)}">
    <div class="table-title">
      ${table.headerColor ? `<span class="color-swatch" style="background-color: ${escapeHtml(table.headerColor)}"></span>` : ''}
      <span>${escapeHtml(table.name)}</span>
      ${table.alias ? `<span style="font-size: 14px; color: var(--muted-text);">(${escapeHtml(table.alias)})</span>` : ''}
    </div>

    ${table.note ? `<div style="font-size: 14px; margin-top: 4px; margin-bottom: 12px; color: var(--text-color);">${escapeHtml(table.note)}</div>` : ''}

    ${(() => {
      const tableMeta = { ...table.rawSettings, ...table.metadata };
      if (table.schema) tableMeta['schema'] = table.schema;
      const entries = Object.entries(tableMeta);
      if (entries.length === 0) return '';
      return `
      <div class="meta-grid" style="margin-bottom: 16px;">
        ${entries.map(([k, v]) => `
          <div class="meta-item">
            <span class="meta-key">${escapeHtml(k)}</span>
            <span class="meta-val">${escapeHtml(v)}</span>
          </div>
        `).join('')}
      </div>
      `;
    })()}

    <div class="table-container">
      <table class="data-table">
        <thead>
          ${indexCount > 0 || remarksCount > 0 ? `
          <tr>
            <th rowspan="2" style="width: 40px; text-align: center; vertical-align: middle;">${t.no}</th>
            <th rowspan="2" style="vertical-align: middle;">${t.physicalColName}</th>
            <th rowspan="2" style="vertical-align: middle;">${t.note}</th>
            <th rowspan="2" style="vertical-align: middle;">${t.dataType}</th>
            <th rowspan="2" style="vertical-align: middle;">${t.constraints}</th>
            <th rowspan="2" style="vertical-align: middle;">${t.defaultVal}</th>
            <th rowspan="2" style="vertical-align: middle;">${t.ref}</th>
            ${indexCount > 0 ? `<th colspan="${indexCount}" style="text-align: center;">${t.indexesHeader}</th>` : ''}
            ${remarksCount > 0 ? `<th colspan="${remarksCount}" style="text-align: center;">${t.remarksHeader}</th>` : ''}
          </tr>
          <tr>
            ${tableIndexes.map(idx => `<th style="font-size: 12px; text-align: center;">${escapeHtml(idx.name)}</th>`).join('')}
            ${allDynamicMetaColumns.map(k => `<th style="font-size: 12px; text-align: center;">${escapeHtml(k)}</th>`).join('')}
          </tr>
          ` : `
          <tr>
            <th style="width: 40px;">${t.no}</th>
            <th>${t.physicalColName}</th>
            <th>${t.note}</th>
            <th>${t.dataType}</th>
            <th>${t.constraints}</th>
            <th>${t.defaultVal}</th>
            <th>${t.ref}</th>
          </tr>
          `}
        </thead>
        <tbody>
          ${table.columns
            .map((col, idx) => {
              const explicitRef = col.metadata['ref'];
              const key = `${table.name}.${col.name}`;
              const parsedRefs = columnRefDisplayMap.get(key);
              let refDisplay = '-';

              if (explicitRef) {
                refDisplay = explicitRef;
              } else if (parsedRefs && parsedRefs.length > 0) {
                refDisplay = parsedRefs.join(', ');
              }

              return `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${escapeHtml(col.name)}</strong></td>
                <td>${escapeHtml(col.note || '-')}</td>
                <td><code>${escapeHtml(col.type)}</code></td>
                <td>
                  ${col.pk ? '<span class="badge badge-pk">PK</span> ' : ''}
                  ${col.notNull ? '<span class="badge badge-nn">NOT NULL</span> ' : ''}
                  ${col.unique ? '<span class="badge badge-uk">UNIQUE</span> ' : ''}
                  ${col.increment ? '<span class="badge badge-inc">AUTOINC</span> ' : ''}
                </td>
                <td>${col.dbDefault ? `<code>${escapeHtml(col.dbDefault)}</code>` : '-'}</td>
                <td>${refDisplay !== '-' ? `<code>${escapeHtml(refDisplay)}</code>` : '-'}</td>
                ${tableIndexes.map(indexObj => {
                  const isInIndex = indexObj.columns.includes(col.name);
                  return `<td style="text-align: center;">${isInIndex ? '✓' : '-'}</td>`;
                }).join('')}
                ${allDynamicMetaColumns.map((k) => `<td>${escapeHtml(col.metadata[k] || '-')}</td>`).join('')}
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    ${indexNotesList.length > 0 ? `
    <div class="index-notes-box">
      <strong>${t.indexNotesHeading}</strong>
      <ul style="margin: 4px 0 0 18px; padding: 0;">
        ${indexNotesList.map(inote => `<li><strong>${escapeHtml(inote.name)}</strong>: ${escapeHtml(inote.note)}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${tableRefs.length > 0 ? `
    <div class="index-notes-box" style="border-left-color: var(--tag-bg); margin-top: 12px;">
      <strong>${t.relationDefHeading}</strong>
      <ul style="margin: 4px 0 0 18px; padding: 0;">
        ${tableRefs.map(r => {
          const ep1 = r.endpoints[0];
          const ep2 = r.endpoints[1];
          const desc = `${ep1.tableName}.${ep1.fieldNames.join(',')} ${ep1.relation}--${ep2.relation} ${ep2.tableName}.${ep2.fieldNames.join(',')}`;
          return `<li><code>${escapeHtml(desc)}</code>${r.note ? ` - ${escapeHtml(r.note)}` : ''}</li>`;
        }).join('')}
      </ul>
    </div>
    ` : ''}
  </div>
  `;
}

function renderEnumCards(enums: EnumMeta[], t: Translations): string {
  return enums
    .map(
      (e) => `
  <div class="card" id="enum-def-${escapeHtml(e.name)}">
    <div class="table-title">
      <span>Enum: ${escapeHtml(e.name)}</span>
      ${e.schema ? `<span style="font-size: 14px; color: var(--muted-text);">(${t.schema}: ${escapeHtml(e.schema)})</span>` : ''}
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">${t.no}</th>
            <th>${t.enumValueName}</th>
            <th>${t.note}</th>
          </tr>
        </thead>
        <tbody>
          ${e.values
            .map(
              (v, idx) => `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td><code>${escapeHtml(v.name)}</code></td>
              <td>${escapeHtml(v.note || '-')}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </div>
  `
    )
    .join('');
}

function renderStickyNoteCard(sn: StickyNoteMeta): string {
  return `
  <div class="card" style="border: 1px solid var(--border-color); border-left: 6px solid ${escapeHtml(sn.color || '#F4D03F')}; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
    <div class="table-title">
      <span>Sticky Note: ${escapeHtml(sn.name || 'Note')}</span>
    </div>
    <p style="white-space: pre-wrap;">${escapeHtml(sn.content)}</p>
    ${Object.keys(sn.metadata).length > 0 ? `
      <div><strong>Meta:</strong> ${Object.entries(sn.metadata).map(([k,v]) => `<span style="display:inline-block; background: var(--tag-bg); padding:2px 6px; border-radius:4px; font-size:11px; margin-right:4px;">${escapeHtml(k)}: ${escapeHtml(v)}</span>`).join('')}</div>
    ` : ''}
  </div>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
