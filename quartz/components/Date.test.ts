import assert from "node:assert"
import { describe, test } from "node:test"
import { formatDate, getDate } from "./Date"
import type { GlobalConfiguration } from "../cfg"
import type { QuartzPluginData } from "../plugins/vfile"

describe("formatDate", () => {
  const date = new Date(2026, 5, 1)

  test("formats Russian dates without English punctuation", () => {
    assert.equal(formatDate(date, "ru-RU"), "1 июн 2026")
  })

  test("keeps the existing English format", () => {
    assert.equal(formatDate(date, "en-US"), "Jun 01, 2026")
  })

  test("late-night origin dates do not move to yesterday on the UTC build server", () => {
    const midnight = new Date("2026-02-07T00:10:00+07:00")
    assert.equal(formatDate(midnight, "ru-RU"), "7 февр 2026")
    assert.equal(formatDate(midnight, "en-US"), "Feb 07, 2026")
  })
})

describe("atom chronology", () => {
  const cfg = { defaultDateType: "modified" } as GlobalConfiguration
  const created = new Date("2026-02-15T13:30:31+07:00")
  const modified = new Date("2026-09-29T12:00:00+07:00")
  const published = new Date("2026-10-07T17:49:15+07:00")
  const page = (slug: string) =>
    ({ slug, dates: { created, modified, published } }) as QuartzPluginData

  test("existing atom mirrors keep their original dates despite later edits or bulk commits", () => {
    for (const slug of ["Атомы/Конгруэнтность", "en/Атомы/Congruence", "th/Atoms/Congruence"]) {
      assert.equal(getDate(cfg, page(slug)), created)
      const edited = page(slug)
      edited.dates!.modified = new Date("2027-01-01")
      edited.dates!.published = new Date("2027-01-01")
      assert.equal(getDate(cfg, edited), created)
      assert.equal(edited.dates!.created, created)
    }
  })

  test("new atoms can use a fixed first-publication date without losing the draft origin", () => {
    for (const slug of [
      "Атомы/Постижение-Дао",
      "en/Атомы/Realization-of-the-Dao",
      "th/Atoms/Realization-of-the-Dao",
    ]) {
      const atom = {
        ...page(slug),
        frontmatter: { title: "Dao", published: published.toISOString() },
      }
      assert.equal(getDate(cfg, atom), published)
      atom.dates!.modified = new Date("2027-01-01")
      assert.equal(getDate(cfg, atom), published)
      assert.equal(atom.dates!.created, created)
    }
  })

  test("other pages and folder indexes retain their configured date", () => {
    for (const slug of ["Миссия-проекта", "Атомы/index", "en/Атомы/index", "th/Atoms/index"]) {
      assert.equal(getDate(cfg, page(slug)), modified)
    }
  })
})
