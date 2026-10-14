import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { getLanguagePair } from "../util/languagePair"
import { languageForSlug } from "../util/lang"
// @ts-ignore
import languageSwitcherScript from "./scripts/language-switcher.inline"

/**
 * Global RU/EN/TH switcher.
 *
 * Spec:
 * - RU lives at /ru/
 * - EN lives at /en/
 * - TH lives at /th/
 * File names and slugs are translated, so the switcher resolves the semantic page group.
 */
const LanguageSwitcher: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const slug = (fileData.slug ?? "index") as FullSlug
  const language = languageForSlug(slug)
  const pair = getLanguagePair(slug, allFiles)

  // Service pages without a translated counterpart fall back to the language home page.
  const ruSlug = pair?.ru ?? ("ru/index" as FullSlug)
  const enSlug = pair?.en ?? ("en/index" as FullSlug)
  const thSlug = pair?.th ?? ("th/index" as FullSlug)

  const ruHref = resolveRelative(slug, ruSlug)
  const enHref = resolveRelative(slug, enSlug)
  const thHref = resolveRelative(slug, thSlug)
  const label =
    language === "ru" ? "Переключение языка" : language === "th" ? "เปลี่ยนภาษา" : "Language switch"
  const languages = [
    { code: "ru", name: "Русский", href: ruHref },
    { code: "en", name: "English", href: enHref },
    { code: "th", name: "ไทย", href: thHref },
  ]

  return (
    <details class="lang-switch">
      <summary aria-label={`${label}: ${language.toUpperCase()}`}>
        <span>{language.toUpperCase()}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </summary>
      <nav class="lang-options" aria-label={label}>
        {languages.map(({ code, name, href }) => (
          <a
            class={`lang-link ${language === code ? "active" : ""}`}
            href={href}
            lang={code}
            hreflang={code}
            data-set-lang={code}
            aria-current={language === code ? "page" : undefined}
          >
            <span>{name}</span>
            {language === code && (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="m3 7 2.5 2.5L11 4" fill="none" stroke="currentColor" stroke-width="1.5" />
              </svg>
            )}
          </a>
        ))}
      </nav>
    </details>
  )
}

LanguageSwitcher.css = `
.lang-switch {
  position: relative;
  flex-shrink: 0;
  font-size: 1.05rem;
  line-height: 1.25;
  user-select: none;
}

.lang-switch > summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 2.75rem;
  height: 32px;
  padding: 0 0.2rem;
  box-sizing: border-box;
  list-style: none;
  cursor: pointer;
  color: var(--secondary);
  font-weight: 600;
}

.lang-switch > summary::-webkit-details-marker {
  display: none;
}

.lang-switch[open] > summary > svg {
  transform: rotate(180deg);
}

.lang-switch .lang-options {
  position: absolute;
  z-index: 10;
  top: calc(100% + 0.4rem);
  right: 0;
  min-width: 9.5rem;
  max-width: calc(100vw - 2rem);
  padding: 0.3rem;
  box-sizing: border-box;
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  background: var(--light);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.lang-switch .lang-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 38px;
  padding: 0 0.65rem;
  border-radius: 3px;
  font-weight: 400;
  text-decoration: none;
  color: var(--darkgray);
  white-space: nowrap;
}

.lang-switch .lang-link:hover,
.lang-switch .lang-link:focus-visible {
  background: var(--highlight);
}

.lang-switch .lang-link.active {
  color: var(--secondary);
  font-weight: 600;
}
`

LanguageSwitcher.afterDOMLoaded = languageSwitcherScript

export default (() => LanguageSwitcher) satisfies QuartzComponentConstructor
