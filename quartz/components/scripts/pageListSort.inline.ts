import { comparePageListItems, type PageListSortMode } from "./page-list-order"

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

      const orderData = (item: HTMLElement) => ({
        title: item.dataset.pageTitle ?? "",
        date: Number(item.dataset.pageDate ?? 0),
        releaseRank: Number(item.dataset.pageReleaseRank ?? -1),
        publicationOrder: Number(item.dataset.pagePublicationOrder ?? NaN),
      })
      items.sort((a, b) => comparePageListItems(orderData(a), orderData(b), mode, collator))

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
