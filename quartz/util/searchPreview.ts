export function createSearchPreview<T>(load: () => Promise<Record<string, T>>) {
  let pending: Promise<boolean> | undefined
  let loaded: Record<string, T> | undefined
  let revision = 0

  function prepare(): Promise<boolean> {
    if (loaded) return Promise.resolve(true)
    if (!pending) {
      pending = load()
        .then((value) => {
          loaded = value
          return true
        })
        .catch(() => false)
        .finally(() => {
          pending = undefined
        })
    }
    return pending
  }

  return {
    prepare,
    invalidate() {
      revision++
    },
    async show(key: string, render: (value: T) => void, unavailable: () => void) {
      const request = ++revision
      if (!loaded) await prepare()
      if (request !== revision) return
      // Paint once, using the final markup, never a temporary version of the atom.
      if (loaded && Object.hasOwn(loaded, key)) render(loaded[key])
      else unavailable()
    },
  }
}
