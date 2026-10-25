import { parseChartDrawing, type ChartDrawing } from '../../shared/types/chartDrawing'
import { getDb } from './sqlite'

interface DrawingRow {
  id: string
  kind: string
  payload: string
}

function readPayload(raw: string): ChartDrawing | null {
  try {
    return parseChartDrawing(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export const chartDrawingRepository = {
  list(tsCode: string): ChartDrawing[] {
    const rows = getDb()
      .prepare(
        `SELECT id, kind, payload
         FROM chart_drawing
         WHERE ts_code = ?
         ORDER BY rowid ASC`
      )
      .all(tsCode) as DrawingRow[]
    const drawings: ChartDrawing[] = []
    for (const row of rows) {
      const drawing = readPayload(row.payload)
      if (drawing && drawing.id === row.id && drawing.kind === row.kind) {
        drawings.push(drawing)
      }
    }
    return drawings
  },

  save(tsCode: string, drawings: ChartDrawing[]): ChartDrawing[] {
    const db = getDb()
    const replace = db.transaction(() => {
      db.prepare('DELETE FROM chart_drawing WHERE ts_code = ?').run(tsCode)
      const insert = db.prepare(
        `INSERT INTO chart_drawing (ts_code, id, kind, payload)
         VALUES (@ts_code, @id, @kind, @payload)`
      )
      for (const drawing of drawings) {
        insert.run({
          ts_code: tsCode,
          id: drawing.id,
          kind: drawing.kind,
          payload: JSON.stringify(drawing)
        })
      }
    })
    replace()
    return this.list(tsCode)
  }
}
