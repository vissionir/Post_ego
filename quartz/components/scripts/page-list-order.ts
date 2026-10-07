export type PageListSortMode = "alphabetical" | "newest" | "oldest"

export type PageListOrderData = {
  title: string
  date: number
  releaseRank: number
  publicationOrder?: number
}

export function comparePageListItems(
  a: PageListOrderData,
  b: PageListOrderData,
  mode: PageListSortMode,
  collator: Intl.Collator,
): number {
  const titleOrder = collator.compare(a.title, b.title)
  if (mode === "alphabetical") return titleOrder

  const dateOrder = mode === "newest" ? b.date - a.date : a.date - b.date
  const rank = (value?: number) =>
    value !== undefined && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER
  const publicationOrder = rank(a.publicationOrder) - rank(b.publicationOrder)
  const releaseOrder =
    mode === "newest" ? b.releaseRank - a.releaseRank : a.releaseRank - b.releaseRank
  return dateOrder || publicationOrder || releaseOrder || titleOrder
}
