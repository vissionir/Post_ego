import type { ValidLocale } from "../i18n"
import { isSiteLanguage, siteLanguages, type SiteLanguage } from "./siteLanguages"

export function capitalize(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1)
}

export function isEnglishSlug(slug?: string): boolean {
  return slug === "en" || slug?.startsWith("en/") === true
}

export function isThaiSlug(slug?: string): boolean {
  return slug === "th" || slug?.startsWith("th/") === true
}

export function isChineseSlug(slug?: string): boolean {
  return slug === "zh" || slug?.startsWith("zh/") === true
}

export function localeForSlug(slug?: string): ValidLocale {
  return siteLanguages[languageForSlug(slug)].locale
}

export function languageForSlug(slug?: string): SiteLanguage {
  const prefix = slug?.split("/")[0]
  return isSiteLanguage(prefix) ? prefix : "ru"
}

export function classNames(
  displayClass?: "mobile-only" | "desktop-only",
  ...classes: string[]
): string {
  if (displayClass) {
    classes.push(displayClass)
  }
  return classes.join(" ")
}
