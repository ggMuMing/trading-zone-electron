/** 分组分类、分组、成员。名称只用于显示，身份是 id。 */

export const SYMBOL_GROUP_NAME_MAX = 40

export const RESERVED_CATEGORY_NAMES = ['未分类', '指数行情', '成分股', '行业'] as const

export interface SymbolRef {
  tsCode: string
  name: string
}

export interface SymbolGroupSummary {
  id: string
  categoryId: string | null
  name: string
  memberCount: number
}

export interface SymbolGroupCategorySummary {
  id: string
  name: string
  isDefault: boolean
  groups: SymbolGroupSummary[]
}

export interface SymbolGroupTree {
  categories: SymbolGroupCategorySummary[]
  uncategorized: SymbolGroupSummary[]
  defaultCategoryId: string | null
}

export interface SymbolGroupMember {
  tsCode: string
  name: string
}

export interface SaveSymbolGroupHitsParams {
  name: string
  categoryId: string | null
  symbols: SymbolRef[]
  makeDefault: boolean
}

export interface SaveSymbolGroupHitsResult {
  id: string
  name: string
  categoryId: string | null
}
