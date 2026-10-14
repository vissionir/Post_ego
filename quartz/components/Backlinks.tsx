import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/backlinks.scss"
import { resolveRelative, simplifySlug } from "../util/path"
import { i18n } from "../i18n"
import { classNames, localeForSlug } from "../util/lang"

interface BacklinksOptions {
  hideWhenEmpty: boolean
}

const defaultOptions: BacklinksOptions = {
  hideWhenEmpty: true,
}

export default ((opts?: Partial<BacklinksOptions>) => {
  const options: BacklinksOptions = { ...defaultOptions, ...opts }

  const Backlinks: QuartzComponent = ({
    fileData,
    allFiles,
    displayClass,
  }: QuartzComponentProps) => {
    const locale = localeForSlug(fileData.slug)
    const slug = simplifySlug(fileData.slug!)
    const listId = `backlinks-${slug.replace(/[^a-zA-Z0-9-]/g, "-")}`
    const backlinkFiles = allFiles.filter((file) => file.links?.includes(slug))
    if (options.hideWhenEmpty && backlinkFiles.length == 0) {
      return null
    }
    return (
      <div class={classNames(displayClass, "backlinks")}>
        <h3>{i18n(locale).components.backlinks.title}</h3>
        <div class="backlinks-scroll-area">
          <ul
            class="backlinks-list"
            id={listId}
            tabIndex={0}
            aria-label={i18n(locale).components.backlinks.title}
          >
            {backlinkFiles.length > 0 ? (
              backlinkFiles.map((f) => (
                <li>
                  <a href={resolveRelative(fileData.slug!, f.slug!)} class="internal">
                    {f.frontmatter?.title}
                  </a>
                </li>
              ))
            ) : (
              <li>{i18n(locale).components.backlinks.noBacklinksFound}</li>
            )}
          </ul>
        </div>
      </div>
    )
  }

  Backlinks.css = style

  return Backlinks
}) satisfies QuartzComponentConstructor
