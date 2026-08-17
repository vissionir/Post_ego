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
  document.querySelectorAll<HTMLElement>("[data-page-list-sort]").forEach((controls) => {
    const listing = controls.closest(".page-listing")
    const list = listing?.querySelector<HTMLElement>("ul.section-ul")
    if (!list) return

    const locale = controls.dataset.sortLocale === "en" ? "en" : "ru"
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

        const dateOrder = Number(b.dataset.pageModified ?? 0) - Number(a.dataset.pageModified ?? 0)
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
        const mode = button.dataset.sortMode === "modified" ? "modified" : "alphabetical"
        applySort(mode, true)
      }
      button.addEventListener("click", onClick)
      window.addCleanup(() => button.removeEventListener("click", onClick))
    })

    applySort(getStoredSortMode(), false)
  })
})
