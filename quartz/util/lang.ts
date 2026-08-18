import type { ValidLocale } from "../i18n"

export function capitalize(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1)
}

export function isEnglishSlug(slug?: string): boolean {
  return slug === "en" || slug?.startsWith("en/") === true
}

export function localeForSlug(slug?: string): ValidLocale {
  return isEnglishSlug(slug) ? "en-US" : "ru-RU"
}

export function languageForSlug(slug?: string): "en" | "ru" {
  return isEnglishSlug(slug) ? "en" : "ru"
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
