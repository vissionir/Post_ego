import assert from "node:assert"
import test, { describe } from "node:test"
import { isNeuronavigatorPathname } from "./neuronavigator"

describe("Neuronavigator path detection", () => {
  test("recognizes canonical RU, EN, and TH paths", () => {
    assert.strictEqual(isNeuronavigatorPathname("/Нейронавигатор"), true)
    assert.strictEqual(isNeuronavigatorPathname("/en/Нейронавигатор"), true)
    assert.strictEqual(isNeuronavigatorPathname("/th/Нейронавигатор"), true)
  })

  test("recognizes encoded, aliased, and legacy project paths", () => {
    assert.strictEqual(
      isNeuronavigatorPathname(
        "/%D0%9D%D0%B5%D0%B9%D1%80%D0%BE%D0%BD%D0%B0%D0%B2%D0%B8%D0%B3%D0%B0%D1%82%D0%BE%D1%80",
      ),
      true,
    )
    assert.strictEqual(isNeuronavigatorPathname("/en/Neuronavigator"), true)
    assert.strictEqual(isNeuronavigatorPathname("/Post_ego/th/Нейронавигатор/"), true)
  })

  test("does not match other site pages", () => {
    assert.strictEqual(isNeuronavigatorPathname("/Атомы/Нейронаука"), false)
    assert.strictEqual(isNeuronavigatorPathname("/en/Atoms/Navigation"), false)
    assert.strictEqual(isNeuronavigatorPathname("/%E0%A4%A"), false)
  })
})
