/**
 * 语音识别（ASR）：把本机音频转成文字。
 *
 * 走 DeepSeek 的 /v1/tools/asr（multipart，file 字段），要求 16 位 PCM WAV 或 Ogg Opus，
 * 单次 ≤8 MiB、≤120 秒。别的格式先用 ffmpeg 转成 16k 单声道 wav 再传。
 *
 * key 来源顺序：配置 deepseekApiKey → 环境变量 DEEPSEEK_API_KEY → ~/.dsh/.credentials.yaml。
 *
 * @module dsh-breeze-voice/src/asr
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ENDPOINT = process.env.DEEPSEEK_ASR_ENDPOINT || 'https://api.deepseek.com/v1/tools/asr'
const FFMPEG = process.env.DSH_FFMPEG || '/Users/xieyuanhang/.dsh/drawai-ffmpeg/darwin-arm64/ffmpeg'
const MAX_BYTES = 8 * 1024 * 1024
const MAX_SECONDS = 120
const RATES = [8000, 16000, 22050, 24000, 32000, 44100, 48000]

export class AsrError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.status = status
  }
}

function readCredentialKey(logger) {
  try {
    const file = path.join(os.homedir(), '.dsh', '.credentials.yaml')
    const text = fs.readFileSync(file, 'utf8')
    const match = text.match(/^\s*DEEPSEEK_API_KEY:\s*(\S+)\s*$/m)
    return match ? match[1].replace(/^['"]|['"]$/g, '') : ''
  } catch (error) {
    logger?.debug?.(`breeze-voice: 读凭证文件失败 ${String(error)}`)
    return ''
  }
}

function wavInfo(buffer) {
  if (buffer.length < 44) return null
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null
  return { channels: buffer.readUInt16LE(22), rate: buffer.readUInt32LE(24), bits: buffer.readUInt16LE(34) }
}

export class AsrService {
  constructor({ configStore, logger } = {}) {
    this.configStore = configStore
    this.logger = logger ?? console
  }

  get config() {
    return this.configStore?.config ?? {}
  }

  apiKey() {
    const fromConfig = typeof this.config.deepseekApiKey === 'string' ? this.config.deepseekApiKey.trim() : ''
    if (fromConfig) return fromConfig
    if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim()
    return readCredentialKey(this.logger)
  }

  get ready() {
    return this.apiKey() !== ''
  }

  async prepare(file) {
    const stat = fs.statSync(file)
    if (stat.size === 0) throw new AsrError(`音频是空文件：${file}`)
    const head = Buffer.alloc(64)
    const fd = fs.openSync(file, 'r')
    try { fs.readSync(fd, head, 0, 64, 0) } finally { fs.closeSync(fd) }
    const info = wavInfo(head)
    const usable = info && info.bits === 16 && RATES.includes(info.rate)
    if (usable && stat.size <= MAX_BYTES) return { file, cleanup: () => {} }
    const tmp = path.join(os.tmpdir(), `breeze-asr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`)
    try {
      await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-t', String(MAX_SECONDS), tmp], { timeout: 120000 })
    } catch (error) {
      throw new AsrError(`转成 wav 失败（ffmpeg）：${String(error?.message ?? error)}`)
    }
    return { file: tmp, cleanup: () => { try { fs.unlinkSync(tmp) } catch {} } }
  }

  async recognize({ file, language } = {}) {
    if (typeof file !== 'string' || file.trim() === '') throw new AsrError('需要音频文件路径')
    const abs = path.resolve(file.replace(/^~/, os.homedir()))
    if (!fs.existsSync(abs)) throw new AsrError(`找不到文件：${abs}`)
    if (!this.ready) throw new AsrError('没有可用的 DeepSeek key：请在 设置 → 语音 里填，或设置环境变量 DEEPSEEK_API_KEY')
    const cleanups = []
    try {
      const prepared = await this.prepare(abs)
      cleanups.push(prepared.cleanup)
      const buffer = fs.readFileSync(prepared.file)
      if (buffer.length > MAX_BYTES) throw new AsrError(`音频超过 8 MiB（${(buffer.length / 1048576).toFixed(1)} MiB），请先截短`)
      const form = new FormData()
      form.append('file', new Blob([buffer], { type: 'audio/wav' }), path.basename(prepared.file))
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey()}` },
        body: form,
        signal: AbortSignal.timeout(Number(this.config.asrTimeoutMs) || 180000),
      })
      const raw = await response.text()
      if (!response.ok) throw new AsrError(`识别失败 HTTP ${response.status}：${raw.slice(0, 300)}`, response.status)
      let payload
      try { payload = JSON.parse(raw) } catch { throw new AsrError(`返回不是 JSON：${raw.slice(0, 200)}`) }
      const durationMs = Number(payload.duration_ms) || 0
      return {
        text: typeof payload.text === 'string' ? payload.text : '',
        durationMs,
        seconds: durationMs > 0 ? durationMs / 1000 : 0,
        requestId: payload.request_id ?? '',
        language: language ?? '',
      }
    } finally {
      for (const fn of cleanups) fn()
    }
  }
}
