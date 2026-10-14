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

// Compile just the UI fixtures; browser scripts and styles are not executed in Node.
const bundle = await build({
  stdin: {
    contents: `
      export { default as LanguageSwitcher } from "./quartz/components/LanguageSwitcher"
      export { default as FolderContent } from "./quartz/components/pages/FolderContent"
      export { default as Breadcrumbs } from "./quartz/components/Breadcrumbs"
      export { default as Graph } from "./quartz/components/Graph"
      export { default as PageTitle } from "./quartz/components/PageTitle"
      export { defaultContentPageLayout } from "./quartz.layout"
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
  "LanguageSwitcher" | "FolderContent" | "Breadcrumbs" | "Graph" | "PageTitle",
  () => QuartzComponent
> & { defaultContentPageLayout: PageLayout; languageEntryScript: () => string }

function props(slug: string): QuartzComponentProps {
  const allFiles = [
    ...languages.map((language) => ({
      slug: `${language}/index`,
      frontmatter: { title: "PostEgo" },
    })),
    { slug: "zh/atoms/index", frontmatter: { title: "概念原子" } },
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
