export function matchingTitleIds(titles: readonly string[], query: string): number[] {
  const term = query.normalize("NFC").toLowerCase().trim()
  if (!term) return []
  return titles
    .map((title, id) => ({ title: title.normalize("NFC").toLowerCase(), id }))
    .filter(({ title }) => title.includes(term))
    .sort((a, b) => {
      const rank = (title: string) => (title === term ? 0 : title.startsWith(term) ? 1 : 2)
      return rank(a.title) - rank(b.title) || a.id - b.id
    })
    .map(({ id }) => id)
}
