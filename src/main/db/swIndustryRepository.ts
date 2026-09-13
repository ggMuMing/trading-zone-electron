import type {
  SwIndustryBreadcrumb,
  SwIndustryLevel,
  SwIndustryMemberRow,
  SwIndustryNode
} from '../../shared/types/swIndustry'
import { getDb } from './sqlite'

const TREE_SELECT = `
  SELECT index_code, industry_code, parent_code, level, name, is_pub, src
  FROM sw_industry
`

function isLevel(value: string): value is SwIndustryLevel {
  return value === 'L1' || value === 'L2' || value === 'L3'
}

function mapNode(row: {
  index_code: string
  industry_code: string
  parent_code: string
  level: string
  name: string
  is_pub: string | null
  src: string
}): SwIndustryNode | null {
  if (!isLevel(row.level)) {
    return null
  }
  return {
    index_code: row.index_code,
    industry_code: row.industry_code,
    parent_code: row.parent_code,
    level: row.level,
    name: row.name,
    is_pub: row.is_pub,
    src: row.src
  }
}

export const swIndustryRepository = {
  replaceTree(rows: SwIndustryNode[], syncedAt = new Date().toISOString()): number {
    const db = getDb()
    const insert = db.prepare(`
      INSERT INTO sw_industry (
        index_code, industry_code, parent_code, level, name, is_pub, src, synced_at
      ) VALUES (
        @index_code, @industry_code, @parent_code, @level, @name, @is_pub, @src, @synced_at
      )
    `)
    const replace = db.transaction((items: SwIndustryNode[]) => {
      db.prepare('DELETE FROM sw_industry').run()
      for (const row of items) {
        if (!isLevel(row.level)) {
          continue
        }
        insert.run({
          index_code: row.index_code,
          industry_code: row.industry_code,
          parent_code: row.parent_code,
          level: row.level,
          name: row.name,
          is_pub: row.is_pub,
          src: row.src ?? 'SW2021',
          synced_at: syncedAt
        })
      }
      return items.length
    })
    return replace(rows)
  },

  replaceMembers(
    rows: SwIndustryMemberRow[],
    syncedAt = new Date().toISOString()
  ): { member_count: number; skipped_not_in_stocks: number } {
    const db = getDb()
    const listed = new Set(
      (db.prepare('SELECT ts_code FROM stocks').all() as Array<{ ts_code: string }>).map(
        (row) => row.ts_code
      )
    )
    const kept: SwIndustryMemberRow[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      if (!listed.has(row.ts_code) || seen.has(row.ts_code)) {
        continue
      }
      seen.add(row.ts_code)
      kept.push(row)
    }

    const insert = db.prepare(`
      INSERT INTO sw_industry_member (ts_code, l1_code, l2_code, l3_code, in_date, synced_at)
      VALUES (@ts_code, @l1_code, @l2_code, @l3_code, @in_date, @synced_at)
    `)
    const replace = db.transaction((items: SwIndustryMemberRow[]) => {
      db.prepare('DELETE FROM sw_industry_member').run()
      for (const row of items) {
        insert.run({
          ts_code: row.ts_code,
          l1_code: row.l1_code,
          l2_code: row.l2_code,
          l3_code: row.l3_code,
          in_date: row.in_date,
          synced_at: syncedAt
        })
      }
    })
    replace(kept)
    return {
      member_count: kept.length,
      skipped_not_in_stocks: rows.length - kept.length
    }
  },

  listTree(): SwIndustryNode[] {
    const rows = getDb().prepare(`${TREE_SELECT} ORDER BY industry_code`).all() as Array<{
      index_code: string
      industry_code: string
      parent_code: string
      level: string
      name: string
      is_pub: string | null
      src: string
    }>
    return rows.map(mapNode).filter((row): row is SwIndustryNode => row !== null)
  },

  listChildren(parentIndustryCode: string): SwIndustryNode[] {
    const rows = getDb()
      .prepare(`${TREE_SELECT} WHERE parent_code = ? ORDER BY industry_code`)
      .all(parentIndustryCode) as Array<{
      index_code: string
      industry_code: string
      parent_code: string
      level: string
      name: string
      is_pub: string | null
      src: string
    }>
    return rows.map(mapNode).filter((row): row is SwIndustryNode => row !== null)
  },

  listMemberCodes(indexCode: string): string[] {
    const node = getDb()
      .prepare(`SELECT level FROM sw_industry WHERE index_code = ?`)
      .get(indexCode) as { level: string } | undefined
    if (!node || !isLevel(node.level)) {
      return []
    }
    const column = node.level === 'L1' ? 'l1_code' : node.level === 'L2' ? 'l2_code' : 'l3_code'
    const rows = getDb()
      .prepare(
        `SELECT s.ts_code
         FROM sw_industry_member m
         JOIN stocks s ON s.ts_code = m.ts_code
         WHERE m.${column} = ?
         ORDER BY s.ts_code`
      )
      .all(indexCode) as Array<{ ts_code: string }>
    return rows.map((row) => row.ts_code)
  },

  getBreadcrumb(tsCode: string): SwIndustryBreadcrumb | null {
    const row = getDb()
      .prepare(
        `SELECT
            m.ts_code,
            l1.index_code AS l1_code, l1.name AS l1_name,
            l2.index_code AS l2_code, l2.name AS l2_name,
            l3.index_code AS l3_code, l3.name AS l3_name
         FROM sw_industry_member m
         JOIN sw_industry l1 ON l1.index_code = m.l1_code
         JOIN sw_industry l2 ON l2.index_code = m.l2_code
         JOIN sw_industry l3 ON l3.index_code = m.l3_code
         WHERE m.ts_code = ?`
      )
      .get(tsCode) as
      | {
          ts_code: string
          l1_code: string
          l1_name: string
          l2_code: string
          l2_name: string
          l3_code: string
          l3_name: string
        }
      | undefined
    if (!row) {
      return null
    }
    return {
      ts_code: row.ts_code,
      l1: { index_code: row.l1_code, name: row.l1_name },
      l2: { index_code: row.l2_code, name: row.l2_name },
      l3: { index_code: row.l3_code, name: row.l3_name }
    }
  }
}
