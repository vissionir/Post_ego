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
    { slug: "Граф", frontmatter: { title: "Граф" }, links: [] },
    { slug: "en/Graph", frontmatter: { title: "Graph" }, links: [] },
    { slug: "th/Graph", frontmatter: { title: "กราฟ" }, links: [] },
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

  test("switches graph pages between all three languages without returning home", () => {
    const pair = { ru: "Граф", en: "en/Graph", th: "th/Graph" }
    for (const slug of Object.values(pair)) {
      assert.deepEqual(getLanguagePair(slug as FullSlug, files), pair)
    }
  })

  test("resolves an anchored atom with an ambiguous graph position", () => {
    assert.deepEqual(getLanguagePair("th/Atoms/Attraction" as FullSlug, files), {
      ru: "Атомы/Влечение",
      en: "en/Атомы/Attraction",
      th: "th/Atoms/Attraction",
    })
  })
})

describe("Chinese language counterparts", () => {
  const data = (slugs: string[]) => slugs.map((slug) => ({ slug })) as QuartzPluginData[]

  test("canonical pages and atoms resolve the same four counterparts in every direction", () => {
    for (const suffix of [
      "index",
      "atoms/index",
      "graph",
      "neuronavigator",
      "project-mission",
      "atoms/mind",
    ]) {
      const pair = Object.fromEntries(
        ["ru", "en", "th", "zh"].map((lang) => [lang, `${lang}/${suffix}`]),
      )
      const files = data(Object.values(pair))
      for (const slug of Object.values(pair))
        assert.deepEqual(getLanguagePair(slug as FullSlug, files), pair)
    }
  })

  test("Chinese source counterparts resolve without any Thai or Russian files", () => {
    const pair = { en: "en/Атомы/Mind", zh: "zh/Atoms/Mind" }
    const files = data(Object.values(pair))
    for (const slug of Object.values(pair))
      assert.deepEqual(getLanguagePair(slug as FullSlug, files), pair)
  })

  test("a missing Chinese translation does not disable legacy canonical counterparts", () => {
    const pair = { ru: "ru/graph", en: "en/graph", th: "th/graph" }
    const files = data(Object.values(pair))
    for (const slug of Object.values(pair)) {
      const result = getLanguagePair(slug as FullSlug, files)
      assert.deepEqual(result, pair)
      assert.equal(Object.hasOwn(result!, "zh"), false)
    }
  })

  test("legacy source names and canonical slugs can coexist in a partial group", () => {
    const pair = { ru: "Граф", en: "en/graph", zh: "zh/Graph" }
    const files = data(Object.values(pair))
    for (const slug of Object.values(pair))
      assert.deepEqual(getLanguagePair(slug as FullSlug, files), pair)
  })

  test("unknown pages are not paired with nonexistent translations", () => {
    assert.equal(
      getLanguagePair("zh/unknown" as FullSlug, data(["en/other", "zh/unknown"])),
      undefined,
    )
  })
})
