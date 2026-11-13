import assert from "node:assert/strict"
import test from "node:test"
import { createSearchLifecycle, createSearchNavigation } from "./searchLifecycle"

test("reinitialization replaces columns and handlers rather than adding a second instance", () => {
  const begin = createSearchLifecycle()
  const element = { columns: [] as string[], handlers: 0 }
  const setup = () => {
    const session = begin(element)
    element.columns.push("results", "preview")
    element.handlers++
    session.addCleanup(() => {
      element.columns = []
      element.handlers--
    })
    return session
  }
  const first = setup()
  const second = setup()
  assert(!first.isActive())
  assert.deepEqual(element.columns, ["results", "preview"])
  assert.equal(element.handlers, 1)
  first.dispose()
  assert(second.isActive())
  assert.equal(element.handlers, 1)
  second.dispose()
  second.dispose()
  assert.deepEqual(element.columns, [])
  assert.equal(element.handlers, 0)
})

test("late work from a disposed instance cannot register lingering listeners", () => {
  const begin = createSearchLifecycle()
  const first = begin({})
  first.dispose()
  let cleaned = false
  first.addCleanup(() => {
    cleaned = true
  })
  assert(cleaned)
})

test("searches in separate elements have independent lifecycles", () => {
  const begin = createSearchLifecycle()
  const a = begin({})
  const b = begin({})
  a.dispose()
  assert(b.isActive())
})

test("overlapping navigation events initialize only the latest search", async () => {
  let resolve!: (value: string) => void
  const data = new Promise<string>((yes) => {
    resolve = yes
  })
  const navigation = createSearchNavigation()
  const pages: string[] = []
  const first = navigation.run(data, () => {
    pages.push("old")
  })
  const second = navigation.run(data, () => {
    pages.push("new")
  })
  resolve("index")
  await Promise.all([first, second])
  assert.deepEqual(pages, ["new"])
})

test("leaving a page before the index loads cancels its pending setup", async () => {
  let resolve!: (value: string) => void
  const data = new Promise<string>((yes) => {
    resolve = yes
  })
  const navigation = createSearchNavigation()
  const pending = navigation.run(data, () => assert.fail("stale setup"))
  navigation.invalidate()
  resolve("index")
  await pending
})
