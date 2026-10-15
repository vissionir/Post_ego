import assert from "node:assert/strict"
import test from "node:test"
import { needsAssetReload, siteAssetVersion } from "./siteAssetVersion"

test("compares release versions independently of page depth", () => {
  const current = siteAssetVersion(
    "../../index.css?v=release-a",
    "https://post-ego.com/ru/atoms/mind",
  )
  const next = siteAssetVersion("../index.css?v=release-a", "https://post-ego.com/en/")
  assert.equal(current, "release-a")
  assert.equal(needsAssetReload(current, next), false)
  assert.equal(needsAssetReload(current, "release-b"), true)
})

test("upgrades unversioned sessions but does not reload for missing or unrelated styles", () => {
  assert.equal(needsAssetReload(null, "release-b"), true)
  assert.equal(needsAssetReload("release-a", null), false)
  assert.equal(siteAssetVersion(null, "https://post-ego.com/"), null)
  assert.equal(siteAssetVersion("index.css", "https://post-ego.com/"), null)
  assert.equal(siteAssetVersion("https://example.com/theme.css?v=x", "https://post-ego.com/"), null)
})
