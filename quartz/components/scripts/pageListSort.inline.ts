type PageListSortMode = "alphabetical" | "modified"

const atomSortStorageKey = "postego-atom-sort"

function getStoredSortMode(): PageListSortMode {
  try {
    return localStorage.getItem(atomSortStorageKey) === "modified" ? "modified" : "alphabetical"
  } catch {
    return "alphabetical"
  }
}

function storeSortMode(mode: PageListSortMode) {
  try {
    localStorage.setItem(atomSortStorageKey, mode)
  } catch {}
}

document.addEventListener("nav", () => {
  document.querySelectorAll<HTMLSelectElement>("select[data-page-list-sort]").forEach((select) => {
    const listing = select.closest(".page-listing")
    const list = listing?.querySelector<HTMLElement>("ul.section-ul")
    if (!list) return

    const locale = select.dataset.sortLocale === "en" ? "en" : "ru"
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })

    const applySort = (mode: PageListSortMode, persist: boolean) => {
      const items = Array.from(list.children).filter(
        (item): item is HTMLElement =>
          item instanceof HTMLElement && item.classList.contains("section-li"),
      )

      items.sort((a, b) => {
        const titleOrder = collator.compare(a.dataset.pageTitle ?? "", b.dataset.pageTitle ?? "")
        if (mode === "alphabetical") return titleOrder

        const dateOrder = Number(b.dataset.pageModified ?? 0) - Number(a.dataset.pageModified ?? 0)
        return dateOrder || titleOrder
      })

      list.append(...items)
      select.value = mode
      if (persist) storeSortMode(mode)
    }

    const onChange = () => {
      const mode = select.value === "modified" ? "modified" : "alphabetical"
      applySort(mode, true)
    }
    select.addEventListener("change", onChange)
    window.addCleanup(() => select.removeEventListener("change", onChange))

    applySort(getStoredSortMode(), false)
  })
})
