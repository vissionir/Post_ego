const colorSchemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
let manualTheme: "light" | "dark" | null = null

try {
  // Legacy "theme" values mixed automatic updates with manual choices.
  const savedPreference = localStorage.getItem("theme-preference")
  if (savedPreference === "light" || savedPreference === "dark") {
    manualTheme = savedPreference
  }
} catch {
  // Theme switching should still work when browser storage is unavailable.
}

const deviceTheme = () => (colorSchemeMediaQuery.matches ? "dark" : "light")
document.documentElement.setAttribute("saved-theme", manualTheme ?? deviceTheme())

const emitThemeChangeEvent = (theme: "light" | "dark") => {
  const event: CustomEventMap["themechange"] = new CustomEvent("themechange", {
    detail: { theme },
  })
  document.dispatchEvent(event)
}

document.addEventListener("nav", () => {
  const switchTheme = () => {
    const newTheme =
      document.documentElement.getAttribute("saved-theme") === "dark" ? "light" : "dark"
    manualTheme = newTheme
    document.documentElement.setAttribute("saved-theme", newTheme)
    try {
      localStorage.setItem("theme-preference", newTheme)
    } catch {
      // Keep the manual choice for this visit even without persistent storage.
    }
    emitThemeChangeEvent(newTheme)
  }

  const themeChange = (e: MediaQueryListEvent) => {
    if (manualTheme !== null) return
    const newTheme = e.matches ? "dark" : "light"
    document.documentElement.setAttribute("saved-theme", newTheme)
    emitThemeChangeEvent(newTheme)
  }

  for (const darkmodeButton of document.getElementsByClassName("darkmode")) {
    darkmodeButton.addEventListener("click", switchTheme)
    window.addCleanup(() => darkmodeButton.removeEventListener("click", switchTheme))
  }

  // Listen for changes in prefers-color-scheme
  document.documentElement.setAttribute("saved-theme", manualTheme ?? deviceTheme())
  colorSchemeMediaQuery.addEventListener("change", themeChange)
  window.addCleanup(() => colorSchemeMediaQuery.removeEventListener("change", themeChange))
})
