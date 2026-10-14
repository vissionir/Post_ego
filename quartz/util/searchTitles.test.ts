import assert from "node:assert/strict"
import test from "node:test"
import { matchingTitleIds } from "./searchTitles"

test("Chinese title matches prioritize the exact atom before longer concepts", () => {
  const titles = ["心智地图", "对心智的信任", "心智", "临在", "心智平息"]
  assert.deepEqual(matchingTitleIds(titles, "心智"), [2, 0, 4, 1])
  assert.deepEqual(matchingTitleIds(titles, "  心智 "), [2, 0, 4, 1])
  assert.deepEqual(matchingTitleIds(titles, "不存在的词"), [])
  assert.deepEqual(matchingTitleIds(titles, " "), [])
})
