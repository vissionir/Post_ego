const neuronavigatorSuffixes = [
  "Нейронавигатор",
  "Post-Ego-AI",
  "en/Neuronavigator",
  "en/Post-Ego-AI",
] as const

export function isNeuronavigatorPathname(pathname: string): boolean {
  let decodedPathname: string

  try {
    decodedPathname = decodeURIComponent(pathname)
  } catch {
    return false
  }

  const normalizedPathname = decodedPathname.replace(/^\/+|\/+$/g, "")

  return neuronavigatorSuffixes.some(
    (suffix) => normalizedPathname === suffix || normalizedPathname.endsWith(`/${suffix}`),
  )
}
