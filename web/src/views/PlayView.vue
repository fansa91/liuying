<template>
  <v-container>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2" @click="$router.back()">返回</v-btn>
    <v-row>
      <v-col cols="12" md="8">
        <Player
          v-if="playUrl"
          :key="playUrl"
          :url="playUrl"
          :title="`${detail?.name ?? ''} ${currentEp?.name ?? ''}`"
        />
        <v-skeleton-loader v-else type="image" />

        <div class="d-flex align-center mt-3 ga-2 flex-wrap">
          <v-switch v-model="useProxy" label="经服务器代理播放" density="compact" hide-details color="primary" />
          <span class="text-caption text-medium-emphasis">直连播不了 (跨域 / 防盗链) 时打开</span>
        </div>

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
import { useRoute } from 'vue-router'
import { api, type Episode, type VideoDetail } from '../api'
import Player from '../components/Player.vue'

const route = useRoute()
const detail = ref<VideoDetail | null>(null)
const groupIdx = ref(0)
const epIdx = ref(0)
const useProxy = ref(false)

const episodes = computed<Episode[]>(() => detail.value?.plays[groupIdx.value]?.episodes ?? [])
const currentEp = computed(() => episodes.value[epIdx.value])
const rawUrl = computed(() => currentEp.value?.url ?? '')
const playUrl = computed(() => {
  if (!rawUrl.value) return ''
  return useProxy.value ? api.proxied(rawUrl.value) : rawUrl.value
})

watch(groupIdx, () => {
  epIdx.value = 0
})

onMounted(async () => {
  const source = String(route.query.source ?? '')
  const id = String(route.query.id ?? '')
  if (!source || !id) return
  detail.value = await api.detail(source, id)
})
</script>

<style scoped>
.content {
  white-space: pre-line;
  max-height: 60vh;
  overflow-y: auto;
}
</style>
