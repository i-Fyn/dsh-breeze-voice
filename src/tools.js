/**
 * 工具：breeze_voice —— 合成语音，返回发送方拿得到的引用。
 * @module dsh-breeze-voice/src/tools
 */
function textResult(value) {
  return [{ type: 'text', text: value }]
}

const DESCRIPTION = [
  'Synthesize speech from text with the BreezeBlue cloud TTS, saving an audio file on this machine.',
  'This tool sends nothing itself: it returns the local file path, plus mime and byte count.',
  'To deliver it, hand that path to whatever channel tool sends voice messages (in QQ it is the voice parameter of qq_draft, which reads the file itself; send it with qq_confirm afterwards).',
  'Use it only when something should actually be heard; ordinary replies stay text.',
].join(' ')

const ASR_DESCRIPTION = [
  'Transcribe a local audio file to text with the DeepSeek ASR tool.',
  'Accepts 16-bit PCM WAV or Ogg Opus; anything else is converted with ffmpeg first.',
  'Limits: 120 seconds and 8 MiB per request — cut the clip first if it is longer.',
  'Use it to understand a voice message the user sent you; it costs money by audio length.',
].join(' ')

export function registerBreezeTools(ctx, service, options = {}) {
  const logger = options.logger ?? console
  const registry = ctx.get?.('tools') ?? ctx.tools
  if (!registry || typeof registry.register !== 'function') {
    logger.warn?.('breeze-voice: 没有 tools 服务，跳过工具注册')
    return () => {}
  }

  const disposers = []
  const asr = options.asr

  if (asr) {
    try {
      disposers.push(registry.register({
        name: 'breeze_transcribe',
        description: ASR_DESCRIPTION,
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            file: { type: 'string', description: 'Absolute path (or ~/...) of the audio file on this machine.' },
          },
          required: ['file'],
        },
        output: { schema: { type: 'string' }, render: (_args, value) => textResult(value) },
        async execute(args) {
          const result = await asr.recognize({ file: args?.file })
          const lines = ['转写结果：', result.text === '' ? '（这段音频里没听出字）' : result.text]
          if (result.seconds > 0) lines.push('', `时长: ${result.seconds.toFixed(2)} 秒`)
          if (result.requestId) lines.push(`request_id: ${result.requestId}`)
          return lines.join('\n')
        },
      }))
    } catch (error) {
      logger.warn?.(`breeze-voice: 注册 breeze_transcribe 失败 ${String(error)}`)
    }
  }

  const dispose = registry.register({
    name: 'breeze_voice',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: { type: 'string', description: 'The line to speak. Keep it short — a sentence or two talks best.' },
        instructions: {
          type: 'string',
          description: 'Optional performance instructions in the same language as the text, e.g. tone and emotion. Overrides the configured default.',
        },
        voiceId: { type: 'string', description: 'Optional voice id (voc_...) overriding the configured voice.' },
      },
      required: ['text'],
    },
    output: { schema: { type: 'string' }, render: (_args, value) => textResult(value) },
    ...(Number.isFinite(service.config?.timeoutMs) ? { timeoutMs: service.config.timeoutMs + 60000 } : {}),
    async execute(args) {
      const result = await service.synthesize({
        text: args?.text,
        instructions: args?.instructions,
        voiceId: args?.voiceId,
      })
      const lines = [
        '语音已合成：',
        `path: ${result.file}`,
        `mime: ${result.mime}`,
        `bytes: ${result.bytes}`,
      ]
      if (result.words.length > 0) {
        lines.push(`字词: ${result.words.length} 条（词级时间戳）`, `timestamps: ${result.timestampsFile}`)
      }
      lines.push('', '要发出去：把这个 path 交给负责发送的渠道——QQ 里是 qq_draft 的 voice 参数，起草后再 qq_confirm(decision="send") 发出去。')
      return lines.join('\n')
    },
  })
  disposers.push(dispose)
  return () => { for (const fn of disposers) { try { fn?.() } catch {} } }
}
