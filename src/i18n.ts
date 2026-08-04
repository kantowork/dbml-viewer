export type Language = 'en' | 'ja' | 'auto';

export interface Translations {
  docTitle: string;
  projectName: string;
  overview: string;
  sectionTableDef: string;
  sectionEnumDef: string;
  sectionErDiagram: string;
  sectionStickyNotes: string;
  tableGroup: string;
  columnDef: string;
  no: string;
  physicalColName: string;
  note: string;
  dataType: string;
  constraints: string;
  defaultVal: string;
  ref: string;
  indexesHeader: string;
  remarksHeader: string;
  indexNotesHeading: string;
  relationDefHeading: string;
  enumValueName: string;
  schema: string;
  debugMermaidShow: string;
  exportPdfBtn: string;
}

export const translations: Record<'en' | 'ja', Translations> = {
  ja: {
    docTitle: 'DBML Viewer',
    projectName: 'プロジェクト名',
    overview: '概要',
    sectionTableDef: 'テーブル定義',
    sectionEnumDef: 'Enum 定義',
    sectionErDiagram: 'ER図',
    sectionStickyNotes: 'Sticky Notes',
    tableGroup: 'TableGroup',
    columnDef: 'カラム定義',
    no: 'No',
    physicalColName: 'Name',
    note: 'Note',
    dataType: 'Type',
    constraints: 'Constraints',
    defaultVal: 'Default',
    ref: 'Ref',
    indexesHeader: 'index(es)',
    remarksHeader: 'Remarks',
    indexNotesHeading: '【Index 補足説明】',
    relationDefHeading: 'Relationship (Ref) Definitions',
    enumValueName: 'Value Name',
    schema: 'schema',
    debugMermaidShow: 'Show Mermaid',
    exportPdfBtn: '📄 PDFで出力'
  },
  en: {
    docTitle: 'DBML Viewer',
    projectName: 'Project Name',
    overview: 'Overview',
    sectionTableDef: 'Table Definitions',
    sectionEnumDef: 'Enum Definitions',
    sectionErDiagram: 'ER Diagram',
    sectionStickyNotes: 'Sticky Notes',
    tableGroup: 'TableGroup',
    columnDef: 'Column Definitions',
    no: 'No.',
    physicalColName: 'Name',
    note: 'Note',
    dataType: 'Type',
    constraints: 'Constraints',
    defaultVal: 'Default',
    ref: 'Ref',
    indexesHeader: 'Index(es)',
    remarksHeader: 'Remarks',
    indexNotesHeading: '[Index Notes]',
    relationDefHeading: 'Relationship (Ref) Definitions',
    enumValueName: 'Value Name',
    schema: 'Schema',
    debugMermaidShow: 'Show Mermaid',
    exportPdfBtn: '📄 Export PDF'
  }
};

export function getTranslations(langSetting: string = 'auto'): Translations {
  if (langSetting === 'en') {
    return translations.en;
  }
  if (langSetting === 'ja') {
    return translations.ja;
  }

  // Auto detect from VS Code environment (default)
  const envLang = process.env.VSCODE_NLS_CONFIG ? JSON.parse(process.env.VSCODE_NLS_CONFIG).locale : 'en';
  if (envLang && envLang.toLowerCase().startsWith('ja')) {
    return translations.ja;
  }

  return translations.en;
}
