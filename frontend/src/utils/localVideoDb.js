/**
 * localVideoDb.js
 * ────────────────────────────────────────────────────────────
 * IndexedDB helpers for:
 *   1. "local-videos"   — single-slot local video upload
 *   2. "received-files" — phone-to-TV transferred files
 *   3. "playlists"      — user-created playlists of received files
 *
 * DB:    auralink-db   (version 3)
 */

const DB_NAME = "auralink-db";
const DB_VERSION = 3;
const STORE_LOCAL = "local-videos";
const STORE_RECEIVED = "received-files";
const STORE_PLAYLISTS = "playlists";
const CURRENT_KEY = "current";

/** Open (or create/upgrade) the database. Returns a Promise<IDBDatabase>. */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion;

      // v1 store
      if (!db.objectStoreNames.contains(STORE_LOCAL)) {
        db.createObjectStore(STORE_LOCAL, { keyPath: "id" });
      }
      // v2 store
      if (!db.objectStoreNames.contains(STORE_RECEIVED)) {
        const store = db.createObjectStore(STORE_RECEIVED, { keyPath: "id", autoIncrement: true });
        store.createIndex("created_at", "created_at", { unique: false });
      }
      // v3 store
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror  = (e) => reject(e.target.error);
  });
}


// ═══════════════════════════════════════════════════════════
// LOCAL VIDEO (single slot) — existing API unchanged
// ═══════════════════════════════════════════════════════════

export async function saveLocalVideo(file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_LOCAL, "readwrite");
    const store = tx.objectStore(STORE_LOCAL);
    const req   = store.put({ id: CURRENT_KEY, file, name: file.name, savedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function getLocalVideoUrl() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_LOCAL, "readonly");
    const store = tx.objectStore(STORE_LOCAL);
    const req   = store.get(CURRENT_KEY);
    req.onsuccess = (e) => {
      const record = e.target.result;
      if (!record) return resolve(null);
      const url = URL.createObjectURL(record.file);
      resolve(url);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getLocalVideoRecord() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_LOCAL, "readonly");
    const store = tx.objectStore(STORE_LOCAL);
    const req   = store.get(CURRENT_KEY);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function deleteLocalVideo() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_LOCAL, "readwrite");
    const store = tx.objectStore(STORE_LOCAL);
    const req   = store.delete(CURRENT_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}


// ═══════════════════════════════════════════════════════════
// RECEIVED FILES (from phone transfer)
// ═══════════════════════════════════════════════════════════

/** Save a received file blob to IndexedDB. Returns the new record id. */
export async function saveReceivedFile(blob, name, fileType) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_RECEIVED, "readwrite");
    const store = tx.objectStore(STORE_RECEIVED);
    const req   = store.add({
      file: blob,
      file_name: name,
      file_type: fileType,
      file_size: blob.size,
      created_at: Date.now(),
    });
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Get all received file records (metadata only, no blob URLs). */
export async function getAllReceivedFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_RECEIVED, "readonly");
    const store = tx.objectStore(STORE_RECEIVED);
    const req   = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Get a single received file record by id. */
export async function getReceivedFileById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_RECEIVED, "readonly");
    const store = tx.objectStore(STORE_RECEIVED);
    const req   = store.get(id);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Get a blob URL for a specific received file by id. */
export async function getReceivedFileUrl(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_RECEIVED, "readonly");
    const store = tx.objectStore(STORE_RECEIVED);
    const req   = store.get(id);
    req.onsuccess = (e) => {
      const record = e.target.result;
      if (!record) return resolve(null);
      resolve(URL.createObjectURL(record.file));
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/** Delete a received file by id. */
export async function deleteReceivedFile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_RECEIVED, "readwrite");
    const store = tx.objectStore(STORE_RECEIVED);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}


// ═══════════════════════════════════════════════════════════
// PLAYLISTS — user-created ordered file collections
// Structure: { id, name, createdAt, files: [{ fileId, name, size }] }
// ═══════════════════════════════════════════════════════════

/** Save a new playlist. Returns the new playlist id. */
export async function savePlaylist(name, files) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PLAYLISTS, "readwrite");
    const store = tx.objectStore(STORE_PLAYLISTS);
    const req   = store.add({
      name,
      createdAt: new Date().toISOString(),
      files, // [{ fileId, name, size }]
    });
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Get all playlists (metadata + file list). */
export async function getAllPlaylists() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PLAYLISTS, "readonly");
    const store = tx.objectStore(STORE_PLAYLISTS);
    const req   = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Get a single playlist by id. */
export async function getPlaylistById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PLAYLISTS, "readonly");
    const store = tx.objectStore(STORE_PLAYLISTS);
    const req   = store.get(id);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Update an existing playlist (name or files). */
export async function updatePlaylist(id, name, files) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PLAYLISTS, "readwrite");
    const store = tx.objectStore(STORE_PLAYLISTS);
    // get first, then put with updated fields
    const getReq = store.get(id);
    getReq.onsuccess = (e) => {
      const existing = e.target.result;
      if (!existing) return reject(new Error("Playlist not found"));
      const putReq = store.put({ ...existing, name, files });
      putReq.onsuccess = () => resolve();
      putReq.onerror   = (err) => reject(err.target.error);
    };
    getReq.onerror = (e) => reject(e.target.error);
  });
}

/** Delete a playlist by id. Also clears activePlaylistId if it matches. */
export async function deletePlaylist(id) {
  const active = localStorage.getItem("activePlaylistId");
  if (active && Number(active) === id) {
    localStorage.removeItem("activePlaylistId");
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_PLAYLISTS, "readwrite");
    const store = tx.objectStore(STORE_PLAYLISTS);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

/** Mark a playlist as active (DevicePlayer will loop it). */
export function activatePlaylist(id) {
  localStorage.setItem("activePlaylistId", String(id));
}

/** Deactivate any active playlist. */
export function deactivatePlaylist() {
  localStorage.removeItem("activePlaylistId");
}
