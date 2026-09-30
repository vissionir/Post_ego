import { test } from "node:test"
import assert from "node:assert/strict"
import { graphData } from "./graph"
import type { FullSlug } from "./path"

const index = {
  "Атомы/A": { title: "A", links: ["Атомы/B", "en/Atoms/A", "Атомы/A"] },
  "Атомы/B": { title: "B", links: [] },
  "Атомы/C": { title: "C", links: ["Атомы/A"] },
  "Атомы/Isolated": { title: "Isolated", links: [] },
  "en/Atoms/A": { title: "English", links: ["th/Atoms/A"] },
  "th/Atoms/A": { title: "Thai", links: [] },
}
test("neighbourhood includes both link directions without other languages", () => {
  const result = graphData(index, "Атомы/A" as FullSlug, 1)
  assert.deepEqual(result.nodes.map((node) => node.id).sort(), ["Атомы/A", "Атомы/B", "Атомы/C"])
  assert.equal(result.links.length, 2)
})
test("full graph stays in the current language", () => {
  for (const [current, count] of [
    ["Атомы/A", 4],
    ["en/Atoms/A", 1],
    ["th/Atoms/A", 1],
  ] as const)
    assert.equal(graphData(index, current as FullSlug, -1).nodes.length, count)
})
test("an isolated atom remains visible", () => {
  const result = graphData(index, "Атомы/Isolated" as FullSlug, 1)
  assert.equal(result.nodes[0].text, "Isolated")
  assert.equal(result.links.length, 0)
})
