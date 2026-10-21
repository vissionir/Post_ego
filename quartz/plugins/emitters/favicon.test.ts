import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import sharp from "sharp"
import { Favicon } from "./favicon"
import type { BuildCtx } from "../../util/ctx"
import type { FilePath } from "../../util/path"

test("favicon emitter produces a valid multi-size ICO and correctly sized browser icons", async () => {
  const output = await mkdtemp(path.join(tmpdir(), "postego-icons-"))
  try {
    const ctx = { argv: { output } } as BuildCtx
    const emitted: FilePath[] = []
    const files = await Favicon().emit(ctx, [], { css: [], js: [], additionalHead: [] })
    for await (const file of files) {
      emitted.push(file)
    }
    assert.equal(emitted.length, 4)
    for (const [filename, size] of [
      ["favicon-32.png", 32],
      ["favicon-192.png", 192],
      ["apple-touch-icon.png", 180],
    ] as const) {
      const metadata = await sharp(path.join(output, filename)).metadata()
      assert.equal(metadata.format, "png")
      assert.equal(metadata.width, size)
      assert.equal(metadata.height, size)
    }

    const ico = await readFile(path.join(output, "favicon.ico"))
    assert.equal(ico.readUInt16LE(0), 0)
    assert.equal(ico.readUInt16LE(2), 1)
    assert.equal(ico.readUInt16LE(4), 3)
    let expectedOffset = 6 + 3 * 16
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16
      const length = ico.readUInt32LE(entry + 8)
      const offset = ico.readUInt32LE(entry + 12)
      assert.equal(offset, expectedOffset)
      assert.equal(ico[entry], size)
      assert.equal(ico[entry + 1], size)
      const metadata = await sharp(ico.subarray(offset, offset + length)).metadata()
      assert.equal(metadata.format, "png")
      assert.equal(metadata.width, size)
      assert.equal(metadata.height, size)
      expectedOffset += length
    }
    assert.equal(expectedOffset, ico.length)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})
