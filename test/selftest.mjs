/**
 * 自检：不联外网，用替身 fetch 跑通「配置 → 合成 → 落盘 → 接口」。
 *
 * node test/selftest.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { ConfigStore, defaultConfig, mergeConfig, normalizeConfig } from '../src/config.js'
import { mimeOf } from '../src/breeze.js'
import { VoiceService } from '../src/voice.js'
import { mountBreezeApi } from '../src/api.js'

const quiet = { info() {}, warn() {}, debug() {}, error() {} }
let passed = 0
const failures = []

async function test(name, run) {
  try {
    await run()
    passed += 1
    console.log('  ok   ' + name)
  } catch (error) {
    failures.push(name)
    console.log('  FAIL ' + name)
    console.log('       ' + String(error?.stack ?? error).split('\n').slice(0, 4).join('\n       '))
  }
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'breeze-selftest-'))

// ── 配置 ──────────────────────────────────────────────────────────────────
await test('配置：默认值收敛，输出目录落在数据目录下', () => {
  const config = normalizeConfig(mergeConfig(defaultConfig(), {}), { dataDir })
  assert.equal(config.outputFormat, 'mp3')
  assert.equal(config.speed, 1)
  assert.equal(config.outputDir, path.join(dataDir, 'audio'))
  assert.ok(fs.existsSync(config.outputDir))
  assert.equal(config.enabled, true)
})

await test('配置：越界值夹紧，格式不认识就退回 mp3', () => {
  const config = normalizeConfig({
    ...defaultConfig(),
    speed: 9,
    volume: 0,
    guidanceScale: 99,
    maxChars: 1e6,
    timeoutMs: 10,
    outputFormat: 'ogg-maybe',
  }, { dataDir })
  assert.equal(config.speed, 2)
  assert.equal(config.volume, 0.01)
  assert.equal(config.guidanceScale, 10)
  assert.equal(config.maxChars, 2000)
  assert.equal(config.timeoutMs, 1000)
  assert.equal(config.outputFormat, 'mp3')
})

await test('配置：ConfigStore 落盘、重读、增量更新', () => {
  const store = new ConfigStore({ dataDir, logger: quiet })
  store.load()
  store.update({ voiceId: 'voc_test_1', speed: 1.25 })
  assert.equal(store.config.voiceId, 'voc_test_1')
  const again = new ConfigStore({ dataDir, logger: quiet })
  again.load()
  assert.equal(again.config.voiceId, 'voc_test_1')
  assert.equal(again.config.speed, 1.25)
  assert.ok(fs.readFileSync(again.file, 'utf8').includes('voc_test_1'))
})

// ── 合成 ──────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch

function stubFetch(handler) {
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => handler(String(url), init)
  return () => { globalThis.fetch = original }
}

await test('合成：普通端点写盘，返回 mime 与字节数', async () => {
  const audio = Buffer.from('ID3-fake-mp3-bytes')
  const restore = stubFetch(async (url, init) => {
    assert.ok(url.startsWith('https://api.breeze.blue/v1/text-to-speech/voc_test_1'))
    assert.ok(url.includes('delivery=sync'))
    assert.equal(init.headers['xi-api-key'], 'key-123')
    const body = JSON.parse(init.body)
    assert.equal(body.text, '你好')
    assert.equal(body.model_id, 'breeze-tts-2')
    return new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
  })
  try {
    const store = new ConfigStore({ dataDir, logger: quiet })
    store.load()
    store.update({ apiKey: 'key-123', voiceId: 'voc_test_1' })
    const service = new VoiceService({ configStore: store, logger: quiet })
    assert.equal(service.ready, true)
    const result = await service.synthesize({ text: '你好' })
    assert.equal(result.bytes, audio.length)
    assert.equal(result.mime, 'audio/mpeg')
    assert.ok(result.name.startsWith('breeze-'))
    assert.ok(fs.existsSync(result.file))
    assert.equal(fs.readFileSync(result.file).length, audio.length)
    assert.equal(result.words.length, 0)
    assert.equal(service.status().count, 1)
    assert.equal(service.status().lastError, '')
  } finally {
    restore()
  }
})

await test('合成：带时间戳走 JSON 信封，旁边写 .timestamps.json', async () => {
  const audio = Buffer.from('fake-wav')
  const restore = stubFetch(async (url) => {
    assert.ok(url.endsWith('/with-timestamps?output_format=wav'))
    return new Response(JSON.stringify({
      audio_base64: audio.toString('base64'),
      content_type: 'audio/wav',
      word_timestamps: [{ word: '你', start: 0, end: 0.28 }, { word: '好', start: 0.28, end: 0.55 }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  try {
    const store = new ConfigStore({ dataDir, logger: quiet })
    store.load()
    store.update({ apiKey: 'key-123', voiceId: 'voc_test_1', outputFormat: 'wav', withTimestamps: true })
    const service = new VoiceService({ configStore: store, logger: quiet })
    const result = await service.synthesize({ text: '你好' })
    assert.equal(result.mime, 'audio/wav')
    assert.equal(result.words.length, 2)
    assert.equal(result.words[1].text, '好')
    assert.equal(result.words[1].start, 0.28)
    assert.ok(fs.existsSync(result.timestampsFile))
    const saved = JSON.parse(fs.readFileSync(result.timestampsFile, 'utf8'))
    assert.equal(saved.unit, 'second')
    assert.equal(saved.words.length, 2)
    store.update({ withTimestamps: false, outputFormat: 'mp3' })
  } finally {
    restore()
  }
})

await test('合成：错误信息是中文且可读', async () => {
  const store = new ConfigStore({ dataDir, logger: quiet })
  store.load()
  store.update({ apiKey: '', voiceId: '' })
  const service = new VoiceService({ configStore: store, logger: quiet })
  await assert.rejects(() => service.synthesize({ text: '你好' }), /API key/)
  store.update({ apiKey: 'key-123' })
  await assert.rejects(() => service.synthesize({ text: '你好' }), /音色 ID/)
  store.update({ voiceId: 'voc_test_1' })
  await assert.rejects(() => service.synthesize({ text: '' }), /text 不能为空/)
  await assert.rejects(() => service.synthesize({ text: 'x'.repeat(5000) }), /超过上限/)

  const restore = stubFetch(async () => new Response(JSON.stringify({ error: 'bad key' }), { status: 401, headers: { 'content-type': 'application/json' } }))
  try {
    await assert.rejects(() => service.synthesize({ text: '你好' }), /401.*bad key/)
  } finally {
    restore()
  }
})

// ── HTTP 接口 ──────────────────────────────────────────────────────────────
/** 用真的 http server 承载 handler，验证路由与状态码。 */
function startServer(handler) {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => { void handler(req, res) })
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

