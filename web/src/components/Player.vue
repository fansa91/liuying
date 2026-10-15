<template>
  <div ref="container" class="player-wrap"></div>
</template>

<script setup lang="ts">
import Artplayer from 'artplayer'
import Hls from 'hls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ url: string; title?: string; startPosition?: number }>()
const emit = defineEmits<{
  (e: 'position', payload: { url: string; position: number }): void
}>()
const container = ref<HTMLDivElement>()
let art: Artplayer | null = null

function create() {
  if (!container.value || !props.url) return
  art?.destroy()
  art = new Artplayer({
    container: container.value,
    url: props.url,
    title: props.title ?? '',
    autoplay: true,
    fullscreen: true,
    fullscreenWeb: true,
    pip: true,
    setting: true,
    playbackRate: true,
    aspectRatio: true,
    hotkey: true,
    // m3u8 用 hls.js 接管, Safari 等原生支持的走原生
    customType: {
      m3u8(video: HTMLVideoElement, url: string, art: Artplayer) {
        if (Hls.isSupported()) {
          const hls = new Hls()
          hls.loadSource(url)
          hls.attachMedia(video)
          ;(art as any).hls = hls
          art.on('destroy', () => hls.destroy())
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url
        }
      },
    },
  })

  // 断点续播 + 进度上报 (给播放历史用)
  let seeked = false
  let lastEmit = 0
  const emitPos = () => {
    lastEmit = Math.floor(art!.currentTime)
    emit('position', { url: props.url, position: lastEmit })
  }
  art.on('video:loadedmetadata', () => {
    if (!seeked && (props.startPosition ?? 0) > 1) {
      seeked = true
      art!.seek(props.startPosition!)
    }
  })
  art.on('video:timeupdate', () => {
    if (Math.floor(art!.currentTime) - lastEmit >= 5) emitPos()
  })
  art.on('video:pause', emitPos)
}

onMounted(create)
watch(() => props.url, create)
onBeforeUnmount(() => art?.destroy())
</script>

<style scoped>
.player-wrap {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}
</style>
