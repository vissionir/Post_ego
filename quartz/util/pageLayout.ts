import { isSiteLanguage } from "./siteLanguages"

export function isAtomPage(slug?: string): boolean {
  const [language, section, atom, ...rest] = (slug ?? "").split("/")
  return (
    isSiteLanguage(language) &&
    section === "atoms" &&
    Boolean(atom) &&
    atom !== "index" &&
    rest.length === 0
  )
}
