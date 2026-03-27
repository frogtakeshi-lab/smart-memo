/* ========================================
   DB.JS - IndexedDB Wrapper
   ======================================== */

const SmartMemoDB = (() => {
  const DB_NAME = 'SmartMemoDB';
  const DB_VERSION = 1;
  let db = null;

  // Store names
  const STORES = {
    MEMOS: 'memos',
    CATEGORIES: 'categories',
    TAGS: 'tags',
    IMAGES: 'images',
    AUDIO: 'audio',
    SETTINGS: 'settings'
  };

  /**
   * Initialize the database
   */
  function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Memos store
        if (!db.objectStoreNames.contains(STORES.MEMOS)) {
          const memoStore = db.createObjectStore(STORES.MEMOS, { keyPath: 'id' });
          memoStore.createIndex('type', 'type', { unique: false });
          memoStore.createIndex('category', 'category', { unique: false });
          memoStore.createIndex('pinned', 'pinned', { unique: false });
          memoStore.createIndex('deleted', 'deleted', { unique: false });
          memoStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          memoStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Categories store
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
        }

        // Tags store
        if (!db.objectStoreNames.contains(STORES.TAGS)) {
          db.createObjectStore(STORES.TAGS, { keyPath: 'id' });
        }

        // Images store (Blob storage)
        if (!db.objectStoreNames.contains(STORES.IMAGES)) {
          db.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
        }

        // Audio store (Blob storage)
        if (!db.objectStoreNames.contains(STORES.AUDIO)) {
          db.createObjectStore(STORES.AUDIO, { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }

  /**
   * Generic CRUD helpers
   */
  function getStore(storeName, mode = 'readonly') {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  function add(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const request = store.add(data);
      request.onsuccess = () => resolve(data);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function put(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function get(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function remove(storeName, id) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  function clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get all items by index value
   */
  function getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const store = getStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Settings helpers
   */
  function getSetting(key) {
    return get(STORES.SETTINGS, key).then(result => result ? result.value : null);
  }

  function setSetting(key, value) {
    return put(STORES.SETTINGS, { key, value });
  }

  /**
   * Generate unique ID
   */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Export all data as JSON
   */
  async function exportData() {
    const memos = await getAll(STORES.MEMOS);
    const categories = await getAll(STORES.CATEGORIES);
    const tags = await getAll(STORES.TAGS);
    const images = await getAll(STORES.IMAGES);
    const audio = await getAll(STORES.AUDIO);

    // Convert Blobs to base64 for export
    const processedImages = [];
    for (const img of images) {
      if (img.blob instanceof Blob) {
        const base64 = await blobToBase64(img.blob);
        processedImages.push({ ...img, blob: base64, isBase64: true });
      } else {
        processedImages.push(img);
      }
    }

    return {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      memos,
      categories,
      tags,
      images: processedImages,
      audio
    };
  }

  /**
   * Import data from JSON
   */
  async function importData(data) {
    if (data.memos) {
      for (const memo of data.memos) {
        await put(STORES.MEMOS, memo);
      }
    }
    if (data.categories) {
      for (const cat of data.categories) {
        await put(STORES.CATEGORIES, cat);
      }
    }
    if (data.tags) {
      for (const tag of data.tags) {
        await put(STORES.TAGS, tag);
      }
    }
    if (data.images) {
      for (const img of data.images) {
        if (img.isBase64 && typeof img.blob === 'string') {
          img.blob = base64ToBlob(img.blob);
          delete img.isBase64;
        }
        await put(STORES.IMAGES, img);
      }
    }
  }

  // Helpers
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(base64) {
    const parts = base64.split(';base64,');
    const type = parts[0].split(':')[1];
    const raw = atob(parts[1]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type });
  }

  return {
    init,
    STORES,
    add,
    put,
    get,
    getAll,
    remove,
    clear,
    getByIndex,
    getSetting,
    setSetting,
    generateId,
    exportData,
    importData
  };
})();
