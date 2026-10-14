import assert from "node:assert/strict"
import test from "node:test"
import vm from "node:vm"
import { preferredSiteLanguage, languageEntryScript } from "./siteLanguage"

test("language entry respects manual choice and browser preference order", () => {
  assert.equal(preferredSiteLanguage(["th-TH", "en-US"], "ru"), "ru")
  assert.equal(preferredSiteLanguage(["ru-RU", "en-US"]), "ru")
  assert.equal(preferredSiteLanguage(["de-DE", "th-TH", "en-US"]), "th")
  assert.equal(preferredSiteLanguage(["en-GB", "ru-RU"]), "en")
  assert.equal(preferredSiteLanguage(["fr-FR"], "invalid"), "en")
})

test("Chinese browser variants and stored choices use the simplified Chinese site", () => {
  for (const locale of ["zh", "zh-CN", "zh-Hans-CN", "zh_TW", "ZH-hk"]) {
    assert.equal(preferredSiteLanguage([locale, "en-US"]), "zh")
  }
  assert.equal(preferredSiteLanguage(["en-US", "zh-CN"]), "en")
  assert.equal(preferredSiteLanguage(["de-DE", "zh-CN", "th-TH"]), "zh")
  assert.equal(preferredSiteLanguage(["en-US"], "zh"), "zh")
  assert.equal(preferredSiteLanguage(["zh-CN"], "th"), "th")
})

test("serialized entry script honors a Chinese manual choice and retains URL state", () => {
  let target = ""
  vm.runInNewContext(languageEntryScript(), {
    navigator: { languages: ["en-US"] },
    localStorage: { getItem: () => "zh" },
    location: {
      search: "?q=mind",
      hash: "#intro",
      replace(url: string) {
        target = url
      },
    },
  })
  assert.equal(target, "/zh/?q=mind#intro")
})

test("root entry script redirects even without storage and preserves query and fragment", () => {
  let target = ""
  vm.runInNewContext(languageEntryScript(), {
    navigator: { languages: ["th-TH", "en-US"] },
    localStorage: {
      getItem() {
        throw new Error("Storage blocked")
      },
    },
    location: {
      search: "?source=podcast",
      hash: "#materials",
      replace(url: string) {
        target = url
      },
    },
  })
  assert.equal(target, "/th/?source=podcast#materials")
})

test("entry falls back to the single browser language and does not store automatic guesses", () => {
  let target = ""
  vm.runInNewContext(languageEntryScript(), {
    navigator: { languages: [], language: "ru-RU" },
    localStorage: {
      getItem() {
        return null
      },
    },
    location: {
      search: "",
      hash: "",
      replace(url: string) {
        target = url
      },
    },
  })
  assert.equal(target, "/ru/")
})
