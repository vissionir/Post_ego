import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "scripts/data/atom-origins.json"), "utf8"))
const directories = ["content/Атомы", "content/en/Атомы", "content/th/Atoms"]
const restore = process.argv.includes("--restore")
assert(restore || process.argv.includes("--check"), "Use --check or --restore")

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

let restored = 0
for (const atom of snapshot.atoms) {
  assert(validDate(atom.created), `Invalid origin date: ${atom.title}`)
  const existing = atom.paths.filter(file => fs.existsSync(path.join(root, file)))
  // This historical register must never resurrect a deleted atom.
  if (!existing.length) continue
  assert.equal(existing.length, 3, `Incomplete mirror group: ${atom.title}`)
  for (const file of existing) {
    const absolute = path.join(root, file)
    const before = fs.readFileSync(absolute, "utf8")
    assert(before.startsWith("---\n"), `Missing frontmatter: ${file}`)
    if (restore) {
      const end = before.indexOf("\n---", 4)
      assert(end > 0, `Invalid frontmatter: ${file}`)
      const header = before.slice(0, end)
      const updated = /^created:.*$/m.test(header)
        ? header.replace(/^created:.*$/m, `created: ${atom.created}`)
        : `${header}\ncreated: ${atom.created}`
      const after = updated + before.slice(end)
      assert.equal(matter(after).content, matter(before).content, `Body changed: ${file}`)
      const withoutCreated = data => Object.fromEntries(Object.entries(data).filter(([key]) => key !== "created"))
      assert.deepEqual(withoutCreated(matter(after).data), withoutCreated(matter(before).data), `Other metadata changed: ${file}`)
      if (after !== before) {
        fs.writeFileSync(absolute, after)
        restored++
      }
    }
    const actual = matter(fs.readFileSync(absolute, "utf8")).data.created
    assert.equal(new Date(actual).toISOString(), new Date(atom.created).toISOString(), `Origin changed: ${file}`)
  }
}

const counts = directories.map(directory => {
  const files = fs.readdirSync(path.join(root, directory)).filter(file => file.endsWith(".md") && file !== "index.md")
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, directory, file), "utf8")
    const literal = source.match(/^created:\s*['"]?([^'"\n]+)['"]?\s*$/m)?.[1]?.trim()
    assert(validDate(literal), `Missing or invalid immutable created date: ${directory}/${file}`)
  }
  return files.length
})
assert(counts.every(count => count === counts[0]), "Mirror counts differ")
console.log(JSON.stringify({ atomCounts: counts, restoredFiles: restored, definitionsChanged: 0, originsVerified: true }))
