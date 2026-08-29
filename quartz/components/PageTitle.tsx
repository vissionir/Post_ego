import { FullSlug, resolveRelative } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames, languageForSlug } from "../util/lang"
import { i18n } from "../i18n"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const language = languageForSlug(fileData.slug)
  const homeSlug = (
    language === "en" ? "en/index" : language === "th" ? "th/index" : "index"
  ) as FullSlug
  const homeHref = resolveRelative(fileData.slug!, homeSlug)
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a href={homeHref}>{title}</a>
    </h2>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
