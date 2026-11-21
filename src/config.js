/**
 * 配置：默认值、深合并、校验与落盘。
 *
 * 运行中的服务每次都从同一份配置对象读取，所以音色、语速这类改动立即生效，
 * 不需要重启插件。
 *
 * @module dsh-breeze-voice/src/config
 */
import fs from 'node:fs'
import path from 'node:path'
import { expandHome, resolveDataDir } from './paths.js'
import { readJson, writeJsonAtomic } from './store.js'

export const OUTPUT_FORMATS = ['mp3', 'wav', 'flac', 'opus', 'aac', 'pcm']

export function defaultConfig() {
  return {
    version: 1,
    enabled: true,
    /** BreezeBlue 开发者 key；留空时读环境变量 BREEZE_API_KEY。 */
    apiKey: '',
    /** 音色 ID，形如 voc_... */
    voiceId: '',
    modelId: 'breeze-tts-2',
    /** ISO 639-1 两字母代码，留空由服务端判断。 */
    languageCode: '',
    /** 默认演绎指令（与正文同语言）。 */
    instructions: '',
    outputFormat: 'mp3',
    speed: 1,
    volume: 1,
    guidanceScale: 1,
    speakerBoost: false,
    /** 音频落盘目录；留空 = <数据目录>/audio。 */
    outputDir: '',
    maxChars: 1000,
    timeoutMs: 20000,
    /** 词级时间戳：改走 with-timestamps 端点，音频旁边多一份 .timestamps.json。 */
    withTimestamps: false,
    /** 语音识别用的 DeepSeek key；留空时依次读环境变量与 ~/.dsh/.credentials.yaml。 */
    deepseekApiKey: '',
    /** 识别超时（毫秒）。 */
    asrTimeoutMs: 180000,
    /** 规则文本里 {{asrMaxSeconds}} 的值，同时也是文件时长上限（接口硬限 120 秒）。 */
    asrMaxSeconds: 120,
    /** 规则文本里 {{asrMaxMiB}} 的值（接口硬限 8 MiB）。 */
    asrMaxMiB: 8,
    /** 规则文本里 {{asrPrice}} 的值：每小时音频的现价，仅用于提示。 */
    asrPrice: '0.39',
  };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

export function mergeConfig(base, patch) {
  if (!isPlainObject(patch)) return base
  const out = Array.isArray(base) ? base.slice() : { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (isPlainObject(value) && isPlainObject(out[key])) out[key] = mergeConfig(out[key], value)
    else out[key] = value
  }
  return out
}

/** 把配置收敛成稳定形状；就地改，方便热读。 */
export function normalizeConfig(config, { dataDir = resolveDataDir() } = {}) {
  const next = config
  const str = (value) => String(value ?? '').trim()
  next.enabled = next.enabled !== false
  next.apiKey = str(next.apiKey)
  next.voiceId = str(next.voiceId)
  next.modelId = str(next.modelId)
  next.languageCode = str(next.languageCode).toLowerCase()
  next.instructions = str(next.instructions)
  next.outputFormat = OUTPUT_FORMATS.includes(next.outputFormat) ? next.outputFormat : 'mp3'
  next.speed = clampNumber(next.speed, 0.5, 2, 1)
  next.volume = clampNumber(next.volume, 0.01, 2, 1)
  next.guidanceScale = clampNumber(next.guidanceScale, 1, 10, 1)
  next.speakerBoost = next.speakerBoost === true
  next.outputDir = str(next.outputDir) === '' ? path.join(dataDir, 'audio') : path.resolve(expandHome(str(next.outputDir)))
  next.maxChars = Math.round(clampNumber(next.maxChars, 1, 2000, 1000))
  next.timeoutMs = Math.round(clampNumber(next.timeoutMs, 1000, 120000, 20000))
  next.withTimestamps = next.withTimestamps === true
  try {
    fs.mkdirSync(next.outputDir, { recursive: true })
  } catch {
    // 建不出来不阻塞加载，真正合成时还会再报
  }
  return next
}

/** 读写配置文件。 */
export class ConfigStore {
  constructor(options = {}) {
    this.dir = options.dataDir ?? resolveDataDir()
    this.file = path.join(this.dir, 'config.json')
    this.logger = options.logger ?? console
  }

  get exists() {
    return fs.existsSync(this.file)
  }

  load() {
    const config = mergeConfig(defaultConfig(), this.exists ? readJson(this.file, {}) : {})
    const normalized = normalizeConfig(config, { dataDir: this.dir })
    this.config = normalized
    if (!this.exists) this.save(normalized)
    return this.config
  }

  /** 就地更新：保持对象身份，服务那边读到的就是新值。 */
  update(patch) {
    const merged = mergeConfig(this.config ?? this.load(), patch)
    const normalized = normalizeConfig(merged, { dataDir: this.dir })
    this.config = normalized
    this.save(normalized)
    return normalized
  }

  save(config) {
    fs.mkdirSync(this.dir, { recursive: true })
    this.config = normalizeConfig(config, { dataDir: this.dir })
    writeJsonAtomic(this.file, this.config)
    return this.config
  }
}
