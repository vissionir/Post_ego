import test from "node:test"
import assert from "node:assert/strict"
import { canonicalRoute, publicPath } from "./canonicalRoutes"

test("all languages use the same ASCII atom path", () => {
  assert.equal(
    canonicalRoute("Атомы/Непредсказуемость-мира"),
    "ru/atoms/unpredictability-of-the-world",
  )
  assert.equal(
    canonicalRoute("en/Атомы/Unpredictability-of-the-world"),
    "en/atoms/unpredictability-of-the-world",
  )
  assert.equal(
    canonicalRoute("th/Atoms/Unpredictability-of-the-world"),
    "th/atoms/unpredictability-of-the-world",
  )
})
test("encoded, folder and mixed-language legacy URLs resolve without loops", () => {
  assert.equal(publicPath("/"), "/ru/")
  assert.equal(publicPath("/Атомы/"), "/ru/atoms/")
  assert.equal(publicPath("/ru/atoms/"), "/ru/atoms/")
  assert.equal(publicPath("/en/Атомы/Реальность"), "/en/atoms/reality")
  assert.equal(publicPath("/Атомы/Reality"), "/ru/atoms/reality")
  assert.equal(publicPath(encodeURI("/Атомы/Реальность")), "/ru/atoms/reality")
  assert.equal(publicPath("/static/icon.png"), "/static/icon.png")
})