const store = new ConfigStore({ dataDir, logger: quiet })
store.load()
store.update({ apiKey: 'key-123', voiceId: 'voc_test_1', speed: 1 })
const service = new VoiceService({ configStore: store, logger: quiet })

let handler = null
const fakeCtx = {
  inject(_deps, fn) {
    fn({
      webServer: { register: (_options, next) => () => {} },
      effect: (fn) => { const dispose = fn(); return dispose },
    })
  },
}
// 借用 dsh-qq 的挂载方式：server.register({kind:'prefix',path,handler}) 把整条 URL 交给 handler
const fakeServer = { register: (entry) => { handler = entry.handler; return () => { handler = null } } }
const fakeScoped = {
  webServer: fakeServer,
  effect: (fn) => { const dispose = fn(); return dispose },
}
mountBreezeApi({
  inject: (_deps, fn) => fn(fakeScoped),
  logger: quiet,
}, { service, configStore: store, logger: quiet })
assert.equal(typeof handler, 'function', '接口没挂上')

const base = await startServer(handler)
const url = (sub) => 'http://127.0.0.1:' + base.port + '/api/dsh-breeze-voice' + sub

await test('接口：GET 回配置与状态，不回传 key 明文', async () => {
  const res = await fetch(url(''))
  assert.equal(res.status, 200)
  const payload = await res.json()
  assert.equal(payload.ok, true)
  assert.equal(payload.config.apiKeySet, true)
  assert.equal(payload.config.apiKey, undefined)
  assert.equal(payload.config.voiceId, 'voc_test_1')
  assert.equal(payload.status.ready, true)
  assert.ok(Array.isArray(payload.config.formats))
  assert.ok(String(payload.config.configFile).endsWith('config.json'))
})

await test('接口：POST 校验失败回 400，合法改动落盘', async () => {
  const bad = await fetch(url(''), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ speed: 9 }) })
  assert.equal(bad.status, 400)
  assert.match((await bad.json()).error, /语速/)

  const ok = await fetch(url(''), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ speed: 1.1, instructions: '温柔一点', enabled: false }),
  })
  assert.equal(ok.status, 200)
  const payload = await ok.json()
  assert.equal(payload.config.speed, 1.1)
  assert.equal(payload.config.instructions, '温柔一点')
  assert.equal(payload.config.enabled, false)
  assert.deepEqual(payload.changed.sort(), ['enabled', 'instructions', 'speed'])
  assert.equal(store.config.speed, 1.1)
  assert.equal(new ConfigStore({ dataDir, logger: quiet }).load().instructions, '温柔一点')
  // 复原，别影响后面的试听
  await fetch(url(''), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) })
})

await test('接口：POST /test 合成，GET /audio 能取回同一份字节', async () => {
  const audio = Buffer.from('fake-mp3-for-api')
  const restore = stubFetch(async () => new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg' } }))
  try {
    const res = await realFetch(url('/test'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '试一句' }) })
    assert.equal(res.status, 200)
    const payload = await res.json()
    assert.equal(payload.ok, true)
    assert.equal(payload.bytes, audio.length)
    assert.ok(fs.existsSync(payload.path))

    const played = await realFetch(url('/audio/' + encodeURIComponent(payload.name)))
    assert.equal(played.status, 200)
    assert.equal(played.headers.get('content-type'), 'audio/mpeg')
    assert.deepEqual(Buffer.from(await played.arrayBuffer()), audio)
  } finally {
    restore()
  }
})

await test('接口：越界文件名、未知路由、错方法都按约定回', async () => {
  const traversal = await fetch(url('/audio/' + encodeURIComponent('../config.json')))
  assert.equal(traversal.status, 400)
  const missing = await fetch(url('/audio/breeze-nope-123456.mp3'))
  assert.equal(missing.status, 404)
  const unknown = await fetch(url('/nope'))
  assert.equal(unknown.status, 404)
  const wrong = await fetch(url(''), { method: 'PUT' })
  assert.equal(wrong.status, 405)
  const empty = await fetch(url('/test'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '   ' }) })
  assert.equal(empty.status, 400)
})

await test('接口：mimeOf 覆盖所有格式', () => {
  assert.equal(mimeOf('mp3'), 'audio/mpeg')
  assert.equal(mimeOf('wav'), 'audio/wav')
  assert.equal(mimeOf('flac'), 'audio/flac')
  assert.equal(mimeOf('opus'), 'audio/ogg')
  assert.equal(mimeOf('aac'), 'audio/aac')
  assert.equal(mimeOf('pcm'), 'audio/L16')
})

base.server.close()
fs.rmSync(dataDir, { recursive: true, force: true })

console.log('\n' + passed + ' passed' + (failures.length ? ', ' + failures.length + ' failed' : ''))
if (failures.length) process.exit(1)
