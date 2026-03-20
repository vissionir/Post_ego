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

async function* processFile(ctx: BuildCtx, file: VFile) {
  const ogSlug = simplifySlug(file.data.slug!)
  const aliasTargets = new Set<string>(file.data.aliases ?? [])
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
