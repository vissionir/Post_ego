import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { getLanguagePair } from "../util/languagePair"
import { isEnglishSlug } from "../util/lang"

/**
 * Global RU/EN switcher.
 *
 * Spec:
 * - RU lives at / (root)
 * - EN lives at /en/
 * File names and slugs are translated, so the switcher resolves the semantic RU/EN pair.
 */
const LanguageSwitcher: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const slug = (fileData.slug ?? "index") as FullSlug
  const isEn = isEnglishSlug(slug)
  const pair = getLanguagePair(slug, allFiles)

  // Service pages without a translated counterpart fall back to the language home page.
  const ruSlug = pair?.ru ?? ("index" as FullSlug)
  const enSlug = pair?.en ?? ("en/index" as FullSlug)

  const ruHref = resolveRelative(slug, ruSlug)
  const enHref = resolveRelative(slug, enSlug)

  return (
    <div class="lang-switch" aria-label={isEn ? "Language switch" : "Переключение языка"}>
      <a class={`lang-link ${!isEn ? "active" : ""}`} href={ruHref} data-set-lang="ru">
        RU
      </a>
      <span class="sep">/</span>
      <a class={`lang-link ${isEn ? "active" : ""}`} href={enHref} data-set-lang="en">
        EN
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
