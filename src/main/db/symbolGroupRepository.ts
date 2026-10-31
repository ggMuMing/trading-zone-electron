import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  allocateUniqueGroupName,
  assertSymbolGroupName,
  readSymbolRefs
} from '../../shared/symbolGroup/symbolGroup'
import type {
  SaveSymbolGroupHitsParams,
  SaveSymbolGroupHitsResult,
  SymbolGroupCategorySummary,
  SymbolGroupMember,
  SymbolGroupSummary,
  SymbolGroupTree,
  SymbolRef
} from '../../shared/types/symbolGroup'
import { getDb } from './sqlite'

interface CategoryRow {
  id: string
  name: string
  is_default: number
  sort_order: number
}

interface GroupRow {
  id: string
  category_id: string | null
  name: string
  member_count: number
}

function nowIso(): string {
  return new Date().toISOString()
}

function nextId(): string {
  return randomUUID().replaceAll('-', '')
}

function categoryExists(database: Database.Database, id: string): boolean {
  const row = database.prepare(`SELECT id FROM symbol_group_category WHERE id = ?`).get(id) as
    | { id: string }
    | undefined
  return Boolean(row)
}

function groupExists(database: Database.Database, id: string): boolean {
  const row = database.prepare(`SELECT id FROM symbol_group WHERE id = ?`).get(id) as
    | { id: string }
    | undefined
  return Boolean(row)
}

function assertCategory(database: Database.Database, id: string): void {
  if (!categoryExists(database, id)) {
    throw new Error('分类不存在')
  }
}

function assertGroup(database: Database.Database, id: string): void {
  if (!groupExists(database, id)) {
    throw new Error('分组不存在')
  }
}

function categoryNameTaken(database: Database.Database, name: string, exceptId?: string): boolean {
  const row = database
    .prepare(
      `SELECT id FROM symbol_group_category
       WHERE name = ? AND id != ?
       LIMIT 1`
    )
    .get(name, exceptId ?? '') as { id: string } | undefined
  return Boolean(row)
}

function groupNameTaken(
  database: Database.Database,
  categoryId: string | null,
  name: string,
  exceptId?: string
): boolean {
  const row = database
    .prepare(
      `SELECT id FROM symbol_group
       WHERE name = ?
         AND ((? IS NULL AND category_id IS NULL) OR category_id = ?)
         AND id != ?
       LIMIT 1`
    )
    .get(name, categoryId, categoryId, exceptId ?? '') as { id: string } | undefined
  return Boolean(row)
}

function namesInBucket(database: Database.Database, categoryId: string | null): Set<string> {
  const rows = database
    .prepare(
      `SELECT name FROM symbol_group
       WHERE (? IS NULL AND category_id IS NULL) OR category_id = ?`
    )
    .all(categoryId, categoryId) as Array<{ name: string }>
  return new Set(rows.map((row) => row.name))
}

function nextCategorySort(database: Database.Database): number {
  const row = database
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS value FROM symbol_group_category`)
    .get() as { value: number }
  return row.value + 1
}

function nextGroupSort(database: Database.Database, categoryId: string | null): number {
  const row = database
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS value FROM symbol_group
       WHERE (? IS NULL AND category_id IS NULL) OR category_id = ?`
    )
    .get(categoryId, categoryId) as { value: number }
  return row.value + 1
}

