import sharp from "sharp"
import { joinSegments, QUARTZ, FullSlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"

export const Favicon: QuartzEmitterPlugin = () => ({
  name: "Favicon",
  async *emit({ argv }) {
    const iconPath = joinSegments(QUARTZ, "static", "icon.png")
    const croppedIcon = await sharp(iconPath).trim({ threshold: 10 }).png().toBuffer()
    const background = "#f4f6f8"
    const sizes = [16, 32, 48, 180, 192]
    const icons = new Map(
      await Promise.all(
        sizes.map(async (size) => {
          const padding = Math.max(1, Math.round(size * 0.04))
          const artworkSize = size - padding * 2
          // Keep the original artwork, with a small safe margin and a stable background.
          const icon = await sharp(croppedIcon)
            .resize(artworkSize, artworkSize, {
              fit: "contain",
              background,
            })
            .extend({ top: padding, bottom: padding, left: padding, right: padding, background })
            .flatten({ background })
            .png()
            .toBuffer()
          return [size, icon] as const
        }),
      ),
    )

    // ICO directory entries point to the PNG image for each supported size.
    const faviconSizes = [16, 32, 48]
    const directory = Buffer.alloc(6 + faviconSizes.length * 16)
    directory.writeUInt16LE(1, 2)
    directory.writeUInt16LE(faviconSizes.length, 4)
    let offset = directory.length
    faviconSizes.forEach((size, index) => {
      const entry = 6 + index * 16
      const png = icons.get(size)!
      directory[entry] = size
      directory[entry + 1] = size
      directory.writeUInt16LE(1, entry + 4)
      directory.writeUInt16LE(32, entry + 6)
      directory.writeUInt32LE(png.length, entry + 8)
      directory.writeUInt32LE(offset, entry + 12)
      offset += png.length
    })

    yield write({
      ctx: { argv } as BuildCtx,
      slug: "favicon" as FullSlug,
      ext: ".ico",
      content: Buffer.concat([directory, ...faviconSizes.map((size) => icons.get(size)!)]),
    })

    for (const [slug, size] of [
      ["favicon-32", 32],
      ["favicon-192", 192],
      ["apple-touch-icon", 180],
    ] as const) {
      yield write({
        ctx: { argv } as BuildCtx,
        slug: slug as FullSlug,
        ext: ".png",
        content: icons.get(size)!,
      })
    }
  },
  async *partialEmit() {},
})
