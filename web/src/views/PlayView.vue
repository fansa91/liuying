<template>
  <v-container>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2" @click="goDetail">返回详情</v-btn>
    <v-row>
      <v-col cols="12" md="8">
        <Player
          v-if="playUrl"
          :key="playUrl"
          :url="playUrl"
          :title="`${detail?.name ?? ''} ${currentEp?.name ?? ''}`"
          :start-position="startPosition"
          @position="onPosition"
        />
        <v-skeleton-loader v-else type="image" />

        <v-tabs v-model="groupIdx" class="mt-2" show-arrows>
          <v-tab v-for="(g, i) in detail?.plays" :key="i" :value="i">{{ g.from }}</v-tab>
        </v-tabs>
        <div class="d-flex flex-wrap ga-2 mt-3">
          <v-chip
            v-for="(ep, i) in episodes"
            :key="i"
            :color="epIdx === i ? 'primary' : undefined"
            @click="epIdx = i"
          >
            {{ ep.name }}
          </v-chip>
        </div>
      </v-col>

      <v-col cols="12" md="4">
        <v-card v-if="detail" variant="tonal">
          <v-card-title>{{ detail.name }}</v-card-title>
          <v-card-subtitle>{{ detail.year }} · {{ detail.type }} · {{ detail.remarks }}</v-card-subtitle>
          <v-card-text class="content">{{ detail.content }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Episode, type VideoDetail } from '../api'
import Player from '../components/Player.vue'
import { findHistory, saveHistory } from '../history'
import { settings } from '../settings'
import { queueSync } from '../sync'

const route = useRoute()
const router = useRouter()
const source = String(route.query.source ?? '')
const id = String(route.query.id ?? '')

// 历史断点: 无明确指定集数时回到上次看的集
const h = findHistory(source, id)
const qGroup = route.query.group !== undefined ? Number(route.query.group) : undefined
const qEp = route.query.ep !== undefined ? Number(route.query.ep) : undefined

const detail = ref<VideoDetail | null>(null)
const groupIdx = ref(qGroup ?? h?.groupIndex ?? 0)
const epIdx = ref(qEp ?? h?.episodeIndex ?? 0)
const startPosition = ref(
  h && h.groupIndex === groupIdx.value && h.episodeIndex === epIdx.value ? h.position : 0,
)

const episodes = computed<Episode[]>(() => detail.value?.plays[groupIdx.value]?.episodes ?? [])
const currentEp = computed(() => episodes.value[epIdx.value])
const rawUrl = computed(() => currentEp.value?.url ?? '')
const playUrl = computed(() => {
  if (!rawUrl.value) return ''
  return settings.proxyPlay ? api.proxied(rawUrl.value) : rawUrl.value
})

function recordHistory(position: number) {
  if (!detail.value || !currentEp.value) return
  saveHistory({
    source,
    sourceName: detail.value.sourceName,
    id,
    name: detail.value.name,
    pic: detail.value.pic,
    remarks: detail.value.remarks,
    groupIndex: groupIdx.value,
    groupName: detail.value.plays[groupIdx.value]?.from ?? '',
    episodeIndex: epIdx.value,
    episodeName: currentEp.value.name,
    position,
    updatedAt: Date.now(),
  })
  // 有账号登录时, 播放记录变动后自动同步
  queueSync()
}

function onPosition(p: { url: string; position: number }) {
  // 只接受当前在播实例的上报, 防止旧实例销毁时覆盖新记录
  if (p.url === playUrl.value) recordHistory(p.position)
}

function goDetail() {
  router.push({ name: 'detail', query: { source, id } })
}

watch(groupIdx, () => {
  epIdx.value = 0
})
watch([groupIdx, epIdx], () => {
  // detail 还没加载时的赋值 (越界修正) 不记历史
  if (!detail.value) return
  startPosition.value = 0
  recordHistory(0)
})

onMounted(async () => {
  if (!source || !id) return
  const d = await api.detail(source, id)
  // 历史集数越界时回落到 0 (detail 赋值前做, 避免触发上面的 watcher)
  let g = groupIdx.value
  let e = epIdx.value
  if (g >= d.plays.length) g = 0
  if (e >= (d.plays[g]?.episodes.length ?? 0)) e = 0
  const resume = h && h.groupIndex === g && h.episodeIndex === e
  groupIdx.value = g
  epIdx.value = e
  startPosition.value = resume ? h.position : 0
  detail.value = d
  recordHistory(startPosition.value)
})
</script>

<style scoped>
.content {
  white-space: pre-line;
  max-height: 60vh;
  overflow-y: auto;
}
</style>
