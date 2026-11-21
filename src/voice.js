/**
 * 语音服务：读配置、调 BreezeBlue、落盘。
 *
 * 只做一件事：把文字变成音频，交给负责发送的渠道。这里不起 HTTP 服务、也不发布：
 * 音频就在本机磁盘上，发送方（dsh-qq）自己读文件、按渠道需要转成 base64。
 *
 * @module dsh-breeze-voice/src/voice
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { mimeOf, synthesize } from './breeze.js'
import { appendHistory, loadHistory } from './history.js'

function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

export class VoiceService {
  #store
  #log
  #lastError = ''
  #lastAt = null
  #count = 0

  constructor({ configStore, logger }) {
    this.#store = configStore
    this.#log = logger ?? console
  }

  get config() { return this.#store.config }
  get outDir() { return this.config.outputDir }
  get lastError() { return this.#lastError }

  /** 密钥：环境变量 BREEZE_API_KEY 优先，其次配置里的明文。 */
  apiKey() {
    const fromEnv = String(process.env.BREEZE_API_KEY ?? '').trim()
    if (fromEnv !== '') return fromEnv
    return String(this.config.apiKey ?? '').trim()
  }

  get ready() {
    return this.apiKey() !== '' && String(this.config.voiceId ?? '') !== ''
  }

  status() {
    const config = this.config
    return {
      enabled: config.enabled !== false,
      ready: this.ready,
      apiKeySet: this.apiKey() !== '',
      voiceId: config.voiceId,
      outDir: this.outDir,
      lastError: this.#lastError,
      lastAt: this.#lastAt,
      count: this.#count,
      node: typeof process !== 'undefined' ? process.version : null,
    }
  }

  /**
   * 合成并落盘。
   * @returns {Promise<{file:string,name:string,mime:string,bytes:number,words:object[],timestampsFile:string}>}
   */
  async synthesize({ text, instructions, voiceId }) {
    const config = this.config
    const body = typeof text === 'string' ? text.trim() : ''
    if (body === '') throw new Error('text 不能为空')
    if (body.length > config.maxChars) throw new Error(`文本 ${body.length} 字，超过上限 ${config.maxChars}，请精简后再合成。`)
    const key = this.apiKey()
    if (key === '') throw new Error('没有 BreezeBlue API key：在 设置 → 语音 里填，或给部署环境加 BREEZE_API_KEY。')
    const voice = String(voiceId ?? '').trim() || config.voiceId
    if (voice === '') throw new Error('没有音色 ID：在 设置 → 语音 里填一个形如 voc_... 的值。')

    const startedAt = Date.now()
    const { bytes, mime, words } = await synthesize({
      apiKey: key,
      voiceId: voice,
      text: body,
      modelId: config.modelId,
      languageCode: config.languageCode,
      instructions: String(instructions ?? '').trim() || config.instructions,
      outputFormat: config.outputFormat,
      voiceSettings: {
        speed: config.speed,
        volume: config.volume,
        guidance_scale: config.guidanceScale,
        use_speaker_boost: config.speakerBoost,
      },
      timeoutMs: config.timeoutMs,
      withTimestamps: config.withTimestamps,
    })

    await mkdir(this.outDir, { recursive: true })
    const ext = path.extname(`x.${config.outputFormat}`).slice(1) || 'mp3'
    const name = `breeze-${stamp()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const file = path.join(this.outDir, name)
    await writeFile(file, bytes)

    // 时间戳与音频同名同目录，只多一个后缀，方便别处拿到音频就能顺手找到锚点。
    let timestampsFile = ''
    if (words.length > 0) {
      timestampsFile = `${file}.timestamps.json`
      await writeFile(timestampsFile, `${JSON.stringify({
        version: 1,
        file: name,
        voice,
        text: body,
        unit: 'second',
        words,
      }, null, 2)}\n`, 'utf8')
    }

    this.#lastAt = new Date().toISOString()
    this.#count += 1
    this.#lastError = ''
    this.#log?.info?.(`breeze-voice: 合成 ${name}（${bytes.length} 字节，音色 ${voice}）`)
    // 记录写不进去不算合成失败：面板少一行，比这一次白跑强。
    try {
      await appendHistory(this.#store.dir, {
        at: this.#lastAt,
        name,
        text: body,
        bytes: bytes.length,
        ms: Date.now() - startedAt,
        voiceId: voice,
        format: ext,
      })
    } catch (error) {
      this.#log?.warn?.(`breeze-voice: 写生成记录失败 ${String(error)}`)
    }
    return { file, name, mime: mime || mimeOf(config.outputFormat), bytes: bytes.length, words, timestampsFile }
  }

  /** 面板的「记录」页：磁盘上还在的音频 + 能对上的文本记录。 */
  async history(limit = 30) {
    return loadHistory({ dataDir: this.#store.dir, outDir: this.outDir, limit })
  }
}
