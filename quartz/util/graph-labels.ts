export type GraphLabelBox = { left: number; right: number; top: number; bottom: number }
export type GraphLabelPoint = { x: number; y: number; radius: number }
export type GraphLabelLine = { source: GraphLabelPoint; target: GraphLabelPoint }

function overlaps(a: GraphLabelBox, b: GraphLabelBox) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function coversNode(box: GraphLabelBox, node: GraphLabelPoint) {
  const x = Math.max(box.left, Math.min(box.right, node.x))
  const y = Math.max(box.top, Math.min(box.bottom, node.y))
  return (x - node.x) ** 2 + (y - node.y) ** 2 <= (node.radius + 2) ** 2
}

function crossesLine(box: GraphLabelBox, { source, target }: GraphLabelLine) {
  if (
    Math.max(source.x, target.x) < box.left ||
    Math.min(source.x, target.x) > box.right ||
    Math.max(source.y, target.y) < box.top ||
    Math.min(source.y, target.y) > box.bottom
  )
    return false
  let start = 0,
    end = 1
  // Clip the segment to the caption rectangle, including vertical and zero-length links.
  for (const [from, delta, low, high] of [
    [source.x, target.x - source.x, box.left, box.right],
    [source.y, target.y - source.y, box.top, box.bottom],
  ]) {
    if (delta === 0) {
      if (from < low || from > high) return false
      continue
    }
    const a = (low - from) / delta,
      b = (high - from) / delta
    start = Math.max(start, Math.min(a, b))
    end = Math.min(end, Math.max(a, b))
    if (start > end) return false
  }
  return true
}

export function graphLabelPlacement(
  node: GraphLabelPoint,
  size: { width: number; height: number },
  origin: { x: number; y: number },
  bounds: { width: number; height: number },
  obstacles: { nodes: GraphLabelPoint[]; lines: GraphLabelLine[]; boxes: GraphLabelBox[] },
  gaps: readonly number[] = [7, 19],
) {
  const padding = 3,
    halfWidth = size.width / 2,
    halfHeight = size.height / 2
  if (size.width + padding * 2 + 8 > bounds.width) return undefined
  const vertical = node.y > origin.y + 4 ? 1 : -1
  const horizontal = node.x >= origin.x ? 1 : -1
  for (const gap of gaps) {
    const dy = node.radius + gap + halfHeight,
      dx = node.radius + gap + halfWidth
    const offsets = [
      [0, vertical * dy],
      [0, -vertical * dy],
      [horizontal * dx, 0],
      [-horizontal * dx, 0],
      [horizontal * halfWidth * 0.5, vertical * dy],
      [-horizontal * halfWidth * 0.5, vertical * dy],
      [horizontal * halfWidth * 0.5, -vertical * dy],
      [-horizontal * halfWidth * 0.5, -vertical * dy],
    ]
    for (const [offsetX, offsetY] of offsets) {
      const x = Math.max(
        halfWidth + padding + 4,
        Math.min(bounds.width - halfWidth - padding - 4, node.x + offsetX),
      )
      const y = node.y + offsetY
      const box = {
        left: x - halfWidth - padding,
        right: x + halfWidth + padding,
        top: y - halfHeight - padding,
        bottom: y + halfHeight + padding,
      }
      if (
        box.top < 4 ||
        box.bottom > bounds.height - 4 ||
        obstacles.boxes.some((other) => overlaps(box, other)) ||
        obstacles.nodes.some((other) => coversNode(box, other)) ||
        obstacles.lines.some((line) => crossesLine(box, line))
      )
        continue
      return { x, y, box }
    }
  }
}

export function graphLabelText(text: string, maxWidth: number, measure: (text: string) => number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (measure(next) <= maxWidth) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = ""
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      word,
    )) {
      if (line && measure(line + segment) > maxWidth) {
        lines.push(line)
        line = ""
      }
      line += segment
    }
  }
  if (line) lines.push(line)
  return lines
}

export function graphFocusLabelPlacement(
  node: GraphLabelPoint,
  size: { width: number; height: number },
  origin: { x: number; y: number },
  bounds: { width: number; height: number },
  obstacles: { nodes: GraphLabelPoint[]; lines: GraphLabelLine[]; boxes: GraphLabelBox[] },
) {
  const nearby =
    graphLabelPlacement(node, size, origin, bounds, obstacles) ??
    graphLabelPlacement(
      node,
      size,
      origin,
      bounds,
      { ...obstacles, lines: [] },
      [7, 19, 35, 55, 85],
    )
  if (nearby) return nearby

  // Route captions may move further away, but must never disappear behind the background map.
  const halfWidth = size.width / 2 + 3,
    halfHeight = size.height / 2 + 3
  const minX = halfWidth + 4,
    maxX = bounds.width - halfWidth - 4,
    minY = halfHeight + 4,
    maxY = bounds.height - halfHeight - 4
  const xs = new Set([Math.max(minX, Math.min(maxX, node.x)), minX, maxX])
  for (let x = minX; x <= maxX; x += 40) xs.add(x)
  let best: { x: number; y: number; box: GraphLabelBox } | undefined
  let bestScore = Infinity
  for (let y = minY; y <= maxY; y += size.height + 8) {
    for (const x of xs) {
      const box = {
        left: x - halfWidth,
        right: x + halfWidth,
        top: y - halfHeight,
        bottom: y + halfHeight,
      }
      const overlap = obstacles.boxes.reduce((sum, other) => {
        const width = Math.max(0, Math.min(box.right, other.right) - Math.max(box.left, other.left))
        const height = Math.max(
          0,
          Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top),
        )
        return sum + width * height
      }, 0)
      const covered = obstacles.nodes.filter((other) => coversNode(box, other)).length
      const score = overlap * 10000 + covered * 1000000 + (x - node.x) ** 2 + (y - node.y) ** 2
      if (score < bestScore) {
        best = { x, y, box }
        bestScore = score
      }
    }
  }
  return best
}