function nextMemberSort(database: Database.Database, groupId: string): number {
  const row = database
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS value FROM symbol_group_member WHERE group_id = ?`
    )
    .get(groupId) as { value: number }
  return row.value + 1
}

function clearDefault(database: Database.Database): void {
  database.prepare(`UPDATE symbol_group_category SET is_default = 0 WHERE is_default = 1`).run()
}

function mapGroup(row: GroupRow): SymbolGroupSummary {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    memberCount: row.member_count
  }
}

export const symbolGroupRepository = {
  tree(): SymbolGroupTree {
    const database = getDb()
    const categories = database
      .prepare(
        `SELECT id, name, is_default, sort_order
         FROM symbol_group_category
         ORDER BY sort_order, name`
      )
      .all() as CategoryRow[]
    const groups = database
      .prepare(
        `SELECT g.id, g.category_id, g.name,
                (SELECT COUNT(*) FROM symbol_group_member m WHERE m.group_id = g.id) AS member_count
         FROM symbol_group g
         ORDER BY g.sort_order, g.name`
      )
      .all() as GroupRow[]
    const byCategory = new Map<string, SymbolGroupSummary[]>()
    const uncategorized: SymbolGroupSummary[] = []
    for (const row of groups) {
      const group = mapGroup(row)
      if (!group.categoryId) {
        uncategorized.push(group)
        continue
      }
      const list = byCategory.get(group.categoryId) ?? []
      list.push(group)
      byCategory.set(group.categoryId, list)
    }
    const categoryNodes: SymbolGroupCategorySummary[] = categories.map((row) => ({
      id: row.id,
      name: row.name,
      isDefault: row.is_default === 1,
      groups: byCategory.get(row.id) ?? []
    }))
    const defaultCategory = categoryNodes.find((item) => item.isDefault) ?? null
    return {
      categories: categoryNodes,
      uncategorized,
      defaultCategoryId: defaultCategory?.id ?? null
    }
  },

  createCategory(name: string): { id: string; name: string } {
    const trimmed = assertSymbolGroupName(name, 'category')
    const database = getDb()
    if (categoryNameTaken(database, trimmed)) {
      throw new Error('分类名称已存在')
    }
    const id = nextId()
    const timestamp = nowIso()
    database
      .prepare(
        `INSERT INTO symbol_group_category (id, name, is_default, sort_order, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?, ?)`
      )
      .run(id, trimmed, nextCategorySort(database), timestamp, timestamp)
    return { id, name: trimmed }
  },

  renameCategory(id: string, name: string): { id: string; name: string } {
    const trimmed = assertSymbolGroupName(name, 'category')
    const database = getDb()
    assertCategory(database, id)
    if (categoryNameTaken(database, trimmed, id)) {
      throw new Error('分类名称已存在')
    }
    database
      .prepare(`UPDATE symbol_group_category SET name = ?, updated_at = ? WHERE id = ?`)
      .run(trimmed, nowIso(), id)
    return { id, name: trimmed }
  },

  deleteCategory(id: string): void {
    const database = getDb()
    const remove = database.transaction(() => {
      assertCategory(database, id)
      const groups = database
        .prepare(`SELECT id, name FROM symbol_group WHERE category_id = ? ORDER BY sort_order, name`)
        .all(id) as Array<{ id: string; name: string }>
      const taken = namesInBucket(database, null)
      const timestamp = nowIso()
      for (const group of groups) {
        const nextName = allocateUniqueGroupName(group.name, taken)
        taken.add(nextName)
        database
          .prepare(
            `UPDATE symbol_group
             SET category_id = NULL, name = ?, updated_at = ?
             WHERE id = ?`
          )
          .run(nextName, timestamp, group.id)
      }
      database.prepare(`DELETE FROM symbol_group_category WHERE id = ?`).run(id)
    })
    remove()
  },

  createGroup(categoryId: string | null, name: string): { id: string; categoryId: string | null; name: string } {
    const trimmed = assertSymbolGroupName(name, 'group')
    const database = getDb()
    if (categoryId) {
      assertCategory(database, categoryId)
    }
    if (groupNameTaken(database, categoryId, trimmed)) {
      throw new Error('分组名称已存在')
    }
    const id = nextId()
    const timestamp = nowIso()
    database
      .prepare(
        `INSERT INTO symbol_group (id, category_id, name, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, categoryId, trimmed, nextGroupSort(database, categoryId), timestamp, timestamp)
    return { id, categoryId, name: trimmed }
  },

  renameGroup(id: string, name: string): { id: string; name: string } {
    const trimmed = assertSymbolGroupName(name, 'group')
    const database = getDb()
    const row = database
      .prepare(`SELECT category_id FROM symbol_group WHERE id = ?`)
      .get(id) as { category_id: string | null } | undefined
    if (!row) {
      throw new Error('分组不存在')
    }
    if (groupNameTaken(database, row.category_id, trimmed, id)) {
      throw new Error('分组名称已存在')
    }
    database
      .prepare(`UPDATE symbol_group SET name = ?, updated_at = ? WHERE id = ?`)
      .run(trimmed, nowIso(), id)
    return { id, name: trimmed }
  },

  deleteGroup(id: string): void {
    const database = getDb()
    const result = database.prepare(`DELETE FROM symbol_group WHERE id = ?`).run(id)
    if (result.changes === 0) {
      throw new Error('分组不存在')
    }
  },

  members(groupId: string): SymbolGroupMember[] {
    const database = getDb()
    assertGroup(database, groupId)
    const rows = database
      .prepare(
        `SELECT ts_code, name
         FROM symbol_group_member
         WHERE group_id = ?
         ORDER BY sort_order, ts_code`
      )
      .all(groupId) as Array<{ ts_code: string; name: string }>
    return rows.map((row) => ({ tsCode: row.ts_code, name: row.name }))
  },

  addMembers(groupId: string, symbols: SymbolRef[]): void {
    const incoming = readSymbolRefs(symbols)
    const database = getDb()
    const insert = database.transaction(() => {
      assertGroup(database, groupId)
      const existing = new Set(
        (
          database
            .prepare(`SELECT ts_code FROM symbol_group_member WHERE group_id = ?`)
            .all(groupId) as Array<{ ts_code: string }>
        ).map((row) => row.ts_code)
      )
      const statement = database.prepare(
        `INSERT INTO symbol_group_member (group_id, ts_code, name, sort_order)
         VALUES (?, ?, ?, ?)`
      )
      let sort = nextMemberSort(database, groupId)
      for (const symbol of incoming) {
        if (existing.has(symbol.tsCode)) {
          continue
        }
        statement.run(groupId, symbol.tsCode, symbol.name, sort)
        existing.add(symbol.tsCode)
        sort += 1
      }
    })
    insert()
  },

  removeMembers(groupId: string, tsCodes: string[]): void {
    const codes = [...new Set(tsCodes.map((code) => code.trim()).filter(Boolean))]
    if (codes.length === 0) {
      throw new Error('请选择要删除的标的')
    }
    const database = getDb()
    const remove = database.transaction(() => {
      assertGroup(database, groupId)
      const statement = database.prepare(
        `DELETE FROM symbol_group_member WHERE group_id = ? AND ts_code = ?`
      )
      for (const code of codes) {
        statement.run(groupId, code)
      }
    })
    remove()
  },

  membership(tsCode: string): string[] {
    const code = tsCode.trim()
    if (!code) {
      throw new Error('标的无效')
    }
    const rows = getDb()
      .prepare(
        `SELECT group_id FROM symbol_group_member
         WHERE ts_code = ?
         ORDER BY group_id`
      )
      .all(code) as Array<{ group_id: string }>
    return rows.map((row) => row.group_id)
  },

  setSymbolGroups(tsCode: string, name: string, groupIds: string[]): void {
    const code = tsCode.trim()
    const label = name.trim()
    if (!code || !label) {
      throw new Error('标的无效')
    }
    const uniqueIds = [...new Set(groupIds.map((id) => id.trim()).filter(Boolean))]
    const database = getDb()
    const write = database.transaction(() => {
      if (uniqueIds.length > 0) {
        const placeholders = uniqueIds.map(() => '?').join(', ')
        const found = database
          .prepare(`SELECT id FROM symbol_group WHERE id IN (${placeholders})`)
          .all(...uniqueIds) as Array<{ id: string }>
        if (found.length !== uniqueIds.length) {
          throw new Error('分组不存在')
        }
      }
      const existing = new Set(
        (
          database
            .prepare(`SELECT group_id FROM symbol_group_member WHERE ts_code = ?`)
            .all(code) as Array<{ group_id: string }>
        ).map((row) => row.group_id)
      )
      const next = new Set(uniqueIds)
      const remove = database.prepare(
        `DELETE FROM symbol_group_member WHERE group_id = ? AND ts_code = ?`
      )
      for (const groupId of existing) {
        if (!next.has(groupId)) {
          remove.run(groupId, code)
        }
      }
      const insert = database.prepare(
        `INSERT INTO symbol_group_member (group_id, ts_code, name, sort_order)
         VALUES (?, ?, ?, ?)`
      )
      for (const groupId of uniqueIds) {
        if (existing.has(groupId)) {
          continue
        }
        insert.run(groupId, code, label, nextMemberSort(database, groupId))
      }
    })
    write()
  },

  saveHits(params: SaveSymbolGroupHitsParams): SaveSymbolGroupHitsResult {
    const symbols = readSymbolRefs(params.symbols)
    if (symbols.length === 0) {
      throw new Error('没有可保存的标的')
    }
    const database = getDb()
    const save = database.transaction(() => {
      if (params.categoryId) {
        assertCategory(database, params.categoryId)
      }
      const taken = namesInBucket(database, params.categoryId)
      const name = allocateUniqueGroupName(params.name, taken)
      const id = nextId()
      const timestamp = nowIso()
      database
        .prepare(
          `INSERT INTO symbol_group (id, category_id, name, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(id, params.categoryId, name, nextGroupSort(database, params.categoryId), timestamp, timestamp)
      const insert = database.prepare(
        `INSERT INTO symbol_group_member (group_id, ts_code, name, sort_order)
         VALUES (?, ?, ?, ?)`
      )
      symbols.forEach((symbol, index) => {
        insert.run(id, symbol.tsCode, symbol.name, index + 1)
      })
      if (params.makeDefault) {
        clearDefault(database)
        if (params.categoryId) {
          database
            .prepare(`UPDATE symbol_group_category SET is_default = 1, updated_at = ? WHERE id = ?`)
            .run(timestamp, params.categoryId)
        }
      }
      return { id, name, categoryId: params.categoryId }
    })
    return save()
  }
}
