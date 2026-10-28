export function createSearchPreview<T>(load: (key: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>()
  const loaded = new Map<string, T>()
  let revision = 0

  return {
    invalidate() {
      revision++
    },
    async show(key: string, fallback: () => void, render: (value: T) => void) {
      const request = ++revision
      if (loaded.has(key)) {
        render(loaded.get(key)!)
        return
      }

      fallback()
      let promise = pending.get(key)
      if (!promise) {
        promise = load(key)
        pending.set(key, promise)
      }
      try {
        const value = await promise
        loaded.set(key, value)
        if (request === revision) render(value)
      } catch {
        // Keep the matching index text visible; a later hover can retry the page.
      } finally {
        if (pending.get(key) === promise) pending.delete(key)
      }
    },
  }
}
