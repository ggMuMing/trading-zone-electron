import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { safeStorage } from 'electron'

let keyPath: string | null = null

export function initScriptAgentSecret(userDataPath: string): void {
  keyPath = join(userDataPath, 'config', 'script-agent.key')
}

/** Env wins over the encrypted local file. Never return this value to the renderer. */
export function getScriptAgentApiKey(): string | null {
  const fromEnv = process.env.SCRIPT_AGENT_API_KEY?.trim()
  if (fromEnv) {
    return fromEnv
  }
  if (!keyPath || !existsSync(keyPath) || !safeStorage.isEncryptionAvailable()) {
    return null
  }
  try {
    const plain = safeStorage.decryptString(readFileSync(keyPath)).trim()
    return plain || null
  } catch {
    return null
  }
}

export function setScriptAgentApiKey(apiKey: string): void {
  if (!keyPath) {
    throw new Error('Script agent secret not initialized.')
  }
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统无法加密保存密钥')
  }
  writeFileSync(keyPath, safeStorage.encryptString(trimmed))
}
