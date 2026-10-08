import assert from "node:assert/strict"
import test from "node:test"
import { addToVisited, getVisited, graphVisitEvent } from "../components/scripts/graph-visits"
import type { SimpleSlug } from "./path"

test("graph visits preserve existing history, notify once, and tolerate unavailable storage", () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document")
  let value = JSON.stringify(["Атомы/Реальность", null, 123])
  const events = new EventTarget()
  let notifications = 0
  events.addEventListener(graphVisitEvent, () => notifications++)
  Object.defineProperty(globalThis, "document", { configurable: true, value: events })
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => value, setItem: (_key: string, next: string) => (value = next) },
  })
  try {
    assert.deepEqual([...getVisited()], ["ru/atoms/reality"])
    addToVisited("Атомы/Ум" as SimpleSlug)
    assert.deepEqual(JSON.parse(value), ["ru/atoms/reality", "ru/atoms/mind"])
    addToVisited("ru/atoms/mind" as SimpleSlug)
    assert.equal(notifications, 1)
    value = "invalid JSON"
    assert(getVisited().has("ru/atoms/mind" as SimpleSlug))
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("Storage unavailable")
      },
    })
    addToVisited("Атомы/Присутствие" as SimpleSlug)
    assert(getVisited().has("ru/atoms/presence" as SimpleSlug))
    assert.equal(notifications, 2)
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor)
    else Reflect.deleteProperty(globalThis, "localStorage")
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor)
    else Reflect.deleteProperty(globalThis, "document")
  }
})
