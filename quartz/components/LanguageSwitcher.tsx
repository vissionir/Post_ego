import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { getLanguagePair } from "../util/languagePair"
import { languageForSlug } from "../util/lang"

/**
 * Global RU/EN/TH switcher.
 *
 * Spec:
 * - RU lives at / (root)
 * - EN lives at /en/
 * - TH lives at /th/
 * File names and slugs are translated, so the switcher resolves the semantic page group.
 */
const LanguageSwitcher: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const slug = (fileData.slug ?? "index") as FullSlug
  const language = languageForSlug(slug)
  const pair = getLanguagePair(slug, allFiles)

  // Service pages without a translated counterpart fall back to the language home page.
  const ruSlug = pair?.ru ?? ("index" as FullSlug)
  const enSlug = pair?.en ?? ("en/index" as FullSlug)
  const thSlug = pair?.th ?? ("th/index" as FullSlug)

  const ruHref = resolveRelative(slug, ruSlug)
  const enHref = resolveRelative(slug, enSlug)
  const thHref = resolveRelative(slug, thSlug)

  return (
    <div
      class="lang-switch"
      aria-label={
        language === "ru"
          ? "Переключение языка"
          : language === "th"
            ? "เปลี่ยนภาษา"
            : "Language switch"
      }
    >
      <a class={`lang-link ${language === "ru" ? "active" : ""}`} href={ruHref} data-set-lang="ru">
        RU
      </a>
      <span class="sep">/</span>
      <a class={`lang-link ${language === "en" ? "active" : ""}`} href={enHref} data-set-lang="en">
        EN
      </a>
      <span class="sep">/</span>
      <a class={`lang-link ${language === "th" ? "active" : ""}`} href={thHref} data-set-lang="th">
        TH
      </a>
    </div>
  )
}

LanguageSwitcher.css = `
.lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  user-select: none;
  opacity: 0.9;
}

.lang-switch .sep {
  opacity: 0.5;
}

.lang-switch a.lang-link {
  text-decoration: none;
  border-bottom: 1px solid transparent;
  padding: 0.05rem 0;
}

.lang-switch a.lang-link.active {
  opacity: 1;
  border-bottom-color: currentColor;
}

.lang-switch a.lang-link:not(.active) {
  opacity: 0.65;
}
`

export default (() => LanguageSwitcher) satisfies QuartzComponentConstructor
