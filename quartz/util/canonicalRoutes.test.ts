import test from "node:test"
import assert from "node:assert/strict"
import { asciiSlug, canonicalRoute, languages, publicPath, routeAliases } from "./canonicalRoutes"
import { FilePath, FullSlug, slugifyFilePath, transformLink } from "./path"
import atoms from "./atom-routes.json"
import { siteLanguages } from "./siteLanguages"

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

test("Chinese English-named sources map to the same stable ASCII atom slugs", () => {
  assert.deepEqual(languages, ["ru", "en", "th", "zh"])
  const source = slugifyFilePath("zh/Atoms/Unpredictability of the world.md" as FilePath)
  assert.equal(canonicalRoute(source), "zh/atoms/unpredictability-of-the-world")
  assert.equal(publicPath("/zh/Atoms/Reality"), "/zh/atoms/reality")
  assert.equal(publicPath("/zh/Atoms/Freedom"), "/zh/atoms/inner-freedom")
  assert.equal(publicPath("/zh/atoms/reality/"), "/zh/atoms/reality")
  assert.equal(publicPath("/th/Atoms/Reality"), "/th/atoms/reality")
})

test("all seven Chinese source pages resolve without undefined aliases", () => {
  const pages = [
    ["zh/index.md", "zh/index"],
    ["zh/Atoms/index.md", "zh/atoms/index"],
    ["zh/Graph.md", "zh/graph"],
    ["zh/Нейронавигатор.md", "zh/neuronavigator"],
    ["zh/How the research is structured.md", "zh/how-the-research-is-structured"],
    ["zh/Scope of the research.md", "zh/scope-of-the-research"],
    ["zh/Project Mission.md", "zh/project-mission"],
  ]
  for (const [source, target] of pages) {
    assert.equal(canonicalRoute(slugifyFilePath(source as FilePath)), target)
    assert(routeAliases(target as FullSlug).every((alias) => !alias.includes("undefined")))
  }
  for (const language of languages) assert.equal(canonicalRoute(`${language}/undefined`), undefined)
})

test("every registered atom's shortest link survives adding the Chinese English-name mirror", () => {
  const allSlugs = Object.entries(atoms).flatMap(([ru, en]) =>
    languages.map((language) =>
      slugifyFilePath(
        `${siteLanguages[language].atomPrefix}${language === "ru" ? ru : en}.md` as FilePath,
      ),
    ),
  )
  for (const [ru, en] of Object.entries(atoms)) {
    for (const language of languages) {
      const source = `${siteLanguages[language].atomPrefix}Other` as FullSlug
      const link = transformLink(source, language === "ru" ? ru : en, {
        strategy: "shortest",
        allSlugs,
      })
      const target = new URL(link, `https://post-ego.com/${source}`)
      assert.equal(
        canonicalRoute(target.pathname),
        `${language}/atoms/${asciiSlug(en)}`,
        `${language}: ${en} resolved to ${target.pathname}`,
      )
    }
  }
})
test("fear of exile preserves the old public and source routes in every language", () => {
  for (const language of languages) {
    const expected = `${language}/atoms/fear-of-exile`
    const prefix = siteLanguages[language].atomPrefix
    assert.equal(canonicalRoute(`${language}/atoms/illusion-of-exile`), expected)
    assert.equal(canonicalRoute(`${prefix}Illusion-of-Exile`), expected)
    assert.equal(canonicalRoute(`${prefix}Иллюзия-изгнания`), expected)
    assert.equal(canonicalRoute(`${prefix}Fear-of-Exile`), expected)
    assert.equal(canonicalRoute(`${prefix}Страх-изгнания`), expected)
    assert(routeAliases(expected as FullSlug).includes(`${language}/atoms/illusion-of-exile`))
  }
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
