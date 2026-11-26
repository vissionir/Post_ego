import assert from "node:assert/strict"
import test from "node:test"
import FlexSearch from "flexsearch"
import { searchResultIds } from "./searchResults"

test("scrollable results retain every match, beyond the former eight and eighty limits", async () => {
  const slugs = Array.from({ length: 120 }, (_, i) => `ru/atoms/acceptance-${i}`)
  const index = new FlexSearch.Document({ document: { id: "id", index: ["title", "content"] } })
  for (let id = 0; id < slugs.length; id++)
    index.add({ id, title: `acceptance ${id}`, content: "acceptance" })
  const results = await index.searchAsync({
    query: "acceptance",
    limit: slugs.length,
    index: ["title", "content"],
  })
  const ids = (field: string) =>
    (results.find((result) => result.field === field)?.result as number[]) ?? []
  const matches = searchResultIds(slugs, "ru", {
    title: ids("title"),
    content: ids("content"),
    tags: [],
  })
  assert.equal(matches.length, 120)
  assert(matches.includes(119))
})

test("titles stay ahead of content and tag matches without duplicate atoms", () => {
  const slugs = ["ru/atoms/a", "ru/atoms/b", "ru/atoms/c", "ru/atoms/d"]
  assert.deepEqual(
    searchResultIds(slugs, "ru", { title: [1, 0], content: [0, 2], tags: [2, 3] }),
    [1, 0, 2, 3],
  )
})

test("each language keeps all its matches even after many other-language results", () => {
  for (const language of ["ru", "en", "th", "zh"] as const) {
    const other = language === "ru" ? "en" : "ru"
    const slugs = [
      ...Array.from({ length: 90 }, (_, i) => `${other}/atoms/atom-${i}`),
      ...Array.from({ length: 20 }, (_, i) => `${language}/atoms/a-${i}`),
    ]
    const ids = slugs.map((_, i) => i)
    const result = searchResultIds(slugs, language, { title: ids, content: [], tags: [] })
    assert.equal(result.length, 20)
    assert.deepEqual(result.slice(-20), ids.slice(-20))
  }
})

test("Chinese preferred title matches keep priority and never hide remaining results", () => {
  const slugs = ["zh/atoms/a", "zh/atoms/b", "en/atoms/a", "zh/atoms/c"]
  assert.deepEqual(
    searchResultIds(slugs, "zh", { title: [0, 1, 2], content: [3], tags: [] }, [1]),
    [1, 0, 3],
  )
})
