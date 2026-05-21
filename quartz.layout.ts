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

  if (node.slugSegment === "tags") return false

  const slug = typeof node.slug === "string" ? node.slug : ""
  const isEnNode = node.slugSegment === "en" || /(^|\/)en(\/|$)/.test(slug)
  return isEn ? isEnNode : !isEnNode
}

const explorerSort = (a: any, b: any) => {
  const ruExplorerOrder = [
    "Атомы",
    "Нейронавигатор",
    "Как устроено исследование",
    "Область исследования",
    "Миссия проекта",
    "Как я сюда пришёл?",
  ]

  const enExplorerOrder = [
    "Atoms",
    "Neuronavigator",
    "How the research is structured",
    "Scope of the research",
    "Mission",
    "How I got here",
  ]

  const aParts = String(a?.slug ?? "")
    .replace(/\/index$/, "")
    .split("/")
  const bParts = String(b?.slug ?? "")
    .replace(/\/index$/, "")
    .split("/")
  const aLabel = String(a?.displayName ?? "").trim()
  const bLabel = String(b?.displayName ?? "").trim()

  let aGroup: "ru" | "en" | null = null
  let bGroup: "ru" | "en" | null = null
  let aOrder = -1
  let bOrder = -1

  if (aParts[0] === "en" && aParts.length > 1) {
    aOrder = enExplorerOrder.indexOf(aLabel)
    if (aOrder !== -1) aGroup = "en"
  } else {
    aOrder = ruExplorerOrder.indexOf(aLabel)
    if (aOrder !== -1) aGroup = "ru"
  }

  if (bParts[0] === "en" && bParts.length > 1) {
    bOrder = enExplorerOrder.indexOf(bLabel)
    if (bOrder !== -1) bGroup = "en"
  } else {
    bOrder = ruExplorerOrder.indexOf(bLabel)
    if (bOrder !== -1) bGroup = "ru"
  }

  if (aGroup && bGroup) {
    if (aGroup === bGroup && aOrder !== bOrder) {
      return aOrder - bOrder
    }
  } else if (aGroup) {
    return -1
  } else if (bGroup) {
    return 1
  }

  if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
    return a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }

  return a.isFolder ? -1 : 1
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
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
      mapFn: (node) => {
        if (node.slugSegment === "en" && node.isFolder) node.displayName = ""
        return node
      },
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
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
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
      mapFn: (node) => {
        if (node.slugSegment === "en" && node.isFolder) node.displayName = ""
        return node
      },
      sortFn: explorerSort,
    }),
  ],
  right: [],
}
