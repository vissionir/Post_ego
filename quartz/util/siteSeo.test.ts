import assert from "node:assert/strict"
import test from "node:test"
import vm from "node:vm"
import { createElement } from "preact"
import { render } from "preact-render-to-string"
import Head from "../components/Head"
import type { QuartzComponentProps } from "../components/types"
import type { GlobalConfiguration } from "../cfg"
import { generateSiteMap, type ContentIndexMap } from "../plugins/emitters/contentIndex"
import type { QuartzPluginData } from "../plugins/vfile"
import { simplifySlug } from "./path"
import { languages, siteLanguages } from "./siteLanguages"

const files = languages.map((language) => ({
  slug: `${language}/atoms/mind`,
  frontmatter: { title: language === "zh" ? "心智" : "Mind" },
})) as QuartzPluginData[]
const cfg = {
  baseUrl: "post-ego.com",
  pageTitle: "PostEgo",
  theme: { cdnCaching: false },
} as GlobalConfiguration

function renderHead(allFiles = files, baseUrl = cfg.baseUrl) {
  const props = {
    cfg: { ...cfg, baseUrl },
    fileData: allFiles.find((file) => file.slug === "zh/atoms/mind"),
    allFiles,
    externalResources: { css: [], js: [], additionalHead: [] },
    ctx: { cfg: { plugins: { emitters: [] } } },
  } as unknown as QuartzComponentProps
  return render(createElement(Head(), props))
}

function contentIndex(allFiles = files): ContentIndexMap {
  return new Map(allFiles.map((file) => [file.slug!, { slug: file.slug! }])) as ContentIndexMap
}

test("each sitemap URL has four reciprocal alternates including zh-CN, not zh", () => {
  const sitemap = generateSiteMap(cfg, contentIndex())
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
  assert.equal(entries.length, 4)
  for (const [, entry] of entries) {
    assert.equal([...entry.matchAll(/hreflang=/g)].length, 4)
    for (const language of languages) {
      assert(
        entry.includes(
          `hreflang="${siteLanguages[language].hreflang}" href="https://post-ego.com/${language}/atoms/mind"`,
        ),
      )
    }
  }
  assert.doesNotMatch(sitemap, /hreflang="zh"|undefined|[^\x00-\x7f]/)
})

test("sitemap folder and home alternates preserve trailing slashes", () => {
  for (const suffix of ["index", "atoms/index"]) {
    const pages = languages.map((language) => ({
      slug: `${language}/${suffix}`,
    })) as QuartzPluginData[]
    const sitemap = generateSiteMap(cfg, contentIndex(pages))
    for (const { slug } of pages)
      assert(sitemap.includes(`href="https://post-ego.com/${simplifySlug(slug!)}"`))
  }
})

test("Chinese head includes canonical, four alternates, and Chinese Open Graph locale", () => {
  const html = renderHead()
  assert(html.includes('rel="canonical" href="https://post-ego.com/zh/atoms/mind"'))
  for (const language of languages) {
    assert(
      html.includes(
        `hreflang="${siteLanguages[language].hreflang}" href="https://post-ego.com/${language}/atoms/mind"`,
      ),
    )
  }
  assert(html.includes('property="og:locale" content="zh_CN"'))
  assert.equal([...html.matchAll(/property="og:locale:alternate"/g)].length, 3)
  assert.doesNotMatch(html, /undefined|hreflang="zh"/)
})

test("SEO does not advertise unavailable counterparts", () => {
  const partial = files.filter((file) => !file.slug!.startsWith("th/"))
  assert.doesNotMatch(renderHead(partial), /hreflang="th"/)
  assert.doesNotMatch(generateSiteMap(cfg, contentIndex(partial)), /hreflang="th"/)
})

test("head language script sets zh-CN on initial render and SPA navigation without closures", () => {
  const html = renderHead(files, "post-ego.com/research")
  const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]
  const listeners = new Map<string, () => void>()
  const document = {
    documentElement: { lang: "ru" },
    addEventListener: (event: string, listener: () => void) => listeners.set(event, listener),
  }
  let redirect = ""
  const location = {
    pathname: "/research/zh/atoms/mind/",
    search: "?source=test",
    hash: "#definition",
    replace: (target: string) => {
      redirect = target
    },
  }
  vm.runInNewContext(script, { document, window: { location, addEventListener() {} } })
  assert.equal(document.documentElement.lang, "zh-CN")
  assert.equal(redirect, "/research/zh/atoms/mind?source=test#definition")
  for (const language of languages) {
    location.pathname = `/research/${language}/graph`
    listeners.get("nav")!()
    assert.equal(document.documentElement.lang, siteLanguages[language].hreflang)
  }
})
