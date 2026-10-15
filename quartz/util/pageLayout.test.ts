import assert from "node:assert/strict"
import test from "node:test"
import { isAtomPage } from "./pageLayout"
import { languages } from "./siteLanguages"

test("viewport layout applies to individual atoms in every language, not long index pages", () => {
  for (const language of languages) {
    assert(isAtomPage(`${language}/atoms/map`))
    assert(isAtomPage(`${language}/atoms/mind`))
    for (const suffix of ["index", "atoms/index", "atoms/", "graph", "project-mission"]) {
      assert.equal(isAtomPage(`${language}/${suffix}`), false)
    }
  }
  assert.equal(isAtomPage(undefined), false)
  assert.equal(isAtomPage("other/atoms/map"), false)
})
