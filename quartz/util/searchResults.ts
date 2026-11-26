import { languageForSlug } from "./lang"
import type { SiteLanguage } from "./siteLanguages"

export function searchResultIds(
  slugs: readonly string[],
  language: SiteLanguage,
  fields: { title: readonly number[]; content: readonly number[]; tags: readonly number[] },
  preferredTitles: readonly number[] = [],
) {
  // Preserve relevance and title priority without cutting off the scrollable list.
  return [
    ...new Set([...preferredTitles, ...fields.title, ...fields.content, ...fields.tags]),
  ].filter((id) => slugs[id] !== undefined && languageForSlug(slugs[id]) === language)
}
