import { fetchCanonical } from "./util"

const cache = new Map<string, HTMLElement>()

export async function loadGraphArticle(url: URL): Promise<HTMLElement> {
  const key = url.href
  const cached = cache.get(key)
  if (cached) return cached.cloneNode(true) as HTMLElement
  let article: HTMLElement | null = null
  let base = url
  if (url.pathname === window.location.pathname)
    article = document
      .querySelector<HTMLElement>("article.popover-hint")
      ?.cloneNode(true) as HTMLElement | null
  if (!article) {
    const response = await fetchCanonical(url)
    if (!response.ok || !response.headers.get("content-type")?.startsWith("text/html"))
      throw new Error("Article unavailable")
    base = new URL(response.url || url.href)
    const html = new DOMParser().parseFromString(await response.text(), "text/html")
    article = html.querySelector<HTMLElement>("article.popover-hint")
  }
  if (!article) throw new Error("Article unavailable")
  // Copy only the article, never the page's scripts, controls or duplicate heading IDs.
  article
    .querySelectorAll("script, style, iframe, object, embed, form, button, input, link, meta")
    .forEach((el) => el.remove())
  article.querySelectorAll<HTMLElement>("[id]").forEach((el) => {
    el.id = `graph-article-${el.id}`
  })
  for (const el of [article, ...article.querySelectorAll<HTMLElement>("*")]) {
    for (const attribute of [...el.attributes]) {
      if (attribute.name.startsWith("on")) el.removeAttribute(attribute.name)
    }
    for (const attribute of ["href", "src"]) {
      const value = el.getAttribute(attribute)
      if (value === null) continue
      try {
        const destination = new URL(value, base)
        if (!["http:", "https:", "mailto:", "tel:"].includes(destination.protocol)) {
          el.removeAttribute(attribute)
          continue
        }
        if (attribute === "href" && value.startsWith("#")) {
          const fragment = `graph-article-${decodeURIComponent(value.slice(1))}`
          if ([...article.querySelectorAll("[id]")].some((target) => target.id === fragment)) {
            el.setAttribute("href", `#${fragment}`)
            el.dataset.graphFragment = fragment
            el.dataset.routerIgnore = ""
            continue
          }
        }
        el.setAttribute(attribute, destination.href)
      } catch {
        el.removeAttribute(attribute)
      }
    }
  }
  article.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    link.dataset.noPopover = "true"
    if (new URL(link.href).origin !== window.location.origin) {
      link.target = "_blank"
      link.rel = "noopener noreferrer"
    }
  })
  cache.set(key, article)
  if (cache.size > 40) cache.delete(cache.keys().next().value!)
  return article.cloneNode(true) as HTMLElement
}
