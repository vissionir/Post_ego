import { scrollThumbMetrics } from "../../util/scrollbar"

document.addEventListener("nav", () => {
  for (const list of document.querySelectorAll<HTMLElement>(
    ".backlinks-list, .explorer-content > .explorer-ul",
  )) {
    const parent = list.parentElement
    if (!parent) continue
    const bar = document.createElement("div")
    const thumb = document.createElement("div")
    bar.className = "persistent-scrollbar"
    thumb.className = "persistent-scrollbar-thumb"
    bar.append(thumb)
    bar.setAttribute("role", "scrollbar")
    bar.setAttribute("aria-orientation", "vertical")
    bar.setAttribute("aria-controls", list.id)
    bar.setAttribute(
      "aria-label",
      list.getAttribute("aria-label") ??
        parent.closest(".explorer")?.querySelector("h2")?.textContent ??
        "Scroll",
    )
    bar.tabIndex = 0
    parent.append(bar)
    list.classList.add("persistent-scroll-list")

    let frame = 0
    let drag: { pointer: number; y: number; scroll: number } | undefined
    const update = () => {
      frame = 0
      const metrics = scrollThumbMetrics(list.clientHeight, list.scrollHeight, list.scrollTop)
      bar.hidden = metrics.maxScroll <= 1 || list.clientHeight === 0
      bar.style.top = `${list.offsetTop}px`
      bar.style.height = `${list.clientHeight}px`
      thumb.style.height = `${metrics.height}px`
      thumb.style.transform = `translateY(${metrics.top}px)`
      bar.setAttribute("aria-valuemin", "0")
      bar.setAttribute("aria-valuemax", String(Math.round(metrics.maxScroll)))
      bar.setAttribute("aria-valuenow", String(Math.round(Math.max(0, list.scrollTop))))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      bar.focus({ preventScroll: true })
      const metrics = scrollThumbMetrics(list.clientHeight, list.scrollHeight, list.scrollTop)
      if (event.target !== thumb) {
        const y = event.clientY - bar.getBoundingClientRect().top - metrics.height / 2
        list.scrollTop = metrics.travel > 0 ? (y / metrics.travel) * metrics.maxScroll : 0
      }
      drag = { pointer: event.pointerId, y: event.clientY, scroll: list.scrollTop }
      bar.setPointerCapture(event.pointerId)
      schedule()
    }
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointer) return
      const metrics = scrollThumbMetrics(list.clientHeight, list.scrollHeight, list.scrollTop)
      if (metrics.travel > 0) {
        list.scrollTop =
          drag.scroll + ((event.clientY - drag.y) / metrics.travel) * metrics.maxScroll
      }
    }
    const end = () => {
      drag = undefined
    }
    const key = (event: KeyboardEvent) => {
      const offsets: Record<string, number> = {
        ArrowDown: 40,
        ArrowUp: -40,
        PageDown: list.clientHeight * 0.9,
        PageUp: -list.clientHeight * 0.9,
        Home: -list.scrollHeight,
        End: list.scrollHeight,
      }
      if (!(event.key in offsets)) return
      event.preventDefault()
      list.scrollTop += offsets[event.key]
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(list)
    const observeContent = () => {
      resize.disconnect()
      resize.observe(list)
      for (const child of list.children) resize.observe(child)
      schedule()
    }
    const mutation = new MutationObserver(observeContent)
    mutation.observe(list, { childList: true, subtree: true, attributes: true })
    observeContent()
    list.addEventListener("scroll", schedule, { passive: true })
    bar.addEventListener("pointerdown", down)
    bar.addEventListener("pointermove", move)
    bar.addEventListener("pointerup", end)
    bar.addEventListener("pointercancel", end)
    bar.addEventListener("lostpointercapture", end)
    bar.addEventListener("keydown", key)
    update()
    window.addCleanup(() => {
      resize.disconnect()
      mutation.disconnect()
      cancelAnimationFrame(frame)
      list.removeEventListener("scroll", schedule)
      bar.remove()
      list.classList.remove("persistent-scroll-list")
    })
  }
})
