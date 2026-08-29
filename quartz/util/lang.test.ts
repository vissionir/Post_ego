import assert from "node:assert"
import test, { describe } from "node:test"
import { languageForSlug, localeForSlug } from "./lang"

describe("content language detection", () => {
  test("uses Russian at the site root", () => {
    assert.strictEqual(languageForSlug("Атомы/Ум"), "ru")
    assert.strictEqual(localeForSlug("index"), "ru-RU")
  })

  test("detects English pages", () => {
    assert.strictEqual(languageForSlug("en/Атомы/Mind"), "en")
    assert.strictEqual(localeForSlug("en/index"), "en-US")
  })

  test("detects Thai pages", () => {
    assert.strictEqual(languageForSlug("th/Atoms/Mind"), "th")
    assert.strictEqual(localeForSlug("th/index"), "th-TH")
  })
})
