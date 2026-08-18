import assert from "node:assert"
import { describe, test } from "node:test"
import { isEnglishSlug, languageForSlug, localeForSlug } from "./lang"

describe("page language helpers", () => {
  test("uses Russian outside the English subtree", () => {
    assert.equal(isEnglishSlug("index"), false)
    assert.equal(localeForSlug("Атомы/Миссия"), "ru-RU")
    assert.equal(languageForSlug("Атомы/Миссия"), "ru")
  })

  test("uses English inside the English subtree", () => {
    assert.equal(isEnglishSlug("en/index"), true)
    assert.equal(localeForSlug("en/Атомы/Mission"), "en-US")
    assert.equal(languageForSlug("en/Атомы/Mission"), "en")
  })
})
