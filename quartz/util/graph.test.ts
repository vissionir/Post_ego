import { test } from "node:test"
import assert from "node:assert/strict"
import {
  graphData,
  graphFocus,
  graphLabelPolicy,
  graphLabelRank,
  graphNodeRadius,
  graphView,
} from "./graph"
import type { FullSlug, SimpleSlug } from "./path"

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

test("node sizes reflect their connections", () => {
  assert(graphNodeRadius(100) > graphNodeRadius(4))
  assert.equal(graphNodeRadius(0), 2)
})

test("full graph fits the main cloud instead of distant isolated nodes", () => {
  const cloud = Array.from({ length: 100 }, (_, i) => ({ x: i * 2 - 100, y: (i % 10) * 20 - 100 }))
  const view = graphView([...cloud, { x: 10000, y: -10000 }], 390, 700, true, true)
  assert(view.k > 1)
  assert(Math.abs(view.x - 195) < 30)
})

test("isolated and small graphs have a finite bounded initial zoom", () => {
  for (const nodes of [
    [],
    [{ x: 0, y: 0 }],
    [
      { x: -20, y: 20 },
      { x: 20, y: -20 },
    ],
  ]) {
    const view = graphView(nodes, 180, 250, false, false)
    assert(Number.isFinite(view.k) && view.k > 0 && view.k <= 1.4)
  }
})

test("dense graphs reveal captions in three zoom levels", () => {
  const policy = (zoom: number) => graphLabelPolicy(800, zoom, true, true, 390 * 700)
  assert.equal(policy(1).level, "none")
  assert.equal(policy(1.8).level, "sparse")
  assert(policy(1.8).limit > 0 && policy(1.8).limit <= 32)
  assert.equal(policy(3.3).level, "all")
})

test("expanded neighbourhoods start labelled without overloading dense previews", () => {
  assert.equal(graphLabelPolicy(12, 1, false, false, 250 * 250).level, "sparse")
  assert.equal(graphLabelPolicy(12, 1, true, false, 390 * 700).level, "all")
  assert.equal(graphLabelPolicy(113, 1, false, false, 250 * 250).level, "none")
  assert.equal(graphLabelPolicy(113, 1, true, false, 390 * 700).level, "sparse")
})

test("caption sampling is stable across redraws", () => {
  assert.equal(graphLabelRank("Атомы/Ум"), graphLabelRank("Атомы/Ум"))
  assert.notEqual(graphLabelRank("Атомы/Ум"), graphLabelRank("Атомы/Реальность"))
})

test("focus includes neighbours and the references between them, not an entire component", () => {
  const links = [
    ["Plasticity", "Map"],
    ["Plasticity", "Rebuild"],
    ["Plasticity", "Refine"],
    ["Rebuild", "Map"],
    ["Refine", "Map"],
    ["Map", "Unrelated"],
  ].map(([source, target]) => ({ source: source as SimpleSlug, target: target as SimpleSlug }))
  const focus = graphFocus(links, "Plasticity" as SimpleSlug, "Map" as SimpleSlug)
  assert.deepEqual([...focus.nodes].sort(), ["Map", "Plasticity", "Rebuild", "Refine"])
  assert.deepEqual([...focus.links], [0, 1, 2, 3, 4])
})

test("a distant node highlights a real route to the page without unrelated branches", () => {
  const links = [
    ["A", "B"],
    ["B", "C"],
    ["D", "C"],
    ["C", "Side"],
  ].map(([source, target]) => ({ source: source as SimpleSlug, target: target as SimpleSlug }))
  const focus = graphFocus(links, "A" as SimpleSlug, "D" as SimpleSlug)
  assert.deepEqual([...focus.nodes].sort(), ["A", "B", "C", "D"])
  assert.deepEqual([...focus.links].sort(), [0, 1, 2])
})

test("focus never invents a route between disconnected atoms", () => {
  const focus = graphFocus([], "A" as SimpleSlug, "B" as SimpleSlug)
  assert.deepEqual([...focus.nodes], ["A"])
  assert.equal(focus.links.size, 0)
})
