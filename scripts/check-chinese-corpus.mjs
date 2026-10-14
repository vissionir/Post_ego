import fs from "node:fs"
import path from "node:path"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const routes = JSON.parse(fs.readFileSync(path.join(root, "quartz/util/atom-routes.json"), "utf8"))
const ruDir = path.join(root, "content/Атомы")
const zhDir = path.join(root, "content/zh/Atoms")
const files = fs.readdirSync(ruDir).filter((file) => file.endsWith(".md") && file !== "index.md")
const zhFiles = fs.readdirSync(zhDir).filter((file) => file.endsWith(".md") && file !== "index.md")
assert.equal(zhFiles.length, files.length, "Chinese atom count differs from Russian")
const allZhNames = new Set(zhFiles.map((file) => file.slice(0, -3)))
const wikiLinks = (body) => [...body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)]
const englishName = (target) => routes[target.replace(/^Атомы\//, "")]
let links = 0
const titles = new Set()
for (const file of files) {
  const ru = matter(fs.readFileSync(path.join(ruDir, file), "utf8"))
  const name = englishName(file.slice(0, -3))
  assert(name, `No stable route: ${file}`)
  const zh = matter(fs.readFileSync(path.join(zhDir, `${name}.md`), "utf8"))
  assert.equal(zh.data.lang, "zh-CN", `Wrong language: ${name}`)
  assert(typeof zh.data.title === "string" && zh.data.title.trim(), `Missing title: ${name}`)
  assert(!titles.has(zh.data.title), `Ambiguous Chinese title: ${zh.data.title}`)
  titles.add(zh.data.title)
  assert(/\p{Script=Han}/u.test(zh.content), `Missing Chinese definition: ${name}`)
  assert(!/\p{Script=Cyrillic}/u.test(zh.content), `Untranslated Russian: ${name}`)
  for (const key of ["created", "published", "modified", "publicationOrder"]) {
    assert.deepEqual(zh.data[key], ru.data[key], `Changed ${key}: ${name}`)
  }
  const expected = wikiLinks(ru.content)
    .map((match) => `zh/Atoms/${englishName(match[1])}`)
    .sort()
  const actual = wikiLinks(zh.content)
  assert.deepEqual(actual.map((match) => match[1]).sort(), expected, `Changed links: ${name}`)
  for (const match of actual) {
    assert(match[2]?.trim(), `Missing Chinese link label: ${name}`)
    assert(
      allZhNames.has(match[1].replace(/^zh\/Atoms\//, "")),
      `Unknown Chinese target: ${match[1]}`,
    )
  }
  const originalURLs = [...ru.content.matchAll(/https?:\/\/[^\s)"<>]+/g)].map((m) => m[0]).sort()
  const translatedURLs = [...zh.content.matchAll(/https?:\/\/[^\s)"<>]+/g)].map((m) => m[0]).sort()
  assert.deepEqual(translatedURLs, originalURLs, `External URL changed: ${name}`)
  links += actual.length
}
console.log(
  JSON.stringify({
    atoms: files.length,
    wikiLinksPreserved: links,
    uniqueTitles: titles.size,
    datesPreserved: true,
    externalURLsPreserved: true,
  }),
)
