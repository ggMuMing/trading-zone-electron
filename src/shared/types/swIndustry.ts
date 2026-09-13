export type SwIndustryLevel = 'L1' | 'L2' | 'L3'

export interface SwIndustryNode {
  index_code: string
  industry_code: string
  parent_code: string
  level: SwIndustryLevel
  name: string
  is_pub: string | null
  src?: string
}

export interface SwIndustryMemberRow {
  ts_code: string
  l1_code: string
  l2_code: string
  l3_code: string
  in_date: string | null
}

export interface SwIndustryBreadcrumbLevel {
  index_code: string
  name: string
}

export interface SwIndustryBreadcrumb {
  ts_code: string
  l1: SwIndustryBreadcrumbLevel
  l2: SwIndustryBreadcrumbLevel
  l3: SwIndustryBreadcrumbLevel
}

export interface SwIndustryMembersResult {
  index_code: string
  con_codes: string[]
}

export interface SwIndustrySyncResult {
  classify_count: number
  member_fetched: number
  member_count: number
  skipped_not_in_stocks: number
  errors: string[]
}

export interface SwIndustryWorkerResult {
  classify: SwIndustryNode[]
  members: SwIndustryMemberRow[]
  errors: string[]
}
