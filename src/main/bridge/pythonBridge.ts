import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import type {
  WorkerReadyMessage,
  WorkerRequest,
  WorkerResponse
} from '../../shared/types/pythonProtocol'

const DEFAULT_CALL_TIMEOUT_MS = 120_000
const READY_TIMEOUT_MS = 30_000

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: NodeJS.Timeout
}

export class PythonBridge {
  private proc: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private ready: WorkerReadyMessage | null = null
  private pending = new Map<string, PendingCall>()
  private starting: Promise<void> | null = null
  private restartAttempts = 0
  private stopped = false
  private readonly maxRestarts = 1

  async start(): Promise<WorkerReadyMessage> {
    this.stopped = false
    await this.ensureStarted()
    if (!this.ready) {
      throw new Error('Python worker started but ready message is missing')
    }
    return this.ready
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.rejectAllPending(new Error('Python worker stopped'))
    if (!this.proc) {
      return
    }
    const child = this.proc
    this.proc = null
    this.ready = null
    this.starting = null
    child.stdin.end()
    child.kill()
  }

  async call<T>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = DEFAULT_CALL_TIMEOUT_MS
  ): Promise<T> {
    await this.ensureStarted()

    const id = randomUUID()
    const request: WorkerRequest = { id, method, params }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Python call timed out: ${method}`))
      }, timeoutMs)

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer
      })

      try {
        this.writeLine(request)
      } catch (err) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  getReadyInfo(): WorkerReadyMessage | null {
    return this.ready
  }

  private async ensureStarted(): Promise<void> {
    if (this.proc && this.ready) {
      return
    }
    if (!this.starting) {
      this.starting = this.spawnWorker().finally(() => {
        this.starting = null
      })
    }
    await this.starting
  }

  private async spawnWorker(): Promise<void> {
    const { python, cwd, script } = resolvePythonPaths()
    console.log(`[pythonBridge] starting: ${python} ${script}`)

    const child = spawn(python, [script], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      windowsHide: true
    })
    this.proc = child
    this.buffer = ''
    this.ready = null

    child.stdout.setEncoding('utf-8')
    child.stderr.setEncoding('utf-8')
    child.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    child.stderr.on('data', (chunk: string) => {
      console.error(`[pythonBridge:stderr] ${chunk.trimEnd()}`)
    })
    child.on('error', (err) => {
      console.error('[pythonBridge] process error:', err)
    })
    child.on('exit', (code, signal) => {
      console.warn(`[pythonBridge] exited code=${code} signal=${signal}`)
      this.onExit(code)
    })

    await this.waitForReady()
    this.restartAttempts = 0
  }

  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Python worker ready timeout'))
      }, READY_TIMEOUT_MS)

      const check = (): void => {
        if (this.ready) {
          clearTimeout(timer)
          resolve()
          return
        }
        if (!this.proc) {
          clearTimeout(timer)
          reject(new Error('Python worker exited before ready'))
          return
        }
        setTimeout(check, 20)
      }
      check()
    })
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk
    let idx = this.buffer.indexOf('\n')
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (line) {
        this.handleLine(line)
      }
      idx = this.buffer.indexOf('\n')
    }
  }

  private handleLine(line: string): void {
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      console.error('[pythonBridge] invalid JSON line:', line)
      return
    }

    if (!msg || typeof msg !== 'object') {
      return
    }

    const obj = msg as Record<string, unknown>
    if (obj.type === 'ready') {
      this.ready = obj as unknown as WorkerReadyMessage
      console.log('[pythonBridge] ready:', this.ready)
      if (!Object.values(this.ready.imports).every(Boolean)) {
        console.error('[pythonBridge] import smoke failed:', this.ready.imports)
      }
      return
    }

    if (typeof obj.id === 'string' && typeof obj.ok === 'boolean') {
      const response = obj as unknown as WorkerResponse
      const pending = this.pending.get(response.id)
      if (!pending) {
        console.warn('[pythonBridge] orphan response:', response.id)
        return
      }
      clearTimeout(pending.timer)
      this.pending.delete(response.id)
      if (response.ok) {
        pending.resolve(response.result)
      } else {
        const code = response.error?.code ?? 'handler_error'
        const message = response.error?.message ?? 'Unknown python worker error'
        pending.reject(new Error(`[${code}] ${message}`))
      }
    }
  }

  private onExit(code: number | null): void {
    this.proc = null
    this.ready = null
    this.rejectAllPending(new Error(`Python worker exited (code=${code})`))

    if (this.stopped) {
      return
    }

    if (this.restartAttempts < this.maxRestarts) {
      this.restartAttempts += 1
      console.warn(`[pythonBridge] restarting (attempt ${this.restartAttempts})`)
      void this.ensureStarted().catch((err) => {
        console.error('[pythonBridge] restart failed:', err)
      })
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }

  private writeLine(payload: WorkerRequest): void {
    if (!this.proc) {
      throw new Error('Python worker is not running')
    }
    this.proc.stdin.write(JSON.stringify(payload) + '\n')
  }
}

function resolvePythonPaths(): { python: string; cwd: string; script: string } {
  const root = app.isPackaged
    ? join(process.resourcesPath, 'python')
    : join(app.getAppPath(), 'python')

  const script = join(root, 'worker', 'main.py')
  if (!existsSync(script)) {
    throw new Error(`Python worker script not found: ${script}`)
  }

  const fromEnv = process.env.PYTHON_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) {
    return { python: fromEnv, cwd: root, script }
  }

  const venvPython =
    process.platform === 'win32'
      ? join(root, '.venv', 'Scripts', 'python.exe')
      : join(root, '.venv', 'bin', 'python')

  if (existsSync(venvPython)) {
    return { python: venvPython, cwd: root, script }
  }

  throw new Error(
    `Python venv not found at ${venvPython}. Create it with: cd python && python -m venv .venv && pip install -r requirements.txt`
  )
}

export const pythonBridge = new PythonBridge()
