import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const styles = readFileSync(new URL("./custom.scss", import.meta.url), "utf8")

test("sidebar alignment only reacts to breadcrumbs in the main page header", () => {
  const unscopedSelector = /(?:^|[\s,])body\s*:\s*has\([^)]*breadcrumb/m
  assert.ok(unscopedSelector.test("body:has(.breadcrumb-container) .sidebar.left"))
  assert.doesNotMatch(styles, unscopedSelector)
  assert.ok(
    styles.includes(
      "#quartz-body:has(> .center > .page-header > .popover-hint > .breadcrumb-container)",
    ),
  )
})
