import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { localeForSlug } from "../../util/lang"

const NotFound: QuartzComponent = ({ cfg, fileData }: QuartzComponentProps) => {
  // If baseUrl contains a pathname after the domain, use this as the home link
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname
  const translation = i18n(localeForSlug(fileData.slug)).pages.error

  return (
    <article class="popover-hint">
      <h1>404</h1>
      <p>{translation.notFound}</p>
      <a href={baseDir}>{translation.home}</a>
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
