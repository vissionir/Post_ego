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
  const aSlug = (a?.slug ?? "").replace(/\/index$/, "")
  const bSlug = (b?.slug ?? "").replace(/\/index$/, "")
  const aParts = aSlug.split("/")
  const bParts = bSlug.split("/")

  let aGroup: "ru" | "en" | null = null
  let bGroup: "ru" | "en" | null = null
  let aOrder = -1
  let bOrder = -1

  const ruOrder = ["Атомы", "Миссия", "Как я сюда пришёл", "Как устроено исследование", "Область исследования"]
  const enOrder = ["Атомы", "Миссия", "Как я сюда пришёл", "Как устроено исследование", "Область исследования"]

  if (aParts[0] === "en" && aParts.length > 1) {
    aGroup = "en"
    aOrder = enOrder.indexOf(aParts[1])
  } else {
    aGroup = "ru"
    aOrder = ruOrder.indexOf(aParts[0])
  }

  if (bParts[0] === "en" && bParts.length > 1) {
    bGroup = "en"
    bOrder = enOrder.indexOf(bParts[1])
  } else {
    bGroup = "ru"
    bOrder = ruOrder.indexOf(bParts[0])
  }

  if (aOrder >= 0 && bOrder >= 0 && aGroup === bGroup && aOrder !== bOrder) {
    return aOrder - bOrder
  }

  if (aOrder >= 0 && bOrder < 0) return -1
  if (aOrder < 0 && bOrder >= 0) return 1

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
