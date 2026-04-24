const OLLAMA_URL_KEY = 'collab-ollama-url'
const OLLAMA_MODEL_KEY = 'collab-ollama-model'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const DEFAULT_OLLAMA_MODEL = 'llama3.2'

export interface OllamaSettings {
  url: string
  model: string
}

function getItem(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore — e.g. private mode
  }
}

export function getOllamaSettings(): OllamaSettings {
  return {
    url: getItem(OLLAMA_URL_KEY, DEFAULT_OLLAMA_URL),
    model: getItem(OLLAMA_MODEL_KEY, DEFAULT_OLLAMA_MODEL),
  }
}

export function saveOllamaSettings(settings: Partial<OllamaSettings>): void {
  if (settings.url !== undefined) setItem(OLLAMA_URL_KEY, settings.url)
  if (settings.model !== undefined) setItem(OLLAMA_MODEL_KEY, settings.model)
}

export function isOllamaConfigured(): boolean {
  try {
    const url = localStorage.getItem(OLLAMA_URL_KEY)
    return url !== null && url.trim().length > 0
  } catch {
    return false
  }
}
