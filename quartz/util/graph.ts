import { languageForSlug } from "./lang"
import { FullSlug, SimpleSlug, simplifySlug } from "./path"

export type GraphEntry = { title: string; links?: string[]; tags?: string[] }
export type GraphNode = { id: SimpleSlug; text: string }
export type GraphLink = { source: SimpleSlug; target: SimpleSlug }

export function graphFocus(links: GraphLink[], active: SimpleSlug, center: SimpleSlug) {
  const neighbours = new Map<SimpleSlug, Set<SimpleSlug>>()
  for (const { source, target } of links) {
    if (!neighbours.has(source)) neighbours.set(source, new Set())
    if (!neighbours.has(target)) neighbours.set(target, new Set())
    neighbours.get(source)!.add(target)
    neighbours.get(target)!.add(source)
  }
  const nodes = new Set([active, ...(neighbours.get(active) ?? [])])
  const focusedLinks = new Set<number>()
  links.forEach(({ source, target }, index) => {
    if (nodes.has(source) && nodes.has(target)) focusedLinks.add(index)
  })
  // A route is a chain of actual references in either direction, not a causal claim.
  if (!nodes.has(center)) {
    const parent = new Map<SimpleSlug, SimpleSlug | null>([[active, null]])
    const queue = [active]
    for (let i = 0; i < queue.length && !parent.has(center); i++) {
      for (const neighbour of neighbours.get(queue[i]) ?? []) {
        if (parent.has(neighbour)) continue
        parent.set(neighbour, queue[i])
        queue.push(neighbour)
      }
    }
    if (parent.has(center)) {
      let child = center
      for (let ancestor = parent.get(child); ancestor; ancestor = parent.get(child)) {
        nodes.add(child)
        nodes.add(ancestor)
        links.forEach(({ source, target }, index) => {
          if (
            (source === child && target === ancestor) ||
            (target === child && source === ancestor)
          )
            focusedLinks.add(index)
        })
        child = ancestor
      }
    }
  }
  return { nodes, links: focusedLinks }
}

export function graphNodeRadius(degree: number) {
  return 2 + Math.sqrt(degree)
}

export function graphLabelPolicy(
  count: number,
  relativeZoom: number,
  expanded: boolean,
  full: boolean,
  area: number,
) {
  const maxLength = Math.floor((expanded && !full ? 48 : 24) * Math.max(0.5, relativeZoom))
  if (relativeZoom >= 3.2 || count <= (expanded && !full ? 36 : 8))
    return { level: "all", limit: Infinity, maxLength } as const
  if ((expanded && !full) || count <= 16 || relativeZoom >= 1.35)
    return {
      level: "sparse",
      limit: Math.min(32, Math.max(5, Math.floor(area / 14000))),
      maxLength,
    } as const
  return { level: "none", limit: 0, maxLength } as const
}

// Stable sampling spreads captions without changing the selection on every redraw.
export function graphLabelRank(id: string) {
  let hash = 2166136261
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

export function graphLabelRequired(
  id: SimpleSlug,
  center: SimpleSlug,
  active: SimpleSlug | null,
  focused: Set<SimpleSlug>,
  full: boolean,
) {
  return active !== null && (full ? focused.has(id) : id === active && id !== center)
}

export function graphView(
  nodes: { x?: number; y?: number }[],
  width: number,
  height: number,
  expanded: boolean,
  full: boolean,
) {
  const xs = nodes.map((n) => n.x ?? 0).sort((a, b) => a - b)
  const ys = nodes.map((n) => n.y ?? 0).sort((a, b) => a - b)
  // Distant disconnected nodes must not shrink the main graph into a speck.
  const trim = full && nodes.length > 40 ? Math.floor(nodes.length * 0.025) : 0
  const left = xs[trim] ?? 0,
    right = xs[xs.length - 1 - trim] ?? 0,
    top = ys[trim] ?? 0,
    bottom = ys[ys.length - 1 - trim] ?? 0
  const k = Math.min(
    expanded ? 2.5 : 1.4,
    (width * 0.78) / Math.max(60, right - left),
    (height * 0.78) / Math.max(60, bottom - top),
  )
  return { x: width / 2 - ((left + right) / 2) * k, y: height / 2 - ((top + bottom) / 2) * k, k }
}

export function graphData(index: Record<string, GraphEntry>, current: FullSlug, depth: number) {
  const language = languageForSlug(current)
  const entries = new Map(
    Object.entries(index)
      .filter(([id]) => languageForSlug(id) === language)
      .map(([id, entry]) => [simplifySlug(id as FullSlug), entry] as const),
  )
  const center = simplifySlug(current)
  const links: GraphLink[] = []
  const neighbours = new Map<SimpleSlug, Set<SimpleSlug>>()
  for (const [source, entry] of entries) {
    for (const target of new Set((entry.links ?? []).map((id) => simplifySlug(id as FullSlug)))) {
      if (!entries.has(target) || source === target) continue
      links.push({ source, target })
      if (!neighbours.has(source)) neighbours.set(source, new Set())
      if (!neighbours.has(target)) neighbours.set(target, new Set())
      neighbours.get(source)!.add(target)
      neighbours.get(target)!.add(source)
    }
  }
  const included = new Set<SimpleSlug>(entries.has(center) ? [center] : [])
  if (depth < 0) entries.forEach((_, id) => included.add(id))
  else {
    let frontier = [...included]
    for (let step = 0; step < depth; step++) {
      const next: SimpleSlug[] = []
      for (const id of frontier)
        for (const neighbour of neighbours.get(id) ?? []) {
          if (!included.has(neighbour)) {
            included.add(neighbour)
            next.push(neighbour)
          }
        }
      frontier = next
    }
  }
  return {
    nodes: [...included].map((id) => ({ id, text: entries.get(id)!.title })),
    links: links.filter(({ source, target }) => included.has(source) && included.has(target)),
  }
}
