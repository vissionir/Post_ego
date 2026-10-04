import type { SimpleSlug } from "../../util/path"

const storageKey = "graph-visited"
const memory = new Set<SimpleSlug>()
export const graphVisitEvent = "graph-visit"

export function getVisited(): Set<SimpleSlug> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
    if (Array.isArray(value)) {
      for (const slug of value) {
        if (typeof slug === "string") memory.add(slug as SimpleSlug)
      }
    }
  } catch {
    // Keep visit history during this session even if browser storage is unavailable.
  }
  return new Set(memory)
}

export function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  if (visited.has(slug)) return
  visited.add(slug)
  memory.add(slug)
  try {
    localStorage.setItem(storageKey, JSON.stringify([...visited]))
  } catch {
    // The in-memory history still works in restricted private browsing.
  }
  document.dispatchEvent(new CustomEvent(graphVisitEvent, { detail: slug }))
}
