import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

type AiNode = {
  id: string
  title: string
  type: "atom" | "page"
  language: "ru" | "en"
  path: string
  url: string
  summary: string
  links: string[]
  body: string
  truncated: boolean
}

type AtomHint = {
  synonyms?: string[]
  when?: string
  examples?: string[]
}

type KnowledgeRoute = {
  query: string
  atoms: string[]
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const contentDir = path.join(rootDir, "content")
const aiDir = process.env.POSTEGO_AI_OUTPUT_DIR
  ? path.resolve(rootDir, process.env.POSTEGO_AI_OUTPUT_DIR)
  : path.join(rootDir, "public", "ai")
const nodesDir = path.join(aiDir, "nodes")
const siteBaseUrl = (process.env.POSTEGO_BASE_URL ?? "https://post-ego.com").replace(/\/$/, "")
const maxBodyLength = 12000

const translitMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
}

const atomHints: Record<string, AtomHint> = {
  "Автоматизм ума": {
    synonyms: ["автоматически", "повторяется", "не могу остановиться", "меня тянет", "меня клинит"],
    when: "Используй этот атом, когда пользователь описывает повторяющуюся реакцию, действие без выбора, привычный паттерн, внутренний автопилот или состояние «меня снова понесло».",
    examples: [
      "Почему это повторяется?",
      "Меня опять тянет сделать то же самое.",
      "Не могу остановиться, хотя понимаю, что не надо.",
      "Где здесь автоматизм?",
    ],
  },
  "Внутренний диалог": {
    synonyms: ["мысли", "разговор в голове", "голос в голове", "сам с собой", "ментальный шум"],
    when: "Используй этот атом, когда пользователь говорит о мыслях, споре с собой, внутреннем объяснении, прокручивании ситуаций или шуме ума.",
    examples: [
      "Почему я постоянно разговариваю с собой в голове?",
      "Как остановить внутренний диалог?",
      "Что делает ум, когда всё объясняет?",
    ],
  },
  "Галлюцинация ума": {
    synonyms: ["накрутил", "придумал", "кажется", "история в голове", "ум дорисовал"],
    when: "Используй этот атом, когда пользователь принимает продукт интерпретации за реальность, достраивает картину без прямого опыта или верит в сценарий ума.",
    examples: [
      "Я накрутил себя?",
      "Как понять, где реальность, а где история ума?",
      "Почему я верю тому, что сам придумал?",
    ],
  },
  "Дефицитное мышление": {
    synonyms: ["мало", "не хватит", "упущу", "нет ресурса", "страх нехватки"],
    when: "Используй этот атом, когда пользователь смотрит на ситуацию через нехватку, страх потери, недостаточность ресурса или ощущение, что возможности исчезают.",
    examples: [
      "Почему мне всё время кажется, что я что-то упускаю?",
      "Как дефицитное мышление связано со страхом?",
      "Что делать с ощущением, что мне не хватит?",
    ],
  },
  Импринт: {
    synonyms: ["триггер", "старый паттерн", "реакция из прошлого", "зажим", "меня задело"],
    when: "Используй этот атом, когда пользователь описывает сильную автоматическую реакцию, будто настоящее распознаётся как старая ситуация.",
    examples: [
      "Помоги найти импринт.",
      "Почему меня так задело?",
      "Это реакция на реальность или старый паттерн?",
      "Как импринт связан со страхом?",
    ],
  },
  Карта: {
    synonyms: ["схема", "навигация", "как читать карту", "структура", "с чего начать"],
    when: "Используй этот атом, когда пользователь спрашивает, как ориентироваться в Post-Ego, с чего начать или как связаны понятия карты.",
    examples: ["С чего начать?", "Как пользоваться картой?", "Как понять связи между атомами?"],
  },
  Контроль: {
    synonyms: [
      "контролировать",
      "держать",
      "не отпускаю",
      "надо управлять",
      "страх потерять контроль",
    ],
    when: "Используй этот атом, когда пользователь описывает попытку удерживать ситуацию, себя, других людей или образ будущего.",
    examples: [
      "Почему я всё контролирую?",
      "Что стоит за страхом потерять контроль?",
      "Как контроль связан с умом?",
    ],
  },
  "Модель реальности": {
    synonyms: ["картина мира", "модель мира", "как устроена реальность", "объяснение мира"],
    when: "Используй этот атом, когда пользователь спрашивает о том, через какую модель Post-Ego описывает опыт и реальность.",
    examples: [
      "Что такое модель реальности?",
      "Как Post-Ego описывает реальность?",
      "Это теория или карта?",
    ],
  },
  Миссия: {
    synonyms: [
      "миссия проекта",
      "зачем нужен Post-Ego",
      "смысл проекта",
      "культурная форма",
      "осознанность как культура",
    ],
    when: "Используй этот атом, когда пользователь спрашивает о миссии как организующей системе участия субъекта в реальности. Если вопрос именно про миссию проекта Post-Ego, смотри также post-ego-corpus.md и страницу «Миссия проекта».",
    examples: [
      "В чём миссия Post-Ego?",
      "Зачем нужен этот проект?",
      "Что такое миссия в карте Post-Ego?",
      "Как миссия связана с позицией автора?",
    ],
  },
  Папанча: {
    synonyms: ["ум разгоняется", "раздувание мыслей", "ментальное размножение", "накрутка"],
    when: "Используй этот атом, когда пользователь описывает разрастание мыслей, сценариев и интерпретаций вокруг простого события.",
    examples: [
      "Почему мысли разгоняются?",
      "Как остановить накрутку?",
      "Чем папанча отличается от обычного мышления?",
    ],
  },
  Присутствие: {
    synonyms: ["быть здесь", "прямой опыт", "сейчас", "осознанность", "не в голове"],
    when: "Используй этот атом, когда пользователь спрашивает о прямом переживании, выходе из интерпретаций ума и контакте с происходящим.",
    examples: [
      "Что такое присутствие?",
      "Как вернуться в прямой опыт?",
      "Чем присутствие отличается от мыслей о происходящем?",
    ],
  },
  Разотождествление: {
    synonyms: ["я не мысль", "не отождествляться", "отлипнуть", "наблюдать", "дистанция от ума"],
    when: "Используй этот атом, когда пользователь хочет отделить себя от мыслей, эмоций, роли, образа себя или автоматической реакции.",
    examples: [
      "Как разотождествиться с мыслью?",
      "Я — это мои эмоции?",
      "Как перестать верить внутреннему диалогу?",
    ],
  },
  Ретроспекция: {
    synonyms: ["задним числом", "надо было", "если бы", "прошлое", "переигрываю ситуацию"],
    when: "Используй этот атом, когда пользователь оценивает прошлое из настоящего, переигрывает выбор или считает, что тогда должен был знать то, что знает сейчас.",
    examples: [
      "Почему я думаю, что надо было сделать иначе?",
      "Как ретроспекция искажает прошлое?",
      "Почему прошлый выбор кажется очевидной ошибкой?",
    ],
  },
  Самость: {
    synonyms: ["я", "кто я", "целостность", "самость", "внутренний центр"],
    when: "Используй этот атом, когда пользователь спрашивает о целостности себя, структуре «я» или отличии самости от эго.",
    examples: ["Что такое самость?", "Чем самость отличается от эго?", "Кто я в модели Post-Ego?"],
  },
  Страх: {
    synonyms: ["боюсь", "страшно", "опасность", "защита", "угроза"],
    when: "Используй этот атом, когда пользователь описывает угрозу, избегание, защитную реакцию или корень импринта.",
    examples: [
      "Чего я боюсь на самом деле?",
      "Как страх связан с импринтом?",
      "Почему я защищаюсь?",
    ],
  },
  Субъектность: {
    synonyms: ["авторство", "я выбираю", "моя жизнь", "ответственность", "позиция субъекта"],
    when: "Используй этот атом, когда пользователь спрашивает про возвращение выбора себе, ответственность, авторство действия и выход из пассивной позиции.",
    examples: [
      "Где здесь моё авторство?",
      "Как вернуть субъектность?",
      "Почему я чувствую, что мной управляет ситуация?",
    ],
  },
  Тень: {
    synonyms: ["не я", "вытесненное", "подавленное", "не хочу видеть", "стыдная часть"],
    when: "Используй этот атом, когда пользователь сталкивается с вытесненной частью себя, отрицанием качества или сильной реакцией на то, что не признаёт в себе.",
    examples: [
      "Что я не хочу видеть в себе?",
      "Как тень связана с эго?",
      "Почему меня раздражает это качество в других?",
    ],
  },
  Тревога: {
    synonyms: ["тревожно", "беспокойство", "напряжение", "ожидание плохого", "неопределённость"],
    when: "Используй этот атом, когда пользователь описывает тревогу, ожидание угрозы, напряжение перед будущим или невозможность опереться на настоящее.",
    examples: [
      "Почему мне тревожно?",
      "Как тревога связана со страхом?",
      "Что проверить в опыте, когда тревожно?",
    ],
  },
  Ум: {
    synonyms: ["мысли", "мышление", "интерпретация", "объяснение", "голова"],
    when: "Используй этот атом, когда пользователь спрашивает о функции мышления, интерпретациях, моделировании и подмене опыта объяснением.",
    examples: [
      "Что такое ум в Post-Ego?",
      "Почему ум подменяет реальность?",
      "Как отличить опыт от интерпретации?",
    ],
  },
  "Упущенная выгода": {
    synonyms: ["упустил", "потерял шанс", "надо было иначе", "жалею", "мог бы"],
    when: "Используй этот атом, когда пользователь переживает потерянную возможность, сравнивает настоящее с воображаемой альтернативой или мучается от «надо было иначе».",
    examples: [
      "Я упустил шанс?",
      "Почему меня мучает упущенная выгода?",
      "Как ум создаёт ощущение потерянной возможности?",
    ],
  },
  Эго: {
    synonyms: ["я", "эго-структура", "личность", "самоотождествление", "образ себя"],
    when: "Используй этот атом, когда пользователь спрашивает про «я», самоотождествление, личность, внутренний образ себя, контроль или защиту образа себя.",
    examples: [
      "Что такое эго?",
      "Почему я защищаю образ себя?",
      "Как эго связано с умом?",
      "Где здесь самоотождествление?",
    ],
  },
}

