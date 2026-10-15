<template>
  <div ref="container" class="player-wrap"></div>
</template>

<script setup lang="ts">
import Artplayer from 'artplayer'
import Hls from 'hls.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ url: string; title?: string }>()
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
