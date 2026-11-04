// Node 22 defines a `localStorage` global of its own — undefined unless the
// process is started with --localstorage-file — and vitest's jsdom
// environment won't overwrite a global that already exists, so every test
// that touched localStorage saw `undefined` (and passed or failed on that
// accident). A plain in-memory Storage, the way the browser's behaves for
// what these tests need.
class MemoryStorage {
  #map = new Map()
  get length() { return this.#map.size }
  key(i) { return [...this.#map.keys()][i] ?? null }
  getItem(k) { return this.#map.has(String(k)) ? this.#map.get(String(k)) : null }
  setItem(k, v) { this.#map.set(String(k), String(v)) }
  removeItem(k) { this.#map.delete(String(k)) }
  clear() { this.#map.clear() }
}

for (const name of ['localStorage', 'sessionStorage']) {
  if (typeof globalThis[name] === 'undefined') {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true })
  }
}
