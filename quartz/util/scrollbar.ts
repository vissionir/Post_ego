export function scrollThumbMetrics(viewport: number, content: number, scroll: number) {
  const maxScroll = Math.max(0, content - viewport)
  const height = Math.min(
    viewport,
    Math.max(24, content > 0 ? (viewport * viewport) / content : viewport),
  )
  const travel = Math.max(0, viewport - height)
  const top = maxScroll > 0 ? (Math.min(maxScroll, Math.max(0, scroll)) / maxScroll) * travel : 0
  return { maxScroll, height, travel, top }
}
