export interface TableViewColumnPreference {
  columnId: string
  visible: boolean
}

export interface TableViewDefinition {
  id: string
  name: string
  columnOrder: string[]
  columns: TableViewColumnPreference[]
}

export interface TableViewPreference {
  tableId: string
  activeViewId: string | null
  views: TableViewDefinition[]
}
