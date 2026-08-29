import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug, simplifySlug } from "./path"

export interface LanguagePair {
  ru: FullSlug
  en: FullSlug
  th: FullSlug
}

type AtomGraph = {
  files: QuartzPluginData[]
  outgoing: number[][]
  incoming: number[][]
}

const fixedPagePairs: [FullSlug, FullSlug, FullSlug][] = [
  ["index" as FullSlug, "en/index" as FullSlug, "th/index" as FullSlug],
  ["Атомы/index" as FullSlug, "en/Атомы/index" as FullSlug, "th/Atoms/index" as FullSlug],
  [
    "Как-устроено-исследование" as FullSlug,
    "en/How-the-research-is-structured" as FullSlug,
    "th/How-the-research-is-structured" as FullSlug,
  ],
  [
    "Как-я-сюда-пришёл" as FullSlug,
    "en/How-I-got-here" as FullSlug,
    "th/How-I-got-here" as FullSlug,
  ],
  [
    "Миссия-проекта" as FullSlug,
    "en/Project-Mission" as FullSlug,
    "th/Project-Mission" as FullSlug,
  ],
  ["Нейронавигатор" as FullSlug, "en/Нейронавигатор" as FullSlug, "th/Нейронавигатор" as FullSlug],
  [
    "Область-исследования" as FullSlug,
    "en/Scope-of-the-research" as FullSlug,
    "th/Scope-of-the-research" as FullSlug,
  ],
]

// These stable semantic anchors align the two near-isomorphic atom graphs.
const atomAnchors: [string, string][] = [
  ["Ум", "Mind"],
  ["Бессознательное", "The unconscious"],
  ["Эго", "Ego"],
  ["Реальность", "Reality"],
  ["Выбор", "Choice"],
  ["Влечение", "Attraction"],
  ["Аверсия", "Aversion"],
  ["Сопротивление", "Resistance"],
  ["Присутствие", "Presence"],
  ["Отождествление", "Identification"],
  ["Дефицит", "Deficit"],
  ["Контроль", "Control"],
  ["Иллюзия контроля", "Illusion of Control"],
  ["Безусловность существования", "Unconditionality of existence"],
  ["Воображение", "Imagination"],
  ["Все просто", "Everything is Simple"],
  ["Выгода", "Benefit"],
  ["Делегирование", "Delegation"],
  ["Децентрация", "Decentering"],
  ["Духовность", "Spirituality"],
  ["Индульгирование", "Indulgence"],
  ["Культура", "Culture"],
  ["Ложь", "Lie"],
  ["Обида", "Resentment"],
  ["Организация", "Organization"],
  ["Право на лучшее", "Right to better"],
  ["Самостоятельность", "Self-direction"],
  ["Стимул", "Stimulus"],
  ["Третья позиция", "Third Position"],
  ["Экстернализация", "Externalization"],
  ["Этерналс", "Eternals"],
]

const pairCache = new WeakMap<QuartzPluginData[], Map<FullSlug, LanguagePair>>()

function addSlugPair(
  pairs: Map<FullSlug, LanguagePair>,
  available: Set<FullSlug>,
  ru: FullSlug,
  en: FullSlug,
  th: FullSlug,
) {
  if (!available.has(ru) || !available.has(en) || !available.has(th)) return
  const pair = { ru, en, th }
  pairs.set(ru, pair)
  pairs.set(en, pair)
  pairs.set(th, pair)
}

function buildGraph(files: QuartzPluginData[]): AtomGraph {
  const indexBySlug = new Map(files.map((file, index) => [simplifySlug(file.slug!), index]))
  const outgoing = files.map((file) =>
    (file.links ?? [])
      .map((link) => indexBySlug.get(link))
      .filter((index): index is number => index !== undefined),
  )
  const incoming = files.map(() => [] as number[])
  outgoing.forEach((targets, source) => {
    targets.forEach((target) => incoming[target].push(source))
  })
  return { files, outgoing, incoming }
}

function differenceSize(left: Set<number>, right: Set<number>) {
  let count = 0
  left.forEach((value) => {
    if (!right.has(value)) count++
  })
  return count
}

