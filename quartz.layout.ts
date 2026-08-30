import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer(),
}

const explorerFilter = (node: any) => {
  const p = window.location.pathname
  const isEn = /\/en(\/|$)/.test(p)
  const isTh = /\/th(\/|$)/.test(p)

  if (node.slugSegment === "tags") return false

  const slug = typeof node.slug === "string" ? node.slug : ""
  const nodeLanguage =
    node.slugSegment === "en" || slug === "en" || slug.startsWith("en/")
      ? "en"
      : node.slugSegment === "th" || slug === "th" || slug.startsWith("th/")
        ? "th"
        : "ru"
  const currentLanguage = isEn ? "en" : isTh ? "th" : "ru"
  return nodeLanguage === currentLanguage
}

const explorerSort = (a: any, b: any) => {
  const explorerOrder: Record<"ru" | "en" | "th", readonly string[]> = {
    ru: [
      "Атомы",
      "Нейронавигатор",
      "Как-устроено-исследование",
      "Область-исследования",
      "Миссия-проекта",
      "Как-я-сюда-пришёл",
    ],
    en: [
      "Атомы",
      "Нейронавигатор",
      "How-the-research-is-structured",
      "Scope-of-the-research",
      "Project-Mission",
      "How-I-got-here",
    ],
    th: [
      "Atoms",
      "Нейронавигатор",
      "How-the-research-is-structured",
      "Scope-of-the-research",
      "Project-Mission",
      "How-I-got-here",
    ],
  }

  const aParts = String(a?.slug ?? "")
    .replace(/\/index$/, "")
    .split("/")
    .filter(Boolean)
  const bParts = String(b?.slug ?? "")
    .replace(/\/index$/, "")
    .split("/")
    .filter(Boolean)
  const aLanguage = aParts[0] === "en" ? "en" : aParts[0] === "th" ? "th" : "ru"
  const bLanguage = bParts[0] === "en" ? "en" : bParts[0] === "th" ? "th" : "ru"
  const aIndex = explorerOrder[aLanguage].indexOf(
    (aLanguage === "ru" ? aParts : aParts.slice(1)).join("/"),
  )
  const bIndex = explorerOrder[bLanguage].indexOf(
    (bLanguage === "ru" ? bParts : bParts.slice(1)).join("/"),
  )

  if (aLanguage === bLanguage) {
    if (aIndex !== -1 && bIndex !== -1 && aIndex !== bIndex) {
      return aIndex - bIndex
    }
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
  }

  if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
    const locale = aLanguage === "th" ? "th" : aLanguage === "en" ? "en" : "ru"
    return a.displayName.localeCompare(b.displayName, locale, {
      numeric: true,
      sensitivity: "base",
    })
  }

  return a.isFolder ? -1 : 1
}

const explorerMap = (node: any) => {
  if ((node.slugSegment === "en" || node.slugSegment === "th") && node.isFolder) {
    node.displayName = ""
  }
  if (node.slug === "en/Атомы/index" && node.isFolder) node.displayName = "Atoms"
  if (node.slug === "th/Atoms/index" && node.isFolder) node.displayName = "อะตอม"
  return node
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) =>
        page.fileData.slug !== "index" &&
        page.fileData.slug !== "en" &&
        page.fileData.slug !== "en/index" &&
        page.fileData.slug !== "th" &&
        page.fileData.slug !== "th/index",
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
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({
      filterFn: explorerFilter,
      mapFn: explorerMap,
      sortFn: explorerSort,
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) =>
        page.fileData.slug !== "index" &&
        page.fileData.slug !== "en" &&
        page.fileData.slug !== "en/index" &&
        page.fileData.slug !== "th" &&
        page.fileData.slug !== "th/index",
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
