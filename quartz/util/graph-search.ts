import type { GraphNode } from "./graph"

function normalize(text: string) {
  return text.normalize("NFC").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim()
}

export function graphSearchIndex(nodes: GraphNode[], language: "ru" | "en" | "th") {
  const prefix = language === "ru" ? "Атомы/" : language === "en" ? "en/Атомы/" : "th/Atoms/"
  const collator = new Intl.Collator(language)
  return nodes
    .filter((node) =>
      [prefix, `${language}/atoms/`].some(
        (p) =>
          node.id.startsWith(p) &&
          node.id.slice(p.length).length > 0 &&
          node.id.slice(p.length) !== "index",
      ),
    )
    .map((node) => ({ ...node, searchable: normalize(node.text) }))
    .sort((a, b) => collator.compare(a.text, b.text) || a.id.localeCompare(b.id))
}

export function searchGraphAtoms(
  index: ReturnType<typeof graphSearchIndex>,
  query: string,
  limit = 10,
): GraphNode[] {
  const normalized = normalize(query)
  if (!normalized || limit <= 0) return []
  const words = normalized.split(" ")
  const score = (text: string) => (text === normalized ? 0 : text.startsWith(normalized) ? 1 : 2)
  return index
    .filter((node) => words.every((word) => node.searchable.includes(word)))
    .sort((a, b) => score(a.searchable) - score(b.searchable))
    .slice(0, limit)
}
