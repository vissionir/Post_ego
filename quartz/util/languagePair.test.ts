import assert from "node:assert"
import { describe, test } from "node:test"
import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug } from "./path"
import { getLanguagePair } from "./languagePair"

describe("language pairs", () => {
  const files = [
    { slug: "index", frontmatter: { title: "Post-Ego" }, links: [] },
    { slug: "en/index", frontmatter: { title: "Post-Ego" }, links: [] },
    { slug: "th/index", frontmatter: { title: "Post-Ego" }, links: [] },
    { slug: "Атомы/Ум", frontmatter: { title: "Ум" }, links: [] },
    { slug: "en/Атомы/Mind", frontmatter: { title: "Mind" }, links: [] },
    { slug: "th/Atoms/Mind", frontmatter: { title: "จิต" }, links: [] },
    { slug: "Атомы/Производный", frontmatter: { title: "Производный" }, links: ["Атомы/Ум"] },
    {
      slug: "en/Атомы/Derived",
      frontmatter: { title: "Derived" },
      links: ["en/Атомы/Mind"],
    },
    {
      slug: "th/Atoms/Derived",
      frontmatter: { title: "อนุพันธ์" },
      links: ["th/Atoms/Mind"],
    },
    { slug: "Атомы/Влечение", frontmatter: { title: "Влечение" }, links: [] },
    { slug: "en/Атомы/Attraction", frontmatter: { title: "Attraction" }, links: [] },
    { slug: "th/Atoms/Attraction", frontmatter: { title: "ความดึงดูด" }, links: [] },
  ] as QuartzPluginData[]

  test("resolves fixed and anchored pairs", () => {
    assert.deepEqual(getLanguagePair("index" as FullSlug, files), {
      ru: "index",
      en: "en/index",
      th: "th/index",
    })
    assert.deepEqual(getLanguagePair("Атомы/Ум" as FullSlug, files), {
      ru: "Атомы/Ум",
      en: "en/Атомы/Mind",
      th: "th/Atoms/Mind",
    })
  })

  test("aligns an unanchored pair by its graph position", () => {
    assert.deepEqual(getLanguagePair("Атомы/Производный" as FullSlug, files), {
      ru: "Атомы/Производный",
      en: "en/Атомы/Derived",
      th: "th/Atoms/Derived",
    })
  })

  test("resolves an anchored atom with an ambiguous graph position", () => {
    assert.deepEqual(getLanguagePair("th/Atoms/Attraction" as FullSlug, files), {
      ru: "Атомы/Влечение",
      en: "en/Атомы/Attraction",
      th: "th/Atoms/Attraction",
    })
  })
})
