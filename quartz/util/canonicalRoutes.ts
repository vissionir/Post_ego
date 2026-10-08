import atoms from "./atom-routes.json"
import { FilePath, FullSlug, slugifyFilePath, simplifySlug } from "./path"

export const languages = ["ru", "en", "th"] as const
const routes = new Map<string, FullSlug>()
const originals = new Map<FullSlug, Set<string>>()

export function asciiSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  if (!slug) throw new Error(`Cannot create ASCII route: ${value}`)
  return slug
}

function register(source: string, target: FullSlug) {
  const key = source
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.html$/, "")
    .replace(/\/index$/, "")
  const existing = routes.get(key)
  if (existing && existing !== target) throw new Error(`Route collision: ${source}`)
  routes.set(key, target)
  const aliases = originals.get(target) ?? new Set<string>()
  aliases.add(source)
  originals.set(target, aliases)
}

const pages = [
  ["index", "index", "index"],
  ["Атомы/index", "Атомы/index", "Atoms/index"],
  ["Граф", "Graph", "Graph"],
  ["Нейронавигатор", "Нейронавигатор", "Нейронавигатор"],
  ["Как-устроено-исследование", "How-the-research-is-structured", "How-the-research-is-structured"],
  ["Область-исследования", "Scope-of-the-research", "Scope-of-the-research"],
  ["Миссия-проекта", "Project-Mission", "Project-Mission"],
]
const pageRoutes = [
  "index",
  "atoms/index",
  "graph",
  "neuronavigator",
  "how-the-research-is-structured",
  "scope-of-the-research",
  "project-mission",
]
pages.forEach((page, i) =>
  languages.forEach((lang, j) => {
    const target = `${lang}/${pageRoutes[i]}` as FullSlug
    register((lang === "ru" ? "" : `${lang}/`) + page[j], target)
    for (const name of new Set(page)) register((lang === "ru" ? "" : `${lang}/`) + name, target)
    register(target, target)
  }),
)

for (const [ru, en] of Object.entries(atoms)) {
  for (const lang of languages) {
    const target = `${lang}/atoms/${asciiSlug(en)}` as FullSlug
    const prefix = lang === "ru" ? "Атомы/" : lang === "en" ? "en/Атомы/" : "th/Atoms/"
    // Mixed-language paths were previously crawled by Google; retain them too.
    for (const name of new Set([ru, en])) {
      const source = slugifyFilePath(`${prefix}${name}.md` as FilePath)
      register(source, target)
      register(source.replace("Атомы/", "атомы/"), target)
      register(source.replace(/ё/g, "е").replace(/Ё/g, "Е"), target)
    }
    register(target, target)
  }
}

// Confirmed old names retained in the corresponding source frontmatter.
for (const [oldName, current] of [
  ["Trust-in-Oneself", "self-trust"],
  ["Итеративное-разотождествление", "iterative-deidentification"],
]) {
  for (const lang of languages) {
    const prefix = lang === "ru" ? "Атомы/" : lang === "en" ? "en/Атомы/" : "th/Atoms/"
    register(`${prefix}${oldName}`, `${lang}/atoms/${current}` as FullSlug)
  }
}

export function canonicalRoute(source: string): FullSlug | undefined {
  let key: string
  try {
    key = decodeURI(source)
  } catch {
    return undefined
  }
  key = key
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.(?:html|md)$/, "")
    .replace(/\/index$/, "")
  if (!key) key = "index"
  return routes.get(key) ?? routes.get(key.toLowerCase())
}

export function routeAliases(target: FullSlug): string[] {
  return [...(originals.get(target) ?? [])].filter((value) => value !== target)
}

export function publicPath(source: string): string {
  const target = canonicalRoute(source)
  return target ? `/${simplifySlug(target)}` : `/${source.replace(/^\//, "")}`
}
