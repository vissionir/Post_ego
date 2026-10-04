import { test } from "node:test"
import assert from "node:assert/strict"
import { graphArticleTarget } from "./graph-article"
import type { SimpleSlug } from "./path"

const base = "https://post-ego.com/Атомы/Тревожность"
const known = new Set(["Атомы/Дефицит", "Атомы/Контроль", "/"] as SimpleSlug[])

test("article links resolve relative and percent-encoded atom URLs", () => {
  assert.equal(graphArticleTarget("../Атомы/Дефицит", base, known), "Атомы/Дефицит")
  assert.equal(
    graphArticleTarget(
      "/%D0%90%D1%82%D0%BE%D0%BC%D1%8B/%D0%94%D0%B5%D1%84%D0%B8%D1%86%D0%B8%D1%82#definition",
      base,
      known,
    ),
    "Атомы/Дефицит",
  )
  assert.equal(graphArticleTarget("../Атомы/Контроль.html", base, known), "Атомы/Контроль")
})

test("generated canonical slugs let alias links choose the real graph node", () => {
  assert.equal(
    graphArticleTarget("../Атомы/An-alias", base, known, "Атомы/Дефицит"),
    "Атомы/Дефицит",
  )
  assert.equal(graphArticleTarget("/index", base, known), "/")
})

test("external, unsafe, malformed and other-language links cannot change the graph", () => {
  for (const href of [
    "https://example.com/Атомы/Дефицит",
    "javascript:alert(1)",
    "mailto:postegoglobal@gmail.com",
    "/bad%encoding",
    "/en/Атомы/Control",
    "/missing",
  ])
    assert.equal(graphArticleTarget(href, base, known), undefined)
  assert.equal(graphArticleTarget("https://example.com/a", base, known, "Атомы/Дефицит"), undefined)
})
