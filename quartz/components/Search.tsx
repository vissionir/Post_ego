import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/search.scss"
// @ts-ignore
import script from "./scripts/search.inline"
import { classNames, languageForSlug, localeForSlug } from "../util/lang"
import { i18n } from "../i18n"

export interface SearchOptions {
  enablePreview: boolean
}

const defaultOptions: SearchOptions = {
  enablePreview: true,
}

export default ((userOpts?: Partial<SearchOptions>) => {
  const Search: QuartzComponent = ({ displayClass, fileData }: QuartzComponentProps) => {
    const opts = { ...defaultOptions, ...userOpts }
    const translation = i18n(localeForSlug(fileData.slug)).components.search
    const searchPlaceholder = translation.searchBarPlaceholder
    const closeLabel = {
      ru: "Закрыть поиск",
      en: "Close search",
      th: "ปิดการค้นหา",
      zh: "关闭搜索",
    }[languageForSlug(fileData.slug)]
    return (
      <div class={classNames(displayClass, "search")}>
        <button class="search-button" type="button" aria-label={translation.title}>
          <svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.9 19.7">
            <title>{translation.title}</title>
            <g class="search-path" fill="none">
              <path stroke-linecap="square" d="M18.5 18.3l-5.4-5.4" />
              <circle cx="8" cy="8" r="7" />
            </g>
          </svg>
          <span>{translation.title}</span>
        </button>
        <div class="search-container">
          <div class="search-space">
            <div class="search-toolbar">
              <input
                autocomplete="off"
                autocorrect="off"
                autocapitalize="none"
                spellcheck={false}
                class="search-bar"
                name="q"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
              />
              <button class="search-close" type="button" aria-label={closeLabel}>
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="m5 5 10 10M15 5 5 15"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                </svg>
              </button>
            </div>
            <div class="search-layout" data-preview={opts.enablePreview}></div>
          </div>
        </div>
      </div>
    )
  }

  Search.afterDOMLoaded = script
  Search.css = style

  return Search
}) satisfies QuartzComponentConstructor
