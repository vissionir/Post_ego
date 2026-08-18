import assert from "node:assert"
import { describe, test } from "node:test"
import { formatDate } from "./Date"

describe("formatDate", () => {
  const date = new Date(2026, 5, 1)

  test("formats Russian dates without English punctuation", () => {
    assert.equal(formatDate(date, "ru-RU"), "1 июн 2026")
  })

  test("keeps the existing English format", () => {
    assert.equal(formatDate(date, "en-US"), "Jun 01, 2026")
  })
})
