import { Root } from "hast"
import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"
import { FullSlug, SimpleSlug, simplifySlug } from "../../util/path"
import { canonicalRoute, publicPath } from "../../util/canonicalRoutes"

// Run after CrawlLinks: authors keep source/wiki-link names while public URLs are stable.
export const CanonicalRoutes: QuartzTransformerPlugin = () => ({
  name: "CanonicalRoutes",
  htmlPlugins(ctx) {
    return [
      () => (tree: Root, file) => {
        const original = file.data.slug!
        const target = canonicalRoute(original)
        if (!target)
          throw new Error(
            `Missing canonical route for ${original}; update quartz/util/atom-routes.json`,
          )
        const origin = `https://${ctx.cfg.configuration.baseUrl}`
        const base = new URL(simplifySlug(original), `${origin}/`).href
        visit(tree, "element", (node) => {
          for (const attr of ["href", "src", "poster"]) {
            const value = node.properties[attr]
            if (typeof value !== "string" || value.startsWith("#")) continue
            const url = new URL(value, base)
            if (url.origin !== origin) continue
            node.properties[attr] = publicPath(url.pathname) + url.search + url.hash
          }
          const slug = node.properties["data-slug"]
          if (typeof slug === "string") node.properties["data-slug"] = canonicalRoute(slug) ?? slug
        })
        file.data.originalSlug = original
        file.data.slug = target
        file.data.links = (file.data.links ?? []).map((slug) => {
          const route = canonicalRoute(slug)
          return route ? (simplifySlug(route) as SimpleSlug) : slug
        })
      },
    ]
  },
})

declare module "vfile" {
  interface DataMap {
    originalSlug: FullSlug
  }
}
