import type { GraphNode } from "../../util/graph"
import type { SimpleSlug } from "../../util/path"
import { graphSearchIndex, searchGraphAtoms } from "../../util/graph-search"

let nextId = 0

export function mountGraphSearch(
  root: HTMLElement,
  nodes: GraphNode[],
  language: "ru" | "en" | "th",
  select: (id: SimpleSlug) => boolean,
  preview: (id?: SimpleSlug) => void,
) {
  const copy =
    language === "ru"
      ? { search: "Найти атом", empty: "Атомы не найдены", results: "Найдено" }
      : language === "th"
        ? { search: "ค้นหาอะตอม", empty: "ไม่พบอะตอม", results: "ผลการค้นหา" }
        : { search: "Find an atom", empty: "No atoms found", results: "Results" }
  const index = graphSearchIndex(nodes, language)
  const controller = new AbortController()
  const options = { signal: controller.signal }
  const input = document.createElement("input")
  input.type = "search"
  input.placeholder = copy.search
  input.maxLength = 512
  input.autocomplete = "off"
  input.spellcheck = false
  input.setAttribute("aria-label", copy.search)
  input.setAttribute("role", "combobox")
  input.setAttribute("aria-autocomplete", "list")
  input.setAttribute("aria-expanded", "false")
  const dropdown = document.createElement("div")
  dropdown.className = "graph-search-dropdown"
  dropdown.hidden = true
  const list = document.createElement("div")
  list.id = `graph-search-results-${++nextId}`
  list.setAttribute("role", "listbox")
  list.setAttribute("aria-label", copy.search)
  input.setAttribute("aria-controls", list.id)
  const status = document.createElement("div")
  status.className = "graph-search-status"
  status.setAttribute("role", "status")
  dropdown.append(list, status)
  root.replaceChildren(input, dropdown)
  let results: GraphNode[] = []
  let active = -1
  let pointerPreview = false

  function clearPreview() {
    input.removeAttribute("aria-activedescendant")
    active = -1
    pointerPreview = false
    Array.from(list.children).forEach((item) => item.setAttribute("aria-selected", "false"))
    preview()
  }
  function dismiss() {
    dropdown.hidden = true
    input.setAttribute("aria-expanded", "false")
    clearPreview()
  }
  function activate(position: number, scroll = true) {
    active = position
    pointerPreview = !scroll
    Array.from(list.children).forEach((item, i) => {
      item.setAttribute("aria-selected", String(i === active))
    })
    const item = list.children[active] as HTMLElement | undefined
    if (item) {
      input.setAttribute("aria-activedescendant", item.id)
      if (scroll) item.scrollIntoView({ block: "nearest" })
      preview(results[active]?.id)
    }
  }
  function choose(position: number) {
    const result = results[position]
    if (!result || input.disabled || !select(result.id)) return
    input.value = result.text
    dismiss()
  }
  function showResults() {
    dismiss()
    list.replaceChildren()
    status.textContent = ""
    results = []
    if (input.disabled || !input.value.trim()) return
    results = searchGraphAtoms(index, input.value)
    results.forEach((result, i) => {
      const button = document.createElement("button")
      button.type = "button"
      button.tabIndex = -1
      button.id = `${list.id}-${i}`
      button.dataset.resultIndex = String(i)
      button.setAttribute("role", "option")
      button.setAttribute("aria-selected", "false")
      button.textContent = result.text
      list.append(button)
    })
    status.textContent = results.length ? `${copy.results}: ${results.length}` : copy.empty
    status.hidden = results.length > 0
    dropdown.hidden = false
    input.setAttribute("aria-expanded", "true")
  }
  input.addEventListener("input", showResults, options)
  // Safari may blur the input without focusing the option; keep it until the click.
  list.addEventListener("mousedown", (event) => event.preventDefault(), options)
  list.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button[data-result-index]",
      )
      if (!button || !list.contains(button)) return
      const position = Number(button.dataset.resultIndex)
      if (active !== position || !pointerPreview) activate(position, false)
    },
    options,
  )
  dropdown.addEventListener(
    "pointerleave",
    () => {
      if (pointerPreview) clearPreview()
    },
    options,
  )
  list.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "button[data-result-index]",
      )
      if (button && list.contains(button)) choose(Number(button.dataset.resultIndex))
    },
    options,
  )
  input.addEventListener(
    "focus",
    () => {
      input.select()
      showResults()
    },
    options,
  )
  input.addEventListener(
    "keydown",
    (event) => {
      if (event.isComposing) return
      if (event.key === "Escape" && !dropdown.hidden) {
        event.preventDefault()
        event.stopPropagation()
        dismiss()
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (dropdown.hidden) showResults()
        if (!results.length || dropdown.hidden) return
        event.preventDefault()
        activate(
          (active + (event.key === "ArrowDown" ? 1 : active < 0 ? 0 : -1) + results.length) %
            results.length,
        )
      } else if (event.key === "Enter" && !dropdown.hidden && results.length) {
        event.preventDefault()
        choose(active < 0 ? 0 : active)
      }
    },
    options,
  )
  root.addEventListener(
    "focusout",
    (event) => {
      if (!root.contains(event.relatedTarget as Node | null)) dismiss()
    },
    options,
  )
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!root.contains(event.target as Node)) dismiss()
    },
    options,
  )
  return {
    setEnabled(visible: boolean, ready = false) {
      root.hidden = !visible
      input.disabled = !ready
      input.value = ""
      results = []
      dismiss()
    },
    cleanup() {
      clearPreview()
      controller.abort()
      root.replaceChildren()
    },
  }
}
