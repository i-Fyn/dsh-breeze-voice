# Changelog

## [0.1.0] - 2026-11-21

首个公开版本。

- `breeze_voice`：文字合成语音，落到本机文件（mp3/wav/flac/opus/aac/pcm）。
- `breeze_transcribe`：把本机音频转成文字（单次 ≤120 秒、≤8 MiB）。
- 设置 → 语音：改 key、音色、模型、演绎指令、语速音量，保存即生效。
- API key 可写在配置里，也可用环境变量 `BREEZE_API_KEY`（优先）。
- 插件不监听端口、不起 HTTP 服务、不上传音频。
