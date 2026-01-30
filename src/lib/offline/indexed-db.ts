// IndexedDB wrapper for offline data storage

const DB_NAME = 'thermogestion'
const DB_VERSION = 1

interface DBSchema {
  pendingSync: {
    id: string
    type: 'create' | 'update' | 'delete'
    table: string
    data: any
    timestamp: number
  }
  cachedData: {
    key: string
    data: any
    timestamp: number
    ttl: number // Time to live in ms
  }
  drafts: {
    id: string
    type: 'devis' | 'facture' | 'projet'
    data: any
    lastModified: number
  }
}

let db: IDBDatabase | null = null

// Initialize database
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database')
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      console.log('[IndexedDB] Database opened')
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Pending sync store
      if (!database.objectStoreNames.contains('pendingSync')) {
        const pendingSyncStore = database.createObjectStore('pendingSync', { keyPath: 'id' })
        pendingSyncStore.createIndex('timestamp', 'timestamp', { unique: false })
        pendingSyncStore.createIndex('type', 'type', { unique: false })
      }

      // Cached data store
      if (!database.objectStoreNames.contains('cachedData')) {
        const cachedDataStore = database.createObjectStore('cachedData', { keyPath: 'key' })
        cachedDataStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Drafts store
      if (!database.objectStoreNames.contains('drafts')) {
        const draftsStore = database.createObjectStore('drafts', { keyPath: 'id' })
        draftsStore.createIndex('type', 'type', { unique: false })
        draftsStore.createIndex('lastModified', 'lastModified', { unique: false })
      }

      console.log('[IndexedDB] Database schema created/updated')
    }
  })
}

// Generic get function
async function get<T>(storeName: string, key: string): Promise<T | null> {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(key)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || null)
  })
}

// Generic put function
async function put<T>(storeName: string, data: T): Promise<void> {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(data)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Generic delete function
async function remove(storeName: string, key: string): Promise<void> {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Generic getAll function
async function getAll<T>(storeName: string): Promise<T[]> {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

// ============= Pending Sync Operations =============

export async function addPendingSync(
  type: 'create' | 'update' | 'delete',
  table: string,
  data: any
): Promise<string> {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  await put('pendingSync', {
    id,
    type,
    table,
    data,
    timestamp: Date.now(),
  })
  
  console.log('[IndexedDB] Added pending sync:', id)
  return id
}

export async function getPendingSyncs(): Promise<DBSchema['pendingSync'][]> {
  return getAll('pendingSync')
}

export async function removePendingSync(id: string): Promise<void> {
  await remove('pendingSync', id)
  console.log('[IndexedDB] Removed pending sync:', id)
}

export async function clearPendingSyncs(): Promise<void> {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('pendingSync', 'readwrite')
    const store = transaction.objectStore('pendingSync')
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      console.log('[IndexedDB] Cleared all pending syncs')
      resolve()
    }
  })
}

// ============= Cached Data Operations =============

export async function setCachedData(key: string, data: any, ttl: number = 3600000): Promise<void> {
  await put('cachedData', {
    key,
    data,
    timestamp: Date.now(),
    ttl,
  })
  console.log('[IndexedDB] Cached:', key)
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const cached = await get<DBSchema['cachedData']>('cachedData', key)
  
  if (!cached) return null
  
  // Check if expired
  if (Date.now() - cached.timestamp > cached.ttl) {
    await remove('cachedData', key)
    return null
  }
  
  return cached.data as T
}

export async function clearCachedData(): Promise<void> {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('cachedData', 'readwrite')
    const store = transaction.objectStore('cachedData')
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      console.log('[IndexedDB] Cleared all cached data')
      resolve()
    }
  })
}

// ============= Drafts Operations =============

export async function saveDraft(
  id: string,
  type: 'devis' | 'facture' | 'projet',
  data: any
): Promise<void> {
  await put('drafts', {
    id,
    type,
    data,
    lastModified: Date.now(),
  })
  console.log('[IndexedDB] Saved draft:', id)
}

export async function getDraft(id: string): Promise<DBSchema['drafts'] | null> {
  return get('drafts', id)
}

export async function getDraftsByType(type: 'devis' | 'facture' | 'projet'): Promise<DBSchema['drafts'][]> {
  const database = await initDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readonly')
    const store = transaction.objectStore('drafts')
    const index = store.index('type')
    const request = index.getAll(type)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result || [])
  })
}

export async function deleteDraft(id: string): Promise<void> {
  await remove('drafts', id)
  console.log('[IndexedDB] Deleted draft:', id)
}

export async function getAllDrafts(): Promise<DBSchema['drafts'][]> {
  return getAll('drafts')
}

// ============= Utility Functions =============

export async function getDatabaseSize(): Promise<number> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return 0
  }
  
  const estimate = await navigator.storage.estimate()
  return estimate.usage || 0
}

export async function clearAllData(): Promise<void> {
  const database = await initDB()
  
  const stores = ['pendingSync', 'cachedData', 'drafts']
  
  for (const storeName of stores) {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
  
  console.log('[IndexedDB] Cleared all data')
}
