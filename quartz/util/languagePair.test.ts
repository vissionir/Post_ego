import assert from "node:assert"
import { describe, test } from "node:test"
import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug } from "./path"
import { getLanguagePair } from "./languagePair"

describe("language pairs", () => {
  const files = [
    { slug: "index", frontmatter: { title: "Post-Ego" }, links: [] },
    { slug: "en/index", frontmatter: { title: "Post-Ego" }, links: [] },
    { slug: "Атомы/Ум", frontmatter: { title: "Ум" }, links: [] },
    { slug: "en/Атомы/Mind", frontmatter: { title: "Mind" }, links: [] },
    { slug: "Атомы/Производный", frontmatter: { title: "Производный" }, links: ["Атомы/Ум"] },
    {
      slug: "en/Атомы/Derived",
      frontmatter: { title: "Derived" },
      links: ["en/Атомы/Mind"],
    },
  ] as QuartzPluginData[]

  test("resolves fixed and anchored pairs", () => {
    assert.deepEqual(getLanguagePair("index" as FullSlug, files), {
      ru: "index",
      en: "en/index",
    })
    assert.deepEqual(getLanguagePair("Атомы/Ум" as FullSlug, files), {
      ru: "Атомы/Ум",
      en: "en/Атомы/Mind",
    })
  })

  test("aligns an unanchored pair by its graph position", () => {
    assert.deepEqual(getLanguagePair("Атомы/Производный" as FullSlug, files), {
      ru: "Атомы/Производный",
      en: "en/Атомы/Derived",
    })
  })
})
