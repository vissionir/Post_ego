export function preferredSiteLanguage(
  browserLanguages: readonly string[],
  stored?: string | null,
): "ru" | "en" | "th" {
  if (stored === "ru" || stored === "en" || stored === "th") return stored
  for (const locale of browserLanguages) {
    const language = locale.toLowerCase().split(/[-_]/)[0]
    if (language === "ru" || language === "en" || language === "th") return language
  }
  return "en"
}

export function languageEntryScript(): string {
  return `(() => {
    let stored = null
    try { stored = localStorage.getItem("siteLang") } catch (_) {}
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language || ""]
    const language = (${preferredSiteLanguage.toString()})(locales, stored)
    location.replace("/" + language + "/" + location.search + location.hash)
  })()`
}
