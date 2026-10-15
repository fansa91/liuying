<template>
  <v-container>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="$router.back()">
      返回
    </v-btn>

    <div v-if="detail">
      <v-row>
        <v-col cols="4" sm="3" md="2">
          <QueuedImage :src="detail.pic" aspect="3/4" radius="12px" />
        </v-col>
        <v-col cols="8" sm="9" md="10">
          <h2 class="text-h5 font-weight-bold mb-2">{{ detail.name }}</h2>
          <div class="d-flex flex-wrap ga-2 mb-3">
            <v-chip v-if="detail.year" size="small">{{ detail.year }}</v-chip>
            <v-chip v-if="detail.type" size="small">{{ detail.type }}</v-chip>
            <v-chip v-if="detail.remarks" size="small">{{ detail.remarks }}</v-chip>
            <v-chip size="small" variant="outlined">{{ detail.sourceName }}</v-chip>
          </div>
          <p class="content text-body-2 text-medium-emphasis">{{ detail.content || '暂无简介' }}</p>
          <v-btn
            v-if="continueItem"
            color="primary"
            class="mt-4"
            prepend-icon="mdi-play"
            @click="playContinue"
          >
            继续播放 {{ continueItem.episodeName }}
          </v-btn>
        </v-col>
      </v-row>

      <v-tabs v-model="groupIdx" class="mt-6" show-arrows>
        <v-tab v-for="(g, i) in detail.plays" :key="i" :value="i">{{ g.from }}</v-tab>
      </v-tabs>
      <div class="d-flex flex-wrap ga-2 mt-4">
        <v-chip v-for="(ep, i) in episodes" :key="i" size="large" @click="play(i)">
          {{ ep.name }}
        </v-chip>
      </div>
    </div>
    <v-skeleton-loader v-else type="article" />
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Episode, type VideoDetail } from '../api'
import QueuedImage from '../components/QueuedImage.vue'
import { findHistory } from '../history'

const route = useRoute()
const router = useRouter()
const source = String(route.query.source ?? '')
const id = String(route.query.id ?? '')

const detail = ref<VideoDetail | null>(null)
const groupIdx = ref(0)
const episodes = computed<Episode[]>(() => detail.value?.plays[groupIdx.value]?.episodes ?? [])
const continueItem = computed(() => findHistory(source, id))

function play(ep: number) {
  router.push({
    name: 'play',
    query: { source, id, group: String(groupIdx.value), ep: String(ep) },
  })
}

function playContinue() {
  const c = continueItem.value
  if (!c) return
  router.push({
    name: 'play',
    query: { source, id, group: String(c.groupIndex), ep: String(c.episodeIndex) },
  })
}

onMounted(async () => {
  if (!source || !id) return
  detail.value = await api.detail(source, id)
})
</script>

<style scoped>
.content {
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
