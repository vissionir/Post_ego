import assert from "node:assert/strict"
import { test } from "node:test"
import { resolvePublishedDate } from "./lastmod"

const created = "2026-02-09T14:55:18+07:00"
const modified = "2026-09-29T19:58:35+07:00"
const published = "2026-10-07T17:49:15+07:00"

test("bulk edits and later source commits cannot republish existing atoms", () => {
  for (const slug of ["Атомы/Нормис", "en/Атомы/Normie", "th/Atoms/Normie"]) {
    assert.equal(resolvePublishedDate(slug, undefined, created, modified), created)
    assert.equal(resolvePublishedDate(slug, undefined, created, "2027-01-01"), created)
  }
})

test("an explicit first-publication date remains independent of later edits", () => {
  for (const slug of ["Атомы/Тишина", "en/Атомы/Silence", "th/Atoms/Silence"]) {
    assert.equal(resolvePublishedDate(slug, published, created, modified), published)
    assert.equal(resolvePublishedDate(slug, published, created, "2027-01-01"), published)
  }
})

test("other pages and atom folder indexes retain their existing date fallback", () => {
  for (const slug of ["Миссия-проекта", "Атомы/index", "en/Атомы/index", "th/Atoms/index"]) {
    assert.equal(resolvePublishedDate(slug, undefined, created, modified), modified)
    assert.equal(resolvePublishedDate(slug, published, created, modified), published)
  }
})
