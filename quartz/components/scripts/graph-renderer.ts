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
import {
  graphFocus,
  graphLabelPolicy,
  graphLabelRequired,
  graphNodeRadius,
  graphView,
  type GraphLink,
  type GraphNode,
} from "../../util/graph"
import { resolveRelative, simplifySlug, type FullSlug, type SimpleSlug } from "../../util/path"
import { graphArticleTarget } from "../../util/graph-article"
import { loadGraphArticle } from "./graph-article"
import {
  graphFocusLabelPlacement,
  graphLabelPlacement,
  graphLabelText,
  type GraphLabelBox,
} from "../../util/graph-labels"

type Node = GraphNode & SimulationNodeDatum & { radius: number }
type Link = { source: Node; target: Node }
type DragSubject = { x: number; y: number; node: Node }

export function renderForceGraph(
  graph: HTMLElement,
  fullSlug: FullSlug,
  data: { nodes: GraphNode[]; links: GraphLink[] },
  config: D3Config,
  visited: Set<SimpleSlug>,
  articleOptions?: {
    nodes: GraphNode[]
    selected?: SimpleSlug
    center?: SimpleSlug
    selectOutside: (id: SimpleSlug) => void
  },
) {
  const slug = articleOptions?.center ?? simplifySlug(fullSlug)
  let width = Math.max(1, graph.clientWidth),
    height = Math.max(1, graph.clientHeight)
  const full = config.depth < 0
  const expanded = graph.classList.contains("global-graph-container")
  const expandButton = expanded
    ? null
    : graph.parentElement?.querySelector<HTMLElement>(".global-graph-icon")
  const pageContext = !full || config.showPageContext !== false
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
  if (current && !full) {
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
  canvas.dataset.viewMode = !full ? "connections" : pageContext ? "paths" : "all"
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
  const fontSize = expanded ? 14 : 12
  const lineHeight = fontSize + 4
  const font = `${fontSize}px ${css.getPropertyValue("--bodyFont").trim() || "sans-serif"}`
  const view = graphView(nodes, width, height, expanded, full)
  let transform = zoomIdentity.translate(view.x, view.y).scale(view.k)
  let selected: SimpleSlug | null = null
  let hovered: SimpleSlug | null = null
  let previewed: SimpleSlug | null = null
  let dragging = false
  let disposed = false
  let frame = 0
  const card = document.createElement("div")
  card.className = "graph-picked"
  card.hidden = true
  card.setAttribute("aria-live", "polite")
  if (expanded) card.classList.add("graph-article")
  const name = document.createElement("strong"),
    open = document.createElement("a")
  const openText = fullSlug.startsWith("th/")
    ? "เปิดหน้า"
    : fullSlug.startsWith("en/")
      ? "Open"
      : "Открыть"
  open.className = "internal"
  open.textContent = openText
  const articleBody = document.createElement("div")
  articleBody.className = "graph-article-body"
  const articleCopy = fullSlug.startsWith("th/")
    ? { loading: "กำลังโหลดข้อความ…", error: "โหลดข้อความไม่สำเร็จ โปรดลองเลือกอะตอมอีกครั้ง" }
    : fullSlug.startsWith("en/")
      ? {
          loading: "Loading text…",
          error: "Could not load the text. Select the atom again to retry.",
        }
      : {
          loading: "Загружаю текст…",
          error: "Не удалось загрузить текст. Нажмите на атом ещё раз.",
        }
  const knownArticles = new Set((articleOptions?.nodes ?? data.nodes).map((n) => n.id))
  let articleGeneration = 0
  card.append(name, expanded ? articleBody : open)
  graph.append(card)
  const ordered = [...nodes].sort((a, b) => b.radius - a.radius)
  const focusCache = new Map<SimpleSlug, ReturnType<typeof graphFocus>>()
  let lastTouchTime = -Infinity

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
    previewed = null
    selected = n?.id ?? null
    const attempt = ++articleGeneration
    card.hidden = !n || (!expanded && pageContext && n.id === slug)
    if (n) {
      name.textContent = n.text
      open.href = resolveRelative(fullSlug, n.id)
      if (expanded) {
        card.setAttribute("aria-busy", "true")
        articleBody.textContent = articleCopy.loading
        articleBody.scrollTop = 0
        void loadGraphArticle(new URL(open.href))
          .then((article) => {
            if (disposed || attempt !== articleGeneration) return
            article.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
              if (
                graphArticleTarget(
                  link.href,
                  window.location.href,
                  knownArticles,
                  link.dataset.slug,
                )
              )
                link.dataset.routerIgnore = ""
            })
            articleBody.replaceChildren(article)
          })
          .catch(() => {
            if (!disposed && attempt === articleGeneration)
              articleBody.textContent = articleCopy.error
          })
          .finally(() => {
            if (disposed || attempt !== articleGeneration) return
            card.setAttribute("aria-busy", "false")
            requestDraw()
          })
      }
    }
    canvas.dataset.selected = selected ?? ""
    requestDraw()
  }
  function navigate(n: Node | undefined) {
    if (n && (n.id !== slug || !pageContext))
      window.spaNavigate(new URL(resolveRelative(fullSlug, n.id), window.location.href))
  }
  function tap(n: Node | undefined) {
    if (!expanded && n && selected === n.id && (n.id !== slug || !pageContext)) navigate(n)
    else choose(n)
  }
  const articleClick = (event: MouseEvent) => {
    const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]")
    if (
      !link ||
      !card.contains(link) ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    if (link.dataset.graphFragment) {
      event.preventDefault()
      event.stopPropagation()
      articleBody
        .querySelector(`#${CSS.escape(link.dataset.graphFragment)}`)
        ?.scrollIntoView({ block: "nearest" })
      return
    }
    const id = graphArticleTarget(link.href, window.location.href, knownArticles, link.dataset.slug)
    if (id === undefined) return
    event.preventDefault()
    event.stopPropagation()
    const target = byId.get(id)
    if (target) choose(target)
    else articleOptions?.selectOutside(id)
  }
  if (expanded) card.addEventListener("click", articleClick)
  function requestDraw() {
    if (!disposed && !frame) frame = requestAnimationFrame(draw)
  }
  function focusFor(id: SimpleSlug) {
    if (!focusCache.has(id))
      focusCache.set(id, graphFocus(data.links, id, pageContext ? slug : undefined))
    return focusCache.get(id)!
  }
  function draw() {
    frame = 0
    if (disposed) return
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx!.clearRect(0, 0, width, height)
    const active = previewed ?? selected ?? hovered
    const constellationId = expanded ? selected : null
    const constellation = constellationId !== null
    const focus = constellation
      ? focusFor(constellationId)
      : { nodes: new Set(active ? [active] : []), links: new Set<number>() }
    const positions = new Map(nodes.map((n) => [n.id, screen(n)] as const))
    const labelNodes = [...positions.values()].filter(
      (p) =>
        p.x + p.radius >= 0 &&
        p.x - p.radius <= width &&
        p.y + p.radius >= 0 &&
        p.y - p.radius <= height,
    )
    const labelLines = links.map((l) => ({
      source: positions.get(l.source.id)!,
      target: positions.get(l.target.id)!,
    }))
    for (const [index, l] of links.entries()) {
      const { source: from, target: to } = labelLines[index]
      const central = !full && (l.source.id === slug || l.target.id === slug)
      const focused = constellation && focus.links.has(index)
      ctx!.strokeStyle = central ? colors.secondary : colors.gray
      ctx!.globalAlpha = constellation
        ? focused
          ? 0.85
          : 0.035
        : central
          ? 0.65
          : full
            ? 0.18
            : 0.35
      ctx!.lineWidth = central || focused ? 1 : 0.7
      ctx!.beginPath()
      ctx!.moveTo(from.x, from.y)
      ctx!.lineTo(to.x, to.y)
      ctx!.stroke()
    }
    ctx!.globalAlpha = 1
    for (const n of nodes) {
      const p = positions.get(n.id)!
      ctx!.fillStyle =
        (pageContext && n.id === slug) || n.id === active || n.id === selected
          ? colors.secondary
          : pageContext && visited.has(n.id)
            ? colors.visited
            : colors.gray
      ctx!.beginPath()
      ctx!.globalAlpha = constellation && !focus.nodes.has(n.id) && n.id !== previewed ? 0.18 : 1
      ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx!.fill()
    }
    ctx!.globalAlpha = 1
    ctx!.font = font
    ctx!.textAlign = "center"
    ctx!.textBaseline = "middle"
    ctx!.lineJoin = "round"
    const boxes: GraphLabelBox[] = expanded
      ? []
      : [
          {
            left: width - (expandButton?.offsetWidth ?? 36) - 12,
            right: width,
            top: 0,
            bottom: (expandButton?.offsetHeight ?? 36) + 12,
          },
        ]
    const labelled = new Set<SimpleSlug>()
    const priorityId = previewed ?? hovered ?? selected ?? (pageContext ? slug : null)
    const priority = priorityId === null ? undefined : byId.get(priorityId)
    const policy = graphLabelPolicy(
      nodes.length,
      transform.k / view.k,
      expanded,
      full,
      width * height,
    )
    const order = constellation
      ? [
          ...ordered.filter((n) => focus.nodes.has(n.id)),
          ...ordered.filter((n) => !focus.nodes.has(n.id)),
        ]
      : ordered
    const candidates = priority ? [priority, ...order.filter((n) => n !== priority)] : order
    const cardHeight = card.hidden ? 0 : card.offsetHeight + 16
    const focusLabelNodes = nodes
      .filter((n) => focus.nodes.has(n.id))
      .map((n) => positions.get(n.id)!)
    const focusLabelLines = labelLines.filter((_, index) => focus.links.has(index))
    let focusLabelCount = 0
    for (const n of candidates) {
      const required = graphLabelRequired(
        n.id,
        slug,
        previewed ?? hovered,
        selected,
        expanded,
        full,
        pageContext,
      )
      if (
        !required &&
        ((constellation && !focus.nodes.has(n.id)) ||
          (n.id === slug && !expanded) ||
          policy.level === "none" ||
          labelled.size >= policy.limit ||
          [...n.text].length > policy.maxLength)
      )
        continue
      const p = positions.get(n.id)!
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) continue
      ctx!.font = font
      const lines = required
        ? graphLabelText(n.text, Math.max(1, width - 24), (text) => ctx!.measureText(text).width)
        : [n.text]
      const size = {
        width: Math.max(...lines.map((text) => ctx!.measureText(text).width)),
        height: lines.length * lineHeight,
      }
      const origin = (pageContext ? positions.get(slug) : undefined) ?? {
        x: width / 2,
        y: height / 2,
      }
      const bounds = { width, height: height - cardHeight }
      const obstacles = {
        nodes: constellation
          ? focusLabelNodes
          : full
            ? labelNodes.filter((other) => other === p || other.radius >= Math.max(p.radius, 5))
            : labelNodes,
        lines: constellation ? focusLabelLines : labelLines,
        boxes,
      }
      // Lines are a soft obstacle: dense hubs need captions too.
      const caption =
        graphLabelPlacement(p, size, origin, bounds, obstacles) ??
        graphLabelPlacement(p, size, origin, bounds, { ...obstacles, lines: [] }) ??
        (required ? graphFocusLabelPlacement(p, size, origin, bounds, obstacles) : undefined)
      if (!caption) continue
      boxes.push(caption.box)
      const anchorX = Math.max(caption.box.left, Math.min(caption.box.right, p.x))
      const anchorY = Math.max(caption.box.top, Math.min(caption.box.bottom, p.y))
      if (constellation && required && Math.hypot(anchorX - p.x, anchorY - p.y) > p.radius + 24) {
        ctx!.strokeStyle = colors.gray
        ctx!.lineWidth = 0.6
        ctx!.globalAlpha = 0.5
        ctx!.setLineDash([2, 3])
        ctx!.beginPath()
        ctx!.moveTo(p.x, p.y)
        ctx!.lineTo(anchorX, anchorY)
        ctx!.stroke()
        ctx!.setLineDash([])
        ctx!.globalAlpha = 1
      }
      ctx!.strokeStyle = colors.light
      ctx!.lineWidth = 3
      ctx!.fillStyle = colors.text
      lines.forEach((text, index) => {
        const y = caption.y + (index - (lines.length - 1) / 2) * lineHeight
        ctx!.strokeText(text, caption.x, y)
        ctx!.fillText(text, caption.x, y)
      })
      labelled.add(n.id)
      if (focus.nodes.has(n.id)) focusLabelCount++
    }
    canvas.dataset.labelCount = String(labelled.size)
    canvas.dataset.labelLevel = policy.level
    canvas.dataset.labelMaxLength = String(policy.maxLength)
    canvas.dataset.focusNodeCount = String(focus.nodes.size)
    canvas.dataset.focusLinkCount = String(focus.links.size)
    canvas.dataset.focusMode = constellation ? "constellation" : active ? "node" : "none"
    canvas.dataset.focusLabelCount = String(focusLabelCount)
    canvas.dataset.focusVisibleNodeCount = String(
      nodes.filter((n) => {
        const p = positions.get(n.id)!
        return focus.nodes.has(n.id) && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height
      }).length,
    )
    canvas.dataset.scale = String(transform.k)
    canvas.dataset.previewed = previewed ?? ""
  }

  const selection = select(canvas)
  const zoomer = zoom<HTMLCanvasElement, unknown>()
    .extent((): [[number, number], [number, number]] => [
      [0, 0],
      [width, height],
    ])
    .scaleExtent([Math.min(0.08, view.k / 3), Math.max(4, view.k * 6)])
    .filter((event: MouseEvent | TouchEvent) => {
      if (!config.zoom || ("button" in event && event.button !== 0)) return false
      if (event.type === "mousedown" && performance.now() - lastTouchTime < 600) return false
      if (
        (event.type === "mousedown" ||
          (event.type === "touchstart" && "touches" in event && event.touches.length === 1)) &&
        config.drag &&
        hit(event)
      )
        return false
      return true
    })
    .on("start", () => {
      // Zoom changes the view, not the layout. Never reheat the simulation for a pinch.
      simulation.stop()
    })
    .on("zoom", ({ transform: next }) => {
      transform = next
      requestDraw()
    })
  selection.call(zoomer).on("dblclick.zoom", null)
  selection.call(zoomer.transform, transform)
  function startNodeDrag(n: Node) {
    n.fx = n.x
    n.fy = n.y
    simulation.alphaTarget(0.25).restart()
  }
  function finishNodeDrag(n: Node) {
    simulation.alphaTarget(0)
    if (n.id !== slug || full) {
      n.fx = null
      n.fy = null
    }
  }
  if (config.drag) {
    let start: { x: number; y: number } | undefined
    let dragDistance = 0
    let moved = false
    selection.call(
      drag<HTMLCanvasElement, unknown, DragSubject | undefined>()
        .container(() => canvas)
        .touchable(() => false)
        // Touch browsers can emit compatibility mouse events after the same tap.
        .filter((event: MouseEvent) => !event.button && performance.now() - lastTouchTime >= 600)
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
          moved = false
          hovered = event.subject.node.id
          simulation.stop()
        })
        .on("drag", (event) => {
          if (start)
            dragDistance = Math.max(dragDistance, Math.hypot(event.x - start.x, event.y - start.y))
          if (!moved && dragDistance < 5) return
          if (!moved) {
            moved = true
            startNodeDrag(event.subject.node)
          }
          event.subject.node.fx = transform.invertX(event.x)
          event.subject.node.fy = transform.invertY(event.y)
          requestDraw()
        })
        .on("end", (event) => {
          const n = event.subject.node
          if (moved) finishNodeDrag(n)
          dragging = false
          hovered = null
          if (start && dragDistance < 5) tap(n)
          requestDraw()
        }),
    )
  }
  const touches = new Set<number>()
  let pinching = false
  let backgroundPress: { id: number; x: number; y: number } | undefined
  const backgroundDown = (event: PointerEvent) => {
    backgroundPress =
      event.isPrimary && event.button === 0 && !hit(event)
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : undefined
  }
  const backgroundMove = (event: PointerEvent) => {
    if (
      backgroundPress?.id === event.pointerId &&
      Math.hypot(event.clientX - backgroundPress.x, event.clientY - backgroundPress.y) >= 5
    )
      backgroundPress = undefined
  }
  const backgroundUp = (event: PointerEvent) => {
    if (backgroundPress?.id !== event.pointerId) return
    const stationary =
      Math.hypot(event.clientX - backgroundPress.x, event.clientY - backgroundPress.y) < 5
    backgroundPress = undefined
    // A background tap clears the selection; panning, pinching and cancellation do not.
    if (event.type === "pointerup" && stationary && !pinching && !hit(event)) {
      hovered = null
      choose(undefined)
    }
  }
  let touchDrag: { id: number; node: Node; x: number; y: number; moved: boolean } | undefined
  const touchDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return
    lastTouchTime = performance.now()
    touches.add(event.pointerId)
    if (touches.size > 1) {
      pinching = true
      if (touchDrag?.moved) finishNodeDrag(touchDrag.node)
      touchDrag = undefined
      dragging = false
      hovered = null
      simulation.stop()
      requestDraw()
      return
    }
    const n = hit(event)
    if (!pinching && config.drag && n) {
      touchDrag = { id: event.pointerId, node: n, x: event.clientX, y: event.clientY, moved: false }
      dragging = true
      simulation.stop()
      canvas.setPointerCapture(event.pointerId)
    }
  }
  const touchMove = (event: PointerEvent) => {
    if (!touchDrag || event.pointerId !== touchDrag.id || pinching) return
    const distance = Math.hypot(event.clientX - touchDrag.x, event.clientY - touchDrag.y)
    if (!touchDrag.moved && distance < 5) return
    if (!touchDrag.moved) {
      touchDrag.moved = true
      startNodeDrag(touchDrag.node)
    }
    const [x, y] = pointer(event, canvas)
    touchDrag.node.fx = transform.invertX(x)
    touchDrag.node.fy = transform.invertY(y)
    hovered = touchDrag.node.id
    requestDraw()
  }
  const touchUp = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return
    lastTouchTime = performance.now()
    touches.delete(event.pointerId)
    if (touchDrag?.id === event.pointerId) {
      if (touchDrag.moved) finishNodeDrag(touchDrag.node)
      else if (!pinching && event.type !== "pointercancel") tap(touchDrag.node)
      touchDrag = undefined
      dragging = false
      hovered = null
      requestDraw()
    }
    if (!touches.size) pinching = false
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
      if (expanded && selected) choose(byId.get(selected))
      else if (selected && (selected !== slug || !pageContext))
        window.spaNavigate(new URL(open.href))
      return
    }
    const index = ordered.findIndex((n) => n.id === selected)
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1
    choose(ordered[(index + step + ordered.length) % ordered.length])
  }
  canvas.addEventListener("mousemove", move)
  canvas.addEventListener("mouseleave", leave)
  canvas.addEventListener("keydown", keydown)
  canvas.addEventListener("pointerdown", backgroundDown)
  canvas.addEventListener("pointermove", backgroundMove)
  canvas.addEventListener("pointerup", backgroundUp)
  canvas.addEventListener("pointercancel", backgroundUp)
  canvas.addEventListener("pointerdown", touchDown)
  canvas.addEventListener("pointermove", touchMove)
  canvas.addEventListener("pointerup", touchUp)
  canvas.addEventListener("pointercancel", touchUp)
  simulation.on("tick", requestDraw)
  if (!full) simulation.restart()
  draw()
  if (articleOptions?.selected) choose(byId.get(articleOptions.selected))
  const cleanup = () => {
    disposed = true
    articleGeneration++
    card.removeEventListener("click", articleClick)
    cancelAnimationFrame(frame)
    simulation.stop().on("tick", null)
    selection.on(".zoom", null).on(".drag", null)
    canvas.removeEventListener("mousemove", move)
    canvas.removeEventListener("mouseleave", leave)
    canvas.removeEventListener("keydown", keydown)
    canvas.removeEventListener("pointerdown", backgroundDown)
    canvas.removeEventListener("pointermove", backgroundMove)
    canvas.removeEventListener("pointerup", backgroundUp)
    canvas.removeEventListener("pointercancel", backgroundUp)
    canvas.removeEventListener("pointerdown", touchDown)
    canvas.removeEventListener("pointermove", touchMove)
    canvas.removeEventListener("pointerup", touchUp)
    canvas.removeEventListener("pointercancel", touchUp)
    canvas.remove()
    card.remove()
  }
  return Object.assign(cleanup, {
    preview(id?: SimpleSlug) {
      if (disposed) return
      const next = id !== undefined && byId.has(id) ? id : null
      if (previewed === next) return
      previewed = next
      requestDraw()
    },
    select(id: SimpleSlug) {
      const node = byId.get(id)
      if (disposed || !node) return false
      choose(node)
      return true
    },
    resize() {
      const nextWidth = Math.max(1, graph.clientWidth),
        nextHeight = Math.max(1, graph.clientHeight)
      if (disposed || (width === nextWidth && height === nextHeight)) return
      transform = zoomIdentity
        .translate(transform.x + (nextWidth - width) / 2, transform.y + (nextHeight - height) / 2)
        .scale(transform.k)
      width = nextWidth
      height = nextHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      selection.call(zoomer.transform, transform)
      requestDraw()
    },
  })
}
