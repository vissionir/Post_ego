import { FullSlug, isFolderPath, resolveRelative } from "../util/path"
import { QuartzPluginData } from "../plugins/vfile"
import { Date, getDate } from "./Date"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { GlobalConfiguration } from "../cfg"
import { languageForSlug, localeForSlug } from "../util/lang"
import releaseOrderV1 from "./releaseOrderV1.json"

export type SortFn = (f1: QuartzPluginData, f2: QuartzPluginData) => number

function compareAlphabetically(f1: QuartzPluginData, f2: QuartzPluginData, locale?: string) {
  const f1Title = f1.frontmatter?.title.toLowerCase() ?? ""
  const f2Title = f2.frontmatter?.title.toLowerCase() ?? ""
  return f1Title.localeCompare(f2Title, locale)
}

export function byDateAndAlphabetical(cfg: GlobalConfiguration): SortFn {
  return (f1, f2) => {
    // Sort by date/alphabetical
    if (f1.dates && f2.dates) {
      // sort descending
      return getDate(cfg, f2)!.getTime() - getDate(cfg, f1)!.getTime()
    } else if (f1.dates && !f2.dates) {
      // prioritize files with dates
      return -1
    } else if (!f1.dates && f2.dates) {
      return 1
    }

    // otherwise, sort lexographically by title
    return compareAlphabetically(f1, f2)
  }
}

export function byDateAndAlphabeticalFolderFirst(cfg: GlobalConfiguration): SortFn {
  return (f1, f2) => {
    // Sort folders first
    const f1IsFolder = isFolderPath(f1.slug ?? "")
    const f2IsFolder = isFolderPath(f2.slug ?? "")
    if (f1IsFolder && !f2IsFolder) return -1
    if (!f1IsFolder && f2IsFolder) return 1

    // If both are folders or both are files, sort by date/alphabetical
    if (f1.dates && f2.dates) {
      // sort descending
      return getDate(cfg, f2)!.getTime() - getDate(cfg, f1)!.getTime()
    } else if (f1.dates && !f2.dates) {
      // prioritize files with dates
      return -1
    } else if (!f1.dates && f2.dates) {
      return 1
    }

    // otherwise, sort lexographically by title
    return compareAlphabetically(f1, f2)
  }
}

export function byAlphabetical(): SortFn {
  return (f1, f2) => compareAlphabetically(f1, f2)
}

export function byAlphabeticalFolderFirst(locale?: string): SortFn {
  return (f1, f2) => {
    const f1IsFolder = isFolderPath(f1.slug ?? "")
    const f2IsFolder = isFolderPath(f2.slug ?? "")
    if (f1IsFolder && !f2IsFolder) return -1
    if (!f1IsFolder && f2IsFolder) return 1

    return compareAlphabetically(f1, f2, locale)
  }
}

type Props = {
  limit?: number
  sort?: SortFn
} & QuartzComponentProps

export const PageList: QuartzComponent = ({ cfg, fileData, allFiles, limit, sort }: Props) => {
  const locale = localeForSlug(fileData.slug)
  const language = languageForSlug(fileData.slug)
  // Chinese source filenames mirror English; chronology remains maintained separately.
  const releaseRanks = new Map(
    releaseOrderV1[language === "zh" ? "en" : language].map((filename, index) => [filename, index]),
  )
  const sorter = sort ?? byAlphabeticalFolderFirst(locale)
  let list = allFiles.sort(sorter)
  if (limit) {
    list = list.slice(0, limit)
  }

  return (
    <ul class="section-ul">
      {list.map((page) => {
        const title = page.frontmatter?.title
        const tags = page.frontmatter?.tags ?? []
        const filename = page.filePath
          ?.split("/")
          .at(-1)
          ?.replace(/\.[^.]+$/, "")
        // Editorial list placement is independent of the displayed publication date.
        const listDate =
          typeof page.frontmatter?.listDate === "string"
            ? globalThis.Date.parse(page.frontmatter.listDate)
            : NaN

        return (
          <li
            class="section-li"
            data-page-title={title ?? ""}
            data-page-date={
              Number.isFinite(listDate) ? listDate : (getDate(cfg, page)?.getTime() ?? 0)
            }
            data-page-release-rank={releaseRanks.get(filename ?? "") ?? -1}
            data-page-publication-order={page.frontmatter?.publicationOrder}
          >
            <div class="section">
              <p class="meta">
                {page.dates && <Date date={getDate(cfg, page)!} locale={locale} />}
              </p>
              <div class="desc">
                <h3>
                  <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal">
                    {title}
                  </a>
                </h3>
              </div>
              <ul class="tags">
                {tags.map((tag) => (
                  <li>
                    <a
                      class="internal tag-link"
                      href={resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)}
                    >
                      {tag}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

PageList.css = `
.section h3 {
  margin: 0;
}

.section > .tags {
  margin: 0;
}
`
