import assert from "node:assert/strict"
import test from "node:test"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import { build } from "esbuild"
import { createElement } from "preact"
import { render } from "preact-render-to-string"
import type { QuartzComponent, QuartzComponentProps } from "../components/types"
import type { PageLayout } from "../cfg"
import type { QuartzPluginData } from "../plugins/vfile"
import { unescapeHTML } from "./escape"
import { languages } from "./siteLanguages"
import releaseOrderV1 from "../components/releaseOrderV1.json"
import { comparePageListItems } from "../components/scripts/page-list-order"

// Compile just the UI fixtures; browser scripts and styles are not executed in Node.
const bundle = await build({
  stdin: {
    contents: `
      export { default as LanguageSwitcher } from "./quartz/components/LanguageSwitcher"
      export { default as FolderContent } from "./quartz/components/pages/FolderContent"
      export { default as Breadcrumbs } from "./quartz/components/Breadcrumbs"
      export { default as Graph } from "./quartz/components/Graph"
      export { default as PageTitle } from "./quartz/components/PageTitle"
      export { default as Search } from "./quartz/components/Search"
      export { defaultContentPageLayout } from "./quartz.layout"
      export { defaultListPageLayout } from "./quartz.layout"
      export { languageEntryScript } from "./quartz/util/siteLanguage"
    `,
    resolveDir: fileURLToPath(new URL("../../", import.meta.url)),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [
    {
      name: "ui-fixture-resources",
      setup(build) {
        build.onLoad({ filter: /(?:\.scss|\.inline\.ts)$/ }, () => ({
          contents: "",
          loader: "text",
        }))
      },
    },
  ],
})
const module = { exports: {} }
vm.runInNewContext(bundle.outputFiles[0].text, {
  module,
  exports: module.exports,
  require: createRequire(import.meta.url),
})
const ui = module.exports as Record<
  "LanguageSwitcher" | "FolderContent" | "Breadcrumbs" | "Graph" | "PageTitle" | "Search",
  () => QuartzComponent
> & {
  defaultContentPageLayout: PageLayout
  defaultListPageLayout: PageLayout
  languageEntryScript: () => string
}

function props(slug: string): QuartzComponentProps {
  const allFiles = [
    ...languages.map((language) => ({
      slug: `${language}/index`,
      frontmatter: { title: "PostEgo" },
    })),
    ...languages.map((language) => ({
      slug: `${language}/atoms/index`,
      frontmatter: { title: language === "zh" ? "概念原子" : "Atoms" },
    })),
    ...languages.map((language) => ({
      slug: `${language}/atoms/mind`,
      filePath: `content/${language}/Atoms/Mind.md`,
      frontmatter: { title: language === "zh" ? "心智" : "Mind" },
    })),
    { slug: "zh/atoms/ego", filePath: "content/zh/Atoms/Ego.md", frontmatter: { title: "自我" } },
  ].map((file) => ({
    ...file,
    filePath: "filePath" in file ? file.filePath : `content/${file.slug}.md`,
  })) as QuartzPluginData[]
  return {
    fileData: allFiles.find((file) => file.slug === slug),
    allFiles,
    cfg: { pageTitle: "PostEgo", defaultDateType: "created" },
    ctx: {},
    tree: { type: "root", children: [] },
  } as unknown as QuartzComponentProps
}

test("search fields identify search intent and offer a localized mobile close control", () => {
  const labels = { ru: "Закрыть поиск", en: "Close search", th: "ปิดการค้นหา", zh: "关闭搜索" }
  for (const language of languages) {
    const html = render(createElement(ui.Search(), props(`${language}/index`)))
    for (const attribute of [
      'type="search"',
      'name="q"',
      'inputMode="search"',
      'enterKeyHint="search"',
      'autocomplete="off"',
      'autocorrect="off"',
      'autocapitalize="none"',
      'spellcheck="false"',
    ])
      assert(html.toLowerCase().includes(attribute.toLowerCase()), attribute)
    assert(html.includes(`aria-label="${labels[language]}"`))
    assert(html.includes('class="search-toolbar"'))
  }
})

test("Chinese header shows all four options and retains atom counterparts", () => {
  const html = render(createElement(ui.LanguageSwitcher(), props("zh/atoms/mind")))
  assert(html.includes("切换语言: ZH"))
  assert(html.includes("简体中文"))
  assert(html.includes('lang="zh-CN" hreflang="zh-CN" data-set-lang="zh"'))
  for (const language of languages) {
    assert(html.includes(`data-set-lang="${language}"`))
    if (language !== "zh") assert(html.includes(`href="../../${language}/atoms/mind"`))
  }
  const title = render(createElement(ui.PageTitle(), props("zh/atoms/mind")))
  assert(title.includes('href="../../zh/"'))
})

test("Chinese atom list has localized counts, sort controls, and English filename ranks", () => {
  const html = render(createElement(ui.FolderContent(), props("zh/atoms/index")))
  assert(html.includes("2 个概念原子。"))
  assert(html.includes('data-sort-locale="zh"'))
  assert(html.includes('aria-label="概念原子排序"'))
  for (const label of ["按名称", "最新优先", "最早优先"]) assert(html.includes(label))
  assert.equal([...html.matchAll(/class="section-li"/g)].length, 2)
  assert(
    html.includes(
      `data-page-title="自我" data-page-date="0" data-page-release-rank="${releaseOrderV1.en.indexOf("Ego")}"`,
    ),
  )
})

test("editorial placement preserves both inserted atoms in every language", () => {
  const publication = new Date("2026-10-19T13:36:32+07:00")
  const selfCompassionPublication = new Date("2026-10-19T14:20:15+07:00")
  const precedingPackage = new Date("2026-10-19T13:08:58+07:00")
  const listDate = "2026-10-19T13:08:58+07:00"
  const names = [
    "Transition to Post-Egoism",
    "Golden Rule",
    "Sympathetic Joy",
    "Compassion",
    "Self-Compassion",
    "Transition to Self-Compassion",
    "Letting Go of Awakening",
  ]
  for (const language of languages) {
    const fixture = props(`${language}/atoms/index`)
    fixture.allFiles = [
      fixture.fileData,
      ...names.map((title, index) => {
        const golden = title === "Golden Rule"
        const selfCompassion = title === "Transition to Self-Compassion"
        const date = golden
          ? publication
          : selfCompassion
            ? selfCompassionPublication
            : precedingPackage
        const order = Math.max(0, index - 1 - (index > 5 ? 1 : 0))
        return {
          slug: `${language}/atoms/${golden ? "golden-rule" : `package-${index}`}`,
          filePath: `content/${language}/Atoms/${title}.md`,
          frontmatter: {
            title,
            published: date.toISOString(),
            ...(!selfCompassion ? { publicationOrder: golden ? 0 : order } : {}),
            ...(golden ? { listDate, listOrder: 0.5 } : {}),
            ...(selfCompassion ? { listDate, listOrder: 3.5 } : {}),
          },
          dates: { created: date, modified: date, published: date },
        } as QuartzPluginData
      }),
    ]
    const html = render(createElement(ui.FolderContent(), fixture))
    const items = [
      ...html.matchAll(
        /data-page-title="([^"]+)" data-page-date="(\d+)" data-page-release-rank="(-?\d+)" data-page-publication-order="(\d+(?:\.\d+)?)"/g,
      ),
    ].map((match) => ({
      title: match[1],
      date: Number(match[2]),
      releaseRank: Number(match[3]),
      publicationOrder: Number(match[4]),
    }))
    items.sort((a, b) => comparePageListItems(a, b, "newest", new Intl.Collator(language)))
    assert.deepEqual(
      items.map((item) => item.title),
      names,
    )
    assert(html.includes(`<time datetime="${publication.toISOString()}">`))
    assert(html.includes(`<time datetime="${selfCompassionPublication.toISOString()}">`))
  }
})

