import {
  drag,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  pointer,
  select,
  zoom,
  zoomIdentity,
  type SimulationNodeDatum,
} from "d3"
import type { D3Config } from "../Graph"
import { graphNodeRadius, graphView, type GraphLink, type GraphNode } from "../../util/graph"
import { resolveRelative, simplifySlug, type FullSlug, type SimpleSlug } from "../../util/path"

type Node = GraphNode & SimulationNodeDatum & { radius: number }
type Link = { source: Node; target: Node }
type DragSubject = { x: number; y: number; node: Node }

export function renderForceGraph(
  graph: HTMLElement,
  fullSlug: FullSlug,
  data: { nodes: GraphNode[]; links: GraphLink[] },
  config: D3Config,
  visited: Set<SimpleSlug>,
) {
  const slug = simplifySlug(fullSlug)
  const width = Math.max(1, graph.clientWidth),
    height = Math.max(1, graph.clientHeight)
  const full = config.depth < 0
  const expanded = graph.classList.contains("global-graph-container")
  const degree = new Map<SimpleSlug, number>()
  data.links.forEach(({ source, target }) => {
    degree.set(source, (degree.get(source) ?? 0) + 1)
    degree.set(target, (degree.get(target) ?? 0) + 1)
  })
  const nodes: Node[] = data.nodes.map((n) => ({
    ...n,
    radius: graphNodeRadius(degree.get(n.id) ?? 0),
  }))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const links: Link[] = data.links.map((l) => ({
    source: byId.get(l.source)!,
    target: byId.get(l.target)!,
  }))
  const current = byId.get(slug)
  if (current) {
    current.fx = 0
    current.fy = 0
  }
  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-100 * config.repelForce))
    .force("center", forceCenter().strength(config.centerForce))
    .force("link", forceLink<Node, Link>(links).distance(config.linkDistance))
    .force("collide", forceCollide<Node>((n) => n.radius + 2).iterations(3))
    .stop()
  simulation.tick(full ? 160 : 70)

  const canvas = document.createElement("canvas")
  canvas.className = "graph-canvas"
  canvas.tabIndex = 0
  canvas.setAttribute("role", "img")
  canvas.setAttribute(
    "aria-label",
    fullSlug.startsWith("th/")
      ? "กราฟการเชื่อมโยง"
      : fullSlug.startsWith("en/")
        ? "Interactive graph"
        : "Интерактивный граф связей",
  )
  canvas.dataset.nodeCount = String(nodes.length)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    simulation.stop()
    throw new Error("Canvas unavailable")
  }
  graph.append(canvas)
  const css = getComputedStyle(document.documentElement)
  const colors = {
    secondary: css.getPropertyValue("--secondary").trim(),
    visited: css.getPropertyValue("--tertiary").trim(),
    gray: css.getPropertyValue("--gray").trim(),
    light: css.getPropertyValue("--light").trim(),
    text: css.getPropertyValue("--dark").trim(),
  }
  const font = `12px ${css.getPropertyValue("--bodyFont").trim() || "sans-serif"}`
  const view = graphView(nodes, width, height, expanded, full)
  let transform = zoomIdentity.translate(view.x, view.y).scale(view.k)
  let selected: SimpleSlug | null = null
  let hovered: SimpleSlug | null = null
  let dragging = false
  let disposed = false
  let frame = 0
  const card = document.createElement("div")
  card.className = "graph-picked"
  card.hidden = true
  card.setAttribute("aria-live", "polite")
  const name = document.createElement("strong"),
    open = document.createElement("a")
  open.className = "internal"
  open.textContent = fullSlug.startsWith("th/")
    ? "เปิดหน้า"
    : fullSlug.startsWith("en/")
      ? "Open page"
      : "Открыть атом"
  card.append(name, open)
  graph.append(card)
  const ordered = [...nodes].sort((a, b) => b.radius - a.radius)

  function screen(n: Node) {
    return {
      x: transform.applyX(n.x ?? 0),
      y: transform.applyY(n.y ?? 0),
      radius: Math.max(full ? 1.25 : 2, n.radius * transform.k),
    }
  }
  function hit(event: MouseEvent | TouchEvent) {
    const [x, y] = pointer("touches" in event ? event.touches[0] : event, canvas)
    let closest: Node | undefined,
      distance = Infinity
    for (const n of nodes) {
      const p = screen(n),
        delta = Math.hypot(p.x - x, p.y - y)
      if (delta <= Math.max(p.radius, 8) && delta < distance) {
        closest = n
        distance = delta
      }
    }
    return closest
  }
  function choose(n: Node | undefined) {
    selected = n?.id ?? null
    card.hidden = !n || n.id === slug
    if (n) {
      name.textContent = n.text
      open.href = resolveRelative(fullSlug, n.id)
    }
    canvas.dataset.selected = selected ?? ""
    requestDraw()
  }
  function requestDraw() {
    if (!disposed && !frame) frame = requestAnimationFrame(draw)
  }
  function draw() {
    frame = 0
    if (disposed) return
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx!.clearRect(0, 0, width, height)
    const active = hovered ?? selected
    for (const l of links) {
      const from = screen(l.source),
        to = screen(l.target)
      const focused = l.source.id === (active ?? slug) || l.target.id === (active ?? slug)
      ctx!.strokeStyle = focused ? colors.secondary : colors.gray
      ctx!.globalAlpha = focused ? 0.65 : full ? 0.18 : 0.35
      ctx!.lineWidth = focused ? 1 : 0.7
      ctx!.beginPath()
      ctx!.moveTo(from.x, from.y)
      ctx!.lineTo(to.x, to.y)
      ctx!.stroke()
    }
    ctx!.globalAlpha = 1
    for (const n of nodes) {
      const p = screen(n)
      ctx!.fillStyle =
        n.id === slug || n.id === active
          ? colors.secondary
          : visited.has(n.id)
            ? colors.visited
            : colors.gray
      ctx!.beginPath()
      ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx!.fill()
    }
    ctx!.font = font
    ctx!.textAlign = "center"
    ctx!.textBaseline = "bottom"
    ctx!.lineJoin = "round"
    const boxes: { left: number; right: number; top: number; bottom: number }[] = []
    const labelled = new Set<SimpleSlug>()
    const priority = byId.get(active ?? slug)
    const candidates = priority ? [priority, ...ordered.filter((n) => n !== priority)] : ordered
    const showAll = nodes.length <= 16 || transform.k / view.k >= 2.2
    const cardHeight = card.hidden ? 0 : card.offsetHeight + 16
    for (const n of candidates) {
      if (n.id === slug || (!showAll && n.id !== active)) continue
      const p = screen(n)
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) continue
      const size = ctx!.measureText(n.text).width
      if (size + 8 > width) continue
      const x = Math.max(size / 2 + 4, Math.min(width - size / 2 - 4, p.x))
      for (const offset of [-p.radius - 5, p.radius + 19, -p.radius - 23]) {
        const y = p.y + offset
        const box = { left: x - size / 2 - 3, right: x + size / 2 + 3, top: y - 14, bottom: y + 3 }
        if (
          box.top < 0 ||
          box.bottom > height - cardHeight ||
          boxes.some(
            (b) =>
              box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top,
          )
        )
          continue
        boxes.push(box)
        ctx!.strokeStyle = colors.light
        ctx!.lineWidth = 3
        ctx!.strokeText(n.text, x, y)
        ctx!.fillStyle = colors.text
        ctx!.fillText(n.text, x, y)
        labelled.add(n.id)
        break
      }
    }
    canvas.dataset.labelCount = String(labelled.size)
    canvas.dataset.scale = String(transform.k)
  }

  const selection = select(canvas)
  const zoomer = zoom<HTMLCanvasElement, unknown>()
    .extent([
      [0, 0],
      [width, height],
    ])
    .scaleExtent([Math.min(0.08, view.k / 3), Math.max(4, view.k * 6)])
    .filter((event: MouseEvent | TouchEvent) => {
      if (!config.zoom || ("button" in event && event.button !== 0)) return false
      if (
        (event.type === "mousedown" ||
          (event.type === "touchstart" && "touches" in event && event.touches.length === 1)) &&
        config.drag &&
        hit(event)
      )
        return false
      return true
    })
    .on("zoom", ({ transform: next }) => {
      transform = next
      requestDraw()
    })
  selection.call(zoomer).on("dblclick.zoom", null)
  selection.call(zoomer.transform, transform)
  if (config.drag) {
    let start: { x: number; y: number } | undefined
    let dragDistance = 0
    selection.call(
      drag<HTMLCanvasElement, unknown, DragSubject | undefined>()
        .container(() => canvas)
        .clickDistance(5)
        .subject((event) => {
          const n = hit(event.sourceEvent)
          if (!n) return undefined
          const p = screen(n)
          return { x: p.x, y: p.y, node: n }
        })
        .on("start", (event) => {
          dragging = true
          start = { x: event.x, y: event.y }
          dragDistance = 0
          hovered = event.subject.node.id
          event.subject.node.fx = event.subject.node.x
          event.subject.node.fy = event.subject.node.y
          simulation.alphaTarget(0.25).restart()
        })
        .on("drag", (event) => {
          if (start)
            dragDistance = Math.max(dragDistance, Math.hypot(event.x - start.x, event.y - start.y))
          event.subject.node.fx = transform.invertX(event.x)
          event.subject.node.fy = transform.invertY(event.y)
          requestDraw()
        })
        .on("end", (event) => {
          simulation.alphaTarget(0)
          const n = event.subject.node
          if (n.id !== slug) {
            n.fx = null
            n.fy = null
          }
          dragging = false
          hovered = null
          if (start && dragDistance < 5) choose(n)
          requestDraw()
        }),
    )
  }
  const move = (event: MouseEvent) => {
    if (dragging) return
    hovered = hit(event)?.id ?? null
    canvas.style.cursor = hovered ? "grab" : "default"
    requestDraw()
  }
  const leave = () => {
    if (!dragging) {
      hovered = null
      requestDraw()
    }
  }
  const keydown = (event: KeyboardEvent) => {
    if (!event.key.startsWith("Arrow") && event.key !== "Enter") return
    event.preventDefault()
    if (event.key === "Enter") {
      if (selected && selected !== slug) window.spaNavigate(new URL(open.href))
      return
    }
    const index = ordered.findIndex((n) => n.id === selected)
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1
    choose(ordered[(index + step + ordered.length) % ordered.length])
  }
  canvas.addEventListener("mousemove", move)
  canvas.addEventListener("mouseleave", leave)
  canvas.addEventListener("keydown", keydown)
  simulation.on("tick", requestDraw).restart()
  draw()
  return () => {
    disposed = true
    cancelAnimationFrame(frame)
    simulation.stop().on("tick", null)
    selection.on(".zoom", null).on(".drag", null)
    canvas.removeEventListener("mousemove", move)
    canvas.removeEventListener("mouseleave", leave)
    canvas.removeEventListener("keydown", keydown)
    canvas.remove()
    card.remove()
  }
}
