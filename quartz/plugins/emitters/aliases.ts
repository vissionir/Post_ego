import { FullSlug, isRelativeURL, resolveRelative, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"
import { VFile } from "vfile"
import path from "path"

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

  return `${slug}/index` as FullSlug
}

async function* processFile(ctx: BuildCtx, file: VFile) {
  const fullSlug = file.data.slug!
  const ogSlug = simplifySlug(fullSlug)
  const aliasTargets = new Set<string>(file.data.aliases ?? [])
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
        ? path.normalize(path.join(ogSlug, "..", aliasTarget))
        : aliasTarget
    ) as FullSlug

    if (String(aliasTargetSlug) === ogSlug) {
      continue
    }

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
    const redirUrl = resolveRelative(aliasTargetSlug, ogSlug)
    yield write({
      ctx,
      content: `
        <!DOCTYPE html>
        <html lang="en-us">
        <head>
        <title>${ogSlug}</title>
        <link rel="canonical" href="${redirUrl}">
        <meta name="robots" content="noindex">
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0; url=${redirUrl}">
        </head>
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
