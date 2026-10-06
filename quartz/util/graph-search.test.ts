import { test } from "node:test"
import assert from "node:assert/strict"
import { graphSearchIndex, searchGraphAtoms } from "./graph-search"
import type { GraphNode } from "./graph"

const nodes = [
  { id: "Атомы/Всё-меняется", text: "Всё меняется" },
  { id: "Атомы/Внутренняя-свобода", text: "Внутренняя свобода" },
  { id: "Атомы/Свобода", text: "Свобода" },
  { id: "Атомы/Социальная-свобода", text: "Социальная свобода" },
  { id: "Атомы/", text: "Атомы" },
  { id: "Область-исследования", text: "Свобода исследования" },
  { id: "en/Атомы/Freedom", text: "Freedom" },
  { id: "th/Atoms/Freedom", text: "อิสรภาพ" },
  { id: "th/Atoms/Anxiety", text: "ความวิตกกังวล" },
] as GraphNode[]

test("graph search indexes only atoms in the requested language", () => {
  assert.equal(graphSearchIndex(nodes, "ru").length, 4)
  assert.deepEqual(
    graphSearchIndex(nodes, "en").map((n) => n.id),
    ["en/Атомы/Freedom"],
  )
  assert.equal(graphSearchIndex(nodes, "th").length, 2)
})

test("exact matches rank first, partial matches remain alphabetical and results are bounded", () => {
  const index = graphSearchIndex(nodes, "ru")
  assert.deepEqual(
    searchGraphAtoms(index, "Свобода").map((n) => n.text),
    ["Свобода", "Внутренняя свобода", "Социальная свобода"],
  )
  assert.equal(searchGraphAtoms(index, "свобода", 1).length, 1)
  assert.equal(searchGraphAtoms(index, "свобода", 0).length, 0)
  assert.deepEqual(searchGraphAtoms(index, "  "), [])
  assert.deepEqual(searchGraphAtoms(index, "несуществующий"), [])
})

test("Russian ё/е, case and word order work without changing displayed titles", () => {
  const index = graphSearchIndex(nodes, "ru")
  assert.equal(searchGraphAtoms(index, " ВСЕ   МЕНЯЕТСЯ ")[0].text, "Всё меняется")
  assert.equal(searchGraphAtoms(index, "все меняется")[0].id, "Атомы/Всё-меняется")
  assert.equal(searchGraphAtoms(index, "свобода внутр")[0].text, "Внутренняя свобода")
  assert.equal(searchGraphAtoms(graphSearchIndex(nodes, "en"), "FREE")[0].text, "Freedom")
})

test("Thai search preserves vowels and tone marks", () => {
  const index = graphSearchIndex(nodes, "th")
  assert.equal(searchGraphAtoms(index, "วิตก")[0].id, "th/Atoms/Anxiety")
  assert.equal(searchGraphAtoms(index, "อิสรภาพ")[0].id, "th/Atoms/Freedom")
  assert.deepEqual(searchGraphAtoms(index, "อสรภาพ"), [])
})
