import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
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
  "Миссия проекта",
  "Как я сюда пришёл",
  "Как устроено исследование",
  "Область исследования",
]

const enExplorerOrder = [
  "Atoms",
  "Mission",
  "How I got here",
  "How the research is structured",
  "Scope of the research",
]

const ruExplorerOrderMap = new Map(ruExplorerOrder.map((name, index) => [name, index]))
const enExplorerOrderMap = new Map(enExplorerOrder.map((name, index) => [name, index]))

const normalizeExplorerSlug = (slug: string) => slug.replace(/\/index$/, "")

const getExplorerOrder = (node: any) => {
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

const explorerSort = (a: any, b: any) => {
  const aOrder = getExplorerOrder(a)
  const bOrder = getExplorerOrder(b)

  if (aOrder && bOrder && aOrder.group === bOrder.group && aOrder.order !== bOrder.order) {
    return aOrder.order - bOrder.order
  }

  if (aOrder && !bOrder) return -1
  if (!aOrder && bOrder) return 1

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
      // i18n: show only one language tree in the explorer
      filterFn: (node) => {
        const p = window.location.pathname
        const isEn = /\/en(\/|$)/.test(p)

        if (node.slugSegment === "tags") return false

        const isEnNode = node.slugSegment === "en" || node.slug.startsWith("en/")
        return isEn ? isEnNode : !isEnNode
      },
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
      // i18n: show only one language tree in the explorer
      filterFn: (node) => {
        const p = window.location.pathname
        const isEn = /\/en(\/|$)/.test(p)

        if (node.slugSegment === "tags") return false

        const isEnNode = node.slugSegment === "en" || node.slug.startsWith("en/")
        return isEn ? isEnNode : !isEnNode
      },
      mapFn: (node) => {
        if (node.slugSegment === "en" && node.isFolder) node.displayName = ""
        return node
      },
      sortFn: explorerSort,
    }),
  ],
  right: [],
}
