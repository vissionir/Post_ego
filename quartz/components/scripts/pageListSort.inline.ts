type PageListSortMode = "alphabetical" | "newest" | "oldest"

const atomSortStorageKey = "postego-atom-sort"

function getStoredSortMode(): PageListSortMode {
  try {
    const storedMode = localStorage.getItem(atomSortStorageKey)
    if (storedMode === "modified" || storedMode === "newest") return "newest"
    if (storedMode === "oldest") return "oldest"
    return "alphabetical"
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
  document.querySelectorAll<HTMLElement>("[data-page-list-sort]").forEach((controls) => {
    const listing = controls.closest(".page-listing")
    const list = listing?.querySelector<HTMLElement>("ul.section-ul")
    if (!list) return

    const requestedLocale = controls.dataset.sortLocale
    const locale = requestedLocale === "en" || requestedLocale === "th" ? requestedLocale : "ru"
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
    const buttons = Array.from(
      controls.querySelectorAll<HTMLButtonElement>("button[data-sort-mode]"),
    )

    const applySort = (mode: PageListSortMode, persist: boolean) => {
      const items = Array.from(list.children).filter(
        (item): item is HTMLElement =>
          item instanceof HTMLElement && item.classList.contains("section-li"),
      )

      items.sort((a, b) => {
        const titleOrder = collator.compare(a.dataset.pageTitle ?? "", b.dataset.pageTitle ?? "")
        if (mode === "alphabetical") return titleOrder

        const aDate = Number(a.dataset.pageModified ?? 0)
        const bDate = Number(b.dataset.pageModified ?? 0)
        const dateOrder = mode === "newest" ? bDate - aDate : aDate - bDate
        return dateOrder || titleOrder
      })

      list.append(...items)
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.sortMode === mode))
      })
      if (persist) storeSortMode(mode)
    }

    buttons.forEach((button) => {
      const onClick = () => {
        const requestedMode = button.dataset.sortMode
        const mode: PageListSortMode =
          requestedMode === "newest" || requestedMode === "oldest" ? requestedMode : "alphabetical"
        applySort(mode, true)
      }
      button.addEventListener("click", onClick)
      window.addCleanup(() => button.removeEventListener("click", onClick))
    })

    applySort(getStoredSortMode(), false)
  })
})
