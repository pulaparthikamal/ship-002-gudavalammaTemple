import type { WebStorage } from 'redux-persist/es/types'

const fallbackStorage = new Map<string, string>()

function getBrowserStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const testKey = '__redux_persist_storage_test__'
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)

    return window.localStorage
  } catch {
    return null
  }
}

export const webStorage: WebStorage = {
  async getItem(key: string) {
    const storage = getBrowserStorage()

    return storage?.getItem(key) ?? fallbackStorage.get(key) ?? null
  },
  async setItem(key: string, value: string) {
    const storage = getBrowserStorage()

    if (storage) {
      storage.setItem(key, value)
      return
    }

    fallbackStorage.set(key, value)
  },
  async removeItem(key: string) {
    const storage = getBrowserStorage()

    if (storage) {
      storage.removeItem(key)
      return
    }

    fallbackStorage.delete(key)
  },
}