const knowledgeRoutes: KnowledgeRoute[] = [
  {
    query: "«сложно», «не понимаю», «запутался», «с чего начать», «как читать карту»",
    atoms: ["Карта", "Модель реальности", "Ум", "Присутствие"],
  },
  {
    query: "«я», «кто я», «личность», «самость», «образ себя», «эго»",
    atoms: [
      "Эго",
      "Иллюзия эго",
      "Дереификация",
      "Память",
      "Личная история",
      "Разотождествление",
      "Самость",
    ],
  },
  {
    query:
      "«повторяется», «меня снова тянет», «не могу остановиться», «автоматически», «меня клинит»",
    atoms: ["Автоматизм ума", "Импринт", "Внутренний диалог", "Папанча", "Страх"],
  },
  {
    query: "«упустил», «потерял шанс», «надо было иначе», «если бы», «жалею»",
    atoms: ["Упущенная выгода", "Ретроспекция", "Галлюцинация ума", "Дефицитное мышление"],
  },
  {
    query: "«тревожно», «страшно», «боюсь», «опасно», «неопределённость»",
    atoms: [
      "Тревога",
      "Тревожность",
      "Озабоченность",
      "Встреча со страхом",
      "Смелость",
      "Заземление",
    ],
  },
  {
    query: "«мысли», «голова», «внутренний голос», «накрутка», «разговор с собой»",
    atoms: ["Ум", "Внутренний диалог", "Папанча", "Галлюцинация ума", "Разотождествление"],
  },
  {
    query: "«контроль», «надо удержать», «отпустить», «управлять», «потерять контроль»",
    atoms: ["Контроль", "Страх", "Ум", "Субъектность", "Выбор"],
  },
  {
    query: "«что делать», «как выбрать», «где моё действие», «ответственность», «авторство»",
    atoms: [
      "Субъектность",
      "Самодетерминация",
      "Воление",
      "Принятое решение",
      "Самоэффективность",
      "Выбор",
    ],
  },
  {
    query:
      "«миссия», «миссия проекта», «зачем нужен Post-Ego», «смысл проекта», «культурная форма»",
    atoms: ["Миссия", "Культура", "Агентность", "Позиция автора", "Присутствие"],
  },
  {
    query: "«не в голове», «прямой опыт», «быть здесь», «осознанность», «вернуться в настоящее»",
    atoms: [
      "Присутствие",
      "Доступность присутствия",
      "Заземление",
      "Внутреннее безмолвие",
      "Реальность",
      "Ум",
    ],
  },
  {
    query: "«буддизм», «недвойственность», «анатта», «пустотность», «пробуждение»",
    atoms: [
      "Анатта",
      "Недвойственность",
      "Пустотность",
      "Иллюзия пути",
      "Изначальная завершённость",
      "Пробуждение",
    ],
  },
  {
    query:
      "«так было всегда», «это естественно», «иначе невозможно», «так устроен мир», «почему не меняется»",
    atoms: [
      "Имплицитная пресуппозиция",
      "Мировоззренческий импринт",
      "Сохранение статус-кво",
      "Контрпресуппозиция",
      "Переход",
    ],
  },
  {
    query:
      "«думаю сам», «не верю авторитетам», «моя картина мира», «сам определяю истину», «чужое мнение»",
    atoms: [
      "Интеллектуальная автономность",
      "Самостоятельное мышление",
      "Суверенная картина мира",
      "Позиция автора",
    ],
  },
  {
    query:
      "«боюсь проявляться», «нельзя влиять», «страшно заявить о себе», «быть лучшим», «превосходство»",
    atoms: [
      "Запрет на самоутверждение",
      "Утверждение",
      "Превосходство",
      "Право на превосходство",
      "Доминантность",
    ],
  },
  {
    query: "«мысли влияют на тело», «ум и тело», «нейронные связи», «мысль меняет реальность»",
    atoms: [
      "Материальность мысли",
      "Психофизическое единство",
      "Нейронная анархия",
      "Ум",
      "Реальность",
    ],
  },
  {
    query: "«Юнг», «тень», «самость», «архетип», «индивидуация»",
    atoms: ["Тень", "Самость", "Архетип", "Индивидуация", "Эго"],
  },
  {
    query: "«Ницше», «воля», «сила», «сверхчеловек», «самопреодоление»",
    atoms: ["Воля к власти", "Самопреодоление", "Сверхчеловек", "Вечное возвращение"],
  },
  {
    query: "«Кастанеда», «точка сборки», «сталкинг», «намерение», «безупречность»",
    atoms: ["Точка сборки", "Сталкинг", "Намерение", "Безупречность"],
  },
]

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === ".obsidian") return []
      return walk(fullPath)
    }

    if (!entry.isFile() || !entry.name.endsWith(".md")) return []
    return [fullPath]
  })
}

