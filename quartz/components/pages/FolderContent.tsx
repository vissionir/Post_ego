import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

import style from "../styles/listPage.scss"
import { PageList, SortFn } from "../PageList"
import { Root } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { i18n } from "../../i18n"
import { QuartzPluginData } from "../../plugins/vfile"
import { ComponentChildren } from "preact"
import { concatenateResources } from "../../util/resources"
import { trieFromAllFiles } from "../../util/ctx"
import { localeForSlug } from "../../util/lang"
// @ts-ignore
import sortScript from "../scripts/pageListSort.inline"

interface FolderContentOptions {
  /**
   * Whether to display number of folders
   */
  showFolderCount: boolean
  showSubfolders: boolean
  sort?: SortFn
}

const defaultOptions: FolderContentOptions = {
  showFolderCount: true,
  showSubfolders: true,
}

function atomCountLabel(count: number, isEnglish: boolean) {
  if (isEnglish) return `${count} atoms.`

  const lastTwo = count % 100
  const last = count % 10
  const noun =
    lastTwo >= 11 && lastTwo <= 14
      ? "атомов"
      : last === 1
        ? "атом"
        : last >= 2 && last <= 4
          ? "атома"
          : "атомов"

  return `${count} ${noun}.`
}

export default ((opts?: Partial<FolderContentOptions>) => {
  const options: FolderContentOptions = { ...defaultOptions, ...opts }

  const FolderContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData, allFiles } = props

    const trie = (props.ctx.trie ??= trieFromAllFiles(allFiles))
    const folder = trie.findNode(fileData.slug!.split("/"))
    if (!folder) {
      return null
    }

    const allPagesInFolder: QuartzPluginData[] =
      folder.children
        .map((node) => {
          // regular file, proceed
          if (node.data) {
            return node.data
          }

          if (node.isFolder && options.showSubfolders) {
            // folders that dont have data need synthetic files
            const getMostRecentDates = (): QuartzPluginData["dates"] => {
              let maybeDates: QuartzPluginData["dates"] | undefined = undefined
              for (const child of node.children) {
                if (child.data?.dates) {
                  // compare all dates and assign to maybeDates if its more recent or its not set
                  if (!maybeDates) {
                    maybeDates = { ...child.data.dates }
                  } else {
                    if (child.data.dates.created > maybeDates.created) {
                      maybeDates.created = child.data.dates.created
                    }

                    if (child.data.dates.modified > maybeDates.modified) {
                      maybeDates.modified = child.data.dates.modified
                    }

                    if (child.data.dates.published > maybeDates.published) {
                      maybeDates.published = child.data.dates.published
                    }
                  }
                }
              }
              return (
                maybeDates ?? {
                  created: new Date(),
                  modified: new Date(),
                  published: new Date(),
                }
              )
            }

            return {
              slug: node.slug,
              dates: getMostRecentDates(),
              frontmatter: {
                title: node.displayName,
                tags: [],
              },
            }
          }
        })
        .filter((page) => page !== undefined) ?? []
    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")
    const listProps = {
      ...props,
      sort: options.sort,
      allFiles: allPagesInFolder,
    }

    const content = (
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    ) as ComponentChildren
    const isEnglishAtoms = fileData.slug === "en/Атомы/index"
    const isAtomsFolder = fileData.slug === "Атомы/index" || isEnglishAtoms

    return (
      <div class="popover-hint">
        <article class={classes}>{content}</article>
        <div class="page-listing">
          {isAtomsFolder ? (
            <div class="page-list-toolbar">
              {options.showFolderCount && (
                <p class="page-list-count">
                  {atomCountLabel(allPagesInFolder.length, isEnglishAtoms)}
                </p>
              )}
              <div
                class="page-list-sort"
                data-page-list-sort
                data-sort-locale={isEnglishAtoms ? "en" : "ru"}
              >
                <span class="page-list-sort-label">{isEnglishAtoms ? "Sort" : "Сортировка"}</span>
                <div
                  class="page-list-sort-options"
                  role="group"
                  aria-label={isEnglishAtoms ? "Sort atoms" : "Сортировка атомов"}
                >
                  <button type="button" data-sort-mode="alphabetical" aria-pressed="true">
                    {isEnglishAtoms ? "Alphabetical" : "По алфавиту"}
                  </button>
                  <button type="button" data-sort-mode="newest" aria-pressed="false">
                    {isEnglishAtoms ? "Newest first" : "Сначала новые"}
                  </button>
                  <button type="button" data-sort-mode="oldest" aria-pressed="false">
                    {isEnglishAtoms ? "Oldest first" : "Сначала старые"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            options.showFolderCount && (
              <p>
                {i18n(localeForSlug(fileData.slug)).pages.folderContent.itemsUnderFolder({
                  count: allPagesInFolder.length,
                })}
              </p>
            )
          )}
          <div>
            <PageList {...listProps} />
          </div>
        </div>
      </div>
    )
  }

  FolderContent.css = concatenateResources(style, PageList.css)
  FolderContent.afterDOMLoaded = sortScript
  return FolderContent
}) satisfies QuartzComponentConstructor
