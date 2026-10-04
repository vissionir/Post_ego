import { test } from "node:test"
import assert from "node:assert/strict"
import {
  graphData,
  graphDisplayRadius,
  graphFocus,
  graphLabelPolicy,
  graphLabelRank,
  graphLabelRequired,
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
test("the whole map has the same node order regardless of the entry atom", () => {
  const first = graphData(index, "Атомы/A" as FullSlug, -1)
  const second = graphData(index, "Атомы/C" as FullSlug, -1)
  const isolated = graphData(index, "Атомы/Isolated" as FullSlug, -1)
  assert.deepEqual(first, second)
  assert.deepEqual(first, isolated)
  assert.deepEqual(
    first.nodes.map((node) => node.id),
    ["Атомы/A", "Атомы/B", "Атомы/C", "Атомы/Isolated"],
  )
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

test("local nodes retain their full-graph degree even when external links are hidden", () => {
  const corpus = {
    "Атомы/A": { title: "A", links: ["Атомы/B"] },
    "Атомы/B": { title: "B", links: ["Атомы/C", "Атомы/D", "en/Atoms/A", "Атомы/B"] },
    "Атомы/C": { title: "C", links: [] },
    "Атомы/D": { title: "D", links: [] },
    "en/Atoms/A": { title: "English", links: [] },
  }
  const whole = graphData(corpus, "Атомы/A" as FullSlug, -1)
  for (const origin of ["Атомы/A", "Атомы/B", "Атомы/C"]) {
    const local = graphData(corpus, origin as FullSlug, 1)
    for (const node of local.nodes) {
      const canonical = whole.nodes.find((n) => n.id === node.id)!
      assert.equal(node.degree, canonical.degree)
      assert.equal(graphNodeRadius(node.degree), graphNodeRadius(canonical.degree))
    }
  }
  const local = graphData(corpus, "Атомы/A" as FullSlug, 1)
  assert.equal(local.nodes.find((n) => n.id === "Атомы/B")!.degree, 3)
  assert.equal(local.nodes.find((n) => n.id === "Атомы/A")!.degree, 1)
  assert.equal(local.links.length, 1)
})

test("local auto-fit does not enlarge circles, while manual zoom and full-map sizing remain", () => {
  const radius = graphNodeRadius(1)
  for (const fit of [1, 1.4, 2.5]) {
    assert.equal(graphDisplayRadius(radius, fit, false, fit), radius)
    assert.equal(graphDisplayRadius(radius, fit * 2, false, fit), radius * 2)
  }
  assert.equal(graphDisplayRadius(radius, 0.5, true, 2.5), 1.5)
  assert.equal(graphDisplayRadius(radius, 0.1, true), 1.25)
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

test("full graph centers an asymmetric main cloud without clipping its core", () => {
  const nodes = Array.from({ length: 100 }, (_, i) => ({
    x: i < 80 ? i - 40 : 300 + (i - 80) * 10,
    y: i < 80 ? (i % 10) - 5 : 600 + (i - 80) * 30,
  }))
  const xs = nodes.map((n) => n.x).sort((a, b) => a - b),
    ys = nodes.map((n) => n.y).sort((a, b) => a - b)
  for (const [width, height] of [
    [1042, 531],
    [374, 660],
  ]) {
    const view = graphView(nodes, width, height, true, true)
    assert(Math.abs(view.x + ((xs[49] + xs[50]) / 2) * view.k - width / 2) < 0.001)
    assert(Math.abs(view.y + ((ys[49] + ys[50]) / 2) * view.k - height / 2) < 0.001)
    assert(view.x + xs[2] * view.k >= width * 0.05 - 0.001)
    assert(view.x + xs[97] * view.k <= width * 0.95 + 0.001)
    assert(view.y + ys[2] * view.k >= height * 0.05 - 0.001)
    assert(view.y + ys[97] * view.k <= height * 0.95 + 0.001)
    const shifted = graphView(
      nodes.map((n) => ({ x: n.x + 1000, y: n.y - 600 })),
      width,
      height,
      true,
      true,
    )
    assert.equal(shifted.k, view.k)
    assert(Math.abs(shifted.x + 1000 * shifted.k - view.x) < 0.001)
    assert(Math.abs(shifted.y - 600 * shifted.k - view.y) < 0.001)
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

test("long captions are hidden in previews until zoom makes room for them", () => {
  const title = "Самоподдерживающийся внутренний диалог"
  const initial = graphLabelPolicy(6, 1, false, false, 250 * 250)
  assert.equal(initial.level, "all")
  assert.equal(initial.maxLength, 24)
  assert([...title].length > initial.maxLength)
  assert([..."Интерпретация"].length <= initial.maxLength)
  const zoomed = graphLabelPolicy(6, 2, false, false, 250 * 250)
  assert([...title].length <= zoomed.maxLength)
})

test("expanded local graphs allow longer captions without changing the label density rules", () => {
  const expanded = graphLabelPolicy(6, 1, true, false, 390 * 700)
  assert.equal(expanded.maxLength, 48)
  assert.equal(expanded.level, "all")
  assert.equal(graphLabelPolicy(800, 1, true, true, 390 * 700).level, "none")
  assert.equal(graphLabelPolicy(800, 1.8, true, true, 390 * 700).maxLength, 43)
})

test("zooming out tightens the caption length budget", () => {
  assert.equal(graphLabelPolicy(6, 0.75, false, false, 250 * 250).maxLength, 18)
  assert.equal(graphLabelPolicy(6, 0.1, false, false, 250 * 250).maxLength, 12)
})

test("selected global constellations follow the zoom policy; only hovering forces a caption", () => {
  const center = "A" as SimpleSlug
  const selected = "C" as SimpleSlug
  for (const zoom of [0.1, 1, 1.8, 4]) {
    const policy = graphLabelPolicy(800, zoom, true, true, 390 * 700)
    assert.equal(policy.level === "none", zoom < 1.35)
    for (const id of [center, "B" as SimpleSlug, selected])
      assert(!graphLabelRequired(id, center, null, selected, true, true))
    assert(graphLabelRequired(selected, center, selected, selected, true, true))
  }
})

test("the central caption is visible in expanded atom connections, and hidden in its preview", () => {
  const id = "A" as SimpleSlug
  assert(!graphLabelRequired(id, id, id, id, false, false))
  assert(graphLabelRequired(id, id, null, null, true, false))
  const neighbour = "B" as SimpleSlug
  assert(graphLabelRequired(neighbour, id, null, neighbour, false, false))
  assert(!graphLabelRequired(neighbour, id, null, neighbour, true, false))
  assert.equal(graphLabelPolicy(87, 0.4, true, false, 1100 * 600).level, "none")
})

test("the full graph starts with only the page caption required, without selecting a constellation", () => {
  const center = "A" as SimpleSlug
  const neighbour = "B" as SimpleSlug
  assert(graphLabelRequired(center, center, null, null, true, true))
  assert(!graphLabelRequired(neighbour, center, null, null, true, true))
  assert(graphLabelRequired(center, center, null, center, true, true))
  assert(!graphLabelRequired(neighbour, center, null, center, true, true))
  assert.equal(graphLabelPolicy(800, 1, true, true, 390 * 700).level, "none")
})

test("the neutral whole map does not force a caption for the page atom", () => {
  const page = "A" as SimpleSlug
  const neighbour = "B" as SimpleSlug
  for (const selected of [null, page, neighbour]) {
    assert(!graphLabelRequired(page, page, null, selected, true, true, false))
    assert(!graphLabelRequired(neighbour, page, null, selected, true, true, false))
  }
  assert(graphLabelRequired(page, page, page, null, true, true, false))
  assert(graphLabelRequired(neighbour, page, neighbour, null, true, true, false))
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

test("free exploration shows the chosen neighbourhood without a route to the entry atom", () => {
  const links = [
    ["A", "B"],
    ["B", "C"],
    ["D", "C"],
    ["C", "Side"],
  ].map(([source, target]) => ({ source: source as SimpleSlug, target: target as SimpleSlug }))
  const focus = graphFocus(links, "A" as SimpleSlug)
  assert.deepEqual([...focus.nodes].sort(), ["A", "B"])
  assert.deepEqual([...focus.links], [0])
  const other = graphFocus(links, "C" as SimpleSlug)
  assert.deepEqual([...other.nodes].sort(), ["B", "C", "D", "Side"])
  assert.deepEqual([...other.links], [1, 2, 3])
})

test("focus never invents a route between disconnected atoms", () => {
  const focus = graphFocus([], "A" as SimpleSlug, "B" as SimpleSlug)
  assert.deepEqual([...focus.nodes], ["A"])
  assert.equal(focus.links.size, 0)
})

test("contextual routes support the home page's empty simplified slug", () => {
  const links = [
    ["A", "B"],
    ["B", "C"],
    ["C", ""],
  ].map(([source, target]) => ({ source: source as SimpleSlug, target: target as SimpleSlug }))
  assert.deepEqual([...graphFocus(links, "A" as SimpleSlug, "" as SimpleSlug).nodes].sort(), [
    "",
    "A",
    "B",
    "C",
  ])
  assert.deepEqual([...graphFocus(links, "" as SimpleSlug, "A" as SimpleSlug).nodes].sort(), [
    "",
    "A",
    "B",
    "C",
  ])
})
