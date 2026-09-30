import { languageForSlug } from "./lang"
import { FullSlug, SimpleSlug, simplifySlug } from "./path"

export type GraphEntry = { title: string; links?: string[]; tags?: string[] }
export type GraphNode = { id: SimpleSlug; text: string }
export type GraphLink = { source: SimpleSlug; target: SimpleSlug }

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
