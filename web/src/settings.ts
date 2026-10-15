import { reactive, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Settings {
  /** 图片是否经服务器代理加载 */
  proxyImage: boolean
  /** 播放链接是否经服务器代理 */
  proxyPlay: boolean
  themeMode: ThemeMode
  /** M3 seed color */
  seedColor: string
}

const KEY = 'liuying-settings'

const defaults: Settings = {
  proxyImage: false,
  proxyPlay: false,
  themeMode: 'dark',
  seedColor: '#6750A4',
}

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...defaults }
  }
}

/** 全局设置, 响应式 + 自动持久化到 localStorage */
export const settings = reactive<Settings>(load())

watch(
  settings,
  (v) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)
