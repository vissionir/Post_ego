import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { canonicalRoute, routeAliases, languages } from "../quartz/util/canonicalRoutes"
import { FilePath, FullSlug, slugifyFilePath, simplifySlug } from "../quartz/util/path"
import { isSiteLanguage, siteLanguages } from "../quartz/util/siteLanguages"

const root = path.resolve("public")
const index = JSON.parse(fs.readFileSync(path.join(root, "static/contentIndex.json"), "utf8"))
const slugs = Object.keys(index)
const errors = new Set<string>()
const exists = (pathname: string) => {
  const p = path.join(root, decodeURIComponent(pathname))
  return [p, `${p}.html`, path.join(p, "index.html")].some(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  )
}
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8")
assert.equal([...sitemap.matchAll(/<loc>/g)].length, slugs.length)
assert.equal([...sitemap.matchAll(/hreflang=/g)].length, slugs.length * languages.length)
for (const language of languages) {
  assert.equal(
    sitemap.split(`hreflang="${siteLanguages[language].hreflang}"`).length - 1,
    slugs.length,
    `Sitemap alternates missing for ${language}`,
  )
}
assert(!/[^\x00-\x7F]/.test(sitemap), "Sitemap must use ASCII URLs")
let redirects = 0
for (const slug of slugs) {
  const [language, ...parts] = slug.split("/")
  assert(isSiteLanguage(language), `Unknown language: ${slug}`)
  assert.match(parts.join("/"), /^[a-z0-9/-]+$/)
  const source = slugifyFilePath(index[slug].filePath as FilePath)
  assert.equal(canonicalRoute(source), slug)
  for (const lang of languages)
    assert(index[`${lang}/${parts.join("/")}`], `Missing translation: ${slug}`)
  for (const link of index[slug].links) {
    if (link.split("/")[0] !== language)
      errors.add(`Cross-language content link: ${slug} -> ${link}`)
    if (
      !slugs.includes(link) &&
      !slugs.includes(`${link}index`) &&
      !slugs.includes(`${link}/index`)
    )
      errors.add(`Unknown graph edge: ${slug} -> ${link}`)
  }
  const html = fs.readFileSync(path.join(root, `${slug}.html`), "utf8")
  const url = new URL(`https://post-ego.com/${simplifySlug(slug as FullSlug)}`)
  assert(html.includes(`rel="canonical" href="${url.href}"`), `Canonical mismatch: ${slug}`)
  for (const lang of languages) {
    const alternate = `${lang}/${parts.join("/")}` as FullSlug
    assert(
      html.includes(
        `hreflang="${siteLanguages[lang].hreflang}" href="https://post-ego.com/${simplifySlug(alternate)}"`,
      ),
      `Missing head alternate ${lang}: ${slug}`,
    )
  }
  for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = new URL(raw.replace(/&amp;/g, "&"), url)
    if (target.origin === url.origin && !exists(target.pathname))
      errors.add(`Broken link: ${slug} -> ${target.pathname}`)
  }
  for (const old of new Set([source, ...routeAliases(slug as FullSlug)])) {
    if (old === slug) continue
    if (process.platform === "darwin" && old.toLowerCase() === slug.toLowerCase()) continue
    const redirect = fs.readFileSync(path.join(root, `${old}.html`), "utf8")
    assert(redirect.includes(`http-equiv="refresh"`), `Missing redirect: ${old}`)
    assert(redirect.includes(`url=/${simplifySlug(slug as FullSlug)}`), `Wrong redirect: ${old}`)
    redirects++
  }
}
assert.equal(errors.size, 0, [...errors].slice(0, 30).join("\n"))
console.log(
  `Verified ${slugs.length} canonical pages, ${redirects} legacy redirects, all graph edges, links, translations and sitemap.`,
)
