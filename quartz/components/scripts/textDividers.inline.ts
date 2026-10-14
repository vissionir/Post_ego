import { textDividerWidth } from "../../util/textDivider"

document.addEventListener("nav", () => {
  const center = document.querySelector<HTMLElement>("#quartz-body > .center")
  const article = center?.querySelector<HTMLElement>(
    ":scope > article, :scope > .popover-hint > article",
  )
  if (!center || !article) return

  const dividers: { element: HTMLElement; sources: Element[]; rule: boolean }[] = []
  for (const rule of article.querySelectorAll<HTMLHRElement>("hr")) {
    const sources: Element[] = []
    for (
      let previous = rule.previousElementSibling;
      previous;
      previous = previous.previousElementSibling
    ) {
      if (previous.matches("hr")) break
      sources.push(previous)
    }
    dividers.push({ element: rule, sources, rule: true })
  }
  const toolbar = center.querySelector<HTMLElement>(".page-list-toolbar")
  if (toolbar) dividers.push({ element: toolbar, sources: [article], rule: false })
  const footerRule = center.querySelector<HTMLHRElement>(":scope > hr")
  if (footerRule) dividers.push({ element: footerRule, sources: [article], rule: true })
  if (dividers.length === 0) return

  let frame = 0
  let disposed = false
  const update = () => {
    frame = 0
    for (const { element, sources, rule } of dividers) {
      if (rule) element.classList.add("text-measured-divider")
      const box = element.getBoundingClientRect()
      const parent = element.parentElement!
      const styles = getComputedStyle(parent)
      const available = rule
        ? parent.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
        : box.width
      const rects: DOMRect[] = []
      for (const source of sources) {
        const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT)
        let node: Node | null
        while ((node = walker.nextNode())) {
          const text = node.textContent ?? ""
          if (
            !text.trim() ||
            node.parentElement?.closest("[hidden], [aria-hidden='true'], script, style, button")
          )
            continue
          // Measure letters, not block boxes or link background padding.
          const range = document.createRange()
          range.setStart(node, text.search(/\S/))
          range.setEnd(node, text.trimEnd().length)
          rects.push(...range.getClientRects())
        }
      }
      const width = textDividerWidth(box.left, available, rects)
      if (width > 0) element.style.setProperty("--text-divider-width", `${width}px`)
      else element.style.removeProperty("--text-divider-width")
    }
  }
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(update)
  }
  const resize = new ResizeObserver(schedule)
  resize.observe(article)
  const mutation = new MutationObserver(schedule)
  mutation.observe(article, { childList: true, characterData: true, subtree: true })
  window.addEventListener("resize", schedule)
  document.fonts.addEventListener("loadingdone", schedule)
  void document.fonts.ready.then(schedule)
  schedule()

  window.addCleanup(() => {
    disposed = true
    cancelAnimationFrame(frame)
    resize.disconnect()
    mutation.disconnect()
    window.removeEventListener("resize", schedule)
    document.fonts.removeEventListener("loadingdone", schedule)
    for (const { element } of dividers) {
      element.classList.remove("text-measured-divider")
      element.style.removeProperty("--text-divider-width")
    }
  })
})
