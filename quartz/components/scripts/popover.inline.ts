import { computePosition, flip, inline, shift } from "@floating-ui/dom"
import { FullSlug, getFullSlug, normalizeRelativeURLs, simplifySlug } from "../../util/path"
import { fetchCanonical } from "./util"

const p = new DOMParser()
let activeAnchor: HTMLAnchorElement | null = null
let hoverVersion = 0
let pointerMovedAfterNav = false

async function mouseEnterHandler(
  this: HTMLAnchorElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = this
  if (!pointerMovedAfterNav || link.dataset.noPopover === "true") {
    return
  }

  const targetUrl = new URL(link.href)
  const hash = decodeURIComponent(targetUrl.hash)
  if (
    hash === "" &&
    simplifySlug(decodeURI(targetUrl.pathname) as FullSlug) === simplifySlug(getFullSlug(window))
  ) {
    return
  }

  clearActivePopover()
  activeAnchor = link
  const version = hoverVersion
  const isCurrentHover = () =>
    version === hoverVersion && activeAnchor === link && link.isConnected && link.matches(":hover")

  // Brief cursor passes and responses from an earlier page must not open a preview.
  await new Promise((resolve) => window.setTimeout(resolve, 180))
  if (!isCurrentHover()) return

  async function setPosition(popoverElement: HTMLElement) {
    const { x, y } = await computePosition(link, popoverElement, {
      strategy: "fixed",
      middleware: [inline({ x: clientX, y: clientY }), shift(), flip()],
    })
    if (!isCurrentHover()) return
    Object.assign(popoverElement.style, {
      transform: `translate(${x.toFixed()}px, ${y.toFixed()}px)`,
    })
  }

  async function showPopover(popoverElement: HTMLElement) {
    await setPosition(popoverElement)
    if (!isCurrentHover()) return
    popoverElement.classList.add("active-popover")

    if (hash !== "") {
      const popoverInner = popoverElement.querySelector<HTMLElement>(".popover-inner")!
      const targetAnchor = `#popover-internal-${hash.slice(1)}`
      const heading = popoverInner.querySelector(targetAnchor) as HTMLElement | null
      if (heading) {
        // leave ~12px of buffer when scrolling to a heading
        popoverInner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
      }
    }
  }

  targetUrl.hash = ""
  targetUrl.search = ""
  const popoverId = `popover-${link.pathname}`
  const prevPopoverElement = document.getElementById(popoverId)

  // dont refetch if there's already a popover
  if (prevPopoverElement) {
    await showPopover(prevPopoverElement)
    return
  }

  const response = await fetchCanonical(targetUrl).catch((err) => {
    console.error(err)
  })

  if (!response?.ok || !isCurrentHover()) return
  const [contentType] = (response.headers.get("Content-Type") ?? "text/html").split(";")
  const [contentTypeCategory, typeInfo] = contentType.split("/")

  const popoverElement = document.createElement("div")
  popoverElement.id = popoverId
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverInner.dataset.contentType = contentType ?? undefined
  popoverElement.appendChild(popoverInner)

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname

      popoverInner.appendChild(img)
      break
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe")
          pdf.src = targetUrl.toString()
          popoverInner.appendChild(pdf)
          break
        default:
          break
      }
      break
    default:
      const contents = await response.text()
      const html = p.parseFromString(contents, "text/html")
      normalizeRelativeURLs(html, targetUrl)
      // prepend all IDs inside popovers to prevent duplicates
      html.querySelectorAll("[id]").forEach((el) => {
        const targetID = `popover-internal-${el.id}`
        el.id = targetID
      })
      const elts = [...html.getElementsByClassName("popover-hint")]
      if (elts.length === 0) return

      elts.forEach((elt) => popoverInner.appendChild(elt))
  }

  if (!isCurrentHover() || document.getElementById(popoverId)) {
    return
  }

  document.body.appendChild(popoverElement)
  await showPopover(popoverElement)
}

function clearActivePopover() {
  hoverVersion++
  activeAnchor = null
  const allPopoverElements = document.querySelectorAll(".popover")
  allPopoverElements.forEach((popoverElement) => popoverElement.classList.remove("active-popover"))
}

function dismissPopovers() {
  clearActivePopover()
  pointerMovedAfterNav = false
  document.querySelectorAll(".popover").forEach((popover) => popover.remove())
}

// A restored page can put a link under a stationary cursor without user intent.
document.addEventListener(
  "mousemove",
  (event) => {
    if (event.isTrusted) pointerMovedAfterNav = true
  },
  { capture: true },
)

function mouseMoveHandler(this: HTMLAnchorElement, event: MouseEvent) {
  if (activeAnchor !== this) void mouseEnterHandler.call(this, event)
}

document.addEventListener("prenav", dismissPopovers)
window.addEventListener("blur", dismissPopovers)
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") dismissPopovers()
})
document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("a.internal")) dismissPopovers()
})

document.addEventListener("nav", () => {
  dismissPopovers()
  window.addCleanup(dismissPopovers)
  const links = [...document.querySelectorAll("a.internal")] as HTMLAnchorElement[]
  for (const link of links) {
    link.addEventListener("mouseenter", mouseEnterHandler)
    link.addEventListener("mousemove", mouseMoveHandler)
    link.addEventListener("mouseleave", clearActivePopover)
    window.addCleanup(() => {
      link.removeEventListener("mouseenter", mouseEnterHandler)
      link.removeEventListener("mousemove", mouseMoveHandler)
      link.removeEventListener("mouseleave", clearActivePopover)
    })
  }
})
