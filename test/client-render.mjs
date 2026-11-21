/**
 * client.js 的离线渲染自检：不打开 DSH，也能验证设置分区能注册、能取数、能渲染，
 * 并且不会在浏览器里抛「undefined is not a function」这类错误。
 *
 * 用的是一个极小的 React 替身：只要 createElement + useState/useMemo/useCallback/
 * useRef/useEffect，以及一个反复渲染直到稳定的循环。够用来跑通一遍真实组件。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(here, '..', 'client.js'), 'utf8')

// ── 迷你 React ───────────────────────────────────────────────────────────────
const Fragment = Symbol('Fragment')
let current = null
const pending = []

function createElement(type, props, ...children) {
  const merged = { ...(props ?? {}) }
  const flat = children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false)
  if (flat.length > 0) merged.children = flat.length === 1 ? flat[0] : flat
  return { type, props: merged }
}

function hook() {
  const index = current.cursor++
  return { index, store: current.hooks }
}

function useState(initial) {
  const { index, store } = hook()
  if (!(index in store)) store[index] = typeof initial === 'function' ? initial() : initial
  const set = next => {
    const value = typeof next === 'function' ? next(store[index]) : next
    if (value !== store[index]) {
      store[index] = value
      current.dirty = true
    }
  }
  return [store[index], set]
}

function depsChanged(store, index, deps) {
  const previous = store[index]
  const changed = previous === undefined || deps === undefined || deps.length !== previous.length || deps.some((dep, i) => dep !== previous[i])
  store[index] = deps
  return changed
}

function useMemo(factory, deps) {
  const { index, store } = hook()
  const slot = index + 1000
  if (depsChanged(store, slot, deps)) store[slot + 5000] = factory()
  return store[slot + 5000]
}

function useCallback(fn, deps) {
  return useMemo(() => fn, deps)
}

function useRef(value) {
  const { index, store } = hook()
  if (!(index in store)) store[index] = { current: value }
  return store[index]
}

function useEffect(fn, deps) {
  const { index, store } = hook()
  if (depsChanged(store, index + 2000, deps)) pending.push(fn)
}

class Component {
  constructor(props) { this.props = props }
  setState(next) { this.state = { ...this.state, ...(typeof next === 'function' ? next(this.state) : next) } }
}

Component.prototype.isReactComponent = {}

const React = { Component, createElement, Fragment, useState, useMemo, useCallback, useRef, useEffect }

// ── 加载 bundle ──────────────────────────────────────────────────────────────
let loaded = null
const window = {
  __ModuleLoader__: {
    load({ id, factory }) { loaded = { id, exports: factory(name => (name === 'react' ? React : {})) } },
  },
  addEventListener() {},
  removeEventListener() {},
}

new Function('window', source)(window)
assert.equal(loaded.id, 'dsh-breeze-voice', 'bundle id must equal the package name')
const plugin = loaded.exports
assert.equal(plugin.name, 'dsh-breeze-voice')

// ── 假 DOM：bundle 会往 head 里插一段 <style> ────────────────────────────────
globalThis.document = {
  createElement() {
    return { attributes: {}, textContent: '', setAttribute(name, value) { this.attributes[name] = value }, remove() { this.removed = true } }
  },
  head: { appendChild() {} },
}


// ── 假 ctx ──────────────────────────────────────────────────────────────────
const sections = []
const dicts = new Map()
const ctx = {
  effect(fn) { return fn() },
  locale: {
    register(namespace, dictionary) { dicts.set(namespace, dictionary) },
    bind(namespace) { return key => dicts.get(namespace)?.zh?.[key] ?? key },
  },
  slots: {
    inject(name, callback) { callback(); return () => {} },
    register(options, component) { sections.push({ options, component }); return () => {} },
  },
}

plugin.apply(ctx)

assert.equal(sections.length, 1, 'exactly one settings section should be registered')
const section = sections[0]
assert.equal(section.options.name, 'settings.section')
assert.equal(section.options.id, 'voice')
assert.equal(section.options.order, 64)
assert.ok(dicts.has(section.options.locale), 'locale dictionary must be registered')
const zh = dicts.get(section.options.locale).zh
const en = dicts.get(section.options.locale).en
assert.equal(zh.nav, '语音')
assert.equal(en.nav, 'Voice')
for (const key of Object.keys(zh)) assert.ok(key in en, 'en is missing ' + key)
for (const key of Object.keys(en)) assert.ok(key in zh, 'zh is missing ' + key)

// ── 假后端 ──────────────────────────────────────────────────────────────────
const snapshot = {
  ok: true,
  config: {
    enabled: true,
    apiKeySet: true,
    voiceId: 'voc_u3nxkd5578wc',
    modelId: 'breeze-tts-2',
    languageCode: '',
    instructions: '',
    outputFormat: 'mp3',
    speed: 1,
    volume: 1,
    guidanceScale: 1,
    speakerBoost: false,
    withTimestamps: false,
    outputDir: '/Users/example/.dsh/dsh-breeze-voice/audio',
    maxChars: 1000,
    timeoutMs: 20000,
    formats: ['mp3', 'wav', 'flac', 'opus', 'aac', 'pcm'],
    configFile: '/Users/example/.dsh/dsh-breeze-voice/config.json',
  },
  status: {
    enabled: true,
    ready: true,
    apiKeySet: true,
    voiceId: 'voc_u3nxkd5578wc',
    outDir: '/Users/example/.dsh/dsh-breeze-voice/audio',
    lastError: '',
    lastAt: new Date(Date.now() - 300000).toISOString(),
    count: 3,
    node: 'v24.11.1',
  },
}

const calls = []
globalThis.fetch = async (url, init) => {
  const method = init?.method ?? 'GET'
  const body = init?.body ? JSON.parse(init.body) : null
  calls.push({ url: String(url), method, body })
  let payload
  if (String(url).endsWith('/test')) {
    payload = { ok: true, path: '/Users/example/.dsh/dsh-breeze-voice/audio/breeze-20261109-233500-abc123.mp3', name: 'breeze-20261109-233500-abc123.mp3', mime: 'audio/mpeg', bytes: 20480, words: 0 }
  } else if (method === 'POST') {
    Object.assign(snapshot.config, body)
    if (body.apiKey !== undefined) snapshot.config.apiKeySet = body.apiKey !== ''
    if (body.clearApiKey === true) snapshot.config.apiKeySet = false
    payload = { ...snapshot, changed: Object.keys(body), restarted: false }
  } else {
    payload = JSON.parse(JSON.stringify(snapshot))
  }
  const text = JSON.stringify(payload)
  return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) }
}

// ── 渲染直到稳定 ────────────────────────────────────────────────────────────
const instance = { hooks: [], cursor: 0, dirty: false }
current = instance

/** 把函数组件就地展开成宿主元素树；纯展示组件不碰 hook 游标。 */
function expand(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(expand)
  const { type, props } = node
  if (typeof type === 'function') {
    if (type.prototype && type.prototype.isReactComponent) {
      const instance = new type(props)
      instance.props = props
      return expand(instance.render())
    }
    return expand(type(props))
  }
  if (props?.children === undefined) return node
  return { ...node, props: { ...props, children: expand(props.children) } }
}

