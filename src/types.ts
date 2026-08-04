export interface ColumnMeta {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
  unique: boolean;
  increment: boolean;
  dbDefault?: string;
  note?: string;
  indexName?: string;
  indexNote?: string;
  metadata: Record<string, string>;
  rawSettings: Record<string, string>;
}

export interface IndexMeta {
  columns: string[];
  name?: string;
  unique?: boolean;
  type?: string;
  pk?: boolean;
  note?: string;
  rawSettings: Record<string, string>;
}

export interface TableMeta {
  name: string;
  schema?: string;
  alias?: string;
  note?: string;
  headerColor?: string;
  groupName?: string;
  groupColor?: string;
  groupNote?: string;
  groupMetadata?: Record<string, string>;
  metadata: Record<string, string>;
  rawSettings: Record<string, string>;
  columns: ColumnMeta[];
  indexes: IndexMeta[];
}

export interface RefEndpoint {
  tableName: string;
  schemaName?: string;
  fieldNames: string[];
  relation: string; // '1' | '*'
}

export interface RefMeta {
  name?: string;
  endpoints: [RefEndpoint, RefEndpoint];
  color?: string;
  inactive?: boolean;
  note?: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface TableGroupMeta {
  name: string;
  tables: string[];
  color?: string;
  note?: string;
  metadata: Record<string, string>;
}

export interface StickyNoteMeta {
  name?: string;
  content: string;
  color?: string;
  metadata: Record<string, string>;
}

export interface DiagramViewMeta {
  name: string;
  tables: string[];
  notes: string[];
  tableGroups: string[];
  schemas: string[];
}

export interface EnumValueMeta {
  name: string;
  note?: string;
}

export interface EnumMeta {
  name: string;
  schema?: string;
  values: EnumValueMeta[];
}

export interface ParsedDbml {
  projectName?: string;
  projectNote?: string;
  tables: TableMeta[];
  refs: RefMeta[];
  enums: EnumMeta[];
  tableGroups: TableGroupMeta[];
  stickyNotes: StickyNoteMeta[];
  diagramViews: DiagramViewMeta[];
  tablePartials: Record<string, ColumnMeta[]>;
}
