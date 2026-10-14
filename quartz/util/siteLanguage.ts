import { languages, type SiteLanguage } from "./siteLanguages"

function selectPreferredLanguage(
  browserLanguages: readonly string[],
  stored: string | null | undefined,
  supportedLanguages: readonly SiteLanguage[],
): SiteLanguage {
  const manual = supportedLanguages.find((language) => language === stored)
  if (manual) return manual
  for (const locale of browserLanguages) {
    const language = locale.toLowerCase().split(/[-_]/)[0]
    const supported = supportedLanguages.find((candidate) => candidate === language)
    if (supported) return supported
  }
  return "en"
}

export function preferredSiteLanguage(
  browserLanguages: readonly string[],
  stored?: string | null,
): SiteLanguage {
  return selectPreferredLanguage(browserLanguages, stored, languages)
}

export function languageEntryScript(): string {
  return `(() => {
    let stored = null
    try { stored = localStorage.getItem("siteLang") } catch (_) {}
    const locales = navigator.languages?.length ? navigator.languages : [navigator.language || ""]
    const language = (${selectPreferredLanguage.toString()})(locales, stored, ${JSON.stringify(languages)})
    location.replace("/" + language + "/" + location.search + location.hash)
  })()`
}
