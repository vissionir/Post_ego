import { FullSlug, isRelativeURL, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"
import { VFile } from "vfile"
import path from "path"
import { canonicalRoute, routeAliases } from "../../util/canonicalRoutes"
import { escapeHTML } from "../../util/escape"

function getLegacyPathAlias(file: VFile): FullSlug | null {
  const relativePath = file.data.relativePath
  if (!relativePath) return null

  const ext = path.extname(relativePath)
  const withoutExt = relativePath.slice(0, relativePath.length - ext.length).replace(/\\/g, "/")

  // Folder indexes already resolve to their canonical directory paths.
  if (withoutExt === "index" || withoutExt.endsWith("/index")) {
    return null
  }

  const canonical = simplifySlug(file.data.slug!)
  if (withoutExt === canonical) {
    return null
  }

  return withoutExt as FullSlug
}

function getReadablePathAlias(slug: string): string | null {
  const readable = slug
    .split("/")
    .map((segment) => segment.replace(/-/g, " "))
    .join("/")

  return readable === slug ? null : readable
}

function getYoNormalizedAlias(slug: string): string | null {
  const normalized = slug.replace(/ё/g, "е").replace(/Ё/g, "Е")
  return normalized === slug ? null : normalized
}

function getTrailingSlashAlias(slug: string): FullSlug | null {
  if (slug === "/" || slug.endsWith("/index")) {
    return null
  }

  // Keep Neuronavigator as a regular page in the explorer and avoid
  // generating folder-style redirects that shadow extensionless URLs locally.
  if (slug === "Нейронавигатор" || slug === "en/Нейронавигатор") {
    return null
  }

  return `${slug}/index` as FullSlug
}

async function* processFile(ctx: BuildCtx, file: VFile) {
  const fullSlug = file.data.slug!
  const ogSlug = simplifySlug(fullSlug)
  const aliasTargets = new Set<string>(file.data.aliases ?? [])
  for (const alias of routeAliases(fullSlug)) aliasTargets.add(alias)
  if (file.data.originalSlug && file.data.originalSlug !== fullSlug)
    aliasTargets.add(file.data.originalSlug)
  const redirectTargets = new Set<FullSlug>()
  const legacyPathAlias = getLegacyPathAlias(file)
  if (legacyPathAlias) {
    aliasTargets.add(legacyPathAlias)
  }

  for (const aliasTarget of [...aliasTargets]) {
    const readableAlias = getReadablePathAlias(aliasTarget)
    if (readableAlias) {
      aliasTargets.add(readableAlias)
    }
  }

  const ogSlugYoAlias = getYoNormalizedAlias(ogSlug)
  if (ogSlugYoAlias) {
    aliasTargets.add(ogSlugYoAlias)
    const readableOgSlugYoAlias = getReadablePathAlias(ogSlugYoAlias)
    if (readableOgSlugYoAlias) {
      aliasTargets.add(readableOgSlugYoAlias)
    }
  }

  for (const aliasTarget of [...aliasTargets]) {
    const yoAlias = getYoNormalizedAlias(aliasTarget)
    if (yoAlias) {
      aliasTargets.add(yoAlias)
    }
  }

  for (const aliasTarget of aliasTargets) {
    const aliasTargetSlug = (
      isRelativeURL(aliasTarget)
        ? path.normalize(path.join(file.data.originalSlug ?? ogSlug, "..", aliasTarget))
        : aliasTarget
    ) as FullSlug

    if (String(aliasTargetSlug) === ogSlug || aliasTargetSlug === fullSlug) {
      continue
    }

    // A legacy alias must never overwrite another page's canonical URL.
    const mapped = canonicalRoute(aliasTargetSlug)
    if (mapped && mapped !== fullSlug) continue

    redirectTargets.add(aliasTargetSlug)
    const trailingSlashAlias = getTrailingSlashAlias(aliasTargetSlug)
    if (trailingSlashAlias) {
      redirectTargets.add(trailingSlashAlias)
    }
  }

  // Support accidental deep-link variants with a trailing slash,
  // e.g. /Атомы/Эго/ should resolve to /Атомы/Эго on GitHub Pages.
  if (fullSlug !== "index" && !fullSlug.endsWith("/index")) {
    const canonicalTrailingSlashAlias = getTrailingSlashAlias(ogSlug)
    if (canonicalTrailingSlashAlias) {
      redirectTargets.add(canonicalTrailingSlashAlias)
    }
  }

  for (const aliasTargetSlug of redirectTargets) {
    // macOS previews commonly use a case-insensitive volume; Linux Pages emits both.
    if (process.platform === "darwin" && aliasTargetSlug.toLowerCase() === fullSlug.toLowerCase())
      continue
    const redirUrl = `https://${ctx.cfg.configuration.baseUrl}/${ogSlug}`
    const localUrl = `/${ogSlug}`
    yield write({
      ctx,
      content: `
        <!DOCTYPE html>
        <html lang="en-us">
        <head>
        <title>${escapeHTML(file.data.frontmatter?.title ?? ogSlug)}</title>
        <link rel="canonical" href="${escapeHTML(redirUrl)}">
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0; url=${escapeHTML(localUrl)}">
        <script>location.replace(${JSON.stringify(localUrl)} + location.search + location.hash)</script>
        </head>
        <body><a href="${escapeHTML(localUrl)}">${escapeHTML(file.data.frontmatter?.title ?? ogSlug)}</a></body>
        </html>
        `,
      slug: aliasTargetSlug,
      ext: ".html",
    })
  }
}

export const AliasRedirects: QuartzEmitterPlugin = () => ({
  name: "AliasRedirects",
  async *emit(ctx, content) {
    for (const [_tree, file] of content) {
      yield* processFile(ctx, file)
    }
  },
  async *partialEmit(ctx, _content, _resources, changeEvents) {
    for (const changeEvent of changeEvents) {
      if (!changeEvent.file) continue
      if (changeEvent.type === "add" || changeEvent.type === "change") {
        // add new ones if this file still exists
        yield* processFile(ctx, changeEvent.file)
      }
    }
  },
})
