/**
 * 设置面板用的本地 HTTP API：读写 ~/.dsh/dsh-breeze-voice/config.json，并热应用。
 *
 * 只服务回环地址；API key 不回传，只回「有没有设置」（apiKeySet），写回时才接受新值。
 *
 * @module dsh-breeze-voice/src/api
 */
import { createReadStream } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { OUTPUT_FORMATS } from './config.js'
import { RULES_MAX, fillTemplate } from './rules.js'

const PREFIX = '/api/dsh-breeze-voice'
const MAX_BODY = 64 * 1024
/** 只放行本插件自己落盘的文件名，避免路径穿越。 */
const AUDIO_NAME = /^breeze-[\w-]+\.(?:mp3|wav|flac|opus|ogg|aac|pcm)$/i

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function send(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? ''
  // 桌面版页面是 file:// 加载、fetch 走 IPC 桥，合成请求可能没有 remoteAddress。
  if (address === '') return true
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, '请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON')
  }
}

function number(value, field, min, max, integer = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new HttpError(400, `${field} 要是数字`)
  if (parsed < min || parsed > max) throw new HttpError(400, `${field} 要在 ${min} 到 ${max} 之间`)
  return integer ? Math.round(parsed) : parsed
}

function stringValue(value, field, maxLength, { allowEmpty = true } = {}) {
  const text = String(value ?? '')
  if (text.length > maxLength) throw new HttpError(400, `${field} 太长`)
  const trimmed = field === 'instructions' ? text.trim() : text.trim()
  if (!allowEmpty && trimmed === '') throw new HttpError(400, `${field} 不能为空`)
  return trimmed
}

/** 面板吐过来的扁平字段 → 配置补丁。 */
function toPatch(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, '请求体必须是 JSON 对象')
  }
  const patch = {}
  const bool = (key) => { if (input[key] !== undefined) patch[key] = input[key] === true }
  bool('enabled')
  bool('speakerBoost')
  bool('serve')
  bool('withTimestamps')

  if (input.apiKey !== undefined) patch.apiKey = stringValue(input.apiKey, 'API key', 4096)
  if (input.clearApiKey === true) patch.apiKey = ''
  if (input.deepseekApiKey !== undefined) patch.deepseekApiKey = stringValue(input.deepseekApiKey, 'DeepSeek key', 4096)
  if (input.clearDeepseekApiKey === true) patch.deepseekApiKey = ''
  if (input.asrMaxSeconds !== undefined) patch.asrMaxSeconds = number(input.asrMaxSeconds, '识别时长上限', 1, 120)
  if (input.asrTimeoutMs !== undefined) patch.asrTimeoutMs = number(input.asrTimeoutMs, '识别超时', 10000, 600000)
  if (input.voiceId !== undefined) patch.voiceId = stringValue(input.voiceId, '音色 ID', 200)
  if (input.modelId !== undefined) patch.modelId = stringValue(input.modelId, '模型', 200)
  if (input.languageCode !== undefined) {
    const code = stringValue(input.languageCode, '语言', 8).toLowerCase()
    if (code !== '' && !/^[a-z]{2}$/.test(code)) throw new HttpError(400, '语言要是两位代码，例如 zh、en')
    patch.languageCode = code
  }
  if (input.instructions !== undefined) patch.instructions = stringValue(input.instructions, '演绎指令', 1000)
  if (input.outputFormat !== undefined) {
    const format = stringValue(input.outputFormat, '输出格式', 12).toLowerCase()
    if (!OUTPUT_FORMATS.includes(format)) throw new HttpError(400, `输出格式只能是 ${OUTPUT_FORMATS.join(' / ')}`)
    patch.outputFormat = format
  }
  if (input.outputDir !== undefined) patch.outputDir = stringValue(input.outputDir, '输出目录', 1000)
  if (input.speed !== undefined) patch.speed = number(input.speed, '语速', 0.5, 2)
  if (input.volume !== undefined) patch.volume = number(input.volume, '音量', 0.01, 2)
  if (input.guidanceScale !== undefined) patch.guidanceScale = number(input.guidanceScale, '演绎强度', 1, 10)
  if (input.maxChars !== undefined) patch.maxChars = number(input.maxChars, '字符上限', 1, 2000, true)
  if (input.timeoutMs !== undefined) patch.timeoutMs = number(input.timeoutMs, '超时', 1000, 120000, true)
  return patch
}