async function settle(component, props, rounds = 8) {
  let tree = null
  for (let round = 0; round < rounds; round += 1) {
    instance.cursor = 0
    instance.dirty = false
    tree = expand(component(props))
    while (pending.length > 0) pending.shift()()
    await new Promise(resolve => setTimeout(resolve, 0))
    if (!instance.dirty) break
  }
  return tree
}

function textOf(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  const { children } = node.props ?? {}
  return textOf(children)
}

function findAll(node, predicate, out = []) {
  if (node === null || node === undefined || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) findAll(child, predicate, out); return out }
  if (predicate(node)) out.push(node)
  findAll(node.props?.children, predicate, out)
  return out
}


// ── 断言 ────────────────────────────────────────────────────────────────────
let tree = await settle(section.component, { t: ctx.locale.bind(section.options.locale) })
assert.ok(tree, 'component rendered nothing')
assert.equal(calls[0]?.url, '/api/dsh-breeze-voice', 'first request should be the plugin API')

let text = textOf(tree)
for (const expected of ['语音', '就绪', 'voc_u3nxkd5578wc', 'API key', '音色 ID', '演绎指令', '试听', 'config.json', '已设置']) {
  assert.ok(text.includes(expected), 'missing copy: ' + expected)
}

const inputs = findAll(tree, node => node.type === 'input')
assert.ok(inputs.some(node => node.props.type === 'password'), 'api key should be a password field')
assert.equal(findAll(tree, node => node.type === 'select').length, 1, 'one format select')
assert.ok(findAll(tree, node => node.type === 'select')[0].props.children.length >= 6, 'all formats listed')
const switches = findAll(tree, node => node.props?.className === 'bv_switch')
assert.ok(switches.length >= 3, 'enabled / speakerBoost / timestamps switches')
assert.equal(switches[0].props['data-on'], 'true')
const numberInputs = inputs.filter(node => node.props.type === 'number')
assert.equal(numberInputs.length, 5, 'speed, volume, guidance, maxChars, timeout')

