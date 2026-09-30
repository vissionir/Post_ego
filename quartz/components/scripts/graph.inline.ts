import {
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceRadial,
  zoomIdentity,
  select,
  drag,
  zoom,
} from "d3"
import { Text, Graphics, Application, Container, Circle, isWebGLSupported } from "pixi.js"
import { Group as TweenGroup, Tween as Tweened } from "@tweenjs/tween.js"
import { removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"
import { graphData as selectGraphData } from "../../util/graph"

type GraphicsInfo = {
  color: string
  gfx: Graphics
  alpha: number
  active: boolean
}

type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
} & SimulationNodeDatum

type LinkData = {
  source: NodeData
  target: NodeData
} & SimulationLinkDatum<NodeData>

type LinkRenderData = GraphicsInfo & {
  simulationData: LinkData
}

type NodeRenderData = GraphicsInfo & {
  simulationData: NodeData
  label: Text
}

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

type TweenNode = {
  update: (time: number) => void
  stop: () => void
}

async function renderGraph(graph: HTMLElement, fullSlug: FullSlug) {
  const slug = simplifySlug(fullSlug)
  const visited = getVisited()
  removeAllChildren(graph)

  let {
    drag: enableDrag,
    zoom: enableZoom,
    depth,
    scale,
    repelForce,
    centerForce,
    linkDistance,
    fontSize,
    opacityScale,
    focusOnHover,
    enableRadial,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config

  const selected = selectGraphData(await fetchData, fullSlug, depth)
  const tweens = new Map<string, TweenNode>()
  const nodes: NodeData[] = selected.nodes.map((node) => ({ ...node, tags: [] }))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const graphData: { nodes: NodeData[]; links: LinkData[] } = {
    nodes,
    links: selected.links.map((link) => ({
      source: byId.get(link.source)!,
      target: byId.get(link.target)!,
    })),
  }

  const width = graph.offsetWidth
  const height = Math.max(graph.offsetHeight, 250)

  // we virtualize the simulation and use pixi to actually render it
  const simulation: Simulation<NodeData, LinkData> = forceSimulation<NodeData>(graphData.nodes)
    .force("charge", forceManyBody().strength(-100 * repelForce))
    .force("center", forceCenter().strength(centerForce))
    .force("link", forceLink(graphData.links).distance(linkDistance))
    .force("collide", forceCollide<NodeData>((n) => nodeRadius(n)).iterations(3))

  const currentNode = nodes.find((node) => node.id === slug)
  if (currentNode) {
    currentNode.fx = 0
    currentNode.fy = 0
  }

  const radius = (Math.min(width, height) / 2) * 0.8
  if (enableRadial) simulation.force("radial", forceRadial(radius).strength(0.2))

  // precompute style prop strings as pixi doesn't support css variables
  const cssVars = [
    "--secondary",
    "--tertiary",
    "--gray",
    "--light",
    "--lightgray",
    "--dark",
    "--darkgray",
    "--bodyFont",
  ] as const
  const computedStyleMap = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  // calculate color
  const color = (d: NodeData) => {
    const isCurrent = d.id === slug
    if (isCurrent) {
      return computedStyleMap["--secondary"]
    } else if (visited.has(d.id) || d.id.startsWith("tags/")) {
      return computedStyleMap["--tertiary"]
    } else {
      return computedStyleMap["--gray"]
    }
  }

  function nodeRadius(d: NodeData) {
    const numLinks = graphData.links.filter(
      (l) => l.source.id === d.id || l.target.id === d.id,
    ).length
    return 2 + Math.sqrt(numLinks)
  }

  let hoveredNodeId: string | null = null
  let hoveredNeighbours: Set<string> = new Set()
  const linkRenderData: LinkRenderData[] = []
  const nodeRenderData: NodeRenderData[] = []
  function updateHoverInfo(newHoveredId: string | null) {
    newHoveredId ??= slug
    hoveredNodeId = newHoveredId

    if (newHoveredId === null) {
      hoveredNeighbours = new Set()
      for (const n of nodeRenderData) {
        n.active = false
      }

      for (const l of linkRenderData) {
        l.active = false
      }
    } else {
      hoveredNeighbours = new Set([newHoveredId])
      for (const l of linkRenderData) {
        const linkData = l.simulationData
        if (linkData.source.id === newHoveredId || linkData.target.id === newHoveredId) {
          hoveredNeighbours.add(linkData.source.id)
          hoveredNeighbours.add(linkData.target.id)
        }

        l.active = linkData.source.id === newHoveredId || linkData.target.id === newHoveredId
      }

      for (const n of nodeRenderData) {
        n.active = hoveredNeighbours.has(n.simulationData.id)
      }
    }
  }

  let dragStartTime = 0
  let dragging = false

  function renderLinks() {
    tweens.get("link")?.stop()
    const tweenGroup = new TweenGroup()

    for (const l of linkRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      // with full alpha and the rest with default alpha
      if (hoveredNodeId) {
        alpha = l.active ? 1 : 0.2
      }

      l.color = l.active ? computedStyleMap["--secondary"] : computedStyleMap["--lightgray"]
      tweenGroup.add(new Tweened<LinkRenderData>(l).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("link", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderLabels() {
    tweens.get("label")?.stop()
    const tweenGroup = new TweenGroup()

    const defaultScale = 1 / scale
    const activeScale = defaultScale * 1.1
    for (const n of nodeRenderData) {
      const nodeId = n.simulationData.id

      if (hoveredNodeId === nodeId) {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: activeScale, y: activeScale },
            },
            100,
          ),
        )
      } else {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: n.label.alpha,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("label", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderNodes() {
    tweens.get("hover")?.stop()

    const tweenGroup = new TweenGroup()
    for (const n of nodeRenderData) {
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      if (hoveredNodeId !== null && focusOnHover) {
        alpha = n.active ? 1 : 0.2
      }

      tweenGroup.add(new Tweened<Graphics>(n.gfx, tweenGroup).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("hover", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderPixiFromD3() {
    renderNodes()
    renderLinks()
    renderLabels()
  }

  tweens.forEach((tween) => tween.stop())
  tweens.clear()

  if (graph.dataset.renderer !== "webgl" || !isWebGLSupported()) {
    simulation.stop()
    return renderSvgGraph(graph, graphData, fullSlug, width, height)
  }
  const app = new Application()
  try {
    await app.init({
      width,
      height,
      antialias: true,
      autoStart: false,
      autoDensity: true,
      backgroundAlpha: 0,
      // webgpu is still flaky across browsers; prefer webgl for stability
      preference: "webgl",
      resolution: Math.min(window.devicePixelRatio, 2),
      eventMode: "static",
    })
  } catch (error) {
    simulation.stop()
    console.warn("WebGL graph unavailable; using SVG", error)
    return renderSvgGraph(graph, graphData, fullSlug, width, height)
  }
  graph.appendChild(app.canvas)

  const stage = app.stage
  stage.interactive = false

  const labelsContainer = new Container<Text>({ zIndex: 3, isRenderGroup: true })
  const nodesContainer = new Container<Graphics>({ zIndex: 2, isRenderGroup: true })
  const linkContainer = new Container<Graphics>({ zIndex: 1, isRenderGroup: true })
  stage.addChild(nodesContainer, labelsContainer, linkContainer)

  for (const n of graphData.nodes) {
    const nodeId = n.id

    const label = new Text({
      interactive: false,
      eventMode: "none",
      text: n.text,
      alpha: nodeId === slug || nodes.length <= 8 ? 1 : 0,
      anchor: { x: 0.5, y: 1.2 },
      style: {
        fontSize: Math.max(12, fontSize * 15),
        fill: computedStyleMap["--dark"],
        fontFamily: computedStyleMap["--bodyFont"],
      },
      resolution: Math.min(window.devicePixelRatio, 2),
    })
    label.scale.set(1 / scale)

    let oldLabelOpacity = 0
    const isTagNode = nodeId.startsWith("tags/")
    const gfx = new Graphics({
      interactive: true,
      label: nodeId,
      eventMode: "static",
      hitArea: new Circle(0, 0, nodeRadius(n)),
      cursor: "pointer",
    })
      .circle(0, 0, nodeRadius(n))
      .fill({ color: isTagNode ? computedStyleMap["--light"] : color(n) })
      .on("pointerover", (e) => {
        updateHoverInfo(e.target.label)
        oldLabelOpacity = label.alpha
        if (!dragging) {
          renderPixiFromD3()
        }
      })
      .on("pointerleave", () => {
        updateHoverInfo(null)
        label.alpha = oldLabelOpacity
        if (!dragging) {
          renderPixiFromD3()
        }
      })

    if (isTagNode) {
      gfx.stroke({ width: 2, color: computedStyleMap["--tertiary"] })
    }

    nodesContainer.addChild(gfx)
    labelsContainer.addChild(label)

    const nodeRenderDatum: NodeRenderData = {
      simulationData: n,
      gfx,
      label,
      color: color(n),
      alpha: 1,
      active: false,
    }

    nodeRenderData.push(nodeRenderDatum)
  }

  for (const l of graphData.links) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" })
    linkContainer.addChild(gfx)

    const linkRenderDatum: LinkRenderData = {
      simulationData: l,
      gfx,
      color: computedStyleMap["--lightgray"],
      alpha: 1,
      active: false,
    }

    linkRenderData.push(linkRenderDatum)
  }

  let currentTransform = zoomIdentity
  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => graphData.nodes.find((n) => n.id === hoveredNodeId))
        .on("start", function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(1).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initialDragPos = {
            x: event.subject.x,
            y: event.subject.y,
            fx: event.subject.fx,
            fy: event.subject.fy,
          }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function dragged(event) {
          const initPos = event.subject.__initialDragPos
          event.subject.fx = initPos.x + (event.x - initPos.x) / currentTransform.k
          event.subject.fy = initPos.y + (event.y - initPos.y) / currentTransform.k
        })
        .on("end", function dragended(event) {
          if (!event.active) simulation.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
          dragging = false

          // if the time between mousedown and mouseup is short, we consider it a click
          if (Date.now() - dragStartTime < 500) {
            const node = graphData.nodes.find((n) => n.id === event.subject.id) as NodeData
            const targ = resolveRelative(fullSlug, node.id)
            window.spaNavigate(new URL(targ, window.location.toString()))
          }
        }),
    )
  } else {
    for (const node of nodeRenderData) {
      node.gfx.on("click", () => {
        const targ = resolveRelative(fullSlug, node.simulationData.id)
        window.spaNavigate(new URL(targ, window.location.toString()))
      })
    }
  }

  if (enableZoom) {
    select<HTMLCanvasElement, NodeData>(app.canvas).call(
      zoom<HTMLCanvasElement, NodeData>()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.25, 4])
        .on("zoom", ({ transform }) => {
          currentTransform = transform
          stage.scale.set(transform.k, transform.k)
          stage.position.set(transform.x, transform.y)

          // zoom adjusts opacity of labels too
          const scale = transform.k * opacityScale
          let scaleOpacity = Math.max((scale - 1) / 3.75, 0)
          const activeNodes = nodeRenderData.filter((n) => n.active).flatMap((n) => n.label)

          for (const label of labelsContainer.children) {
            label.scale.set(1 / transform.k)
            if (!activeNodes.includes(label)) {
              const owner = nodeRenderData.find((n) => n.label === label)
              label.alpha =
                owner?.simulationData.id === slug || nodes.length <= 8 ? 1 : scaleOpacity
            }
          }
        }),
    )
  }

  let stopAnimation = false
  function animate(time: number) {
    if (stopAnimation) return
    for (const n of nodeRenderData) {
      const { x, y } = n.simulationData
      if (x === undefined || y === undefined) continue
      n.gfx.position.set(x + width / 2, y + height / 2)
      if (n.label) {
        n.label.position.set(x + width / 2, y + height / 2)
      }
    }

    for (const l of linkRenderData) {
      const linkData = l.simulationData
      l.gfx.clear()
      l.gfx.moveTo(linkData.source.x! + width / 2, linkData.source.y! + height / 2)
      l.gfx
        .lineTo(linkData.target.x! + width / 2, linkData.target.y! + height / 2)
        .stroke({ alpha: l.alpha, width: 1, color: l.color })
    }

    tweens.forEach((t) => t.update(time))
    app.renderer.render(stage)
    requestAnimationFrame(animate)
  }

  updateHoverInfo(slug)
  renderPixiFromD3()
  requestAnimationFrame(animate)
  return () => {
    stopAnimation = true
    simulation.stop()
    tweens.forEach((tween) => tween.stop())
    select(app.canvas).on(".zoom", null).on(".drag", null)
    app.destroy(true, { children: true, texture: true, textureSource: true })
  }
}

// WebGL can be unavailable on mobile; navigation must still work.
function renderSvgGraph(
  graph: HTMLElement,
  data: { nodes: NodeData[]; links: LinkData[] },
  fullSlug: FullSlug,
  width: number,
  height: number,
) {
  const slug = simplifySlug(fullSlug)
  const layout = forceSimulation(data.nodes)
    .force("charge", forceManyBody().strength(-100))
    .force("link", forceLink(data.links).distance(70))
    .force("center", forceCenter())
    .stop()
  layout.tick(160)
  const nearby = JSON.parse(graph.dataset.cfg!).depth === 1
  if (nearby) {
    const neighbours = data.nodes.filter((n) => n.id !== slug)
    const rx = Math.max(30, Math.min(230, width / 2 - 60))
    const ry = Math.max(30, Math.min(200, height / 2 - 45))
    neighbours.forEach((n, i) => {
      const angle = (i * Math.PI * 2) / neighbours.length - Math.PI / 2
      n.x = rx * Math.cos(angle)
      n.y = ry * Math.sin(angle)
    })
  }
  const extent = Math.max(
    100,
    ...data.nodes.flatMap((n) => [Math.abs(n.x ?? 0), Math.abs(n.y ?? 0)]),
  )
  const scale = nearby ? 1 : Math.min(1.5, (Math.min(width, height) - 40) / (extent * 2))
  const svg = select(graph)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("class", "graph-svg")
  const viewport = svg.append("g")
  viewport
    .selectAll("line")
    .data(data.links)
    .join("line")
    .attr("x1", (d) => d.source.x ?? 0)
    .attr("y1", (d) => d.source.y ?? 0)
    .attr("x2", (d) => d.target.x ?? 0)
    .attr("y2", (d) => d.target.y ?? 0)
    .attr("stroke", (d) =>
      d.source.id === slug || d.target.id === slug ? "var(--secondary)" : "var(--lightgray)",
    )
  const node = viewport
    .selectAll("a")
    .data(data.nodes)
    .join("a")
    .attr("href", (d) => resolveRelative(fullSlug, d.id))
    .attr("class", "internal")
    .attr("aria-label", (d) => d.text)
    .attr("data-slug", (d) => d.id)
    .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
  node
    .append("circle")
    .attr("r", (d) => (d.id === slug ? 8 : 5))
    .attr("fill", (d) => (d.id === slug ? "var(--secondary)" : "var(--gray)"))
  node.append("title").text((d) => d.text)
  const label = node
    .append("text")
    .text((d) => d.text)
    .attr("text-anchor", "middle")
    .attr("fill", "var(--dark)")
    .attr("display", (d) => (d.id === slug || data.nodes.length <= 8 ? null : "none"))
  const card = document.createElement("div")
  card.className = "graph-picked"
  card.hidden = true
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
  let picked = slug
  let currentTransform = zoomIdentity
  function showLabels() {
    const occupied: { left: number; top: number; right: number; bottom: number }[] = []
    label
      .attr("display", "none")
      .attr("font-size", 12 / currentTransform.k)
      .attr("y", -12 / currentTransform.k)
    const ordered = [...label.nodes()].sort(
      (a, b) =>
        Number(select(b).datum() && (select(b).datum() as NodeData).id === picked) -
        Number((select(a).datum() as NodeData).id === picked),
    )
    for (const element of ordered) {
      const d = select(element).datum() as NodeData
      if (d.id === slug) continue
      const priority = d.id === picked
      if (!nearby && !priority && data.nodes.length > 8 && currentTransform.k < 1.2) continue
      const x = currentTransform.applyX(d.x ?? 0),
        y = currentTransform.applyY(d.y ?? 0)
      element.removeAttribute("display")
      const size = element.getComputedTextLength() * currentTransform.k
      let placed = false
      for (const offset of [-14, 22, -32, 40]) {
        const shift = Math.max(size / 2 + 4 - x, Math.min(0, width - 4 - size / 2 - x))
        const box = {
          left: x + shift - size / 2 - 3,
          right: x + shift + size / 2 + 3,
          top: y + offset - 13,
          bottom: y + offset + 4,
        }
        if (
          box.left < 0 ||
          box.right > width ||
          box.top < 0 ||
          box.bottom > height ||
          occupied.some(
            (other) =>
              box.left < other.right &&
              box.right > other.left &&
              box.top < other.bottom &&
              box.bottom > other.top,
          )
        )
          continue
        element.setAttribute("x", String(shift / currentTransform.k))
        element.setAttribute("y", String(offset / currentTransform.k))
        occupied.push(box)
        placed = true
        break
      }
      if (!placed) element.setAttribute("display", "none")
    }
  }
  node.on("click", (event, d) => {
    event.preventDefault()
    event.stopPropagation()
    picked = d.id
    name.textContent = d.text
    open.href = resolveRelative(fullSlug, d.id)
    open.hidden = d.id === slug
    card.hidden = false
    viewport
      .selectAll<SVGLineElement, LinkData>("line")
      .attr("stroke", (link) =>
        link.source.id === picked || link.target.id === picked
          ? "var(--secondary)"
          : "var(--lightgray)",
      )
    node
      .select("circle")
      .attr("fill", (item) =>
        item.id === picked || item.id === slug ? "var(--secondary)" : "var(--gray)",
      )
    showLabels()
  })
  const zoomer = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.08, 4])
    .on("zoom", ({ transform }) => {
      currentTransform = transform
      viewport.attr("transform", transform.toString())
      showLabels()
    })
  svg
    .call(zoomer)
    .call(zoomer.transform, zoomIdentity.translate(width / 2, height / 2).scale(scale))
  return () => {
    layout.stop()
    svg.on(".zoom", null)
    svg.remove()
    card.remove()
  }
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
    let globalCleanup: (() => void) | undefined
    let localCleanup: (() => void) | undefined
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
    async function renderMode(depth: number) {
      const attempt = ++generation
      globalCleanup?.()
      const config = JSON.parse(graph.dataset.cfg!)
      graph.dataset.cfg = JSON.stringify({ ...config, depth, enableRadial: depth < 0 })
      modes.forEach((button) =>
        button.setAttribute("aria-pressed", String(Number(button.dataset.graphDepth) === depth)),
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
        const items = [...overlay.querySelectorAll<HTMLElement>("button, a[href], summary")].filter(
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
        void renderMode(Number(button.dataset.graphDepth)).catch(() => {
          graph.textContent = copy.error
        })
      }),
    )
    document.addEventListener("keydown", keydown)
    const theme = () => {
      void renderLocal().catch(() => {
        local.textContent = copy.error
      })
    }
    document.addEventListener("themechange", theme)
    let resizeTimer: ReturnType<typeof setTimeout>
    const resize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        theme()
        if (opened) {
          void renderMode(JSON.parse(graph.dataset.cfg!).depth).catch(() => {
            graph.textContent = copy.error
          })
        }
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
