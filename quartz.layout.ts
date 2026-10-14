import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import type { QuartzComponentProps } from "./quartz/components/types"

const isGraphPage = (page: QuartzComponentProps) => page.fileData.frontmatter?.graphPage === true

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ConditionalRender({
      component: Component.Graph({ standalone: true }),
      condition: isGraphPage,
    }),
  ],
  footer: Component.Footer(),
}

const explorerFilter = (node: any) => {
  const p = window.location.pathname
  const currentLanguage = p.match(/\/(ru|en|th|zh)(\/|$)/)?.[1] ?? "ru"

  if (node.slugSegment === "tags") return false

  const slug = typeof node.slug === "string" ? node.slug : ""
  const nodeLanguage =
    slug.match(/^(ru|en|th|zh)(\/|$)/)?.[1] ??
    (["ru", "en", "th", "zh"].includes(node.slugSegment) ? node.slugSegment : "ru")
  return nodeLanguage === currentLanguage
}

const explorerSort = (a: any, b: any) => {
  // Explorer callbacks are serialized into the browser and must be self-contained.
  const explorerOrder = [
    "atoms",
    "graph",
    "neuronavigator",
    "how-the-research-is-structured",
    "scope-of-the-research",
    "project-mission",
  ]

  const aParts = String(a?.slug ?? "")
    .replace(/\/index$/, "")
    .split("/")
    .filter(Boolean)
  const bParts = String(b?.slug ?? "")
    .replace(/\/index$/, "")
    .split("/")
    .filter(Boolean)
  const aLanguage = ["ru", "en", "th", "zh"].includes(aParts[0]) ? aParts[0] : "ru"
  const bLanguage = ["ru", "en", "th", "zh"].includes(bParts[0]) ? bParts[0] : "ru"
  const aIndex = explorerOrder.indexOf(aParts.slice(1).join("/"))
  const bIndex = explorerOrder.indexOf(bParts.slice(1).join("/"))

  if (aLanguage === bLanguage) {
    if (aIndex !== -1 && bIndex !== -1 && aIndex !== bIndex) {
      return aIndex - bIndex
    }
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
  }

  if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
    const locale = aLanguage === "zh" ? "zh-CN" : aLanguage
    return a.displayName.localeCompare(b.displayName, locale, {
      numeric: true,
      sensitivity: "base",
    })
  }

  return a.isFolder ? -1 : 1
}

const explorerMap = (node: any) => {
  if (["ru", "en", "th", "zh"].includes(node.slugSegment) && node.isFolder) {
    node.displayName = ""
  }
  if (node.slug === "ru/atoms/index" && node.isFolder) node.displayName = "Атомы"
  if (node.slug === "en/atoms/index" && node.isFolder) node.displayName = "Atoms"
  if (node.slug === "th/atoms/index" && node.isFolder) node.displayName = "อะตอม"
  if (node.slug === "zh/atoms/index" && node.isFolder) node.displayName = "概念原子"
  if (node.slug === "zh/neuronavigator") node.displayName = "AI 导航"
  return node
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) =>
        page.fileData.slug !== "index" &&
        page.fileData.slug !== "ru/index" &&
        page.fileData.slug !== "en" &&
        page.fileData.slug !== "en/index" &&
        page.fileData.slug !== "th" &&
        page.fileData.slug !== "th/index" &&
        page.fileData.slug !== "zh" &&
        page.fileData.slug !== "zh/index",
    }),
    Component.ArticleTitle(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.LanguageSwitcher() },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      filterFn: explorerFilter,
      mapFn: explorerMap,
      sortFn: explorerSort,
    }),
  ],
  right: [
    Component.ConditionalRender({
      component: Component.Graph(),
      condition: (page) => !isGraphPage(page),
    }),
    Component.ConditionalRender({
      component: Component.DesktopOnly(Component.TableOfContents()),
      condition: (page) => !isGraphPage(page),
    }),
    Component.ConditionalRender({
      component: Component.Backlinks(),
      condition: (page) => !isGraphPage(page),
    }),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) =>
        page.fileData.slug !== "index" &&
        page.fileData.slug !== "ru/index" &&
        page.fileData.slug !== "en" &&
        page.fileData.slug !== "en/index" &&
        page.fileData.slug !== "th" &&
        page.fileData.slug !== "th/index" &&
        page.fileData.slug !== "zh" &&
        page.fileData.slug !== "zh/index",
    }),
    Component.ArticleTitle(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.LanguageSwitcher() },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({
      filterFn: explorerFilter,
      mapFn: explorerMap,
      sortFn: explorerSort,
    }),
  ],
  right: [],
}
