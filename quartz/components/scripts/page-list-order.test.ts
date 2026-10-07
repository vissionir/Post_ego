import assert from "node:assert/strict"
import { test } from "node:test"
import { comparePageListItems } from "./page-list-order"

const collator = new Intl.Collator("ru")
const transition = { title: "Переход к тишине", date: 100, releaseRank: -1, publicationOrder: 0 }
const silence = { title: "Тишина", date: 100, releaseRank: -1, publicationOrder: 1 }

test("the transition precedes silence for both date sorts within one publication", () => {
  for (const mode of ["newest", "oldest"] as const) {
    assert(comparePageListItems(transition, silence, mode, collator) < 0)
  }
})

test("publication date takes priority over ordering inside a publication", () => {
  const older = { ...silence, date: 50 }
  assert(comparePageListItems(transition, older, "newest", collator) < 0)
  assert(comparePageListItems(transition, older, "oldest", collator) > 0)
})

test("alphabetical sorting remains alphabetical", () => {
  const alphabetical = { ...silence, title: "Атом" }
  assert(comparePageListItems(transition, alphabetical, "alphabetical", collator) > 0)
})

test("legacy release ordering and alphabetical ties remain available", () => {
  const a = { title: "А", date: 100, releaseRank: 1 }
  const b = { title: "Б", date: 100, releaseRank: 2 }
  assert(comparePageListItems(a, b, "newest", collator) > 0)
  assert(comparePageListItems(a, b, "oldest", collator) < 0)
  assert(comparePageListItems(a, { ...b, releaseRank: 1 }, "newest", collator) < 0)
})
