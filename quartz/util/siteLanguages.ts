import type { ValidLocale } from "../i18n"

export const languages = ["ru", "en", "th", "zh"] as const
export type SiteLanguage = (typeof languages)[number]

export const siteLanguages = {
  ru: { locale: "ru-RU", hreflang: "ru", name: "Русский", atomPrefix: "Атомы/" },
  en: { locale: "en-US", hreflang: "en", name: "English", atomPrefix: "en/Атомы/" },
  th: { locale: "th-TH", hreflang: "th", name: "ไทย", atomPrefix: "th/Atoms/" },
  zh: { locale: "zh-CN", hreflang: "zh-CN", name: "简体中文", atomPrefix: "zh/Atoms/" },
} as const satisfies Record<
  SiteLanguage,
  { locale: ValidLocale; hreflang: string; name: string; atomPrefix: string }
>

export function isSiteLanguage(value: unknown): value is SiteLanguage {
  return languages.some((language) => language === value)
}
