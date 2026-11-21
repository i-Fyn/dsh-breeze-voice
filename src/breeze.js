/**
 * BreezeBlue 云端 TTS 客户端。
 *
 * 两条路，同一个 key：
 *   1. 普通：POST /v1/text-to-speech/{voice_id}?output_format=..&delivery=sync
 *      头 xi-api-key，体 JSON，成功直接返回二进制音频。
 *   2. 带时间戳：POST /v1/text-to-speech/{voice_id}/with-timestamps?output_format=..
 *      返回 JSON 信封 { audio_base64, content_type, word_timestamps }。
 *      普通那条永远不带时间戳，这是服务端的设计。
 *
 * 只依赖全局 fetch（Node 22+），不引第三方依赖。
 * @module dsh-breeze-voice/src/breeze
 */

const API_BASE = 'https://api.breeze.blue'
const TTS_PATH = '/v1/text-to-speech'

/** 输出格式 → 兜底 MIME；服务端返回的 Content-Type 优先。 */
const FORMAT_MIME = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  opus: 'audio/ogg',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  pcm: 'audio/L16',
}

export function mimeOf(format) {
  return FORMAT_MIME[format] ?? 'audio/mpeg'
}

async function readError(res) {
  try {
    const payload = await res.json()
    const parts = [payload?.error, payload?.detail, payload?.code, payload?.message].filter(Boolean)
    if (parts.length) return parts.map(String).join(' / ')
  } catch {
    // 非 JSON 正文，落到下面的文本读取
  }
  try {
    const text = (await res.text()).trim()
    if (text) return text.slice(0, 300)
  } catch {
    // 读不到正文就不带详情
  }
  return '无详情'
}

/** 词级时间戳 → { index, text, start, end }，start/end 是相对这段音频的秒数。 */
function normalizeWords(payload) {
  const raw = payload?.word_timestamps ?? payload?.wordTimestamps
  if (!Array.isArray(raw)) return []
  const words = []
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i]
    const text = String(item?.word ?? item?.text ?? '')
    if (text === '') continue
    const start = Number(item?.start)
    const end = Number(item?.end)
    words.push({
      index: Number.isFinite(Number(item?.index)) ? Number(item.index) : i,
      text,
      start: Number.isFinite(start) ? start : 0,
      end: Number.isFinite(end) ? end : 0,
    })
  }
  return words
}

/**
 * 合成一段语音。成功返回 { bytes, mime, words }；失败抛 Error（消息面向使用者）。
 */
export async function synthesize({
  apiKey,
  voiceId,
  text,
  modelId = '',
  languageCode = '',
  instructions = '',
  outputFormat = 'mp3',
  voiceSettings = {},
  timeoutMs = 20000,
  withTimestamps = false,
}) {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') throw new Error('缺少 BreezeBlue API key')
  if (typeof voiceId !== 'string' || voiceId.trim() === '') throw new Error('缺少音色 ID（形如 voc_...）')

  const url = new URL(`${API_BASE}${TTS_PATH}/${encodeURIComponent(voiceId)}${withTimestamps ? '/with-timestamps' : ''}`)
  url.searchParams.set('output_format', outputFormat)
  // 带时间戳那条不要 delivery：不带才是同步信封，带 async 会变成 202 + 轮询。
  if (!withTimestamps) url.searchParams.set('delivery', 'sync')

  const body = { text }
  if (modelId) body.model_id = modelId
  if (languageCode) body.language_code = languageCode
  if (instructions) body.instructions = instructions
  if (voiceSettings && Object.keys(voiceSettings).length > 0) body.voice_settings = voiceSettings

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
        accept: withTimestamps ? 'application/json' : 'audio/*',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`请求 BreezeBlue 超时（${timeoutMs}ms），可在设置里调大超时。`)
    throw new Error(`连接 BreezeBlue 失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 202) throw new Error('服务端返回了后台任务（202）；本插件只支持同步合成，请改用更短的文本。')
  if (!res.ok) throw new Error(`BreezeBlue 返回 ${res.status}：${await readError(res)}`)

  if (withTimestamps) {
    let payload
    try {
      payload = await res.json()
    } catch {
      throw new Error('带时间戳的接口没有返回 JSON 信封（可能是出口代理改写了响应）。')
    }
    const base64 = String(payload?.audio_base64 ?? payload?.audioBase64 ?? '')
    if (base64 === '') throw new Error('带时间戳的接口没给 audio_base64。')
    const bytes = new Uint8Array(Buffer.from(base64, 'base64'))
    if (bytes.length === 0) throw new Error('BreezeBlue 返回了空音频。')
    const mime = String(payload?.content_type ?? '').split(';')[0].trim() || mimeOf(outputFormat)
    return { bytes, mime, words: normalizeWords(payload) }
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length === 0) throw new Error('BreezeBlue 返回了空音频。')
  const mime = String(res.headers.get('content-type') || '').split(';')[0].trim() || mimeOf(outputFormat)
  return { bytes, mime, words: [] }
}