function alignAtomGraphs(ru: AtomGraph, en: AtomGraph) {
  const mapping = new Map<number, number>()
  const usedEnglish = new Set<number>()
  const ruByTitle = new Map(ru.files.map((file, index) => [file.frontmatter?.title, index]))
  const enByTitle = new Map(en.files.map((file, index) => [file.frontmatter?.title, index]))

  const add = (ruIndex: number | undefined, enIndex: number | undefined) => {
    if (
      ruIndex === undefined ||
      enIndex === undefined ||
      mapping.has(ruIndex) ||
      usedEnglish.has(enIndex)
    ) {
      return false
    }
    mapping.set(ruIndex, enIndex)
    usedEnglish.add(enIndex)
    return true
  }

  atomAnchors.forEach(([ruTitle, enTitle]) => add(ruByTitle.get(ruTitle), enByTitle.get(enTitle)))

  const mappedNeighbors = (neighbors: number[]) =>
    new Set(neighbors.filter((index) => mapping.has(index)).map((index) => mapping.get(index)!))
  const knownEnglishNeighbors = (neighbors: number[]) =>
    new Set(neighbors.filter((index) => usedEnglish.has(index)))

  const score = (ruIndex: number, enIndex: number) => {
    const ruOutgoing = mappedNeighbors(ru.outgoing[ruIndex])
    const ruIncoming = mappedNeighbors(ru.incoming[ruIndex])
    const enOutgoing = knownEnglishNeighbors(en.outgoing[enIndex])
    const enIncoming = knownEnglishNeighbors(en.incoming[enIndex])
    const matches =
      [...ruOutgoing].filter((index) => enOutgoing.has(index)).length +
      [...ruIncoming].filter((index) => enIncoming.has(index)).length
    const mismatches =
      differenceSize(ruOutgoing, enOutgoing) +
      differenceSize(enOutgoing, ruOutgoing) +
      differenceSize(ruIncoming, enIncoming) +
      differenceSize(enIncoming, ruIncoming)
    const degreeDifference =
      Math.abs(ru.outgoing[ruIndex].length - en.outgoing[enIndex].length) +
      Math.abs(ru.incoming[ruIndex].length - en.incoming[enIndex].length)

    return {
      value: matches * 20 - mismatches * 8 - degreeDifference * 2,
      matches,
      mismatches,
    }
  }

  for (let round = 0; round < 30; round++) {
    const bestEnglishForRussian = new Map<number, number>()
    const bestRussianForEnglish = new Map<number, number>()

    for (let ruIndex = 0; ruIndex < ru.files.length; ruIndex++) {
      if (mapping.has(ruIndex)) continue
      const candidates = en.files
        .map((_, enIndex) => ({ enIndex, score: score(ruIndex, enIndex) }))
        .filter(({ enIndex, score }) => !usedEnglish.has(enIndex) && score.matches > 0)
        .sort(
          (a, b) =>
            b.score.value - a.score.value ||
            b.score.matches - a.score.matches ||
            a.score.mismatches - b.score.mismatches,
        )
      if (
        candidates[0]?.score.value >= 16 &&
        (!candidates[1] || candidates[0].score.value > candidates[1].score.value)
      ) {
        bestEnglishForRussian.set(ruIndex, candidates[0].enIndex)
      }
    }

    for (let enIndex = 0; enIndex < en.files.length; enIndex++) {
      if (usedEnglish.has(enIndex)) continue
      const candidates = ru.files
        .map((_, ruIndex) => ({ ruIndex, score: score(ruIndex, enIndex) }))
        .filter(({ ruIndex, score }) => !mapping.has(ruIndex) && score.matches > 0)
        .sort(
          (a, b) =>
            b.score.value - a.score.value ||
            b.score.matches - a.score.matches ||
            a.score.mismatches - b.score.mismatches,
        )
      if (
        candidates[0]?.score.value >= 16 &&
        (!candidates[1] || candidates[0].score.value > candidates[1].score.value)
      ) {
        bestRussianForEnglish.set(enIndex, candidates[0].ruIndex)
      }
    }

    let added = 0
    bestEnglishForRussian.forEach((enIndex, ruIndex) => {
      if (bestRussianForEnglish.get(enIndex) === ruIndex && add(ruIndex, enIndex)) added++
    })
    if (added === 0) break
  }

  return mapping
}

function buildLanguagePairs(allFiles: QuartzPluginData[]) {
  const pairs = new Map<FullSlug, LanguagePair>()
  const available = new Set(allFiles.flatMap((file) => (file.slug ? [file.slug] : [])))
  fixedPagePairs.forEach(([ru, en, th]) => addSlugPair(pairs, available, ru, en, th))

  const russianAtoms = allFiles.filter(
    (file) => file.slug?.startsWith("Атомы/") && file.slug !== "Атомы/index",
  )
  const englishAtoms = allFiles.filter(
    (file) => file.slug?.startsWith("en/Атомы/") && file.slug !== "en/Атомы/index",
  )
  const ruGraph = buildGraph(russianAtoms)
  const enGraph = buildGraph(englishAtoms)
  const atomMapping = alignAtomGraphs(ruGraph, enGraph)

  atomMapping.forEach((enIndex, ruIndex) => {
    const enSlug = enGraph.files[enIndex].slug!
    const thSlug = enSlug.replace(/^en\/Атомы\//, "th/Atoms/") as FullSlug
    addSlugPair(pairs, available, ruGraph.files[ruIndex].slug!, enSlug, thSlug)
  })

  return pairs
}

export function getLanguagePair(
  slug: FullSlug | undefined,
  allFiles: QuartzPluginData[],
): LanguagePair | undefined {
  if (!slug) return undefined
  let pairs = pairCache.get(allFiles)
  if (!pairs) {
    pairs = buildLanguagePairs(allFiles)
    pairCache.set(allFiles, pairs)
  }
  return pairs.get(slug)
}