// 打字进试听框 → 合成
const testInput = inputs.find(node => node.props.placeholder === zh['test.placeholder'])
assert.ok(testInput, 'test input missing')
testInput.props.onChange({ target: { value: '你好呀' } })
tree = await settle(section.component, { t: ctx.locale.bind(section.options.locale) })
const runButton = findAll(tree, node => node.type === 'button').find(node => textOf(node) === zh['test.run'])
assert.ok(runButton, 'synthesize button missing')
assert.equal(findAll(tree, node => node.props?.className === 'bv_savebar').length, 0, 'typing a test line must not dirty the config')
runButton.props.onClick()
await new Promise(resolve => setTimeout(resolve, 10))
tree = await settle(section.component, { t: ctx.locale.bind(section.options.locale) })
const testCall = calls.find(call => call.url === '/api/dsh-breeze-voice/test')
assert.ok(testCall, 'should POST /test')
assert.deepEqual(testCall.body, { text: '你好呀' })
const audio = findAll(tree, node => node.type === 'audio')[0]
assert.ok(audio, 'audio element should appear after synthesis')
assert.equal(audio.props.src, '/api/dsh-breeze-voice/audio/breeze-20261109-233500-abc123.mp3')
text = textOf(tree)
assert.ok(text.includes('已合成 20480 字节'), 'result copy: ' + text.slice(0, 200))

// 改语速 → 出现保存条 → 保存
const speedInput = numberInputs[0]
speedInput.props.onChange({ target: { value: '1.6' } })
tree = await settle(section.component, { t: ctx.locale.bind(section.options.locale) })
const savebar = findAll(tree, node => node.props?.className === 'bv_savebar')
assert.equal(savebar.length, 1, 'save bar should appear when dirty')
assert.ok(textOf(savebar[0]).includes(zh['unsaved']), 'unsaved notice')
const saveButton = findAll(savebar[0], node => node.type === 'button').find(node => textOf(node) === zh.save)
assert.ok(saveButton, 'save button missing')
saveButton.props.onClick()
await new Promise(resolve => setTimeout(resolve, 10))
tree = await settle(section.component, { t: ctx.locale.bind(section.options.locale) })
const patchCall = calls.filter(call => call.url === '/api/dsh-breeze-voice' && call.method === 'POST')[0]
assert.ok(patchCall, 'should POST the patch')
assert.equal(patchCall.body.speed, 1.6)
assert.equal(patchCall.body.apiKey, undefined, 'empty key must not be sent')
assert.equal(findAll(tree, node => node.props?.className === 'bv_savebar').length, 0, 'save bar clears after save')
assert.ok(textOf(tree).includes(zh.saved), 'saved notice')

// 开关只改草稿，跟文本框一起保存
const enabledSwitch = findAll(tree, node => node.props?.className === 'bv_switch')[0]
enabledSwitch.props.onClick()
tree = await settle(section.component, { t: ctx.locale.bind(section.options.locale) })
assert.equal(findAll(tree, node => node.props?.className === 'bv_savebar').length, 1, 'toggling should dirty the form')
const saveButton2 = findAll(tree, node => node.type === 'button').find(node => textOf(node) === zh.save)
saveButton2.props.onClick()
await new Promise(resolve => setTimeout(resolve, 10))
tree = await settle(section.component, { t: ctx.locale.bind(section.options.locale) })
const toggleCall = calls.filter(call => call.method === 'POST' && call.body.enabled === false)[0]
assert.ok(toggleCall, 'switch should be saved with the patch')

// 错误态：加载失败时有重试
{
  const good = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('boom') }
  try {
    const t2 = ctx.locale.bind(section.options.locale)
    instance.hooks.length = 0
    const errorTree = await settle(section.component, { t: t2 })
    assert.ok(textOf(errorTree).includes(zh['loadFailed']), 'error state copy')
    assert.ok(findAll(errorTree, node => textOf(node) === zh.retry).length >= 1, 'retry button')
  } finally {
    globalThis.fetch = good
  }
}

console.log('client-render: all assertions passed')
process.exit(0)