export function mountBreezeApi(ctx, options) {
  const { service, configStore, logger } = options

  const configView = () => {
    const config = configStore.config
    return {
      enabled: config.enabled !== false,
      apiKeySet: service.apiKey() !== '',
      deepseekApiKeySet: typeof config.deepseekApiKey === 'string' && config.deepseekApiKey !== '',
      asrReady: Boolean(options.asr?.ready),
      asrTimeoutMs: config.asrTimeoutMs,
      asrMaxSeconds: config.asrMaxSeconds,
      asrMaxMiB: config.asrMaxMiB,
      asrPrice: config.asrPrice,
      voiceId: config.voiceId,
      modelId: config.modelId,
      languageCode: config.languageCode,
      instructions: config.instructions,
      outputFormat: config.outputFormat,
      speed: config.speed,
      volume: config.volume,
      guidanceScale: config.guidanceScale,
      speakerBoost: config.speakerBoost === true,
      outputDir: config.outputDir,
      maxChars: config.maxChars,
      timeoutMs: config.timeoutMs,
      withTimestamps: config.withTimestamps === true,
      formats: OUTPUT_FORMATS.slice(),
      configFile: configStore.file,
    }
  }

  const view = () => ({ ok: true, config: configView(), status: service.status() })

  const applyPatch = async (input) => {
    const patch = toPatch(input)
    configStore.update(patch)
    const keys = Object.keys(patch)
    logger.info?.(`breeze-voice: 设置已更新 ${keys.join(', ')}`)
    return { ...view(), changed: keys, restarted: false }
  }

  const handle = async (req, res) => {
    if (!isLoopback(req)) { send(res, 403, { ok: false, error: '只接受本机请求' }); return }
    const url = String(req.url ?? '')
    const sub = url.startsWith(PREFIX) ? url.slice(PREFIX.length).split('?')[0] : ''
    try {
      if (sub === '' || sub === '/') {
        if (req.method === 'GET') { send(res, 200, view()); return }
        if (req.method === 'POST') { send(res, 200, await applyPatch(await readJsonBody(req))); return }
        send(res, 405, { ok: false, error: '只支持 GET / POST' })
        return
      }
      if (sub.startsWith('/audio/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, { ok: false, error: '只支持 GET' }); return }
        const name = decodeURIComponent(sub.slice('/audio/'.length))
        if (!AUDIO_NAME.test(name)) { send(res, 400, { ok: false, error: '文件名不合法' }); return }
        const file = path.join(configStore.config.outputDir, name)
        let info = null
        try { info = await stat(file) } catch { info = null }
        if (info === null || !info.isFile()) { send(res, 404, { ok: false, error: '没有这个音频' }); return }
        const ext = path.extname(name).slice(1).toLowerCase()
        const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'flac' ? 'audio/flac'
          : ext === 'opus' || ext === 'ogg' ? 'audio/ogg' : ext === 'aac' ? 'audio/aac' : 'audio/L16'
        res.writeHead(200, { 'content-type': mime, 'content-length': info.size, 'cache-control': 'no-store' })
        if (req.method === 'HEAD') { res.end(); return }
        createReadStream(file).pipe(res)
        return
      }
      if (sub === '/rules') {
        const store = options.rulesStore
        if (!store) { send(res, 503, { ok: false, error: '规则存储没初始化' }); return }
        if (req.method === 'GET') {
          const current = store.read()
          send(res, 200, { ok: true, text: current.text, isDefault: current.isDefault, max: RULES_MAX })
          return
        }
        if (req.method === 'POST') {
          const body = await readJsonBody(req)
          const saved = store.save(body.text)
          send(res, 200, { ok: true, ...saved, max: RULES_MAX })
          return
        }
        if (req.method === 'DELETE') {
          send(res, 200, { ok: true, ...store.reset(), max: RULES_MAX })
          return
        }
        send(res, 405, { ok: false, error: '只支持 GET / POST / DELETE' })
        return
      }
      if (sub === '/history') {
        if (req.method !== 'GET') { send(res, 405, { ok: false, error: '只支持 GET' }); return }
        const query = new URL(url, 'http://127.0.0.1')
        const limit = Number(query.searchParams.get('limit') ?? 30)
        const data = await service.history(Number.isFinite(limit) ? limit : 30)
        send(res, 200, { ok: true, ...data })
        return
      }
      if (sub === '/history/delete') {
        if (req.method !== 'POST') { send(res, 405, { ok: false, error: '只支持 POST' }); return }
        const body = await readJsonBody(req)
        const name = String(body.name ?? '').trim()
        if (!AUDIO_NAME.test(name)) throw new HttpError(400, '文件名不合法')
        const file = path.join(configStore.config.outputDir, name)
        let removed = false
        for (const target of [file, `${file}.timestamps.json`]) {
          try { await unlink(target); removed = removed || target === file } catch { /* 已经不在了 */ }
        }
        if (!removed) throw new HttpError(404, '没有这个音频')
        logger.info?.(`breeze-voice: 已删除 ${name}`)
        send(res, 200, { ok: true, deleted: name })
        return
      }
      if (sub === '/test') {
        if (req.method !== 'POST') { send(res, 405, { ok: false, error: '只支持 POST' }); return }
        const body = await readJsonBody(req)
        const text = String(body.text ?? '').trim()
        if (text === '') throw new HttpError(400, 'text 不能为空')
        const result = await service.synthesize({ text, instructions: body.instructions })
        send(res, 200, {
          ok: true,
          path: result.file,
          name: result.name,
          mime: result.mime,
          bytes: result.bytes,
          words: result.words.length,
          timestamps: result.timestampsFile,
        })
        return
      }
      send(res, 404, { ok: false, error: '没有这个接口' })
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      if (status === 500) logger.warn?.(`breeze-voice: 设置接口出错 ${String(error?.stack ?? error)}`)
      send(res, status, { ok: false, error: String(error?.message ?? error) })
    }
  }

  ctx.inject(['webServer'], (scoped) => {
    const server = scoped.webServer
    scoped.effect(
      () => server.register({ kind: 'prefix', path: PREFIX, handler: handle }),
      'dsh-breeze-voice: settings api',
    )
    logger.info?.(`breeze-voice: 设置接口已挂载 ${PREFIX}`)
  })
}
