import { FullSlug, SimpleSlug, simplifySlug } from "../../util/path"
import type { D3Config } from "../Graph"
import { graphData } from "../../util/graph"
import { renderForceGraph } from "./graph-renderer"
import { mountGraphSearch } from "./graph-search"
import { addToVisited, getVisited } from "./graph-visits"

async function renderGraph(
  graph: HTMLElement,
  fullSlug: FullSlug,
  exploration?: {
    origin: SimpleSlug
    selected?: SimpleSlug
    openAtom: (id: SimpleSlug) => void
  },
) {
  const config = JSON.parse(graph.dataset.cfg!) as D3Config
  const index = await fetchData
  const data = graphData(index, (exploration?.origin ?? fullSlug) as FullSlug, config.depth)
  graph.replaceChildren()
  return renderForceGraph(
    graph,
    fullSlug,
    data,
    config,
    getVisited(),
    exploration
      ? {
          nodes: config.depth < 0 ? data.nodes : graphData(index, fullSlug, -1).nodes,
          ...exploration,
        }
      : undefined,
  )
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  let disposed = false
  const cleanups: (() => void)[] = []
  window.addCleanup(() => {
    disposed = true
    cleanups.forEach((cleanup) => cleanup())
  })
  addToVisited(simplifySlug(slug))
  const language = slug.startsWith("en/") ? "en" : slug.startsWith("th/") ? "th" : "ru"
  const copy =
    language === "ru"
      ? {
          links: "Связи",
          outgoing: "Ссылается на",
          incoming: "На него ссылаются",
          empty: "У этого атома пока нет связей",
          error: "Не удалось загрузить граф",
        }
      : language === "th"
        ? {
            links: "การเชื่อมโยง",
            outgoing: "ลิงก์ไปยัง",
            incoming: "ลิงก์มาจาก",
            empty: "หน้านี้ยังไม่มีการเชื่อมโยง",
            error: "โหลดกราฟไม่สำเร็จ",
          }
        : {
            links: "Connections",
            outgoing: "Links to",
            incoming: "Linked from",
            empty: "This page has no connections yet",
            error: "Could not load graph",
          }
  try {
    await fetchData
  } catch {
    return
  }
  if (disposed) return
  for (const component of document.querySelectorAll<HTMLElement>(".graph")) {
    const standalone = component.dataset.autoOpen === "all"
    const local = component.querySelector<HTMLElement>(".graph-container")!
    const overlay = component.querySelector<HTMLElement>(".global-graph-outer")!
    const graph = overlay.querySelector<HTMLElement>(".global-graph-container")!
    const trigger = component.querySelector<HTMLButtonElement>(".global-graph-icon")!
    const close = overlay.querySelector<HTMLButtonElement>(".graph-close")!
    const modes = [...overlay.querySelectorAll<HTMLButtonElement>("[data-graph-depth]")]
    document.body.append(overlay)
    let globalCleanup: ReturnType<typeof renderForceGraph> | undefined
    let localCleanup: ReturnType<typeof renderForceGraph> | undefined
    let generation = 0
    let localGeneration = 0
    let opened = false
    let origin = simplifySlug(slug)
    let returnFocus: HTMLElement = trigger
    let previousOverflow = ""
    const search = mountGraphSearch(
      overlay.querySelector<HTMLElement>(".graph-search")!,
      graphData(await fetchData, slug, -1).nodes,
      language,
      (id) => {
        if (!opened || !globalCleanup?.select(id)) return false
        graph.querySelector<HTMLCanvasElement>("canvas")?.focus({ preventScroll: true })
        return true
      },
      (id) => globalCleanup?.preview(id),
    )
    async function renderLocal() {
      const attempt = ++localGeneration
      localCleanup?.()
      const cleanup = await renderGraph(local, slug)
      if (disposed || attempt !== localGeneration) cleanup()
      else localCleanup = cleanup
    }
    async function renderMode(depth: number, showPageContext = true, selected?: SimpleSlug) {
      const attempt = ++generation
      const config = JSON.parse(graph.dataset.cfg!)
      const view = config.depth < 0 && depth < 0 ? globalCleanup?.getView() : undefined
      globalCleanup?.()
      globalCleanup = undefined
      search.setEnabled(depth < 0)
      graph.dataset.cfg = JSON.stringify({ ...config, depth, showPageContext })
      modes.forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(
            Number(button.dataset.graphDepth) === depth &&
              (button.dataset.graphContext !== "none") === showPageContext,
          ),
        ),
      )
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (disposed || !opened || attempt !== generation) return
      const cleanup = await renderGraph(graph, slug, {
        origin,
        selected,
        openAtom: (id) => {
          if (!opened || disposed || (origin === id && showPageContext)) return
          origin = id
          if (depth < 0 && !showPageContext) {
            void renderMode(-1, true, id)
              .then(() =>
                graph.querySelector<HTMLCanvasElement>("canvas")?.focus({ preventScroll: true }),
              )
              .catch(() => {
                graph.textContent = copy.error
              })
          } else if (depth < 0) globalCleanup?.setOrigin(id)
          else {
            void renderMode(depth, showPageContext, id).catch(() => {
              graph.textContent = copy.error
            })
          }
        },
      })
      if (disposed || !opened || attempt !== generation) cleanup()
      else {
        if (view) cleanup.setView(view)
        globalCleanup = cleanup
        search.setEnabled(depth < 0, true)
      }
    }
    function hide(restoreFocus = true) {
      if (!opened) return
      opened = false
      generation++
      globalCleanup?.()
      globalCleanup = undefined
      search.setEnabled(false)
      overlay.classList.remove("active")
      overlay.hidden = true
      document.body.style.overflow = previousOverflow
      trigger.setAttribute("aria-expanded", "false")
      if (restoreFocus) returnFocus.focus({ preventScroll: true })
    }
    function show(depth = 1, showPageContext = true) {
      if (opened) {
        void renderMode(depth, showPageContext).catch(() => {
          graph.textContent = copy.error
        })
        return
      }
      opened = true
      origin = simplifySlug(slug)
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      overlay.hidden = false
      overlay.classList.add("active")
      trigger.setAttribute("aria-expanded", "true")
      void renderMode(depth, showPageContext).catch(() => {
        graph.textContent = copy.error
      })
      close.focus()
    }
    const open = () => {
      returnFocus = trigger
      show(standalone ? -1 : 1, !standalone)
    }
    const graphLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return
      const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]")
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return
      const url = new URL(link.href, window.location.href)
      const graphSlug = language === "ru" ? "Граф" : `${language}/Graph`
      let targetSlug: string
      try {
        targetSlug = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "")
      } catch {
        return
      }
      if (url.origin !== window.location.origin || targetSlug !== graphSlug) return
      event.preventDefault()
      event.stopPropagation()
      returnFocus = link
      show(-1, false)
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === "g" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault()
        opened ? hide() : open()
      }
      if (opened && event.key === "Escape") {
        event.preventDefault()
        hide()
      }
      if (opened && event.key === "Tab") {
        const items = [
          ...overlay.querySelectorAll<HTMLElement>("button, input, a[href], canvas"),
        ].filter((el) => el.getClientRects().length && el.tabIndex >= 0 && !el.matches(":disabled"))
        const first = items[0],
          last = items.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    trigger.addEventListener("click", open)
    document.addEventListener("click", graphLink, true)
    close.addEventListener("click", () => hide())
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) hide()
    })
    modes.forEach((button) =>
      button.addEventListener("click", () => {
        void renderMode(
          Number(button.dataset.graphDepth),
          button.dataset.graphContext !== "none",
        ).catch(() => {
          graph.textContent = copy.error
        })
      }),
    )
    document.addEventListener("keydown", keydown)
    const theme = () => {
      if (!standalone) {
        void renderLocal().catch(() => {
          local.textContent = copy.error
        })
      }
      if (opened) {
        const config = JSON.parse(graph.dataset.cfg!)
        const selected = graph.querySelector<HTMLCanvasElement>("canvas")?.dataset.selected
        void renderMode(
          config.depth,
          config.showPageContext,
          selected ? (selected as SimpleSlug) : undefined,
        ).catch(() => {
          graph.textContent = copy.error
        })
      }
    }
    document.addEventListener("themechange", theme)
    let resizeTimer: ReturnType<typeof setTimeout>
    const resize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        localCleanup?.resize()
        if (opened) globalCleanup?.resize()
      }, 150)
    }
    window.addEventListener("resize", resize)
    cleanups.push(() => {
      hide(false)
      localGeneration++
      localCleanup?.()
      search.cleanup()
      overlay.remove()
      trigger.removeEventListener("click", open)
      document.removeEventListener("click", graphLink, true)
      document.removeEventListener("keydown", keydown)
      document.removeEventListener("themechange", theme)
      window.removeEventListener("resize", resize)
      clearTimeout(resizeTimer)
    })
    if (standalone) open()
    else {
      await renderLocal().catch(() => {
        local.textContent = copy.error
      })
    }
  }
})
