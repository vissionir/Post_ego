import { FullSlug, SimpleSlug, simplifySlug } from "../../util/path"
import type { D3Config } from "../Graph"
import { graphData } from "../../util/graph"
import { renderForceGraph } from "./graph-renderer"

const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  try {
    const value = JSON.parse(localStorage.getItem(localStorageKey) ?? "[]")
    return new Set(Array.isArray(value) ? value : [])
  } catch {
    return new Set()
  }
}

function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  try {
    localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
  } catch {
    /* Private browsing may disable storage. */
  }
}

async function renderGraph(graph: HTMLElement, fullSlug: FullSlug) {
  const config = JSON.parse(graph.dataset.cfg!) as D3Config
  const data = graphData(await fetchData, fullSlug, config.depth)
  graph.replaceChildren()
  return renderForceGraph(graph, fullSlug, data, config, getVisited())
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
    let previousOverflow = ""
    async function renderLocal() {
      const attempt = ++localGeneration
      localCleanup?.()
      const cleanup = await renderGraph(local, slug)
      if (disposed || attempt !== localGeneration) cleanup()
      else localCleanup = cleanup
    }
    async function renderMode(depth: number, showPageContext = true) {
      const attempt = ++generation
      globalCleanup?.()
      const config = JSON.parse(graph.dataset.cfg!)
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
      const cleanup = await renderGraph(graph, slug)
      if (disposed || !opened || attempt !== generation) cleanup()
      else globalCleanup = cleanup
    }
    function hide(restoreFocus = true) {
      if (!opened) return
      opened = false
      generation++
      globalCleanup?.()
      globalCleanup = undefined
      overlay.classList.remove("active")
      overlay.hidden = true
      document.body.style.overflow = previousOverflow
      trigger.setAttribute("aria-expanded", "false")
      if (restoreFocus) trigger.focus()
    }
    function show() {
      if (opened) return
      opened = true
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      overlay.hidden = false
      overlay.classList.add("active")
      trigger.setAttribute("aria-expanded", "true")
      void renderMode(1).catch(() => {
        graph.textContent = copy.error
      })
      close.focus()
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === "g" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault()
        opened ? hide() : show()
      }
      if (opened && event.key === "Escape") {
        event.preventDefault()
        hide()
      }
      if (opened && event.key === "Tab") {
        const items = [...overlay.querySelectorAll<HTMLElement>("button, a[href], canvas")].filter(
          (el) => el.getClientRects().length,
        )
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
    trigger.addEventListener("click", show)
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
      void renderLocal().catch(() => {
        local.textContent = copy.error
      })
      if (opened) {
        const config = JSON.parse(graph.dataset.cfg!)
        void renderMode(config.depth, config.showPageContext).catch(() => {
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
      overlay.remove()
      trigger.removeEventListener("click", show)
      document.removeEventListener("keydown", keydown)
      document.removeEventListener("themechange", theme)
      window.removeEventListener("resize", resize)
      clearTimeout(resizeTimer)
    })
    await renderLocal().catch(() => {
      local.textContent = copy.error
    })
  }
})