function quartzSlug(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.md$/, "")
  const normalized = withoutExt
    .split(path.sep)
    .join("/")
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
    .replace(/\/index$/, "")

  return normalized === "index" ? "" : normalized
}

function pageUrl(relativePath: string): string {
  const slug = quartzSlug(relativePath)
  return slug ? `${siteBaseUrl}/${encodeURI(slug)}` : `${siteBaseUrl}/`
}

function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?]]/g, (_match, target, alias) =>
      String(alias ?? target),
    )
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractLinks(markdown: string): string[] {
  const links = new Set<string>()
  const wikiLinkPattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?]]/g
  for (const match of markdown.matchAll(wikiLinkPattern)) {
    links.add(match[1].trim())
  }
  return Array.from(links).sort((a, b) => a.localeCompare(b, "ru"))
}

function summarize(markdown: string): string {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((paragraph) => cleanMarkdown(paragraph))
    .filter((paragraph) => paragraph.length > 20)

  const summary = paragraphs[0] ?? cleanMarkdown(markdown).slice(0, 360)
  return summary.length > 520 ? `${summary.slice(0, 517).trim()}...` : summary
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value.toLowerCase())) return false
      seen.add(value.toLowerCase())
      return true
    })
}

function normalizeYo(value: string): string {
  return value.replace(/ё/g, "е").replace(/Ё/g, "Е")
}

