/**
 * 规则：写进系统提示的一段本插件使用规矩，可在设置面板里改。
 *
 * 存 <数据目录>/rules.md；没写就回默认文本。renderRules() 会把 {{minChars}}
 * 这类占位换成当前设置值，所以规则里可以引用配置而不写死。
 *
 * @module dsh-breeze-voice/src/rules
 */
import fs from 'node:fs'
import path from 'node:path'

export const RULES_MAX = 4000

export const RULES_DEFAULT = `### 语音（dsh-breeze-voice）
- 发语音用 breeze_voice：给文字和可选演绎指令，工具落一个本机文件，再把路径交给渠道（QQ 里是 qq_draft 的 voice）。
- 演绎指令写人话：「像平常跟朋友聊天那样说，语气放松自然，别刻意放慢，句末轻轻落下来」。别写「语速平稳稍慢」——那会被读成念稿。
- 一次只发一条语音；短句更适合说话，长段先拆。
- 听语音用 breeze_transcribe：给本机音频路径，拿回文字。单次 ≤{{asrMaxSeconds}} 秒、≤{{asrMaxMiB}} MiB，超了先截短。
- 识别按音频时长计费（每小时 {{asrPrice}} 元级），不要拿它批量转长音频。`

export class RulesStore {
  constructor({ dataDir, defaults = RULES_DEFAULT, logger } = {}) {
    this.file = path.join(dataDir ?? '.', 'rules.md')
    this.defaults = defaults
    this.logger = logger ?? console
  }

  read() {
    try {
      const text = fs.readFileSync(this.file, 'utf8')
      if (text.trim() === '') return { text: this.defaults, isDefault: true }
      return { text, isDefault: false }
    } catch {
      return { text: this.defaults, isDefault: true }
    }
  }

  save(text) {
    const value = typeof text === 'string' ? text : ''
    if (value.trim() === '') return this.reset()
    if ([...value].length > RULES_MAX) {
      const error = new Error(`规则太长（${[...value].length} 字，上限 ${RULES_MAX}）`)
      error.status = 400
      throw error
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true })
    fs.writeFileSync(this.file, value, 'utf8')
    return { text: value, isDefault: false }
  }

  reset() {
    try { fs.unlinkSync(this.file) } catch {}
    return { text: this.defaults, isDefault: true }
  }
}

/** 把 {{key}} 换成 vars[key]，没有的留空。 */
export function fillTemplate(text, vars = {}) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] === undefined || vars[key] === null ? '' : String(vars[key])))
}
