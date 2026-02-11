import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"

/**
 * Global RU/EN switcher.
 *
 * Spec:
 * - RU lives at / (root)
 * - EN lives at /en/
 * - File names/slugs are NOT translated (1:1 mapping)
 * - Only title/body are translated
 *
 * Notes:
 * - We rely on client-side script (in Head) to persist the choice in localStorage.
 */
const LanguageSwitcher: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const slug = (fileData.slug ?? "index") as FullSlug
  const isEn = slug === ("en" as FullSlug) || slug.startsWith("en/")

  const ruSlug = (isEn ? slug.replace(/^en\//, "") : slug) as FullSlug
  const enSlug = `en/${ruSlug}`.replace(/^en\/en\//, "en/") as FullSlug

  const ruHref = resolveRelative(slug, ruSlug)
  const enHref = resolveRelative(slug, enSlug)

  return (
    <div class="lang-switch" aria-label="Language switch">
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
