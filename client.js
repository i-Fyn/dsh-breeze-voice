/**
 * Breeze 语音 —— 设置窗口里的分区。
 *
 * 数据全部走本插件自己的同源接口 /api/dsh-breeze-voice（见 src/api.js），
 * 配置只有一个真相源：DSH_HOME/dsh-breeze-voice/config.json。
 *
 * 视觉与宿主设置页一致：颜色全部取自 --dsw-alias-* 令牌，尺寸照抄宿主控件规格，
 * 深浅色主题自动适配。手写 ModuleLoader bundle，除 react 之外没有依赖。
 */
window.__ModuleLoader__.load({
  id: 'dsh-breeze-voice',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { Component, createElement: h, useCallback, useEffect, useRef, useState } = React

    const NS = 'settings.breeze-voice'
    const API = '/api/dsh-breeze-voice'
    const inject = ['slots', 'locale']

    // ── copy ──────────────────────────────────────────────────────────────────
    const DICT = { zh: {
      nav: '语音',
      title: '语音',
      subtitle: '把文字合成为语音，交给 QQ 之类的渠道发出去。',
      loading: '正在读取配置…',
      loadFailed: '读不到插件后端',
      loadFailedHint: '如果插件刚装好，重启一次 DeepSeek Harness 让它加载新的设置接口。',
      retry: '重试',
      'state.ready': '就绪',
      'state.setup': '待配置',
      'state.off': '已关闭',
      'state.count': '已合成',
      'state.last': '上次',
      'state.outDir': '输出目录',
      'state.never': '还没有',
      'stat.voice': '音色',
      'stat.count': '合成次数',
      'stat.last': '上次合成',
      'card.conn': '连接',
      'card.conn.hint': 'BreezeBlue 的密钥与音色。改完保存，上一条消息之后的下一次合成就会用新值。',
      enabled: '启用语音',
      'enabled.hint': '关掉后 breeze_voice 会直接报错，不占额度。',
      apiKey: 'API key',
      'apiKey.set': '已设置，留空表示不修改',
      'apiKey.unset': '还没设置',
      'apiKey.clear': '清除',
      'apiKey.cleared': '保存后清除',
      voiceId: '音色 ID',
      'voiceId.hint': '形如 voc_...',
      'voiceId.placeholder': 'voc_...',
      modelId: '模型',
      language: '语言',
      'language.hint': '留空由服务端判断',
      format: '输出格式',
      'card.perf': '演绎',
      'card.perf.hint': '这些是整段合成都生效的默认值；单次调用可以在工具参数里覆盖演绎指令。',
      instructions: '演绎指令',
      'instructions.hint': '与正文同语言，描述语气、情绪、节奏',
      'instructions.placeholder': '例如：语气温柔，语速偏慢，句尾轻轻上扬。',
      speed: '语速',
      volume: '音量',
      guidance: '演绎强度',
      speakerBoost: '提升清晰度',
      'speakerBoost.hint': '人声更突出，适合嘈杂环境回放。',
      timestamps: '词级时间戳',
      'timestamps.hint': '改走 with-timestamps 端点，音频旁边多一份 .timestamps.json。',
      'card.out': '输出',
      'card.out.hint': '音频落在本机；发送方自己读文件，不经过任何服务。',
      outputDir: '目录',
      'outputDir.hint': '留空 = 数据目录下的 audio',
      maxChars: '单次字符上限',
      timeout: '超时（毫秒）',
      'card.test': '试听',
      'card.test.hint': '合成一句听一下；结果只落在本机，不会发到任何地方。',
      'test.placeholder': '输入一句要念的话',
      'test.run': '合成',
      'test.running': '正在合成…',
      'test.result': '已合成 {n} 字节 · {m} 个字词',
      'test.failed': '合成失败',
      'test.empty': '先输入一句话',
      'test.play': '在浏览器里试听',
      'tab.set': '设置',
      'tab.hist': '记录',
      'card.hist': '生成记录',
      'card.hist.hint': '每合成一次都会记一行；这里可以直接试听，删掉会把磁盘上的音频一起删掉。早先版本生成的音频没有文本，只按文件时间列出来。',
      'hist.refresh': '刷新',
      'hist.refreshing': '读取中…',
      'hist.total': '共 {n} 条',
      'hist.empty': '还没有生成过语音。在上面的「试听」里合成一句，这里就会出现一条。',
      'hist.failed': '读不到记录',
      'hist.noText': '（早先版本生成，没有留下文本）',
      'hist.delete': '删除',
      'hist.deleting': '删除中…',
      'hist.sure': '确认删除',
      'hist.deleted': '已删除',
      'hist.play': '试听',
      'hist.stop': '停止',
      save: '保存',
      saving: '保存中…',
      discard: '放弃',
      unsaved: '有未保存的改动',
      saved: '已保存',
      saveFailed: '保存失败',
      configPath: '配置文件',
      'card.asr': '语音识别',
      'card.asr.hint': '收到语音时用它转成文字。密钥只写进本机配置文件，不回显；改完下一轮对话生效。',
      'asr.status': '识别状态',
      'asr.status.hint': '密钥和识别服务是否就绪。',
      'asr.keyBadge': '识别密钥',
      'asr.readyBadge': '识别服务',
      'asr.set': '已配置',
      'asr.unset': '未配置',
      'asr.key': 'DeepSeek API key',
      'asr.key.hint': '识别用的 key，与合成用的分开保存',
      'asr.key.placeholder': 'sk-...',
      'asr.save': '保存',
      'asr.clear': '清除',
      'asr.saved': '已保存 · 下一轮对话生效',
      'asr.cleared': '已清除',
      'asr.empty': '先填入 key',
      'asr.saveFailed': '保存失败',
      'asr.clearFailed': '清除失败',
      'asr.max': '单次识别上限',
      'asr.max.hint': '1 – 120 秒，改完自动保存',
      'asr.unit': '秒',
      'asr.badMax': '识别上限要是 1 到 120 的整数',
      'asr.price': '识别按音频时长计费，约 {n} 元/小时',
      'card.rules': '规则',
      'card.rules.hint': '这段文字会写进系统提示，说明这个插件怎么用。改完下一轮生效。',
      'rules.default': '默认',
      'rules.save': '保存',
      'rules.reset': '恢复默认',
      'rules.saved': '已保存 · 下一轮生效',
      'rules.restored': '已恢复默认 · 下一轮生效',
      'rules.confirm': '恢复默认规则？现在写的内容会被丢掉。',
      'rules.failed': '读不到插件后端',
      'rules.saveFailed': '保存失败',
      'rules.resetFailed': '恢复失败',
      'rules.retry': '重试',
      'rules.count': '{n} / {m}'
    }, en: {
      nav: 'Voice',
      title: 'Voice',
      subtitle: 'Turn text into speech and hand it to a channel such as QQ.',
      loading: 'Reading configuration…',
      loadFailed: 'Cannot reach the plugin backend',
      loadFailedHint: 'If the plugin was just installed, restart DeepSeek Harness so it can load the new settings API.',
      retry: 'Retry',
      'state.ready': 'Ready',
      'state.setup': 'Needs setup',
      'state.off': 'Off',
      'state.count': 'Syntheses',
      'state.last': 'Last',
      'state.outDir': 'Output',
      'state.never': 'Never',
      'stat.voice': 'Voice',
      'stat.count': 'Syntheses',
      'stat.last': 'Last synthesis',
      'card.conn': 'Connection',
      'card.conn.hint': 'BreezeBlue key and voice. Saved changes apply to the next synthesis.',
      enabled: 'Enable voice',
      'enabled.hint': 'When off, breeze_voice fails fast and spends no quota.',
      apiKey: 'API key',
      'apiKey.set': 'Set — leave blank to keep it',
      'apiKey.unset': 'Not set',
      'apiKey.clear': 'Clear',
      'apiKey.cleared': 'Will clear on save',
      voiceId: 'Voice ID',
      'voiceId.hint': 'Looks like voc_...',
      'voiceId.placeholder': 'voc_...',
      modelId: 'Model',
      language: 'Language',
      'language.hint': 'Blank lets the service decide',
      format: 'Format',
      'card.perf': 'Performance',
      'card.perf.hint': 'Defaults applied to every synthesis; a single call can override the instructions.',
      instructions: 'Instructions',
      'instructions.hint': 'Same language as the text: tone, emotion, pacing',
      'instructions.placeholder': 'e.g. warm and unhurried, light lift at the end of each sentence.',
      speed: 'Speed',
      volume: 'Volume',
      guidance: 'Guidance',
      speakerBoost: 'Speaker boost',
      'speakerBoost.hint': 'More present voice, useful in noisy playback.',
      timestamps: 'Word timestamps',
      'timestamps.hint': 'Uses the with-timestamps endpoint and writes a .timestamps.json next to the audio.',
      'card.out': 'Output',
      'card.out.hint': 'Audio stays on this machine; senders read the file themselves.',
      outputDir: 'Directory',
      'outputDir.hint': 'Blank = audio under the data directory',
      maxChars: 'Max characters',
      timeout: 'Timeout (ms)',
      'card.test': 'Try it',
      'card.test.hint': 'Synthesize one line; it only lands on this machine.',
      'test.placeholder': 'Type a line to speak',
      'test.run': 'Synthesize',
      'test.running': 'Synthesizing…',
      'test.result': 'Synthesized {n} bytes · {m} words',
      'test.failed': 'Synthesis failed',
      'test.empty': 'Type a line first',
      'test.play': 'Play in the browser',
      'tab.set': 'Settings',
      'tab.hist': 'History',
      'card.hist': 'History',
      'card.hist.hint': 'One line per synthesis. Play it here; deleting removes the audio file too. Files from earlier versions have no text and are listed by file time.',
      'hist.refresh': 'Refresh',
      'hist.refreshing': 'Reading…',
      'hist.total': '{n} in total',
      'hist.empty': 'Nothing synthesized yet. Try one line under "Try it" and it shows up here.',
      'hist.failed': 'Cannot read history',
      'hist.noText': '(Generated by an earlier version — no text recorded)',
      'hist.delete': 'Delete',
      'hist.deleting': 'Deleting…',
      'hist.sure': 'Confirm',
      'hist.deleted': 'Deleted',
      'hist.play': 'Play',
      'hist.stop': 'Stop',
      save: 'Save',
      saving: 'Saving…',
      discard: 'Discard',
      unsaved: 'Unsaved changes',
      saved: 'Saved',
      saveFailed: 'Save failed',
      configPath: 'Config file',
      'card.asr': 'Speech recognition',
      'card.asr.hint': 'Turns voice into text. The key lives in the local config file and is never echoed back; changes apply to the next turn.',
      'asr.status': 'Recognition status',
      'asr.status.hint': 'Whether the key and the recognition service are ready.',
      'asr.keyBadge': 'Key',
      'asr.readyBadge': 'Service',
      'asr.set': 'Configured',
      'asr.unset': 'Not configured',
      'asr.key': 'DeepSeek API key',
      'asr.key.hint': 'Used for recognition, stored separately from the synthesis key',
      'asr.key.placeholder': 'sk-...',
      'asr.save': 'Save',
      'asr.clear': 'Clear',
      'asr.saved': 'Saved · applies to the next turn',
      'asr.cleared': 'Cleared',
      'asr.empty': 'Enter a key first',
      'asr.saveFailed': 'Save failed',
      'asr.clearFailed': 'Clear failed',
      'asr.max': 'Max duration per clip',
      'asr.max.hint': '1 – 120 seconds, saves when you leave the field',
      'asr.unit': 's',
      'asr.badMax': 'The limit must be a whole number between 1 and 120',
      'asr.price': 'Billed by audio duration, about ¥{n} per hour',
      'card.rules': 'Rules',
      'card.rules.hint': 'This text goes into the system prompt and explains how to use the plugin. Changes apply to the next turn.',
      'rules.default': 'Default',
      'rules.save': 'Save',
      'rules.reset': 'Restore default',
      'rules.saved': 'Saved · applies to the next turn',
      'rules.restored': 'Default restored · applies to the next turn',
      'rules.confirm': 'Restore the default rules? What you have written will be lost.',
      'rules.failed': 'Cannot reach the plugin backend',
      'rules.saveFailed': 'Save failed',
      'rules.resetFailed': 'Restore failed',
      'rules.retry': 'Retry',
      'rules.count': '{n} / {m}'
    } }

    const MONO = 'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace'

    const CSS = [
      '.bv_root{',
      '--bv-fg:var(--dsw-alias-label-primary,#0f1115);',
      '--bv-muted:var(--dsw-alias-label-secondary,#61666b);',
      '--bv-faint:var(--dsw-alias-label-tertiary,#81858c);',
      '--bv-card:var(--dsw-alias-bg-layer-1,#fff);',
      '--bv-bar:var(--dsw-alias-bg-layer-2,#f5f6f8);',
      '--bv-field:var(--dsw-alias-bg-layer-1,#fff);',
      '--bv-dim:var(--dsw-alias-label-dimmed,#e1e5ee);',
      '--bv-line:var(--dsw-alias-border-l2,rgba(0,0,0,.10));',
      '--bv-line-soft:var(--dsw-alias-border-l1,rgba(0,0,0,.05));',
      '--bv-line-strong:var(--dsw-alias-border-l3,rgba(0,0,0,.14));',
      '--bv-hover:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.06));',
      '--bv-brand:var(--dsw-alias-brand-primary,#0f1115);',
      '--bv-brand-fg:var(--dsw-alias-label-primary-foreground,#fff);',
      '--bv-brand-soft:color-mix(in srgb,var(--bv-brand) 10%,transparent);',
      '--bv-ok:var(--dsw-alias-state-success-primary,#22c55e);',
      '--bv-warn:var(--dsw-alias-state-warn-primary,#f59e0b);',
      '--bv-err:var(--dsw-alias-state-error-primary,#ec1313);',
      'box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:2px;max-width:760px;',
      'font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);',
      'font-size:13px;line-height:1.55;color:var(--bv-fg);}',
      '.bv_root *{box-sizing:border-box;}',
      '.bv_head{display:flex;align-items:center;gap:12px;}',
      '.bv_logo{width:34px;height:34px;border-radius:10px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;',
      'background:var(--bv-brand-soft);color:var(--bv-brand);}',
      '.bv_headtext{flex:1 1 auto;min-width:0;}',
      '.bv_h1{margin:0;font-size:16px;font-weight:650;letter-spacing:.2px;line-height:1.35;}',
      '.bv_sub{margin:2px 0 0;font-size:12.5px;color:var(--bv-muted);line-height:1.5;}',
      '.bv_pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;padding:3px 9px;border-radius:999px;',
      'border:1px solid var(--bv-line-soft);background:var(--bv-bar);color:var(--bv-muted);white-space:nowrap;}',
      '.bv_pill[data-state=on]{color:var(--bv-ok);border-color:color-mix(in srgb,var(--bv-ok) 30%,transparent);',
      'background:color-mix(in srgb,var(--bv-ok) 9%,transparent);}',
      '.bv_pill[data-state=warn]{color:var(--bv-warn);border-color:color-mix(in srgb,var(--bv-warn) 30%,transparent);',
      'background:color-mix(in srgb,var(--bv-warn) 9%,transparent);}',
      '.bv_dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:0 0 auto;}',
      '.bv_stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0;border:1px solid var(--bv-line);',
      'border-radius:12px;background:var(--bv-card);overflow:hidden;}',
      '.bv_stat{display:flex;flex-direction:column;gap:3px;padding:12px 14px;min-width:0;border-left:1px solid var(--bv-line-soft);}',
      '.bv_stat:first-child{border-left:0;}',
      '.bv_statk{font-size:11px;color:var(--bv-faint);white-space:nowrap;}',
      '.bv_statv{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.bv_stat[data-tone=err] .bv_statv{color:var(--bv-err);}',
      '.bv_panel{border:1px solid var(--bv-line);border-radius:12px;background:var(--bv-card);padding:0 16px 12px;',
      'display:flex;flex-direction:column;min-width:0;}',
      '.bv_paneltitle{margin:0;padding:12px 0 0;font-size:12.5px;font-weight:600;}',
      '.bv_panelnote{margin:0;padding:4px 0 0;font-size:11.5px;color:var(--bv-faint);line-height:1.6;}',
      '.bv_row{display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--bv-line-soft);}',
      '.bv_row:first-child{border-top:0;}',
      '.bv_rowtext{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px;}',
      '.bv_rowtitle{font-size:12.5px;font-weight:600;}',
      '.bv_rowhint{font-size:11.5px;color:var(--bv-muted);line-height:1.55;}',
      '.bv_fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(224px,1fr));gap:0 16px;border-top:1px solid var(--bv-line-soft);}',
      '.bv_field{display:flex;flex-direction:column;gap:5px;padding:12px 0;min-width:0;}',
      '.bv_label{display:flex;align-items:baseline;gap:8px;font-size:12px;font-weight:600;}',
      '.bv_labelhint{margin-left:auto;font-weight:400;font-size:11px;color:var(--bv-faint);text-align:right;}',
      '.bv_input{width:100%;height:34px;padding:0 11px;border:1px solid var(--bv-line-strong);border-radius:8px;',
      'background:var(--bv-field);font:inherit;font-size:12.5px;color:var(--bv-fg);outline:none;',
      'transition:border-color .15s,box-shadow .15s;}',
      '.bv_input:hover{border-color:var(--bv-line);}',
      '.bv_input:focus{border-color:var(--bv-brand);box-shadow:0 0 0 3px var(--bv-brand-soft);}',
      '.bv_input::placeholder{color:var(--bv-faint);}',
      '.bv_input[data-mono=true]{font-family:' + MONO + ';font-size:12px;}',
      '.bv_input[data-num=true]{font-variant-numeric:tabular-nums;}',
      '.bv_select{width:100%;height:34px;padding:0 9px;border:1px solid var(--bv-line-strong);border-radius:8px;',
      'background:var(--bv-field);font:inherit;font-size:12.5px;color:var(--bv-fg);outline:none;cursor:pointer;}',
      '.bv_select:hover{border-color:var(--bv-line);}',
      '.bv_select:focus{border-color:var(--bv-brand);box-shadow:0 0 0 3px var(--bv-brand-soft);}',
      '.bv_area{width:100%;min-height:76px;padding:8px 10px;border:1px solid var(--bv-line-strong);border-radius:8px;',
      'background:var(--bv-field);color:var(--bv-fg);outline:none;resize:vertical;font:inherit;font-size:12.5px;',
      'line-height:1.65;transition:border-color .15s,box-shadow .15s;}',
      '.bv_area:hover{border-color:var(--bv-line);}',
      '.bv_area:focus{border-color:var(--bv-brand);box-shadow:0 0 0 3px var(--bv-brand-soft);}',
      '.bv_area::placeholder{color:var(--bv-faint);}',
      '.bv_switch{position:relative;width:36px;height:20px;flex:0 0 auto;border:0;border-radius:999px;padding:0;cursor:pointer;',
      'background:var(--bv-dim);transition:background-color .18s;}',
      '.bv_switch i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;',
      'box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .18s;}',
      '.bv_switch[data-on=true]{background:var(--bv-brand);}',
      '.bv_switch[data-on=true] i{transform:translateX(16px);}',
      '.bv_switch:disabled{opacity:.5;cursor:default;}',
      '.bv_btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 13px;',
      'border:1px solid var(--bv-line-strong);border-radius:8px;background:var(--bv-card);color:var(--bv-fg);',
      'font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap;transition:background-color .15s,border-color .15s;}',
      '.bv_btn:hover{background:var(--bv-hover);}',
      '.bv_btn[data-primary=true]{background:var(--bv-brand);border-color:var(--bv-brand);color:var(--bv-brand-fg);}',
      '.bv_btn[data-primary=true]:hover{opacity:.9;background:var(--bv-brand);}',
      '.bv_btn[data-quiet=true]{border-color:transparent;background:transparent;color:var(--bv-muted);}',
      '.bv_btn[data-quiet=true]:hover{background:var(--bv-hover);color:var(--bv-fg);}',
      '.bv_btn:disabled{opacity:.5;cursor:default;}',
      '.bv_inline{display:flex;gap:8px;align-items:center;}',
      '.bv_inline>.bv_input{flex:1 1 auto;}',
      '.bv_tag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:11px;',
      'border:1px solid var(--bv-line-soft);background:var(--bv-bar);color:var(--bv-muted);white-space:nowrap;}',
      '.bv_testrow{display:flex;gap:8px;padding:12px 0 0;align-items:center;}',
      '.bv_testrow>.bv_input{flex:1 1 auto;}',
      '.bv_result{margin:10px 0 0;padding:9px 11px;border-radius:8px;background:var(--bv-bar);border:1px solid var(--bv-line-soft);',
      'font-size:11.5px;color:var(--bv-muted);line-height:1.65;word-break:break-all;}',
      '.bv_result code{font-family:' + MONO + ';font-size:11px;color:var(--bv-fg);}',
      '.bv_result[data-kind=err]{color:var(--bv-err);border-color:color-mix(in srgb,var(--bv-err) 26%,transparent);',
      'background:color-mix(in srgb,var(--bv-err) 7%,transparent);}',
      '.bv_audio{display:block;width:100%;margin:10px 0 0;}',
      '.bv_savebar{position:sticky;bottom:0;z-index:2;display:flex;align-items:center;gap:10px;padding:10px 12px;',
      'border:1px solid var(--bv-line);border-radius:12px;background:color-mix(in srgb,var(--bv-card) 88%,transparent);',
      'backdrop-filter:saturate(1.4) blur(12px);box-shadow:0 10px 26px -16px rgba(0,0,0,.4);}',
      '.bv_noteline{margin:0;font-size:11.5px;color:var(--bv-muted);}',
      '.bv_noteline[data-kind=ok]{color:var(--bv-ok);}',
      '.bv_noteline[data-kind=err]{color:var(--bv-err);}',
      '.bv_notice{flex:1 1 auto;font-size:11.5px;color:var(--bv-muted);}',
      '.bv_notice[data-kind=err]{color:var(--bv-err);}',
      '.bv_notice[data-kind=ok]{color:var(--bv-ok);}',
      '.bv_kbd{font-family:' + MONO + ';font-size:10.5px;color:var(--bv-faint);border:1px solid var(--bv-line-soft);',
      'border-radius:5px;padding:1px 5px;background:var(--bv-bar);}',
      '.bv_foot{margin:0;font-size:11px;color:var(--bv-faint);word-break:break-all;}',
      '.bv_empty{margin:0;padding:16px 0;font-size:12px;color:var(--bv-faint);}',
      '.bv_error{margin:0;padding:14px 0;font-size:12.5px;color:var(--bv-err);}',
      '.bv_tabs{display:flex;gap:2px;padding:3px;border:1px solid var(--bv-line);border-radius:10px;background:var(--bv-bar);width:max-content;}',
      '.bv_tab{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 12px;border:0;border-radius:7px;',
      'background:transparent;color:var(--bv-muted);font:inherit;font-size:12px;font-weight:600;cursor:pointer;}',
      '.bv_tab:hover{color:var(--bv-fg);}',
      '.bv_tab[data-on=true]{background:var(--bv-card);color:var(--bv-fg);box-shadow:0 1px 2px rgba(0,0,0,.10);}',
      '.bv_tabn{font-size:10.5px;font-weight:600;padding:0 5px;height:16px;line-height:16px;border-radius:999px;',
      'background:var(--bv-brand-soft);color:var(--bv-muted);font-variant-numeric:tabular-nums;}',
      '.bv_tab[data-on=true] .bv_tabn{color:var(--bv-fg);}',
      '.bv_histbar{display:flex;align-items:center;gap:8px;padding:12px 0 2px;}',
      '.bv_histbar .bv_grow{flex:1 1 auto;}',
      '.bv_histmeta{font-size:11px;color:var(--bv-faint);font-variant-numeric:tabular-nums;}',
      '.bv_item{display:flex;align-items:flex-start;gap:11px;padding:11px 0;border-top:.5px solid var(--bv-line-soft);}',
      '.bv_item:first-of-type{border-top:0;}',
      '.bv_rowact{display:flex;align-items:center;gap:2px;flex:0 0 auto;}',
      '.bv_textbtn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 8px;border:0;',
      'border-radius:7px;background:transparent;color:var(--bv-muted);cursor:pointer;font:inherit;font-size:12px;',
      'transition:background .15s,color .15s;white-space:nowrap;}',
      '.bv_textbtn:hover{background:var(--bv-hover);color:var(--bv-fg);}',
      '.bv_textbtn[data-on=true]{color:var(--bv-fg);}',
      '.bv_textbtn:disabled{opacity:.45;cursor:default;}',
      '.bv_textbtn[data-danger=true]{color:var(--bv-err);}',
      '.bv_textbtn[data-danger=true]:hover{background:color-mix(in srgb,var(--bv-err) 9%,transparent);color:var(--bv-err);}',
      '.bv_itembody{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}',
      '.bv_itemtext{margin:0;font-size:12.5px;line-height:1.55;color:var(--bv-fg);word-break:break-word;}',
      '.bv_itemtext[data-empty=true]{color:var(--bv-faint);}',
      '.bv_itemmeta{font-size:11px;color:var(--bv-faint);font-variant-numeric:tabular-nums;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.bv_hidden{display:none;}',
      '.bv_panelhead{display:flex;align-items:center;gap:8px;}',
      '.bv_badges{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}',
      '.bv_unit{font-size:11.5px;color:var(--bv-faint);flex:0 0 auto;}',
      '.bv_rules{min-height:220px;width:100%;font-family:' + MONO + ';font-size:12px;line-height:1.7;}',
      '.bv_rulebar{display:flex;align-items:center;gap:8px;padding:10px 0 2px;}',
      '.bv_rulecount{margin-left:auto;font-size:11px;color:var(--bv-faint);font-variant-numeric:tabular-nums;}',
      '.bv_rulecount[data-over=true]{color:var(--bv-err);}',
      '@media (prefers-reduced-motion:reduce){.bv_switch,.bv_switch i,.bv_btn,.bv_input,.bv_area{transition:none;}}',
    ].join('')

    // ── helpers ───────────────────────────────────────────────────────────────
    function fill(template, value) {
      return String(template).replace('{n}', String(value))
    }

    function fill2(template, first, second) {
      return String(template).replace('{n}', String(first)).replace('{m}', String(second))
    }

    function ago(value, t) {
      if (!value) return t('state.never')
      const at = Date.parse(value)
      if (!Number.isFinite(at)) return t('state.never')
      const minutes = Math.round((Date.now() - at) / 60000)
      if (minutes < 1) return t('state.never') === '' ? '—' : '刚刚'
      if (minutes < 60) return minutes + ' 分钟前'
      const hours = Math.round(minutes / 60)
      if (hours < 24) return hours + ' 小时前'
      return Math.round(hours / 24) + ' 天前'
    }

    function num(value) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    function clock(value) {
      const at = Date.parse(value)
      if (!Number.isFinite(at)) return '—'
      const date = new Date(at)
      const pad = n => String(n).padStart(2, '0')
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
        + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
    }

    /** 合成耗时：毫秒 → 秒；没有记录的老音频显示 —。 */
    function secs(value) {
      const ms = Number(value)
      if (!Number.isFinite(ms) || ms <= 0) return '—'
      return (ms / 1000).toFixed(1) + 's'
    }

    function sizeOf(value) {
      const bytes = Number(value)
      if (!Number.isFinite(bytes) || bytes <= 0) return '—'
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return (bytes / 1048576).toFixed(2) + ' MB'
    }

    // ── primitives ────────────────────────────────────────────────────────────
    function Switch(props) {
      return h('button', {
        type: 'button',
        className: 'bv_switch',
        role: 'switch',
        'aria-checked': props.checked === true ? 'true' : 'false',
        'aria-label': props.label,
        'data-on': props.checked === true ? 'true' : 'false',
        disabled: props.disabled === true,
        onClick: () => props.onChange?.(props.checked !== true),
      }, h('i'))
    }

    function Row(props) {
      return h('div', { className: 'bv_row' },
        h('div', { className: 'bv_rowtext' },
          h('span', { className: 'bv_rowtitle' }, props.title),
          props.hint ? h('span', { className: 'bv_rowhint' }, props.hint) : null),
        props.children)
    }

    function Field(props) {
      return h('label', { className: 'bv_field' },
        h('span', { className: 'bv_label' },
          props.label,
          props.hint ? h('span', { className: 'bv_labelhint' }, props.hint) : null),
        props.children)
    }

    function Panel(props) {
      return h('section', { className: 'bv_panel' },
        props.title ? h('h2', { className: 'bv_paneltitle' }, props.title) : null,
        props.note ? h('p', { className: 'bv_panelnote' }, props.note) : null,
        props.children)
    }

    function Stat(props) {
      return h('div', { className: 'bv_stat', 'data-tone': props.tone ?? 'plain' },
        h('span', { className: 'bv_statk' }, props.k),
        h('span', { className: 'bv_statv' }, props.v))
    }

    const ICONS = {
      voice: ['M12 4.5a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0v-4a3 3 0 0 1 3-3z', 'M6.5 11.5a5.5 5.5 0 0 0 11 0', 'M12 17v3', 'M9 20h6'],
      trash: ['M3.6 6.4h16.8', 'M18.4 6.4v13a1.8 1.8 0 0 1-1.8 1.8H7.4a1.8 1.8 0 0 1-1.8-1.8v-13', 'M9.2 6.4V4.6a1.4 1.4 0 0 1 1.4-1.4h2.8a1.4 1.4 0 0 1 1.4 1.4v1.8', 'M10.3 10.6v6.2', 'M13.7 10.6v6.2'],
    }

    /** 试听按钮：自己带一个隐藏的 audio，点一下就播/停，不摆原生控件那条灰底长条。 */
    class PlayButton extends Component {
      constructor(props) {
        super(props)
        this.state = { playing: false }
        this.audio = null
        this.ref = node => {
          if (node === this.audio) return
          this.audio = node
          if (!node) return
          node.addEventListener('ended', () => this.setState({ playing: false }))
          node.addEventListener('pause', () => this.setState({ playing: false }))
          node.addEventListener('play', () => this.setState({ playing: true }))
        }
        this.toggle = () => {
          const node = this.audio
          if (!node) return
          if (node.paused) {
            const played = node.play()
            if (played && typeof played.catch === 'function') played.catch(() => this.setState({ playing: false }))
            this.setState({ playing: true })
          } else {
            node.pause()
          }
        }
      }

      render() {
        const on = this.state.playing
        const label = on ? this.props.stopLabel : this.props.label
        return h('div', { className: 'bv_playwrap' },
          h('button', {
            type: 'button',
            className: 'bv_textbtn',
            'data-on': on ? 'true' : 'false',
            title: label,
            'aria-label': label,
            onClick: this.toggle,
          }, h('span', null, label)),
          h('audio', { ref: this.ref, className: 'bv_hidden', src: this.props.src, preload: 'none' }))
      }
    }

    function Icon(props) {
      return h('svg', {
        viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor',
        'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
      }, (ICONS[props.name] ?? []).map(d => h('path', { key: d, d })))
    }

    class Boundary extends Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error) {
        try { console.warn('[dsh-breeze-voice] 设置页渲染失败：', error) } catch { /* console unavailable */ }
      }

      render() {
        if (this.state.error !== null) {
          return h('div', { className: 'bv_root' },
            h('p', { className: 'bv_error' }, '语音设置页渲染失败：' + String(this.state.error?.message ?? this.state.error)))
        }
        return this.props.children
      }
    }

    // ── the section ───────────────────────────────────────────────────────────
    function VoiceSection(props) {
      const t = props.t ?? (key => key)
      const [snap, setSnap] = useState(null)
      const [error, setError] = useState(null)
      const [loading, setLoading] = useState(true)
      const [draft, setDraft] = useState({
        enabled: true, apiKey: '', apiKeySet: false, clearApiKey: false,
        voiceId: '', modelId: 'breeze-tts-2', languageCode: '', instructions: '',
        outputFormat: 'mp3', speed: '1', volume: '1', guidanceScale: '1',
        speakerBoost: false, withTimestamps: false,
        outputDir: '', maxChars: '1000', timeoutMs: '20000',
      })
      const [busy, setBusy] = useState(null)
      const [notice, setNotice] = useState(null)
      const [testText, setTestText] = useState('')
      const [testBusy, setTestBusy] = useState(false)
      const [testReport, setTestReport] = useState(null)
      const [tab, setTab] = useState('set')
      const [hist, setHist] = useState({ items: [], total: 0, loading: false, error: null, at: null })
      const [pendingDelete, setPendingDelete] = useState(null)
      const [deleting, setDeleting] = useState(null)
      const alive = useRef(true)

      // 语音识别（ASR）和规则各有自己的提交按钮，不参与底部那条保存栏。
      const [asrKey, setAsrKey] = useState('')
      const [asrSeconds, setAsrSeconds] = useState(null)
      const [asrBusy, setAsrBusy] = useState(null)
      const [asrNotice, setAsrNotice] = useState(null)
      const [rules, setRules] = useState({ text: '', isDefault: false, max: 4000, loading: true, error: null })
      const [ruleBusy, setRuleBusy] = useState(null)
      const [ruleNotice, setRuleNotice] = useState(null)

      const absorb = useCallback(payload => {
        setSnap(payload)
        const config = payload?.config ?? {}
        setDraft({
          enabled: config.enabled !== false,
          apiKey: '',
          apiKeySet: config.apiKeySet === true,
          clearApiKey: false,
          voiceId: config.voiceId ?? '',
          modelId: config.modelId ?? 'breeze-tts-2',
          languageCode: config.languageCode ?? '',
          instructions: config.instructions ?? '',
          outputFormat: config.outputFormat ?? 'mp3',
          speed: String(config.speed ?? 1),
          volume: String(config.volume ?? 1),
          guidanceScale: String(config.guidanceScale ?? 1),
          speakerBoost: config.speakerBoost === true,
          withTimestamps: config.withTimestamps === true,
          outputDir: config.outputDir ?? '',
          maxChars: String(config.maxChars ?? 1000),
          timeoutMs: String(config.timeoutMs ?? 20000),
        })
        // 只在第一次拿配置时回填，8 秒一次的轮询不打断正在输入的数字。
        setAsrSeconds(current => (current === null ? String(config.asrMaxSeconds ?? 120) : current))
      }, [])

      const load = useCallback(async () => {
        setLoading(true)
        try {
          const response = await fetch(API, { headers: { accept: 'application/json' } })
          if (!response.ok) throw new Error('HTTP ' + response.status)
          const payload = await response.json()
          if (!alive.current) return
          absorb(payload)
          setError(null)
        } catch (problem) {
          if (alive.current) setError(problem)
        } finally {
          if (alive.current) setLoading(false)
        }
      }, [absorb])

      useEffect(() => {
        alive.current = true
        void load()
        return () => { alive.current = false }
      }, [load])

      // ── 规则：自己读、自己存，失败只落在这一块里 ──────────────────────────
      const loadRules = useCallback(async () => {
        setRules(current => ({ ...current, loading: true, error: null }))
        try {
          const response = await fetch(API + '/rules', { headers: { accept: 'application/json' } })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          setRules({
            text: String(payload.text ?? ''),
            isDefault: payload.isDefault === true,
            max: Number(payload.max ?? 4000),
            loading: false,
            error: null,
          })
        } catch (problem) {
          if (!alive.current) return
          setRules(current => ({ ...current, loading: false, error: problem }))
        }
      }, [])

      useEffect(() => { void loadRules() }, [loadRules])

      const saveRules = useCallback(async () => {
        setRuleBusy('save')
        setRuleNotice(null)
        try {
          const response = await fetch(API + '/rules', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: rules.text }),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          setRules(current => ({
            ...current,
            text: String(payload.text ?? current.text),
            isDefault: payload.isDefault === true,
            max: Number(payload.max ?? current.max),
            loading: false,
            error: null,
          }))
          setRuleNotice({ kind: 'ok', text: t('rules.saved') })
        } catch (problem) {
          if (alive.current) setRuleNotice({ kind: 'err', text: t('rules.saveFailed') + '：' + String(problem?.message ?? problem) })
        } finally {
          if (alive.current) setRuleBusy(null)
        }
      }, [rules.text, t])

      const resetRules = useCallback(async () => {
        if (typeof window === 'undefined' || typeof window.confirm !== 'function') return
        // 取消就什么都不发，连预检请求也不发。
        if (window.confirm(t('rules.confirm')) !== true) return
        setRuleBusy('reset')
        setRuleNotice(null)
        try {
          const response = await fetch(API + '/rules', { method: 'DELETE' })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          setRules({
            text: String(payload.text ?? ''),
            isDefault: payload.isDefault !== false,
            max: Number(payload.max ?? 4000),
            loading: false,
            error: null,
          })
          setRuleNotice({ kind: 'ok', text: t('rules.restored') })
        } catch (problem) {
          if (alive.current) setRuleNotice({ kind: 'err', text: t('rules.resetFailed') + '：' + String(problem?.message ?? problem) })
        } finally {
          if (alive.current) setRuleBusy(null)
        }
      }, [t])

      // ── 识别密钥与单次上限 ────────────────────────────────────────────────
      const saveAsrKey = useCallback(async () => {
        const value = asrKey.trim()
        if (value === '') {
          setAsrNotice({ kind: 'err', text: t('asr.empty') })
          return
        }
        setAsrBusy('key')
        setAsrNotice(null)
        try {
          const response = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ deepseekApiKey: value }),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          // 只更新快照，不动主表单草稿：这里改的是另一组字段。
          setSnap(payload)
          setAsrKey('')
          setAsrNotice({ kind: 'ok', text: t('asr.saved') })
        } catch (problem) {
          if (alive.current) setAsrNotice({ kind: 'err', text: t('asr.saveFailed') + '：' + String(problem?.message ?? problem) })
        } finally {
          if (alive.current) setAsrBusy(null)
        }
      }, [asrKey, t])

      const clearAsrKey = useCallback(async () => {
        setAsrBusy('clear')
        setAsrNotice(null)
        try {
          const response = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ clearDeepseekApiKey: true }),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          setSnap(payload)
          setAsrKey('')
          setAsrNotice({ kind: 'ok', text: t('asr.cleared') })
        } catch (problem) {
          if (alive.current) setAsrNotice({ kind: 'err', text: t('asr.clearFailed') + '：' + String(problem?.message ?? problem) })
        } finally {
          if (alive.current) setAsrBusy(null)
        }
      }, [t])

      // 数字框没有单独的按钮：失焦或回车时提交，值没变就不发请求。
      const commitAsrSeconds = useCallback(async () => {
        const raw = String(asrSeconds ?? snap?.config?.asrMaxSeconds ?? 120)
        const parsed = Number(raw)
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
          setAsrNotice({ kind: 'err', text: t('asr.badMax') })
          setAsrSeconds(String(snap?.config?.asrMaxSeconds ?? 120))
          return
        }
        const value = Math.round(parsed)
        setAsrSeconds(String(value))
        if (value === Number(snap?.config?.asrMaxSeconds ?? 120)) return
        setAsrBusy('seconds')
        setAsrNotice(null)
        try {
          const response = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ asrMaxSeconds: value }),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          setSnap(payload)
          setAsrSeconds(String(payload?.config?.asrMaxSeconds ?? value))
          setAsrNotice({ kind: 'ok', text: t('asr.saved') })
        } catch (problem) {
          if (alive.current) {
            setAsrSeconds(String(snap?.config?.asrMaxSeconds ?? 120))
            setAsrNotice({ kind: 'err', text: t('asr.saveFailed') + '：' + String(problem?.message ?? problem) })
          }
        } finally {
          if (alive.current) setAsrBusy(null)
        }
      }, [asrSeconds, snap, t])

      // 记录页：只在要看的时候才去拉，音频元素留在页面上时也不会被轮询打断。
      const loadHist = useCallback(async () => {
        setHist(current => ({ ...current, loading: true, error: null }))
        try {
          const response = await fetch(API + '/history?limit=60', { headers: { accept: 'application/json' } })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          setHist({
            items: Array.isArray(payload.items) ? payload.items : [],
            total: Number(payload.total ?? 0),
            loading: false,
            error: null,
            at: new Date().toISOString(),
          })
        } catch (problem) {
          if (!alive.current) return
          setHist(current => ({ ...current, loading: false, error: problem }))
        }
      }, [])

      useEffect(() => {
        if (tab === 'hist') void loadHist()
      }, [tab, loadHist])

      const removeOne = useCallback(async (name) => {
        // 两下才删：第一下只是把它标红，避免手滑删掉还在用的音频。
        if (pendingDelete !== name) { setPendingDelete(name); return }
        setPendingDelete(null)
        setDeleting(name)
        try {
          const response = await fetch(API + '/history/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name }),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          await loadHist()
        } catch (problem) {
          if (alive.current) setHist(current => ({ ...current, loading: false, error: problem }))
        } finally {
          if (alive.current) setDeleting(null)
        }
      }, [pendingDelete, loadHist])

      // 面板是活的：桥那边合成一次，计数和上次时间要跟上。
      useEffect(() => {
        const timer = setInterval(() => { void load() }, 8000)
        return () => clearInterval(timer)
      }, [load])

      const patch = (key, value) => setDraft(current => ({ ...current, [key]: value }))

      const same = useCallback((payload) => {
        if (payload === null) return false
        const config = payload.config ?? {}
        const keys = ['voiceId', 'modelId', 'languageCode', 'instructions', 'outputFormat', 'outputDir']
        for (const key of keys) {
          if ((draft[key] ?? '') !== (config[key] ?? '')) return false
        }
        if (String(draft.speed) !== String(config.speed ?? '')) return false
        if (String(draft.volume) !== String(config.volume ?? '')) return false
        if (String(draft.guidanceScale) !== String(config.guidanceScale ?? '')) return false
        if (String(draft.maxChars) !== String(config.maxChars ?? '')) return false
        if (String(draft.timeoutMs) !== String(config.timeoutMs ?? '')) return false
        if (draft.enabled !== (config.enabled !== false)) return false
        if (draft.speakerBoost !== (config.speakerBoost === true)) return false
        if (draft.withTimestamps !== (config.withTimestamps === true)) return false
        if (draft.apiKey !== '' || draft.clearApiKey) return false
        return true
      }, [draft])

      const dirty = !same(snap)

      const save = useCallback(async () => {
        setBusy('patch')
        setNotice(null)
        try {
          const body = {
            enabled: draft.enabled,
            voiceId: draft.voiceId,
            modelId: draft.modelId,
            languageCode: draft.languageCode,
            instructions: draft.instructions,
            outputFormat: draft.outputFormat,
            outputDir: draft.outputDir,
            speakerBoost: draft.speakerBoost,
            withTimestamps: draft.withTimestamps,
          }
          const speed = num(draft.speed)
          if (speed !== null) body.speed = speed
          const volume = num(draft.volume)
          if (volume !== null) body.volume = volume
          const guidance = num(draft.guidanceScale)
          if (guidance !== null) body.guidanceScale = guidance
          const maxChars = num(draft.maxChars)
          if (maxChars !== null) body.maxChars = maxChars
          const timeoutMs = num(draft.timeoutMs)
          if (timeoutMs !== null) body.timeoutMs = timeoutMs
          if (draft.clearApiKey) body.clearApiKey = true
          else if (draft.apiKey.trim() !== '') body.apiKey = draft.apiKey.trim()

          const response = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error ?? ('HTTP ' + response.status))
          }
          if (!alive.current) return
          absorb(payload)
          setNotice({ kind: 'ok', text: t('saved') })
        } catch (problem) {
          if (alive.current) {
            setNotice({ kind: 'err', text: t('saveFailed') + '：' + String(problem?.message ?? problem) })
          }
        } finally {
          if (alive.current) setBusy(null)
        }
      }, [draft, absorb, t])

      // ⌘S / Ctrl+S 保存，Esc 放弃
      useEffect(() => {
        const onKey = event => {
          const meta = event.metaKey || event.ctrlKey
          if (meta && String(event.key).toLowerCase() === 's') {
            if (!dirty) return
            event.preventDefault()
            void save()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [dirty, save])

      const runTest = useCallback(async () => {
        const text = testText.trim()
        if (text === '') {
          setTestReport({ kind: 'err', text: t('test.empty') })
          return
        }
        setTestBusy(true)
        setTestReport(null)
        try {
          const response = await fetch(API + '/test', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
          })
          const payload = await response.json().catch(() => null)
          if (!response.ok || payload?.ok !== true) throw new Error(payload?.error ?? ('HTTP ' + response.status))
          if (!alive.current) return
          setTestReport({
            kind: 'ok',
            text: fill2(t('test.result'), payload.bytes, payload.words ?? 0),
            path: payload.path,
            name: payload.name,
          })
          void load()
        } catch (problem) {
          if (alive.current) setTestReport({ kind: 'err', text: t('test.failed') + '：' + String(problem?.message ?? problem) })
        } finally {
          if (alive.current) setTestBusy(false)
        }
      }, [testText, t, load])

      if (loading && snap === null) {
        return h('div', { className: 'bv_root' },
          h('header', { className: 'bv_head' },
            h('span', { className: 'bv_logo' }, h(Icon, { name: 'voice' })),
            h('div', { className: 'bv_headtext' },
              h('h1', { className: 'bv_h1' }, t('title')),
              h('p', { className: 'bv_sub' }, t('subtitle')))),
          h('p', { className: 'bv_empty' }, t('loading')))
      }

      if (error !== null && snap === null) {
        return h('div', { className: 'bv_root' },
          h('header', { className: 'bv_head' },
            h('span', { className: 'bv_logo' }, h(Icon, { name: 'voice' })),
            h('div', { className: 'bv_headtext' },
              h('h1', { className: 'bv_h1' }, t('title')),
              h('p', { className: 'bv_sub' }, t('subtitle')))),
          h('section', { className: 'bv_panel' },
            h('p', { className: 'bv_error' }, t('loadFailed') + '：' + String(error?.message ?? error)),
            h('p', { className: 'bv_panelnote' }, t('loadFailedHint')),
            h('div', { className: 'bv_row' },
              h('button', { type: 'button', className: 'bv_btn', 'data-primary': 'true', onClick: () => { void load() } }, t('retry')))))
      }

      const status = snap?.status ?? {}
      const asrKeySet = snap?.config?.deepseekApiKeySet === true
      const asrReady = snap?.config?.asrReady === true
      const state = status.enabled === false ? 'warn' : status.ready ? 'on' : 'warn'
      const stateLabel = status.enabled === false ? t('state.off') : status.ready ? t('state.ready') : t('state.setup')
      const voiceLabel = draft.voiceId !== '' ? draft.voiceId : '—'

      const stats = h('div', { className: 'bv_stats' },
        h(Stat, { k: t('stat.voice'), v: voiceLabel }),
        h(Stat, { k: t('stat.count'), v: String(status.count ?? 0) }),
        h(Stat, { k: t('stat.last'), v: ago(status.lastAt, t) }),
        h(Stat, { k: t('state.outDir'), v: draft.outputDir !== '' ? draft.outputDir : status.outDir ?? '—' }))

      const connectionPanel = h(Panel, { title: t('card.conn'), note: t('card.conn.hint') },
        h(Row, { title: t('enabled'), hint: t('enabled.hint') },
          h(Switch, { checked: draft.enabled, label: t('enabled'), onChange: value => patch('enabled', value) })),
        h('div', { className: 'bv_fields' },
          h(Field, { label: t('apiKey'), hint: draft.clearApiKey ? t('apiKey.cleared') : (draft.apiKeySet ? t('apiKey.set') : t('apiKey.unset')) },
            h('div', { className: 'bv_inline' },
              h('input', {
                className: 'bv_input',
                type: 'password',
                'data-mono': 'true',
                value: draft.apiKey,
                placeholder: draft.apiKeySet ? '········' : '',
                autoComplete: 'off',
                onChange: event => { patch('apiKey', event.target.value); patch('clearApiKey', false) },
              }),
              draft.apiKeySet
                ? h('button', {
                  type: 'button',
                  className: 'bv_btn',
                  'data-quiet': 'true',
                  onClick: () => { patch('clearApiKey', !draft.clearApiKey); patch('apiKey', '') },
                }, t('apiKey.clear'))
                : null)),
          h(Field, { label: t('voiceId'), hint: t('voiceId.hint') },
            h('input', {
              className: 'bv_input',
              'data-mono': 'true',
              value: draft.voiceId,
              placeholder: t('voiceId.placeholder'),
              onChange: event => patch('voiceId', event.target.value),
            })),
          h(Field, { label: t('modelId') },
            h('input', {
              className: 'bv_input',
              'data-mono': 'true',
              value: draft.modelId,
              onChange: event => patch('modelId', event.target.value),
            })),
          h(Field, { label: t('language'), hint: t('language.hint') },
            h('input', {
              className: 'bv_input',
              'data-mono': 'true',
              value: draft.languageCode,
              placeholder: 'zh',
              onChange: event => patch('languageCode', event.target.value),
            })),
          h(Field, { label: t('format') },
            h('select', {
              className: 'bv_select',
              value: draft.outputFormat,
              onChange: event => patch('outputFormat', event.target.value),
            }, (snap?.config?.formats ?? ['mp3']).map(item => h('option', { key: item, value: item }, item))))))

      const perfPanel = h(Panel, { title: t('card.perf'), note: t('card.perf.hint') },
        h(Field, { label: t('instructions'), hint: t('instructions.hint') },
          h('textarea', {
            className: 'bv_area',
            value: draft.instructions,
            placeholder: t('instructions.placeholder'),
            rows: 3,
            onChange: event => patch('instructions', event.target.value),
          })),
        h('div', { className: 'bv_fields' },
          h(Field, { label: t('speed'), hint: '0.5 – 2' },
            h('input', {
              className: 'bv_input', type: 'number', step: '0.05', min: '0.5', max: '2', 'data-num': 'true',
              value: draft.speed, onChange: event => patch('speed', event.target.value),
            })),
          h(Field, { label: t('volume'), hint: '0.01 – 2' },
            h('input', {
              className: 'bv_input', type: 'number', step: '0.05', min: '0.01', max: '2', 'data-num': 'true',
              value: draft.volume, onChange: event => patch('volume', event.target.value),
            })),
          h(Field, { label: t('guidance'), hint: '1 – 10' },
            h('input', {
              className: 'bv_input', type: 'number', step: '0.5', min: '1', max: '10', 'data-num': 'true',
              value: draft.guidanceScale, onChange: event => patch('guidanceScale', event.target.value),
            }))),
        h(Row, { title: t('speakerBoost'), hint: t('speakerBoost.hint') },
          h(Switch, { checked: draft.speakerBoost, label: t('speakerBoost'), onChange: value => patch('speakerBoost', value) })),
        h(Row, { title: t('timestamps'), hint: t('timestamps.hint') },
          h(Switch, { checked: draft.withTimestamps, label: t('timestamps'), onChange: value => patch('withTimestamps', value) })))

      const outPanel = h(Panel, { title: t('card.out'), note: t('card.out.hint') },
        h('div', { className: 'bv_fields' },
          h(Field, { label: t('outputDir'), hint: t('outputDir.hint') },
            h('input', {
              className: 'bv_input', 'data-mono': 'true', value: draft.outputDir,
              placeholder: status.outDir ?? '',
              onChange: event => patch('outputDir', event.target.value),
            })),
          h(Field, { label: t('maxChars') },
            h('input', {
              className: 'bv_input', type: 'number', min: '1', max: '2000', 'data-num': 'true',
              value: draft.maxChars, onChange: event => patch('maxChars', event.target.value),
            })),
          h(Field, { label: t('timeout') },
            h('input', {
              className: 'bv_input', type: 'number', min: '1000', max: '120000', step: '1000', 'data-num': 'true',
              value: draft.timeoutMs, onChange: event => patch('timeoutMs', event.target.value),
            }))))

      const testPanel = h(Panel, { title: t('card.test'), note: t('card.test.hint') },
        h('div', { className: 'bv_testrow' },
          h('input', {
            className: 'bv_input',
            value: testText,
            placeholder: t('test.placeholder'),
            onChange: event => setTestText(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void runTest()
              }
            },
          }),
          h('button', {
            type: 'button',
            className: 'bv_btn',
            'data-primary': 'true',
            disabled: testBusy,
            onClick: () => { void runTest() },
          }, testBusy ? t('test.running') : t('test.run'))),
        testReport !== null
          ? h('div', { className: 'bv_result', 'data-kind': testReport.kind ?? 'ok' },
            h('div', null, testReport.text),
            testReport.path ? h('div', null, h('code', null, testReport.path)) : null)
          : null,
        testReport?.name
          ? h('audio', {
            className: 'bv_audio',
            controls: true,
            preload: 'none',
            src: API + '/audio/' + encodeURIComponent(testReport.name),
            'aria-label': t('test.play'),
          })
          : null)

      const asrPanel = h(Panel, { title: t('card.asr'), note: t('card.asr.hint') },
        h(Row, { title: t('asr.status'), hint: t('asr.status.hint') },
          h('div', { className: 'bv_badges' },
            h('span', { className: 'bv_rowhint' }, t('asr.keyBadge')),
            h('span', { className: 'bv_pill', 'data-state': asrKeySet ? 'on' : 'warn', role: 'status' },
              h('span', { className: 'bv_dot' }), asrKeySet ? t('asr.set') : t('asr.unset')),
            h('span', { className: 'bv_rowhint' }, t('asr.readyBadge')),
            h('span', { className: 'bv_pill', 'data-state': asrReady ? 'on' : 'warn', role: 'status' },
              h('span', { className: 'bv_dot' }), asrReady ? t('asr.set') : t('asr.unset')))),
        h('div', { className: 'bv_fields' },
          h(Field, { label: t('asr.key'), hint: t('asr.key.hint') },
            h('div', { className: 'bv_inline' },
              h('input', {
                className: 'bv_input',
                type: 'password',
                'data-mono': 'true',
                value: asrKey,
                placeholder: t('asr.key.placeholder'),
                autoComplete: 'new-password',
                onChange: event => setAsrKey(event.target.value),
                onKeyDown: event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void saveAsrKey()
                  }
                },
              }),
              h('button', {
                type: 'button',
                className: 'bv_btn',
                'data-primary': 'true',
                disabled: asrBusy !== null,
                onClick: () => { void saveAsrKey() },
              }, asrBusy === 'key' ? t('saving') : t('asr.save')),
              h('button', {
                type: 'button',
                className: 'bv_btn',
                'data-quiet': 'true',
                disabled: asrBusy !== null || !asrKeySet,
                onClick: () => { void clearAsrKey() },
              }, asrBusy === 'clear' ? t('saving') : t('asr.clear')))),
          h(Field, { label: t('asr.max'), hint: t('asr.max.hint') },
            h('div', { className: 'bv_inline' },
              h('input', {
                className: 'bv_input',
                type: 'number',
                min: '1',
                max: '120',
                step: '1',
                'data-num': 'true',
                value: asrSeconds ?? String(snap?.config?.asrMaxSeconds ?? 120),
                onChange: event => setAsrSeconds(event.target.value),
                onBlur: () => { void commitAsrSeconds() },
                onKeyDown: event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.target.blur?.()
                  }
                },
              }),
              h('span', { className: 'bv_unit' }, t('asr.unit'))))),
        asrNotice !== null
          ? h('p', { className: 'bv_noteline', 'data-kind': asrNotice.kind, role: 'status' }, asrNotice.text)
          : null,
        h('p', { className: 'bv_panelnote' }, fill(t('asr.price'), snap?.config?.asrPrice ?? '0.39')))

      const ruleMax = Number(rules.max ?? 4000) || 4000
      const ruleLength = [...String(rules.text ?? '')].length
      const rulesPanel = h('section', { className: 'bv_panel' },
        h('div', { className: 'bv_panelhead' },
          h('h2', { className: 'bv_paneltitle' }, t('card.rules')),
          rules.isDefault ? h('span', { className: 'bv_tag' }, t('rules.default')) : null),
        h('p', { className: 'bv_panelnote' }, t('card.rules.hint')),
        rules.error !== null
          ? h('div', null,
            h('p', { className: 'bv_error' }, t('rules.failed') + '：' + String(rules.error?.message ?? rules.error)),
            h('button', {
              type: 'button',
              className: 'bv_btn',
              'data-quiet': 'true',
              onClick: () => { void loadRules() },
            }, t('rules.retry')))
          : h('div', null,
            h('textarea', {
              className: 'bv_area bv_rules',
              value: rules.text,
              spellCheck: false,
              'aria-label': t('card.rules'),
              onChange: event => setRules(current => ({ ...current, text: event.target.value })),
            }),
            h('div', { className: 'bv_rulebar' },
              h('button', {
                type: 'button',
                className: 'bv_btn',
                'data-primary': 'true',
                disabled: ruleBusy !== null,
                onClick: () => { void saveRules() },
              }, ruleBusy === 'save' ? t('saving') : t('rules.save')),
              h('button', {
                type: 'button',
                className: 'bv_btn',
                'data-quiet': 'true',
                disabled: ruleBusy !== null,
                onClick: () => { void resetRules() },
              }, ruleBusy === 'reset' ? t('saving') : t('rules.reset')),
              h('span', {
                className: 'bv_rulecount',
                'data-over': ruleLength > ruleMax ? 'true' : 'false',
              }, fill2(t('rules.count'), ruleLength, ruleMax))),
            ruleNotice !== null
              ? h('p', { className: 'bv_noteline', 'data-kind': ruleNotice.kind, role: 'status' }, ruleNotice.text)
              : null))

      const histPanel = h(Panel, { title: t('card.hist'), note: t('card.hist.hint') },
        h('div', { className: 'bv_histbar' },
          h('span', { className: 'bv_histmeta' }, fill(t('hist.total'), hist.total)),
          h('span', { className: 'bv_grow' }),
          h('button', {
            type: 'button',
            className: 'bv_btn',
            'data-quiet': 'true',
            disabled: hist.loading,
            onClick: () => { void loadHist() },
          }, hist.loading ? t('hist.refreshing') : t('hist.refresh'))),
        hist.error !== null
          ? h('p', { className: 'bv_error' }, t('hist.failed') + '：' + String(hist.error?.message ?? hist.error))
          : null,
        hist.items.length === 0
          ? h('p', { className: 'bv_empty' }, hist.loading ? t('hist.refreshing') : t('hist.empty'))
          : h('div', { className: 'bv_hist' }, hist.items.map(item => h('article', { className: 'bv_item', key: item.name },
            h('div', { className: 'bv_itembody' },
              h('p', {
                className: 'bv_itemtext',
                'data-empty': item.text === '' ? 'true' : 'false',
              }, item.text === '' ? t('hist.noText') : item.text),
              h('div', { className: 'bv_itemmeta' },
                [clock(item.at), String(item.format ?? '').toUpperCase(), sizeOf(item.bytes), item.voiceId]
                  .filter(Boolean).join(' · '))),
            h('div', { className: 'bv_rowact', key: 'act' },
              h(PlayButton, {
                src: API + '/audio/' + encodeURIComponent(item.name),
                label: t('hist.play'),
                stopLabel: t('hist.stop'),
              }),
              h('button', {
                type: 'button',
                className: 'bv_textbtn',
                'data-danger': pendingDelete === item.name ? 'true' : 'false',
                disabled: deleting !== null,
                title: pendingDelete === item.name ? t('hist.sure') : t('hist.delete'),
                'aria-label': pendingDelete === item.name ? t('hist.sure') : t('hist.delete'),
                onClick: () => { void removeOne(item.name) },
              }, deleting === item.name ? t('hist.deleting') : pendingDelete === item.name ? t('hist.sure') : t('hist.delete')))))))

      return h('div', { className: 'bv_root' },
        h('header', { className: 'bv_head' },
          h('span', { className: 'bv_logo' }, h(Icon, { name: 'voice' })),
          h('div', { className: 'bv_headtext' },
            h('h1', { className: 'bv_h1' }, t('title')),
            h('p', { className: 'bv_sub' }, t('subtitle'))),
          h('span', { className: 'bv_pill', 'data-state': state, role: 'status' },
            h('span', { className: 'bv_dot' }), stateLabel)),

        h('div', { className: 'bv_tabs', role: 'tablist' },
          h('button', {
            type: 'button', role: 'tab', className: 'bv_tab', 'data-on': tab === 'set' ? 'true' : 'false',
            onClick: () => setTab('set'),
          }, t('tab.set')),
          h('button', {
            type: 'button', role: 'tab', className: 'bv_tab', 'data-on': tab === 'hist' ? 'true' : 'false',
            onClick: () => { setPendingDelete(null); setTab('hist') },
          }, t('tab.hist'),
          hist.total > 0 ? h('span', { className: 'bv_tabn' }, String(hist.total)) : null)),

        tab === 'hist' ? histPanel : [
        stats,
        notice !== null && !dirty
          ? h('p', { className: 'bv_noteline', 'data-kind': notice.kind, role: 'status' }, notice.text)
          : null,
        status.lastError ? h('section', { className: 'bv_panel' },
          h('p', { className: 'bv_error' }, status.lastError)) : null,
        connectionPanel,
        perfPanel,
        outPanel,
        testPanel,
        asrPanel,
        rulesPanel,

        dirty
          ? h('div', { className: 'bv_savebar' },
            h('button', {
              type: 'button', className: 'bv_btn', 'data-primary': 'true', disabled: busy !== null,
              onClick: () => { void save() },
            }, busy === 'patch' ? t('saving') : t('save')),
            h('button', {
              type: 'button', className: 'bv_btn', 'data-quiet': 'true', disabled: busy !== null,
              onClick: () => { if (snap !== null) { absorb(snap); setNotice(null) } },
            }, t('discard')),
            h('span', { className: 'bv_notice', 'data-kind': notice?.kind ?? 'warn' },
              notice !== null ? notice.text : t('unsaved')),
            h('span', { className: 'bv_kbd' }, '⌘S'))
          : null,
        ],

        h('p', { className: 'bv_foot' }, t('configPath') + '：' + (snap?.config?.configFile ?? '—')))
    }

    // ── plugin ────────────────────────────────────────────────────────────────
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }), 'dsh-breeze-voice: dictionaries')

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-breeze-voice')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => { try { style.remove() } catch { /* already detached */ } }
      }, 'dsh-breeze-voice: styles')

      const t = ctx.locale.bind(NS)

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'voice',
        order: 64,
        label: () => t('nav'),
        locale: NS,
      }, props => h(Boundary, null, h(VoiceSection, { ...props, t }))))
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = 'dsh-breeze-voice'
    return module.exports
  },
})
