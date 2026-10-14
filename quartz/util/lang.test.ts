import assert from "node:assert"
import test, { describe } from "node:test"
import { isChineseSlug, languageForSlug, localeForSlug } from "./lang"

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

  test("detects Chinese source and canonical slugs without matching similar prefixes", () => {
    for (const slug of ["zh", "zh/index", "zh/Atoms/Mind", "zh/atoms/mind", "zh/graph"]) {
      assert.strictEqual(languageForSlug(slug), "zh")
      assert.strictEqual(localeForSlug(slug), "zh-CN")
      assert.strictEqual(isChineseSlug(slug), true)
    }
    for (const slug of [undefined, "zhong", "zh-CN/index", "en/zh/mind"]) {
      assert.strictEqual(isChineseSlug(slug), false)
    }
  })

  test("shared search language detection keeps Chinese results out of Russian searches", () => {
    const slugs = ["ru/atoms/mind", "en/atoms/mind", "th/atoms/mind", "zh/atoms/mind"]
    assert.deepEqual(
      slugs.filter((slug) => languageForSlug(slug) === "zh"),
      ["zh/atoms/mind"],
    )
    assert.deepEqual(
      slugs.filter((slug) => languageForSlug(slug) === "ru"),
      ["ru/atoms/mind"],
    )
  })
})
