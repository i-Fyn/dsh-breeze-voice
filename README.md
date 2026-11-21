# dsh-breeze-voice

把 BreezeBlue 的文字转语音接进 DeepSeek Harness。agent 通过 `breeze_voice` 工具合成音频，
文件落在本机；要发出去就把它交给负责发送的渠道——在 QQ 里是 `qq_send` 的 `voice` 参数。

插件不做任何网络发布：不监听端口、不起 HTTP 服务、不上传音频。发送方自己读文件。

## 装

两条路，装完都要重启一次 DeepSeek Harness。

**从 npm 装**（推荐）

```bash
dsh plugin add dsh-breeze-voice
```

**从 GitHub 装**（想跟最新代码）

```bash
dsh plugin add github:i-Fyn/dsh-breeze-voice
```

装好后打开 **设置 → 语音**，填 API key 与音色 ID（`voc_...`）。

手装（不想走 `dsh plugin add` 的时候）：把插件目录放进 `~/.dsh/plugins/`，
再把它加进 profile 的 `dependencies`（`link:` 指到目录）与 `dsh.profile.bundles`，
最后在这个 profile 里跑 `pnpm install --prefer-offline`，重启。

## 配置

配置文件：`~/.dsh/dsh-breeze-voice/config.json`（设置页改的就是它，改完不用重启）。

| 键 | 说明 | 默认 |
| --- | --- | --- |
| `enabled` | 关掉后工具直接报错，不占额度 | `true` |
| `apiKey` | BreezeBlue 开发者 key；也可用环境变量 `BREEZE_API_KEY`（优先级更高） | 空 |
| `voiceId` | 音色 ID，形如 `voc_...` | 空 |
| `modelId` | 模型 | `breeze-tts-2` |
| `languageCode` | ISO 639-1；留空由服务端判断 | 空 |
| `instructions` | 默认演绎指令（与正文同语言） | 空 |
| `outputFormat` | `mp3` / `wav` / `flac` / `opus` / `aac` / `pcm` | `mp3` |
| `speed` / `volume` / `guidanceScale` | 0.5–2 / 0.01–2 / 1–10 | 1 / 1 / 1 |
| `speakerBoost` | 提升人声清晰度 | `false` |
| `withTimestamps` | 走 with-timestamps 端点，音频旁多一份 `.timestamps.json` | `false` |
| `outputDir` | 落盘目录 | `<数据目录>/audio` |
| `maxChars` / `timeoutMs` | 单次字符上限 / 请求超时 | 1000 / 20000 |

## 工具

`breeze_voice(text, instructions?, voiceId?)` → 返回

```
语音已合成：
path: /Users/you/.dsh/dsh-breeze-voice/audio/breeze-20261109-233500-abc123.mp3
mime: audio/mpeg
bytes: 68736
```

把这个 `path` 交给发送方即可。

## 和 dsh-qq 配合

QQ 会话里让大肥鱼「说句话」时：

1. `breeze_voice` 合成，拿到 `path`；
2. `qq_send({ voice: path })` —— 桥读文件、转成 `base64://` 的 `record` 段发给 OneBot；
3. 只给文件名（例如 `breeze-....mp3`）时，桥会去 `~/.dsh/dsh-breeze-voice/audio` 找。

超过 6MB 会被拦下（OneBot 实现普遍不接受过大的 base64），所以一次别合成太长。

## 自检

```bash
node test/selftest.mjs        # 配置 / 合成 / 落盘 / HTTP 接口（用替身 fetch，不联网）
node test/client-render.mjs   # 设置页的离线渲染
```

## 目录

```
index.js            插件入口：配置、服务、工具、设置接口
client.js           设置 → 语音 的分区（手写 bundle，只依赖 react）
src/config.js       默认值 / 收敛 / 落盘
src/breeze.js       BreezeBlue 客户端（普通端点 + with-timestamps）
src/voice.js        合成 → 写盘 → 返回 path
src/api.js          /api/dsh-breeze-voice（GET/POST/POST test/GET audio）
src/store.js        原子写 JSON
src/paths.js        数据目录解析
```
