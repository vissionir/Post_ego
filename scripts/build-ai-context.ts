import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

type AiNode = {
  id: string
  title: string
  type: "atom" | "page"
  path: string
  url: string
  summary: string
  links: string[]
  body: string
  truncated: boolean
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const contentDir = path.join(rootDir, "content")
const aiDir = process.env.POSTEGO_AI_OUTPUT_DIR
  ? path.resolve(rootDir, process.env.POSTEGO_AI_OUTPUT_DIR)
  : path.join(rootDir, "public", "ai")
const nodesDir = path.join(aiDir, "nodes")
const siteBaseUrl = (process.env.POSTEGO_BASE_URL ?? "https://post-ego.com").replace(/\/$/, "")
const maxBodyLength = 12000

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

  return {
    id: nodeId(relativePath),
    title,
    type: relativePath.startsWith(`Атомы${path.sep}`) ? "atom" : "page",
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
  },
})

writeJson(path.join(aiDir, "search-index.json"), {
  generated_at: generatedAt,
  source: siteBaseUrl,
  count: nodes.length,
  nodes: nodes.map(({ id, title, type, path: nodePath, url, summary, links }) => ({
    id,
    title,
    type,
    path: nodePath,
    url,
    summary,
    links,
  })),
})

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
                type: object
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
                type: object
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
                type: object
`,
)

writeText(
  path.join(aiDir, "custom-gpt-instructions.txt"),
  `Ты Post-Ego GPT - проводник по живой карте Post-Ego.

Главный источник истины о Post-Ego - сайт Post-Ego и подключенный action.

Когда пользователь спрашивает о Post-Ego, понятиях карты, эго, автоматизме, субъектности, авторстве, страхе, внутренней свободе, буддизме, Юнге, Ницше, Кастанеде или связанных темах, сначала получи актуальный контекст через action.

Рабочий порядок:
1. Вызови getPostEgoSearchIndex, чтобы найти релевантные узлы.
2. Выбери 1-5 наиболее важных node id.
3. Вызови getPostEgoNode для этих узлов.
4. Ответь человеку, опираясь на полученный контекст и ссылки на сайт.

Не выдумывай положения Post-Ego. Если в актуальном контексте нет ответа, скажи: "В опубликованной карте Post-Ego я этого не нашел".

Отвечай как проводник по карте:
- коротко дай суть;
- покажи связанные понятия;
- объясни, почему это важно;
- предложи следующий узел или маршрут;
- если уместно, дай ссылку на источник на сайте.

Разделяй:
- что прямо есть в Post-Ego;
- что является твоей интерпретацией;
- что является внешним сравнением.

Тон: ясный, точный, трезвый. Без мистификации, без мотивационной каши, без превращения Post-Ego в религию.
`,
)

console.log(
  `Generated ${nodes.length} Post-Ego Neuronavigator nodes in ${path.relative(rootDir, aiDir)}`,
)
