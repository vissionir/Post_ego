type TextRect = { right: number; width: number; height: number }

export function textDividerWidth(left: number, available: number, rects: Iterable<TextRect>) {
  let right = left
  for (const rect of rects) {
    if (rect.width > 0 && rect.height > 0) right = Math.max(right, rect.right)
  }
  return Math.min(Math.max(0, available), Math.max(0, right - left))
}
