import assert from "node:assert/strict"
import test from "node:test"
import { createSearchPreview } from "./searchPreview"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test("hover shows the matching index text before the page finishes loading", async () => {
  const page = deferred<string>()
  const preview = createSearchPreview(() => page.promise)
  let visible = "old atom"
  const request = preview.show(
    "new",
    () => (visible = "new index text"),
    (text) => (visible = text),
  )
  assert.equal(visible, "new index text")
  page.resolve("new formatted text")
  await request
  assert.equal(visible, "new formatted text")
})

test("a slow previous hover cannot overwrite the current atom", async () => {
  const a = deferred<string>()
  const b = deferred<string>()
  const preview = createSearchPreview((key) => (key === "a" ? a.promise : b.promise))
  let visible = ""
  const show = (key: string) =>
    preview.show(
      key,
      () => (visible = key),
      (text) => (visible = text),
    )
  const first = show("a")
  const second = show("b")
  b.resolve("B")
  await second
  a.resolve("A")
  await first
  assert.equal(visible, "B")
})

test("closing search or changing the query invalidates a pending preview", async () => {
  const page = deferred<string>()
  const preview = createSearchPreview(() => page.promise)
  let renders = 0
  const request = preview.show(
    "a",
    () => {},
    () => renders++,
  )
  preview.invalidate()
  page.resolve("A")
  await request
  assert.equal(renders, 0)
})

test("repeated hovers share a request and cached previews render synchronously", async () => {
  const page = deferred<string>()
  let loads = 0
  const preview = createSearchPreview(() => {
    loads++
    return page.promise
  })
  const first = preview.show(
    "a",
    () => {},
    () => {},
  )
  const second = preview.show(
    "a",
    () => {},
    () => {},
  )
  assert.equal(loads, 1)
  page.resolve("A")
  await Promise.all([first, second])
  let visible = ""
  const cached = preview.show(
    "a",
    () => assert.fail("cached preview needs no fallback"),
    (text) => (visible = text),
  )
  assert.equal(visible, "A")
  await cached
  assert.equal(loads, 1)
})

test("a failed page keeps the matching index text and can be retried", async () => {
  let loads = 0
  const preview = createSearchPreview(async () => {
    if (++loads === 1) throw new Error("offline")
    return "formatted atom"
  })
  let visible = ""
  const show = () =>
    preview.show(
      "a",
      () => (visible = "index atom"),
      (text) => (visible = text),
    )
  await show()
  assert.equal(visible, "index atom")
  await show()
  assert.equal(visible, "formatted atom")
})
