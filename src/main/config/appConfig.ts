import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface AppConfigFile {
  tushareToken?: string
}

let configDir: string | null = null
let cache: AppConfigFile = {}

function configPath(): string {
  if (!configDir) {
    throw new Error('App config not initialized. Call initAppConfig() first.')
  }
  return join(configDir, 'config.json')
}

export function initAppConfig(userDataPath: string): void {
  configDir = join(userDataPath, 'config')
  mkdirSync(configDir, { recursive: true })

  const path = configPath()
  if (existsSync(path)) {
    try {
      cache = JSON.parse(readFileSync(path, 'utf-8')) as AppConfigFile
    } catch {
      cache = {}
    }
  }
}

function persist(): void {
  writeFileSync(configPath(), JSON.stringify(cache, null, 2), 'utf-8')
}

/** Prefer process env, then userData config file. */
export function getTushareToken(): string | null {
  const fromEnv = process.env.TUSHARE_TOKEN?.trim()
  if (fromEnv) {
    return fromEnv
  }
  const fromFile = cache.tushareToken?.trim()
  return fromFile || null
}

export function setTushareToken(token: string): void {
  cache.tushareToken = token.trim()
  persist()
}

export function hasTushareToken(): boolean {
  return Boolean(getTushareToken())
}
