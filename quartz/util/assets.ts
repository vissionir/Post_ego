const assetVersion = process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36)

export function versionedAsset(path: string) {
  return `${path}?v=${assetVersion}`
}
