import type { ValidLocale } from "../i18n"

export function capitalize(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1)
}

export function isEnglishSlug(slug?: string): boolean {
  return slug === "en" || slug?.startsWith("en/") === true
}

export function isThaiSlug(slug?: string): boolean {
  return slug === "th" || slug?.startsWith("th/") === true
}

export function localeForSlug(slug?: string): ValidLocale {
  if (isEnglishSlug(slug)) return "en-US"
  if (isThaiSlug(slug)) return "th-TH"
  return "ru-RU"
}

export function languageForSlug(slug?: string): "en" | "ru" | "th" {
  if (isEnglishSlug(slug)) return "en"
  if (isThaiSlug(slug)) return "th"
  return "ru"
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
