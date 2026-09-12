export interface IndexWeightSyncResult {
  updated_count: number
  skipped_count: number
  empty_count: number
  as_of_dates: Record<string, string>
  errors: string[]
}

export interface IndexConstituentsResult {
  index_code: string
  as_of: string | null
  con_codes: string[]
}
