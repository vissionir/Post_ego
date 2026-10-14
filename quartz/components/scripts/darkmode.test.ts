import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const script = ts.transpileModule(
  readFileSync(new URL("./darkmode.inline.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText

function setup(dark = false, saved: Record<string, string> = {}, blockedStorage = false) {
  const storage = new Map(Object.entries(saved))
  const attributes = new Map<string, string>()
  const cleanups: Array<() => void> = []
  const media = Object.assign(new EventTarget(), { matches: dark })
  const button = new EventTarget()
  const document = Object.assign(new EventTarget(), {
    documentElement: {
      setAttribute: (key: string, value: string) => attributes.set(key, value),
      getAttribute: (key: string) => attributes.get(key),
    },
    getElementsByClassName: () => [button],
  })

  runInNewContext(script, {
    document,
    CustomEvent,
    localStorage: {
      getItem(key: string) {
        if (blockedStorage) throw new Error("Storage blocked")
        return storage.get(key) ?? null
      },
      setItem(key: string, value: string) {
        if (blockedStorage) throw new Error("Storage blocked")
        storage.set(key, value)
      },
    },
    window: {
      matchMedia: () => media,
      addCleanup: (cleanup: () => void) => cleanups.push(cleanup),
    },
  })

  const navigate = () => {
    cleanups.splice(0).forEach((cleanup) => cleanup())
    document.dispatchEvent(new Event("nav"))
  }
  navigate()

  return {
    storage,
    theme: () => attributes.get("saved-theme"),
    click: () => button.dispatchEvent(new Event("click")),
    navigate,
    changeDeviceTheme(dark: boolean) {
      media.matches = dark
      media.dispatchEvent(Object.assign(new Event("change"), { matches: dark }))
    },
  }
}

test("new visitors follow the device theme", () => {
  assert.equal(setup(false).theme(), "light")
  assert.equal(setup(true).theme(), "dark")
})

test("automatic changes do not create a manual preference", () => {
  const page = setup()
  page.changeDeviceTheme(true)
  assert.equal(page.theme(), "dark")
  page.changeDeviceTheme(false)
  assert.equal(page.theme(), "light")
  assert.equal(page.storage.size, 0)
})

test("manual choice survives system changes, navigation and reload", () => {
  const page = setup()
  page.click()
  assert.equal(page.theme(), "dark")
  assert.equal(page.storage.get("theme-preference"), "dark")
  page.changeDeviceTheme(true)
  page.changeDeviceTheme(false)
  page.navigate()
  assert.equal(page.theme(), "dark")
  assert.equal(setup(false, Object.fromEntries(page.storage)).theme(), "dark")
  page.click()
  assert.equal(page.theme(), "light")
})

test("legacy automatic and invalid preferences do not override the device", () => {
  assert.equal(setup(true, { theme: "light" }).theme(), "dark")
  assert.equal(setup(true, { "theme-preference": "invalid" }).theme(), "dark")
})

test("blocked storage does not disable switching or manual priority", () => {
  const page = setup(false, {}, true)
  page.changeDeviceTheme(true)
  assert.equal(page.theme(), "dark")
  page.click()
  assert.equal(page.theme(), "light")
  page.changeDeviceTheme(false)
  page.changeDeviceTheme(true)
  assert.equal(page.theme(), "light")
})

test("navigation cleans up old click handlers", () => {
  const page = setup()
  page.navigate()
  page.navigate()
  page.click()
  assert.equal(page.theme(), "dark")
})
