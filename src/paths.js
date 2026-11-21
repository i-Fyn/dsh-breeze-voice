/**
 * 路径：本插件的落盘位置都从这里来。
 * @module dsh-breeze-voice/src/paths
 */
import os from 'node:os'
import path from 'node:path'

/** DSH 数据目录：优先 DSH_HOME，否则 ~/.dsh。 */
export function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return path.resolve(fromEnv)
  return path.join(os.homedir(), '.dsh')
}

/** 本插件的数据目录（默认 ~/.dsh/dsh-breeze-voice）。 */
export function resolveDataDir() {
  return path.join(resolveDshHome(), 'dsh-breeze-voice')
}

/** 展开 ~ 前缀。 */
export function expandHome(value) {
  if (typeof value !== 'string' || value === '') return value
  if (value === '~') return os.homedir()
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2))
  return value
}
