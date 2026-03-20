import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer(),
}

const baseExplorerSort = (a: any, b: any) => {
  if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
    return a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }

  return a.isFolder ? -1 : 1
}

const ruExplorerOrder = [
  "Атомы",
  "Как я сюда пришёл",
  "Как устроено исследование",
  "Область исследования",
  "Миссия",
]

const enExplorerOrder = [
  "Atoms",
  "How I got here",
  "How the research is structured",
  "Scope of the research",
  "Mission",
]

const ruExplorerOrderMap = new Map(ruExplorerOrder.map((name, index) => [name, index]))
const enExplorerOrderMap = new Map(enExplorerOrder.map((name, index) => [name, index]))

const normalizeExplorerSlug = (slug?: string) => (slug ?? "").replace(/\/index$/, "")

const getExplorerOrder = (node: any) => {
  if (!node?.slug) return null
  const normalized = normalizeExplorerSlug(node.slug)
  const parts = normalized.split("/")

  if (parts[0] === "en" && parts.length > 1) {
    const order = enExplorerOrderMap.get(parts[1])
    if (order !== undefined) {
      return { group: "en", order }
    }
  } else {
    const order = ruExplorerOrderMap.get(parts[0])
    if (order !== undefined) {
      return { group: "ru", order }
    }
  }

  return null
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
  const aExplorerOrder = getExplorerOrder(a)
  const bExplorerOrder = getExplorerOrder(b)

  if (aExplorerOrder && bExplorerOrder) {
    if (
      aExplorerOrder.group === bExplorerOrder.group &&
      aExplorerOrder.order !== bExplorerOrder.order
    ) {
      return aExplorerOrder.order - bExplorerOrder.order
    }
  } else if (aExplorerOrder) {
    return -1
  } else if (bExplorerOrder) {
    return 1
  }

  return baseExplorerSort(a, b)
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
