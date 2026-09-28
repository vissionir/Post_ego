import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const output = path.resolve(process.argv[2] ?? path.join(root, "public", "ai"))
const read = (name: string) => fs.readFileSync(path.join(output, name), "utf8")
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : entry.name.endsWith(".md") ? [file] : []
  })
}
const sources = walk(path.join(root, "content", "Атомы"))
  .filter((file) => path.basename(file) !== "index.md")
  .map((file) => {
    const source = matter(fs.readFileSync(file, "utf8"))
    return { title: source.data.title ?? path.basename(file, ".md"), filename: path.basename(file, ".md"), text: source.content.trim() }
  })
const map = read("post-ego-map.md")
const records = new Map<string, string>()
const headings = [...map.matchAll(/^## Атом: (.+)$/gm)]
for (const [i, heading] of headings.entries()) {
  assert(!records.has(heading[1]), `Duplicate record: ${heading[1]}`)
  records.set(heading[1], map.slice(heading.index, headings[i + 1]?.index))
}
assert.equal(records.size, sources.length, "Atom count differs from source")
let transitions = 0
const targets = new Set(sources.flatMap(({ title, filename }) => [title, filename]))
for (const { title, text } of sources) {
  const record = records.get(title)
  assert(record, `Missing atom: ${title}`)
  const start = record.indexOf("Канонический текст:\n") + "Канонический текст:\n".length
  const end = record.indexOf(`\n\nНавигация для атома «${title}»:`)
  assert(end > start, `Missing canonical section: ${title}`)
  assert.equal(record.slice(start, end), text, `Canonical text changed or truncated: ${title}`)
  for (const match of text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g)) {
    assert(targets.has(match[1]), `Unknown linked atom: ${title} -> ${match[1]}`)
    assert(record.slice(end).includes(`«${match[2] ?? match[1]}» → «${match[1]}»`), `Lost link alias: ${title}`)
    transitions++
  }
}

const names = ["post-ego-map.md", "post-ego-system.md", "post-ego-corpus.md", "post-ego-core.md"]
assert.deepEqual(fs.readdirSync(path.join(output, "upload", "knowledge")).sort(), names.toSorted())
for (const name of names) {
  assert.equal(read(`upload/knowledge/${name}`), read(name), `Stale upload copy: ${name}`)
  assert(!/post-ego-(?:index|atoms)\.md/.test(read(name)), `Retired file referenced: ${name}`)
}
const instructions = read("custom-gpt-instructions.txt")
assert(instructions.length > 6000 && instructions.length <= 8000, "Instruction size outside reviewed bounds")
assert.equal(instructions, read("chatgpt-project-instructions.txt"), "Project instructions differ")
assert.equal(instructions, read("upload/Instructions.txt"), "Upload instructions differ")
assert.equal(instructions, fs.readFileSync(path.join(root, "scripts", "ai", "custom-gpt-instructions.txt"), "utf8"))
const samples = ["Некстинг", "Воин", "Пробуждение", "Отпускание Дхармы", "Бой с тенью", "Homo Deus"]
for (const title of samples) assert(records.has(title), `Missing regression sample: ${title}`)
const report = {
  checked_at: new Date().toISOString(),
  atom_count: records.size,
  canonical_texts_equal_to_source: sources.length,
  link_occurrences_with_preserved_targets_and_labels: transitions,
  instruction_characters: instructions.length,
  shared_instruction_for_gpt_and_project: true,
  upload_knowledge_files: names,
  regression_samples: samples,
  chatgpt_behavior_tested: false,
  note: "File integrity verified. Retrieval and model behavior must be checked after uploading in ChatGPT.",
}
fs.writeFileSync(path.join(output, "validation.json"), JSON.stringify(report, null, 2) + "\n")
const examples = ["Некстинг", "Бой с тенью"].map((title) => {
  const source = sources.find((node) => node.title === title)!
  const formatted = source.text.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, target, label) => `**${label ?? target}**`)
  return `### ${title}\n\n${formatted}`
}).join("\n\n")
fs.writeFileSync(path.join(output, "upload", "Проверка.md"), `# Что проверено\n\nЭто отчёт для владельца, не файл Knowledge.\n\n- ${sources.length} из ${sources.length} канонических текстов дословно совпадают с исходными Markdown-атомами.\n- ${transitions} ссылок сохранили слова и целевые узлы; все целевые атомы существуют.\n- В папке knowledge ровно четыре актуальных файла; ссылок на старые index/atoms внутри них нет.\n- GPT и проект используют одну инструкцию: ${instructions.length} символов, лимит 8000 соблюдён.\n\n## Что восстановлено\n\n| Требование | Решение |\n|---|---|\n| Русский канон и ответ на языке человека | Явный приоритет русской карты; перевод не объявляется новым каноном |\n| Система целиком | Архитектура плюс проверка определений ключевых атомов |\n| Определение и переходы | Точный текст, жирные ссылочные слова, пояснение точного названия соседнего атома |\n| Личный разбор | Факт, переживание, интерпретация, возможный механизм, место выбора |\n| Диалог | Один содержательный шаг; учёт предыдущих ответов и просьб о краткости |\n| Неудача поиска | Повторный целевой запрос, доступный резервный поиск, честное различение пробела и отсутствия атома |\n| Actions | Условия вызова, русский узел, полный текст, проверка версии и доступности инструментов |\n| Причинность | Связь не считается доказательством причины |\n| Внешние модели | Только как обозначенное сравнение или проверка |\n| Служебные материалы | Запрет раскрытия и массовой выгрузки; отдельные публичные определения разрешены |\n\n## Примеры ожидаемого оформления\n\nЭто механическое оформление исходных текстов, не результаты ответа GPT. Пояснение и следующий шаг модель должна подобрать к вопросу.\n\n${examples}\n\n## Что ещё не проверено\n\nРеальный поиск и ответы внутри ChatGPT после загрузки: не тестировались. Десять запросов и критерии приведены в README.md. Правила не дают абсолютной гарантии retrieval или защиты Knowledge.\n\nМетод проверки сочетает сверку источников и сценарии поведения, как рекомендует [официальная документация OpenAI по prompting](https://developers.openai.com/api/docs/guides/prompt-engineering).\n`)
console.log(JSON.stringify(report, null, 2))
