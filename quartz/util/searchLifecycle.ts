export function createSearchLifecycle<T extends object>() {
  const instances = new WeakMap<T, () => void>()
  return (element: T) => {
    instances.get(element)?.()
    const cleanups: Array<() => void> = []
    let active = true
    const dispose = () => {
      if (!active) return
      active = false
      if (instances.get(element) === dispose) instances.delete(element)
      for (const cleanup of cleanups.splice(0).reverse()) cleanup()
    }
    instances.set(element, dispose)
    return {
      dispose,
      isActive: () => active,
      addCleanup(cleanup: () => void) {
        if (active) cleanups.push(cleanup)
        else cleanup()
      },
    }
  }
}

export function createSearchNavigation() {
  let revision = 0
  return {
    invalidate() {
      revision++
    },
    async run<T>(load: Promise<T>, setup: (value: T) => void | Promise<void>) {
      const current = ++revision
      const value = await load
      if (current === revision) await setup(value)
    },
  }
}