test("Chinese breadcrumbs skip the language segment and retain the concept-atom title", () => {
  const html = render(createElement(ui.Breadcrumbs(), props("zh/atoms/mind")))
  assert(html.includes('aria-label="面包屑导航"'))
  assert(html.includes("首页"))
  assert(html.includes("概念原子"))
  assert(html.includes('aria-current="page">心智'))
})

test("Chinese graph toolbar uses localized actions", () => {
  const html = render(createElement(ui.Graph(), props("zh/atoms/mind")))
  for (const label of ["打开图谱", "邻近关联", "概念原子关联", "完整图谱", "关闭图谱"])
    assert(html.includes(label))
})

test("atom lists include an on-demand graph without a visible preview or automatic opening", () => {
  const modal = ui.defaultListPageLayout.beforeBody.at(-1)!
  for (const language of languages) {
    const html = render(createElement(modal, props(`${language}/atoms/index`)))
    assert(html.includes("graph-modal-only"))
    assert(html.includes('data-modal-only="true"'))
    assert(!html.includes('data-auto-open="all"'))
  }
  assert.equal(render(createElement(modal, props("zh/index"))), "")
})

test("serialized explorer callbacks filter, sort and label Chinese nodes without imports", () => {
  const Explorer = ui.defaultContentPageLayout.left.at(-1)!
  const html = render(createElement(Explorer, props("zh/index")))
  const fns = JSON.parse(unescapeHTML(html.match(/data-data-fns="([^"]+)"/)![1]))
  const context = vm.createContext({ window: { location: { pathname: "/zh/" } } })
  const filter = vm.runInContext(`(${fns.filterFn})`, context)
  const sort = vm.runInContext(`(${fns.sortFn})`, context)
  const map = vm.runInContext(`(${fns.mapFn})`, context)
  for (const language of languages) {
    assert.equal(filter({ slug: `${language}/atoms/mind`, slugSegment: "mind" }), language === "zh")
  }
  assert.equal(filter({ slug: "tags", slugSegment: "tags" }), false)
  assert.equal(
    map({ slug: "zh/atoms/index", slugSegment: "atoms", isFolder: true }).displayName,
    "概念原子",
  )
  assert.equal(map({ slug: "zh/neuronavigator", isFolder: false }).displayName, "AI 导航")
  const mind = { slug: "zh/atoms/mind", displayName: "心智", isFolder: false }
  const ego = { slug: "zh/atoms/ego", displayName: "自我", isFolder: false }
  assert.equal(
    Math.sign(sort(mind, ego)),
    Math.sign(
      new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" }).compare(
        mind.displayName,
        ego.displayName,
      ),
    ),
  )
  assert(
    sort(
      { slug: "zh/graph", displayName: "图谱" },
      { slug: "zh/neuronavigator", displayName: "AI 导航" },
    ) < 0,
  )
})

test("bundled entry script stays standalone after import and symbol rewriting", () => {
  let redirect = ""
  vm.runInNewContext(ui.languageEntryScript(), {
    navigator: { languages: ["zh-Hans", "en-US"] },
    localStorage: { getItem: () => null },
    location: {
      search: "?test=1",
      hash: "#intro",
      replace: (value: string) => {
        redirect = value
      },
    },
  })
  assert.equal(redirect, "/zh/?test=1#intro")
})
