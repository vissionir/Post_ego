import assert from "node:assert/strict"
import { test } from "node:test"
import { textDividerWidth } from "./textDivider"

test("uses the furthest text edge, including fragmented inline links", () => {
  assert.equal(
    textDividerWidth(100, 800, [
      { right: 300, width: 200, height: 20 },
      { right: 650.25, width: 100, height: 20 },
      { right: 400, width: 300, height: 20 },
    ]),
    550.25,
  )
})

test("a shorter final line does not shorten the divider", () => {
  assert.equal(
    textDividerWidth(100, 800, [
      { right: 850, width: 750, height: 20 },
      { right: 200, width: 100, height: 20 },
    ]),
    750,
  )
})

test("ignores hidden text and never exceeds the containing column", () => {
  assert.equal(
    textDividerWidth(100, 400, [
      { right: 1000, width: 900, height: 0 },
      { right: 700, width: 600, height: 20 },
    ]),
    400,
  )
  assert.equal(textDividerWidth(100, 400, []), 0)
})
