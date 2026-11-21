/**
 * dsh-breeze-voice：把 BreezeBlue 云端 TTS 接进 DeepSeek Harness。
 *
 * 一个职责：给所有 agent 提供 breeze_voice 工具，把文字合成本机音频文件。
 * 音频不发布、不挂 HTTP——发送方（如 dsh-qq）自己读文件按渠道需要转码。
 *
 * 设置：${DSH_HOME}/dsh-breeze-voice/config.json，GUI 里在 设置 → 语音 可视化编辑
 * （面板走本插件自己的 /api/dsh-breeze-voice 接口，见 src/api.js）。
 *
 * @module dsh-breeze-voice
 */
import path from 'node:path'
import { mountBreezeApi } from './src/api.js'
import { ConfigStore } from './src/config.js'
import { expandHome, resolveDataDir } from './src/paths.js'
import { registerBreezeTools } from './src/tools.js'
import { VoiceService } from './src/voice.js'
import { AsrService } from './src/asr.js'
import { RulesStore, fillTemplate, RULES_DEFAULT } from './src/rules.js'

export const name = 'dsh-breeze-voice'
export const inject = ['tools', 'systemPrompt']

/**
 * 插件入口。
 * @param ctx Cordis 上下文
 * @param config bundle 行里的配置（可临时覆盖 enabled / apiKey / voiceId / port）
 */
export function apply(ctx, config = {}) {
  const logger = ctx.logger ?? console
  const dataDir = typeof config.dataDir === 'string' && config.dataDir !== ''
    ? path.resolve(expandHome(config.dataDir))
    : resolveDataDir()

  const configStore = new ConfigStore({ dataDir, logger })
  try {
    configStore.load()
  } catch (error) {
    logger.warn?.(`breeze-voice: 读取配置失败，使用默认值 ${String(error)}`)
    configStore.config = configStore.save({})
  }

  // bundle 行上的显式配置优先于文件（方便临时关掉发布或换端口）
  const overrides = {}
  if (typeof config.enabled === 'boolean') overrides.enabled = config.enabled
  if (typeof config.apiKey === 'string' && config.apiKey !== '') overrides.apiKey = config.apiKey
  if (typeof config.voiceId === 'string' && config.voiceId !== '') overrides.voiceId = config.voiceId
  if (typeof config.port === 'number') overrides.port = config.port
  if (Object.keys(overrides).length > 0) {
    try {
      configStore.update(overrides)
    } catch (error) {
      logger.warn?.(`breeze-voice: 应用 bundle 配置失败 ${String(error)}`)
    }
  }

  const service = new VoiceService({ configStore, logger })
  const asr = new AsrService({ configStore, logger })

  // 规则：写进系统提示的一段本插件用法，可在 设置 → 语音 里改。
  const rulesStore = new RulesStore({ dataDir, defaults: RULES_DEFAULT, logger })
  const renderRules = () => fillTemplate(rulesStore.read().text, {
    asrMaxSeconds: configStore.config.asrMaxSeconds,
    asrMaxMiB: configStore.config.asrMaxMiB,
    asrPrice: configStore.config.asrPrice,
    maxChars: configStore.config.maxChars,
    voiceId: configStore.config.voiceId,
  })
  try {
    const prompt = ctx.get?.('systemPrompt')
    if (prompt && typeof prompt.context === 'function') {
      const dispose = prompt.context({ name: 'breeze-voice/rules', order: 73, interpolate: false, text: () => renderRules() })
      if (typeof dispose === 'function') ctx.effect?.(() => dispose, 'dsh-breeze-voice: rules context')
    }
  } catch (error) {
    logger.warn?.(`breeze-voice: 注册规则段失败 ${String(error)}`)
  }
  try {
    ctx.provide?.('breezeVoice', service)
  } catch (error) {
    logger.debug?.(`breeze-voice: 注册 breezeVoice 服务失败 ${String(error)}`)
  }

  try {
    mountBreezeApi(ctx, { service, configStore, logger, asr, rulesStore })
  } catch (error) {
    logger.warn?.(`breeze-voice: 挂载设置接口失败 ${String(error?.stack ?? error)}`)
  }

  try {
    ctx.effect(() => registerBreezeTools(ctx, service, { logger, asr }))
  } catch (error) {
    logger.warn?.(`breeze-voice: 注册工具失败 ${String(error?.stack ?? error)}`)
  }

  logger.info?.(`breeze-voice: 已装载（数据目录 ${dataDir}，音色 ${configStore.config.voiceId || '未设置'}）`)
  return service
}

export default apply
