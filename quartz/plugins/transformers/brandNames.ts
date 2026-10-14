import { Element, ElementContent, Root } from "hast"
import { QuartzTransformerPlugin } from "../types"

const excludedTags = new Set(["code", "pre", "script", "style", "textarea", "kbd", "samp"])

// Keep the visible spelling and copied text intact; only change line breaking.
export function keepBrandNamesTogether(tree: Root) {
  function transform(parent: Root | Element) {
    parent.children = parent.children.flatMap((child): ElementContent[] => {
      if (child.type === "element") {
        const classes = child.properties.className
        if (
          !excludedTags.has(child.tagName) &&
          !(Array.isArray(classes) && classes.includes("brand-name"))
        ) {
          transform(child)
        }
      }
      if (child.type !== "text" || !child.value.includes("Post-Ego")) {
        return [child as ElementContent]
      }

      const parts: ElementContent[] = []
      let offset = 0
      for (const match of child.value.matchAll(/Post-Ego/g)) {
        if (match.index > offset) {
          parts.push({ type: "text", value: child.value.slice(offset, match.index) })
        }
        parts.push({
          type: "element",
          tagName: "span",
          properties: { className: ["brand-name"] },
          children: [{ type: "text", value: match[0] }],
        })
        offset = match.index + match[0].length
      }
      if (offset < child.value.length) {
        parts.push({ type: "text", value: child.value.slice(offset) })
      }
      return parts
    })
  }
  transform(tree)
}

export const BrandNames: QuartzTransformerPlugin = () => ({
  name: "BrandNames",
  htmlPlugins() {
    return [() => keepBrandNamesTogether]
  },
})
