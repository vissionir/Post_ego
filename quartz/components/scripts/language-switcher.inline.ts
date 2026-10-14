document.addEventListener("nav", () => {
  const switches = document.querySelectorAll<HTMLDetailsElement>("details.lang-switch")
  const closeOutside = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    for (const dropdown of switches) {
      if (!dropdown.contains(event.target) || event.target.closest("a[data-set-lang]")) {
        dropdown.open = false
      }
    }
  }
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    for (const dropdown of switches) {
      if (dropdown.open) {
        dropdown.open = false
        dropdown.querySelector("summary")?.focus()
        event.stopPropagation()
      }
    }
  }

  document.addEventListener("click", closeOutside)
  document.addEventListener("keydown", closeOnEscape, true)
  window.addCleanup(() => {
    document.removeEventListener("click", closeOutside)
    document.removeEventListener("keydown", closeOnEscape, true)
  })
})