function atomId(title: string): string {
  return normalizeYo(title)
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function knowledgeId(node: AiNode): string {
  return `${node.language}-${atomId(node.title)}`
}

function titleWords(title: string): string[] {
  return title
    .split(/[\s,;:()«»"—-]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3)
}

function atomSynonyms(node: AiNode): string[] {
  const hint = atomHints[node.title]
  return unique([
    node.title,
    node.title.toLowerCase(),
    normalizeYo(node.title),
    ...titleWords(node.title),
    ...(hint?.synonyms ?? []),
  ])
}

function atomExamples(node: AiNode): string[] {
  const hint = atomHints[node.title]
  if (hint?.examples?.length) return hint.examples

  const related = node.links.slice(0, 2)
  return unique([
    `Что такое ${node.title}?`,
    `Объясни ${node.title} проще.`,
    related[0] ? `Как связаны ${node.title} и ${related[0]}?` : "",
    `Где в этом вопросе проявляется ${node.title}?`,
  ])
}

function atomWhenToUse(node: AiNode): string {
  const hint = atomHints[node.title]
  if (hint?.when) return hint.when

  const related = node.links.slice(0, 5)
  const relatedText = related.length ? ` Ближайшие связанные узлы: ${related.join(", ")}.` : ""
  return `Используй этот атом, когда пользователь спрашивает про «${node.title}», близкие формулировки, связанные состояния или хочет понять этот узел карты.${relatedText}`
}

function buildAtomsKnowledge(atomNodes: AiNode[]): string {
  const header = `# Post-Ego atoms

Этот файл подготовлен специально для Knowledge в Custom GPT.
Он не является страницей сайта. Его задача — помочь GPT находить атомы карты Post-Ego по обычным человеческим запросам.
Внутри файла есть русские и английские атомы. Отвечай на языке пользователя, но опирайся на точный атом и его связи.

Правило использования:
- сначала найди релевантные атомы по названию, синонимам, блоку "Когда использовать" и примерам запросов;
- затем отвечай по определениям и тексту атомов;
- если точного атома нет, честно скажи, что точного атома не найдено, и предложи ближайшие узлы как гипотезу.
`

  const body = atomNodes
    .map((node) => {
      const synonyms = atomSynonyms(node)
      const links = node.links.length ? node.links.join(", ") : "нет явных связей"
      const examples = atomExamples(node)
        .map((example) => `- ${example}`)
        .join("\n")

      return `# ${node.title}

ID: ${knowledgeId(node)}
Тип: атом
Язык: ${node.language}
Синонимы: ${synonyms.join(", ")}
Связанные узлы: ${links}
URL: ${node.url}

Определение:
${node.summary}

Когда использовать:
${atomWhenToUse(node)}

Коротко:
${node.summary}

Примеры запросов:
${examples}

Текст атома:
${node.body}`
    })
    .join("\n\n---\n\n")

  return `${header}\n\n${body}\n`
}

function buildIndexKnowledge(atomNodes: AiNode[]): string {
  const atomTitles = new Set(atomNodes.map((node) => node.title))
  const routeText = knowledgeRoutes
    .map((route) => {
      const existingAtoms = route.atoms.filter((atom) => atomTitles.has(atom))
      return `Если пользователь спрашивает про ${route.query}:
смотри атомы: ${existingAtoms.join(", ")}.`
    })
    .join("\n\n")

  const alphabeticalIndex = atomNodes
    .map((node) => {
      const synonyms = atomSynonyms(node).slice(0, 8).join(", ")
      const links = node.links.slice(0, 8).join(", ")
      return `- ${node.title} (${knowledgeId(node)}, язык: ${node.language}): синонимы: ${synonyms}${links ? `; связанные узлы: ${links}` : ""}.`
    })
    .join("\n")

  return `# Индекс карты Post-Ego

Этот файл — навигационная карта для GPT. Используй его перед ответом, чтобы выбрать релевантные атомы.
Индекс включает русские и английские атомы в одном файле, чтобы не плодить отдельные Knowledge-файлы для каждого языка.

## Маршруты по обычным запросам

${routeText}

## Как выбирать атомы

1. Сначала сопоставь язык пользователя с маршрутами выше.
2. Затем найди эти атомы в post-ego-atoms.md.
3. Если запрос личный и неочевидный, выбери 2–5 ближайших атомов и прямо скажи, что это маршрут-гипотеза.
4. Не заменяй Post-Ego общей психологией, буддизмом, Юнгом, Ницше или эзотерикой. Внешние системы можно давать только как отдельное сравнение.

## Как работать с семантической сетью

1. Не останавливайся на одном атоме, если вопрос требует маршрута.
2. У каждого атома есть поле "Связанные узлы". Используй его как карту соседних узлов.
3. После выбора стартового атома посмотри 1–3 ближайших связанных узла, которые уточняют вопрос.
4. Отвечай не только определением, а маршрутом: стартовый узел → связанные узлы → следующий шаг.
5. Если включены Actions, сначала используй search-index, затем открывай нужные nodes/{id}.json и учитывай их links.

## Алфавитный индекс атомов

${alphabeticalIndex}
`
}

function buildCoreKnowledge(): string {
  return `# Core model for Post-Ego GPT

Post-Ego в рамках Нейронавигатора — это карта различений для работы с опытом, умом, состоянием, присутствием, автоматизмами, импринтами, выбором и субъектностью.

Post-Ego не надо подавать как религию, психотерапию, духовное учение, универсальное спасение или набор мнений. Это модель реальности и навигационная карта.

## Базовые различения

Непосредственный опыт — то, что прямо переживается сейчас.

Интерпретация ума — объяснение, история, прогноз, оценка или модель, построенная умом поверх опыта.

Присутствие — режим прямого переживания происходящего, в котором опыт не подменён вторичной интерпретацией ума.

Ум — инструмент интерпретации, моделирования и объяснения опыта, но не источник реальности.

Автоматизм — повторение восприятия, реакции или действия по уже сложившемуся паттерну без актуализации выбора.

Импринт — связанная структура восприятия, телесного состояния, эмоции и контекста, которая автоматически подменяет непосредственное восприятие распознаванием старого паттерна.

Субъектность — возвращение причинности выбора и действия субъекту вместо делегирования жизни обстоятельствам, внутреннему диалогу, автоматизмам или импринтам.

## Семантическая сеть

Каждый атом — это узел карты. Связанные узлы — это не украшение, а основной способ навигации.

Нейронавигатор должен работать по карте: находить стартовый узел, смотреть его связи, выбирать ближайшие узлы и показывать пользователю маршрут понимания.

Один атом редко исчерпывает вопрос. Хороший ответ обычно держит 2–5 узлов и объясняет, как они связаны.

## Как отвечать

1. Сначала определи 2–5 релевантных атомов.
2. Проверь связанные узлы этих атомов и выбери 1–3 узла для продолжения маршрута.
3. Объясни вопрос через эти атомы простым языком.
4. Разделяй: что прямо есть в Post-Ego, что является осторожным выводом, что является внешним сравнением.
5. Если точного атома нет, скажи: "В доступной карте Post-Ego я не нашёл точного атома по этому вопросу".
6. Не ставь диагнозы и не обещай терапевтический эффект.
7. В личных вопросах помогай различать опыт, интерпретацию ума, автоматизм, возможный импринт и место выбора.
`
}

function buildCorpusKnowledge(pageNodes: AiNode[]): string {
  const body = pageNodes
    .map((node) => {
      const links = node.links.length ? node.links.join(", ") : "нет явных связей"

      return `# ${node.title}

Тип: страница корпуса
Язык: ${node.language}
URL: ${node.url}
Связанные узлы: ${links}

Коротко:
${node.summary}

Текст страницы:
${node.body}`
    })
    .join("\n\n---\n\n")

  return `# Корпус Post-Ego: основные страницы

Этот файл дополняет атомы. Используй его, когда пользователь спрашивает не отдельное понятие, а проект целиком: миссию, устройство исследования, область исследования, вход в карту, Нейронавигатор или общий смысл Post-Ego. В файле могут быть русские и английские страницы корпуса.

Правило использования:
- если вопрос про "миссию", "проект", "корпус", "исследование", "сайт", "зачем это нужно" или "что такое Post-Ego", сначала смотри этот файл;
- если вопрос про конкретное понятие, сначала смотри post-ego-index.md и post-ego-atoms.md;
- если страница прямо найдена здесь, не говори, что в карте нет формулировки.

${body}
`
}

function buildGptSetupGuide(): string {
  return `# Post-Ego GPT setup

Этот файл — короткая инструкция по настройке Custom GPT "Post-Ego GPT".

## Knowledge

Загрузи в Knowledge эти файлы:

1. post-ego-index.md
2. post-ego-atoms.md
3. post-ego-corpus.md
4. post-ego-core.md

Лучше не грузить весь сайт архивом. GPT должен искать не сырые страницы, а специально подготовленные файлы с атомами, синонимами, связанными узлами, страницами корпуса и примерами запросов. Русская и английская версии лежат внутри тех же файлов, чтобы не плодить отдельные загрузки.

## Instructions

В поле Instructions вставь содержимое файла:

${siteBaseUrl}/ai/custom-gpt-instructions.txt

## Actions

Actions можно оставить как дополнительный актуальный источник:

${siteBaseUrl}/ai/openapi.yaml

Но для качества ответов основной упор должен быть на Knowledge-файлы:
- post-ego-index.md выбирает релевантные атомы;
- post-ego-atoms.md даёт определения и связи на русском и английском;
- post-ego-corpus.md даёт основные страницы проекта, включая миссию;
- post-ego-core.md держит общую рамку модели.

Главное: GPT должен работать не как поиск по тексту, а как навигатор по семантической сети. У атомов есть поле "Связанные узлы"; по нему GPT должен строить маршрут ответа.

## Capabilities

Рекомендуемая настройка:

- Code Interpreter / Data Analysis: выключить.
- Image generation: выключить.
- Web browsing: можно выключить, если есть Actions; можно включить только если GPT должен проверять внешние страницы.
- Actions: включить, если подключён openapi.yaml.

## Conversation starters

Поставь короткие стартовые вопросы:

- Что такое Post-Ego и зачем эта карта?
- В чём сильная идея Post-Ego как модели?
- Разбери моё состояние через карту Post-Ego.
- Помоги найти возможный импринт.

## Как проверять качество

Проверь GPT на запросах:

- Меня клинит и я снова делаю одно и то же.
- Я чувствую, что упустил шанс.
- Почему я защищаю образ себя?
- Я тревожусь, но не понимаю из-за чего.
- С чего начать, если я не понимаю карту?

Хороший ответ должен:

1. Назвать 2–5 релевантных атомов.
2. Объяснить простыми словами.
3. Не уходить в общую психологию.
4. Не превращать Post-Ego в терапию или духовное учение.
5. Честно сказать, если точного атома в карте нет.
`
}

function nodeId(relativePath: string): string {
  const hash = crypto.createHash("sha1").update(relativePath).digest("hex").slice(0, 12)
  return `node-${hash}`
}

function buildNode(filePath: string): AiNode {
  const relativePath = path.relative(contentDir, filePath)
  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = matter(raw)
  const fallbackTitle = path.basename(filePath, ".md")
  const title = typeof parsed.data.title === "string" ? parsed.data.title : fallbackTitle
  const body = cleanMarkdown(parsed.content)
  const truncated = body.length > maxBodyLength
  const language = relativePath.startsWith(`en${path.sep}`) ? "en" : "ru"
  const normalizedPath = relativePath.split(path.sep).join("/")
  const isAtomSectionPage =
    normalizedPath === "Атомы/index.md" ||
    normalizedPath === "en/Атомы/index.md" ||
    normalizedPath === "en/Атомы/Atoms.md"
  const isAtom =
    !isAtomSectionPage &&
    (relativePath.startsWith(`Атомы${path.sep}`) ||
      relativePath.startsWith(`en${path.sep}Атомы${path.sep}`))

  return {
    id: nodeId(relativePath),
    title,
    type: isAtom ? "atom" : "page",
    language,
    path: relativePath.split(path.sep).join("/"),
    url: pageUrl(relativePath),
    summary: summarize(parsed.content),
    links: extractLinks(parsed.content),
    body: truncated ? `${body.slice(0, maxBodyLength).trim()}...` : body,
    truncated,
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(filePath: string, value: string): void {
  fs.writeFileSync(filePath, value.trimStart())
}

fs.rmSync(aiDir, { recursive: true, force: true })
fs.mkdirSync(nodesDir, { recursive: true })

const generatedAt = new Date().toISOString()
const nodes = walk(contentDir)
  .map(buildNode)
  .sort((a, b) => {
    if (a.type !== b.type) return a.type === "page" ? -1 : 1
    return a.title.localeCompare(b.title, "ru")
  })
const atomNodes = nodes.filter(
  (node) => node.type === "atom" && !node.path.endsWith("Атомы/index.md"),
)
const primaryPageNodes = nodes.filter((node) => node.type === "page")

for (const node of nodes) {
  writeJson(path.join(nodesDir, `${node.id}.json`), {
    generated_at: generatedAt,
    source: siteBaseUrl,
    node,
  })
}

writeJson(path.join(aiDir, "manifest.json"), {
  name: "Post-Ego Neuronavigator",
  description: "AI-readable слой карты Post-Ego: понятия, связи и публичные страницы корпуса.",
  source: siteBaseUrl,
  generated_at: generatedAt,
  version: generatedAt.slice(0, 10),
  count: nodes.length,
  entrypoints: {
    manifest: `${siteBaseUrl}/ai/manifest.json`,
    search_index: `${siteBaseUrl}/ai/search-index.json`,
    node: `${siteBaseUrl}/ai/nodes/{id}.json`,
    openapi: `${siteBaseUrl}/ai/openapi.yaml`,
    custom_gpt_instructions: `${siteBaseUrl}/ai/custom-gpt-instructions.txt`,
    knowledge_atoms: `${siteBaseUrl}/ai/post-ego-atoms.md`,
    knowledge_index: `${siteBaseUrl}/ai/post-ego-index.md`,
    knowledge_corpus: `${siteBaseUrl}/ai/post-ego-corpus.md`,
    knowledge_core: `${siteBaseUrl}/ai/post-ego-core.md`,
    gpt_setup: `${siteBaseUrl}/ai/post-ego-gpt-setup.md`,
  },
})

writeJson(path.join(aiDir, "search-index.json"), {
  generated_at: generatedAt,
  source: siteBaseUrl,
  count: nodes.length,
  nodes: nodes.map(({ id, title, type, language, path: nodePath, url, summary, links }) => ({
    id,
    title,
    type,
    language,
    path: nodePath,
    url,
    summary,
    links,
  })),
})

writeText(path.join(aiDir, "post-ego-atoms.md"), buildAtomsKnowledge(atomNodes))
writeText(path.join(aiDir, "post-ego-index.md"), buildIndexKnowledge(atomNodes))
writeText(path.join(aiDir, "post-ego-corpus.md"), buildCorpusKnowledge(primaryPageNodes))
writeText(path.join(aiDir, "post-ego-core.md"), buildCoreKnowledge())
writeText(path.join(aiDir, "post-ego-gpt-setup.md"), buildGptSetupGuide())

writeText(
  path.join(aiDir, "openapi.yaml"),
  `openapi: 3.1.0
info:
  title: Post-Ego Neuronavigator Context
  version: 1.0.0
  description: Static AI-readable context for the public Post-Ego corpus.
servers:
  - url: ${siteBaseUrl}
paths:
  /ai/manifest.json:
    get:
      operationId: getPostEgoManifest
      summary: Get the Post-Ego Neuronavigator manifest.
      responses:
        "200":
          description: Post-Ego Neuronavigator manifest.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Manifest"
  /ai/search-index.json:
    get:
      operationId: getPostEgoSearchIndex
      summary: Get the searchable index of Post-Ego nodes.
      description: Use this first to find relevant node ids, titles, summaries, links, and source URLs.
      responses:
        "200":
          description: Search index with all public Post-Ego nodes.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SearchIndex"
  /ai/nodes/{id}.json:
    get:
      operationId: getPostEgoNode
      summary: Get one Post-Ego node by id.
      parameters:
        - name: id
          in: path
          required: true
          description: Node id from /ai/search-index.json, for example node-abc123def456.
          schema:
            type: string
      responses:
        "200":
          description: Full node context.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/NodeResponse"
components:
  schemas:
    Manifest:
      type: object
      properties:
        name:
          type: string
        description:
          type: string
        source:
          type: string
        generated_at:
          type: string
        version:
          type: string
        count:
          type: integer
        entrypoints:
          type: object
          properties:
            manifest:
              type: string
            search_index:
              type: string
            node:
              type: string
            openapi:
              type: string
            custom_gpt_instructions:
              type: string
            knowledge_atoms:
              type: string
            knowledge_index:
              type: string
            knowledge_corpus:
              type: string
            knowledge_core:
              type: string
            gpt_setup:
              type: string
          additionalProperties:
            type: string
      additionalProperties: true
    SearchIndex:
      type: object
      properties:
        generated_at:
          type: string
        source:
          type: string
        count:
          type: integer
        nodes:
          type: array
          items:
            $ref: "#/components/schemas/NodeSummary"
      additionalProperties: true
    NodeSummary:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        type:
          type: string
          enum:
            - atom
            - page
        language:
          type: string
          enum:
            - ru
            - en
        path:
          type: string
        url:
          type: string
        summary:
          type: string
        links:
          type: array
          items:
            type: string
      additionalProperties: true
    NodeResponse:
      type: object
      properties:
        generated_at:
          type: string
        source:
          type: string
        node:
          $ref: "#/components/schemas/AiNode"
      additionalProperties: true
    AiNode:
      type: object
      properties:
        id:
          type: string
        title:
          type: string
        type:
          type: string
          enum:
            - atom
            - page
        language:
          type: string
          enum:
            - ru
            - en
        path:
          type: string
        url:
          type: string
        summary:
          type: string
        links:
          type: array
          items:
            type: string
        body:
          type: string
        truncated:
          type: boolean
      additionalProperties: true
`,
)

writeText(
  path.join(aiDir, "custom-gpt-instructions.txt"),
  `Ты — Post-Ego GPT: нейронавигатор по карте Post-Ego.

Твоя задача — помогать человеку быстро и ясно ориентироваться в Post-Ego: объяснять понятия, различать состояния, находить релевантные атомы и показывать смысловые связи карты без воды и без общей психологической болтовни.

Post-Ego — это модель реальности и карта различений для анализа опыта, ума, состояния, присутствия, автоматизмов, импринтов, выбора, субъектности и действия.

Post-Ego не является религией, психотерапией, духовным учением, мотивационной системой или универсальным спасением. Не превращай его в культ, диагноз или обещание трансформации. Не повторяй этот дисклеймер без необходимости.

Главный источник ответа — загруженные Knowledge-файлы:
1. post-ego-index.md — навигационный индекс: помогает выбрать релевантные атомы по обычному языку пользователя.
2. post-ego-atoms.md — основной корпус атомов на русском и английском: определения, связи, синонимы, примеры запросов и тексты атомов.
3. post-ego-corpus.md — основные страницы проекта на русском и английском: миссия, устройство исследования, область исследования, вход в карту, Нейронавигатор.
4. post-ego-core.md — базовая рамка модели и правила ответа.

По умолчанию сначала отвечай из Knowledge. Если нужное понятие есть в Knowledge, не ходи в Actions ради простого определения.

Если пользователь спрашивает про миссию, смысл проекта, устройство исследования, область исследования, корпус, сайт или "что такое Post-Ego", смотри post-ego-corpus.md.

Если пользователь спрашивает про понятие, состояние, повторяющийся паттерн, импринт, ум, эго, страх, тревогу, выбор или действие, сначала смотри post-ego-index.md, затем post-ego-atoms.md.

Перед ответом внутренне определи 1-3 релевантных узла карты. Не показывай этот поиск как отдельный отчёт, если пользователь этого не просил.

Работай по карте, но не пиши механические маршруты.
- Каждый атом является узлом карты.
- Поле "Связанные узлы" показывает соседние смысловые переходы.
- Используй связи, чтобы точнее объяснить понятие.
- Не выводи цепочки вида "А → Б → В → Г", если пользователь прямо не просил маршрут.
- Не выдумывай причинную последовательность между узлами только потому, что они связаны.
- Если связь важна, пиши проще: "Связано: Эго, Самость, Тень, Отождествление".
- "Следующий узел" предлагай только один и только когда это реально помогает продолжить понимание.

Actions — это доступ к живой карте на сайте. Используй Actions только в случаях:
- пользователь просит актуальную версию, свежую карту, ссылку, источник или проверку по сайту;
- в Knowledge не хватает точного атома или связи;
- пользователь прямо просит пройти по карте, найти узлы, связи или маршрут;
- нужно открыть конкретный узел с сайта.

Если Actions нужны:
1. Вызови getPostEgoSearchIndex, чтобы найти релевантные узлы.
2. Выбери 1-5 наиболее важных node id.
3. Посмотри поле links у найденных узлов.
4. Если нужен маршрут, найди в search-index соседние узлы из links и открой их через getPostEgoNode.
5. Ответь, опираясь на найденные атомы и связи между ними.

Если вопрос простой ("что такое эго", "что такое импринт", "объясни атом"), отвечай из Knowledge без Actions, чтобы не тормозить.

Не подменяй Post-Ego общей психологией, буддизмом, стоицизмом, NLP, Юнгом, Ницше, Кастанедой, эзотерикой или своей общей эрудицией. Внешние системы можно использовать только как отдельное сравнение и явно помечать как внешнее сравнение.

Используй карту радикально: если вопрос можно разобрать через узлы Post-Ego, разбирай его через узлы Post-Ego. Не сглаживай ответ до общих фраз. Показывай, где ум подменяет опыт интерпретацией, где включается автоматизм, где возможен импринт, где теряется или возвращается субъектность. Но делай это коротко.

Если точный атом или страница не найдены, только тогда скажи: "В доступной карте Post-Ego я не нашёл точного атома по этому вопросу". После этого предложи ближайшие связанные узлы как гипотезу. Не используй эту фразу, пока не проверены index, atoms, corpus и core.

Отвечай на языке пользователя. Если пользователь пишет по-русски, отвечай по-русски. Если пользователь пишет по-английски, отвечай по-английски, но сохраняй точность терминов Post-Ego.

По умолчанию отвечай коротко: 4-9 строк. Если вопрос сложный, можно дать до 3 коротких блоков. Не делай длинные вступления. Не пиши академическим тоном.

Не используй обязательные заголовки "Узлы карты", "Маршрут", "Дальше по карте" в каждом ответе. Они быстро превращают ответ в шаблон. Встраивай карту естественно.

Если пользователь просит объяснить понятие, дай:
- короткое определение;
- чем это не является;
- с какими узлами связано;
- простой пример.

Идеальный формат для простого понятия:
1. Один короткий абзац определения.
2. Один простой пример.
3. Одна строка "Связано: ..."
4. Если нужно: "Дальше можно смотреть: [один узел]".

Если пользователь описывает личную ситуацию, не ставь диагнозы и не обещай терапевтический эффект. Помоги различить:
- непосредственный опыт;
- интерпретацию ума;
- автоматизм;
- возможный импринт;
- место выбора или субъектности.

Если пользователь спрашивает мнение о Post-Ego, отвечай не как человек с личными вкусами, а как аналитическая оценка модели: в чём сила карты, где её границы, чем она отличается от психологии, духовности и философии.

В конце ответа можно мягко подтолкнуть пользователя дальше, но без рекламной навязчивости. Лучше один точный вопрос или один следующий узел, чем длинный маршрут.

Тон: ясный, точный, трезвый, живой. Без мистификации, без мотивационной каши, без психологической ваты, без духовного тумана.
`,
)

console.log(
  `Generated ${nodes.length} Post-Ego Neuronavigator nodes in ${path.relative(rootDir, aiDir)}`,
)
