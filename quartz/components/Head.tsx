import { i18n } from "../i18n"
import { FullSlug, getFileExtension, joinSegments, pathToRoot, simplifySlug } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"
import { googleFontHref, googleFontSubsetHref } from "../util/theme"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { unescapeHTML } from "../util/escape"
import { CustomOgImagesEmitterName } from "../plugins/emitters/ogImage"
import { localeForSlug } from "../util/lang"
import { getLanguagePair } from "../util/languagePair"
export default (() => {
  const Head: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
    ctx,
    allFiles,
  }: QuartzComponentProps) => {
    const locale = localeForSlug(fileData.slug)
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title = (fileData.frontmatter?.title ?? i18n(locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(locale).propertyDefaults.description)

    const { css, js, additionalHead } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)
    const iconPath = joinSegments(baseDir, "static/icon.png")

    const siteRoot = new URL(url.toString())
    if (!siteRoot.pathname.endsWith("/")) siteRoot.pathname += "/"
    const absoluteUrlForSlug = (slug: FullSlug) => new URL(simplifySlug(slug), siteRoot).toString()

    const canonicalUrl =
      fileData.slug === "404" ? url.toString() : absoluteUrlForSlug(fileData.slug!)
    const socialUrl = canonicalUrl
    const languagePair = getLanguagePair(fileData.slug, allFiles)

    const usesCustomOgImage = ctx.cfg.plugins.emitters.some(
      (e) => e.name === CustomOgImagesEmitterName,
    )
    const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png?v=20260318-1`
    const languageRoutingScript = `(() => {
  try {
    const basePath = ${JSON.stringify(path)}
    const key = "siteLang"
    const pathname = window.location.pathname

    const updateDocumentLanguage = () => {
      const currentPath = window.location.pathname
      const relativePath = currentPath.startsWith(basePath)
        ? currentPath.slice(basePath.length)
        : currentPath.replace(/^\\/+/, "")
      document.documentElement.lang = relativePath === "en" || relativePath.startsWith("en/")
        ? "en"
        : relativePath === "th" || relativePath.startsWith("th/")
          ? "th"
          : "ru"
    }

    updateDocumentLanguage()
    document.addEventListener("nav", updateDocumentLanguage)

    // Persist language choice on click (works for all pages)
    window.addEventListener("click", (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const a = t.closest("a[data-set-lang]")
      if (!a) return
      const lang = a.getAttribute("data-set-lang")
      if (lang) localStorage.setItem(key, lang)
    })

    const stored = localStorage.getItem(key)

    // Normalize accidental trailing slash on atom deep links (e.g. /Атомы/Миссия/)
    if (pathname.startsWith(basePath) && pathname.endsWith("/")) {
      const rel = pathname.slice(basePath.length)
      const parts = rel.split("/").filter(Boolean)
      const depth = parts.length
      const shouldNormalize = parts[0] === "en" || parts[0] === "th" ? depth >= 3 : depth >= 2
      if (shouldNormalize) {
        window.location.replace(pathname.replace(/\\/+$/, "") + window.location.search + window.location.hash)
        return
      }
    }

    const isRoot = pathname === basePath || pathname === basePath + "index.html"

    // Auto-redirect ONLY on the root entrypoint
    if (isRoot) {
      const browserLanguage = (navigator.language || "").toLowerCase()
      const detected = browserLanguage.startsWith("ru")
        ? "ru"
        : browserLanguage.startsWith("th")
          ? "th"
          : "en"
      const desired = stored === "ru" || stored === "en" || stored === "th" ? stored : detected
      if (!stored) localStorage.setItem(key, desired)

      const enRoot = basePath.endsWith("/") ? basePath + "en/" : basePath + "/en/"
      const thRoot = basePath.endsWith("/") ? basePath + "th/" : basePath + "/th/"
      if (desired === "en" && pathname !== enRoot) {
        window.location.replace(enRoot)
      } else if (desired === "th" && pathname !== thRoot) {
        window.location.replace(thRoot)
      }
    }
  } catch (_) {}
})()`

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
            {cfg.theme.typography.title && (
              <link rel="stylesheet" href={googleFontSubsetHref(cfg.theme, cfg.pageTitle)} />
            )}
            {locale === "th-TH" && (
              <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap"
              />
            )}
          </>
        )}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {cfg.baseUrl && fileData.slug !== "404" && <link rel="canonical" href={canonicalUrl} />}
        {cfg.baseUrl && languagePair && (
          <>
            <link rel="alternate" hrefLang="ru" href={absoluteUrlForSlug(languagePair.ru)} />
            <link rel="alternate" hrefLang="en" href={absoluteUrlForSlug(languagePair.en)} />
            <link rel="alternate" hrefLang="th" href={absoluteUrlForSlug(languagePair.th)} />
            <link rel="alternate" hrefLang="x-default" href={absoluteUrlForSlug(languagePair.ru)} />
          </>
        )}

        {/* Language routing (RU at /, EN at /en/, TH at /th/) */}
        <script
          dangerouslySetInnerHTML={{
            __html: languageRoutingScript,
          }}
        />

        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:alt" content={description} />

        {!usesCustomOgImage && (
          <>
            <meta property="og:image" content={ogImageDefaultPath} />
            <meta property="og:image:url" content={ogImageDefaultPath} />
            <meta name="twitter:image" content={ogImageDefaultPath} />
            <meta
              property="og:image:type"
              content={`image/${getFileExtension(ogImageDefaultPath) ?? "png"}`}
            />
          </>
        )}

        {cfg.baseUrl && (
          <>
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={socialUrl}></meta>
            <meta property="twitter:url" content={socialUrl}></meta>
          </>
        )}

        <link rel="icon" href={iconPath} />
        <link rel="shortcut icon" href={iconPath} />
        <link rel="apple-touch-icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />

        {css.map((resource) => CSSResourceToStyleElement(resource, true))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
        {additionalHead.map((resource) => {
          if (typeof resource === "function") {
            return resource(fileData)
          } else {
            return resource
          }
        })}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
