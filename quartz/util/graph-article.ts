import { simplifySlug, type FullSlug, type SimpleSlug } from "./path"

export function graphArticleTarget(
  href: string,
  base: string,
  known: ReadonlySet<SimpleSlug>,
  declaredSlug?: string,
): SimpleSlug | undefined {
  try {
    const url = new URL(href, base)
    if (url.origin !== new URL(base).origin || !["http:", "https:"].includes(url.protocol))
      return undefined
    const id = simplifySlug(
      (declaredSlug ??
        decodeURIComponent(url.pathname)
          .replace(/^\//, "")
          .replace(/\.html$/, "")) as FullSlug,
    )
    return known.has(id) ? id : undefined
  } catch {
    return undefined
  }
}
