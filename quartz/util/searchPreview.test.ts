import assert from "node:assert/strict"
import test from "node:test"
import { createSearchPreview } from "./searchPreview"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}

test("prepared previews switch synchronously with final markup and a single paint", async () => {
  const preview = createSearchPreview(async () => ({
    a: '<h1>A</h1><p><a href="/b">B</a></p>',
    b: "B",
  }))
  await preview.prepare()
  const paints: string[] = []
  const first = preview.show(
    "a",
    (html) => paints.push(html),
    () => assert.fail("no placeholder"),
  )
  assert.deepEqual(paints, ['<h1>A</h1><p><a href="/b">B</a></p>'])
  await first
  await preview.show(
    "b",
    (html) => paints.push(html),
    () => assert.fail("no placeholder"),
  )
  assert.equal(paints.length, 2)
})

test("a delayed bundle never paints temporary text before the full preview", async () => {
  const bundle = deferred<Record<string, string>>()
  const preview = createSearchPreview(() => bundle.promise)
  const paints: string[] = []
  const request = preview.show(
    "a",
    (html) => paints.push(html),
    () => paints.push("unavailable"),
  )
  assert.deepEqual(paints, [])
  bundle.resolve({ a: "formatted A" })
  await request
  assert.deepEqual(paints, ["formatted A"])
})

test("only the latest hover is shown after a delayed bundle", async () => {
  const bundle = deferred<Record<string, string>>()
  const preview = createSearchPreview(() => bundle.promise)
  const paints: string[] = []
  const show = (key: string) =>
    preview.show(
      key,
      (html) => paints.push(html),
      () => assert.fail(),
    )
  const first = show("a")
  const second = show("b")
  bundle.resolve({ a: "A", b: "B" })
  await Promise.all([first, second])
  assert.deepEqual(paints, ["B"])
})

test("closing search or changing query invalidates the pending preview", async () => {
  const bundle = deferred<Record<string, string>>()
  const preview = createSearchPreview(() => bundle.promise)
  const request = preview.show(
    "a",
    () => assert.fail(),
    () => assert.fail(),
  )
  preview.invalidate()
  bundle.resolve({ a: "A" })
  await request
})

test("one bundle request serves all results and repeated searches", async () => {
  const bundle = deferred<Record<string, string>>()
  let loads = 0
  const preview = createSearchPreview(() => {
    loads++
    return bundle.promise
  })
  const first = preview.prepare()
  const second = preview.prepare()
  assert.equal(loads, 1)
  bundle.resolve({ a: "A", b: "B" })
  await Promise.all([first, second])
  await preview.prepare()
  await preview.show(
    "a",
    () => {},
    () => assert.fail(),
  )
  await preview.show(
    "b",
    () => {},
    () => assert.fail(),
  )
  assert.equal(loads, 1)
})

test("failed preparation can retry and a missing atom has only one fallback paint", async () => {
  let loads = 0
  const preview = createSearchPreview(async () => {
    if (++loads === 1) throw new Error("offline")
    return { a: "A" }
  })
  assert.equal(await preview.prepare(), false)
  assert.equal(await preview.prepare(), true)
  let paints = 0
  await preview.show(
    "missing",
    () => assert.fail(),
    () => paints++,
  )
  assert.equal(paints, 1)
})
