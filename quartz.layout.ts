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
        const isEn = p === "/en/" || p.startsWith("/en/")

        if (node.slugSegment === "tags") return false

        const isEnNode = node.slugSegment === "en" || node.slug.startsWith("en/")
        return isEn ? isEnNode : !isEnNode
      },
      mapFn: (node) => {
        if (node.slugSegment === "en" && node.isFolder) node.displayName = ""
        return node
      },
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
        const isEn = p === "/en/" || p.startsWith("/en/")

        if (node.slugSegment === "tags") return false

        const isEnNode = node.slugSegment === "en" || node.slug.startsWith("en/")
        return isEn ? isEnNode : !isEnNode
      },
      mapFn: (node) => {
        if (node.slugSegment === "en" && node.isFolder) node.displayName = ""
        return node
      },
    }),
  ],
  right: [],
}
