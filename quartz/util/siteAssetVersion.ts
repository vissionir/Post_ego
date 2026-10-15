export function siteAssetVersion(href: string | null, base: string): string | null {
  if (!href) return null
  const url = new URL(href, base)
  return url.pathname.endsWith("/index.css") ? url.searchParams.get("v") : null
}

export function needsAssetReload(current: string | null, next: string | null): boolean {
  return next !== null && current !== next
}
