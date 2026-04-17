const API_KEY_STORAGE_KEY = 'collab-gemini-api-key'
let _cachedApiKey: string | null = null

export function getStoredApiKey(): string {
  if (_cachedApiKey !== null) return _cachedApiKey
  try {
    _cachedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || ''
  } catch {
    // localStorage may be unavailable (e.g. private mode, disabled cookies)
    _cachedApiKey = ''
  }
  return _cachedApiKey
}

// Invalidate cache when key is updated
export function invalidateApiKeyCache(): void {
  _cachedApiKey = null
}
