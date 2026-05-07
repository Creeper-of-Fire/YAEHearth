import { ref } from 'vue'

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  time: string
}

const entries = ref<LogEntry[]>([])

function timestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function add(level: LogEntry['level'], message: string) {
  entries.value.push({ level, message, time: timestamp() })
  if (entries.value.length > 500) {
    entries.value = entries.value.slice(-500)
  }
  if (level === 'error') {
    console.error(`[tavern] ${message}`)
  } else if (level === 'warn') {
    console.warn(`[tavern] ${message}`)
  } else if (level === 'debug') {
    console.debug(`[tavern] ${message}`)
  } else {
    console.info(`[tavern] ${message}`)
  }
}

export function useLogStore() {
  return {
    entries,
    info: (msg: string) => add('info', msg),
    debug: (msg: string) => add('debug', msg),
    warn: (msg: string) => add('warn', msg),
    error: (msg: string) => add('error', msg),
  }
}
