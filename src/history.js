/**
 * 生成记录：每次合成落一行 JSON，面板按时间倒序列出来。
 *
 * 记录只说明「这次合成了什么」，音频本体在输出目录里：
 * - 文件被删掉的那条不再返回；
 * - 磁盘上存在、却没记过的音频（早先版本生成的）会从文件名里的时间补出来，
 *   这样换上这一版之前生成的那几条也能在设置页里看到、点开听。
 *
 * @module dsh-breeze-voice/src/history
 */
import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** 超过这么多条就压一次文件，只留最近的。 */
const MAX_LINES = 400
const KEEP_LINES = 200
/** 读取上限，防止文件被外部写坏后拖垮面板。 */
const MAX_READ = 2 * 1024 * 1024
const AUDIO_NAME = /^breeze-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([\w]+)\.(mp3|wav|flac|opus|ogg|aac|pcm)$/i

export function historyFile(dataDir) {
  return path.join(dataDir, 'history.jsonl')
}

/** 一条记录：只留面板要用的字段，文本截短，避免记录文件被长文撑大。 */
function entryOf(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const name = String(raw.name ?? '').trim()
  if (name === '' || name.includes('/') || name.includes('\\')) return null
  const at = String(raw.at ?? '').trim()
  const when = Number.isFinite(Date.parse(at)) ? new Date(Date.parse(at)).toISOString() : new Date().toISOString()
  const text = String(raw.text ?? '').replace(/\s+/g, ' ').trim()
  const bytes = Number(raw.bytes)
  const ms = Number(raw.ms)
  return {
    at: when,
    name,
    text: text.length > 280 ? `${text.slice(0, 280)}…` : text,
    bytes: Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes) : 0,
    ms: Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : 0,
    voiceId: String(raw.voiceId ?? '').trim(),
    format: String(raw.format ?? path.extname(name).slice(1)).toLowerCase(),
  }
}

export async function readHistory(dataDir) {
  let raw = ''
  try {
    raw = await readFile(historyFile(dataDir), 'utf8')
  } catch {
    return []
  }
  if (raw.length > MAX_READ) raw = raw.slice(-MAX_READ)
  const items = []
  for (const line of raw.split('\n')) {
    const text = line.trim()
    if (text === '') continue
    try {
      const item = entryOf(JSON.parse(text))
      if (item !== null) items.push(item)
    } catch {
      // 坏行跳过：记录文件不是关键数据，不值得因为一行坏了整页打不开
    }
  }
  return items
}

export async function appendHistory(dataDir, entry) {
  const item = entryOf(entry)
  if (item === null) return null
  await mkdir(dataDir, { recursive: true })
  await appendFile(historyFile(dataDir), `${JSON.stringify(item)}\n`, 'utf8')
  try {
    const raw = await readFile(historyFile(dataDir), 'utf8')
    const lines = raw.split('\n').filter(line => line.trim() !== '')
    if (lines.length > MAX_LINES) {
      await writeFile(historyFile(dataDir), `${lines.slice(-KEEP_LINES).join('\n')}\n`, 'utf8')
    }
  } catch {
    // 压不动就算了，下次再说
  }
  return item
}

/** 文件名里的本地时间，用来给没有记录的旧文件补一个大概的时间。 */
function timeFromName(name) {
  const match = AUDIO_NAME.exec(name)
  if (match === null) return null
  const [, year, month, day, hour, minute, second] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

async function audioFiles(outDir) {
  let names = []
  try {
    names = await readdir(outDir)
  } catch {
    return []
  }
  const files = []
  for (const name of names) {
    if (!AUDIO_NAME.test(name)) continue
    let info = null
    try {
      info = await stat(path.join(outDir, name))
    } catch {
      info = null
    }
    if (info === null || !info.isFile()) continue
    files.push({
      name,
      bytes: info.size,
      at: timeFromName(name) ?? new Date(info.mtimeMs).toISOString(),
      format: path.extname(name).slice(1).toLowerCase(),
    })
  }
  return files
}

/**
 * 面板用的一份完整列表：磁盘上还在的音频，能对上记录的就带文本，对不上的补一条。
 * @returns {Promise<{items:object[],total:number,historyFile:string,outDir:string}>}
 */
export async function loadHistory({ dataDir, outDir, limit = 20 }) {
  const recorded = await readHistory(dataDir)
  const byName = new Map(recorded.map(item => [item.name, item]))
  const files = await audioFiles(outDir)
  const items = files.map(file => {
    const record = byName.get(file.name)
    return {
      at: record?.at ?? file.at,
      name: file.name,
      text: record?.text ?? '',
      bytes: file.bytes,
      ms: record?.ms ?? 0,
      voiceId: record?.voiceId ?? '',
      format: file.format,
      recorded: record !== undefined,
    }
  })
  items.sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
  const max = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.round(limit))) : 20
  return {
    items: items.slice(0, max),
    total: items.length,
    historyFile: historyFile(dataDir),
    outDir,
  }
}
