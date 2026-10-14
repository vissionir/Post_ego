import assert from "node:assert/strict"
import { test } from "node:test"
import { Root } from "hast"
import { toHtml } from "hast-util-to-html"
import { toString } from "hast-util-to-string"
import { keepBrandNamesTogether } from "./brandNames"

test("keeps the brand together in all four languages without changing text", () => {
  for (const text of [
    "Атомы — смысловые узлы Post-Ego, образующие сеть.",
    "Post-Ego atoms form a semantic network.",
    "อะตอมของ Post-Ego เชื่อมโยงกัน",
    "Post-Ego项目的概念原子。Post-Ego。",
  ]) {
    const tree: Root = { type: "root", children: [{ type: "text", value: text }] }
    keepBrandNamesTogether(tree)
    assert.equal(toString(tree), text)
    assert.equal(
      toHtml(tree).match(/<span class="brand-name">Post-Ego<\/span>/g)?.length,
      text.match(/Post-Ego/g)?.length,
    )
    const once = toHtml(tree)
    keepBrandNamesTogether(tree)
    assert.equal(toHtml(tree), once)
  }
})

test("preserves formatting, links and code literals", () => {
  const tree: Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "strong",
        properties: {},
        children: [{ type: "text", value: "Post-Ego" }],
      },
      {
        type: "element",
        tagName: "a",
        properties: { href: "/ru/atoms/post-ego" },
        children: [{ type: "text", value: "Post-Ego" }],
      },
      {
        type: "element",
        tagName: "code",
        properties: {},
        children: [{ type: "text", value: "Post-Ego" }],
      },
    ],
  }
  keepBrandNamesTogether(tree)
  assert.equal(
    toHtml(tree),
    '<strong><span class="brand-name">Post-Ego</span></strong><a href="/ru/atoms/post-ego"><span class="brand-name">Post-Ego</span></a><code>Post-Ego</code>',
  )
})
