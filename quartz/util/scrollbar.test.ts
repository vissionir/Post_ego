import assert from "node:assert/strict"
import { test } from "node:test"
import { scrollThumbMetrics } from "./scrollbar"

test("a short list has no scrollbar", () => {
  assert.deepEqual(scrollThumbMetrics(200, 100, 0), {
    maxScroll: 0,
    height: 200,
    travel: 0,
    top: 0,
  })
})
test("thumb represents the visible fraction and reaches both ends", () => {
  assert.deepEqual(scrollThumbMetrics(200, 800, 300), {
    maxScroll: 600,
    height: 50,
    travel: 150,
    top: 75,
  })
  assert.equal(scrollThumbMetrics(200, 800, 600).top, 150)
})
test("iOS rubber-band offsets are clamped", () => {
  assert.equal(scrollThumbMetrics(200, 800, -30).top, 0)
  assert.equal(scrollThumbMetrics(200, 800, 900).top, 150)
})
test("a hidden or very small list cannot produce a negative thumb or travel", () => {
  assert.deepEqual(scrollThumbMetrics(0, 0, 0), { maxScroll: 0, height: 0, travel: 0, top: 0 })
  assert.equal(scrollThumbMetrics(10, 1000, 0).height, 10)
})
