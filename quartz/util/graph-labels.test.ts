import { test } from "node:test"
import assert from "node:assert/strict"
import {
  graphFocusLabelPlacement,
  graphLabelPlacement,
  graphLabelText,
  type GraphLabelPoint,
} from "./graph-labels"

const center = { x: 125, y: 125, radius: 6 }
const bounds = { width: 250, height: 250 }
const size = { width: 135, height: 14 }

test("a lower caption sits outside the graph, not across its central node", () => {
  const node = { x: 80, y: 148, radius: 4 }
  const caption = graphLabelPlacement(node, size, center, bounds, {
    nodes: [center, node],
    lines: [{ source: center, target: node }],
    boxes: [],
  })!
  assert(caption)
  assert(caption.box.top > node.y + node.radius)
  assert(caption.box.top > center.y + center.radius)
})

test("an upper caption prefers the space above its node", () => {
  const node = { x: 128, y: 75, radius: 4 }
  const caption = graphLabelPlacement(node, size, center, bounds, {
    nodes: [center, node],
    lines: [{ source: center, target: node }],
    boxes: [],
  })!
  assert(caption.box.bottom < node.y - node.radius)
})

test("captions try another side instead of covering a nearby node", () => {
  const node = { x: 125, y: 160, radius: 4 }
  const blocker = { x: 125, y: 179, radius: 5 }
  const caption = graphLabelPlacement(node, size, center, bounds, {
    nodes: [node, blocker],
    lines: [],
    boxes: [],
  })!
  assert(caption)
  assert(caption.box.bottom < node.y)
})

test("captions do not cut across horizontal, vertical, or diagonal connections", () => {
  const node = { x: 125, y: 160, radius: 4 }
  const segment = (source: GraphLabelPoint, target: GraphLabelPoint) => ({ source, target })
  for (const line of [
    segment({ x: 10, y: 178, radius: 0 }, { x: 240, y: 178, radius: 0 }),
    segment({ x: 125, y: 174, radius: 0 }, { x: 125, y: 220, radius: 0 }),
    segment({ x: 90, y: 174, radius: 0 }, { x: 160, y: 184, radius: 0 }),
    segment({ x: 125, y: 178, radius: 0 }, { x: 125, y: 178, radius: 0 }),
  ]) {
    const caption = graphLabelPlacement(node, size, center, bounds, {
      nodes: [node],
      lines: [line],
      boxes: [],
    })!
    assert(caption)
    assert(caption.box.bottom < node.y)
  }
})

test("existing captions and the expand button reserve their space", () => {
  const node = { x: 220, y: 70, radius: 4 }
  const reserved = { left: 150, right: 250, top: 0, bottom: 58 }
  const caption = graphLabelPlacement(node, { width: 65, height: 14 }, center, bounds, {
    nodes: [node],
    lines: [],
    boxes: [reserved],
  })!
  assert(caption)
  assert(caption.box.top > reserved.bottom)
  assert(caption.box.right <= bounds.width - 4)
})

test("crowded graphs omit a caption rather than stacking it on occupied space", () => {
  assert.equal(
    graphLabelPlacement(center, size, center, bounds, {
      nodes: [center],
      lines: [],
      boxes: [{ left: 0, right: 250, top: 0, bottom: 250 }],
    }),
    undefined,
  )
})

test("a caption cannot extend into a selected-node card or outside a narrow preview", () => {
  const node = { x: 125, y: 185, radius: 4 }
  const caption = graphLabelPlacement(
    node,
    size,
    center,
    { width: 250, height: 200 },
    {
      nodes: [node],
      lines: [],
      boxes: [],
    },
  )!
  assert(caption.box.bottom <= 196)
  assert.equal(
    graphLabelPlacement(center, { width: 260, height: 14 }, center, bounds, {
      nodes: [],
      lines: [],
      boxes: [],
    }),
    undefined,
  )
})

test("placement is stable across redraws and does not mutate the force layout", () => {
  const node = { x: 80, y: 148, radius: 4 }
  const snapshot = { ...node }
  const obstacles = { nodes: [center, node], lines: [{ source: center, target: node }], boxes: [] }
  const first = graphLabelPlacement(node, size, center, bounds, obstacles)
  assert.deepEqual(graphLabelPlacement(node, size, center, bounds, obstacles), first)
  assert.deepEqual(node, snapshot)
})

test("route captions search further instead of dropping a crowded node", () => {
  const caption = graphFocusLabelPlacement(center, size, center, bounds, {
    nodes: [center],
    lines: [],
    boxes: [{ left: 0, right: 250, top: 70, bottom: 180 }],
  })!
  assert(caption)
  assert(caption.box.bottom < 70 || caption.box.top > 180)
})

test("long route captions wrap without truncating the name", () => {
  const text = "Самоподдерживающийся внутренний диалог"
  const lines = graphLabelText(text, 180, (text) => [...text].length * 6)
  assert(lines.length > 1)
  assert.equal(lines.join(" "), text)
  assert(lines.every((line) => [...line].length * 6 <= 180))
})

test("caption wrapping keeps combining characters intact", () => {
  const text = "ก้ก้ก้ก้"
  const lines = graphLabelText(
    text,
    1,
    (text) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length,
  )
  assert.deepEqual(lines, ["ก้", "ก้", "ก้", "ก้"])
  assert.equal(lines.join(""), text)
})
