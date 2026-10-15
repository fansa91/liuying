<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="8">
        <v-text-field
          v-model="wd"
          label="搜索片名"
          prepend-inner-icon="mdi-magnify"
          clearable
          density="comfortable"
          @keyup.enter="doSearch"
        />
      </v-col>
      <v-col cols="12" md="4" class="d-flex align-center">
        <v-btn color="primary" :loading="loading" @click="doSearch">搜索</v-btn>
      </v-col>
    </v-row>

    <div class="mb-4">
      <v-chip
        v-for="s in sources"
        :key="s.id"
        :color="selected.includes(s.id) ? 'primary' : undefined"
        class="ma-1"
        filter
        @click="toggle(s.id)"
      >
        {{ s.name }}
      </v-chip>
      <span class="text-caption text-medium-emphasis ml-2">不选 = 搜索全部源</span>
    </div>

    <template v-for="g in grouped" :key="g.source">
      <h3 class="text-h6 mt-4 mb-2">
        {{ g.sourceName }}
        <span class="text-caption text-medium-emphasis">({{ g.items.length }})</span>
      </h3>
      <v-row>
        <v-col v-for="v in g.items" :key="v.id" cols="4" sm="3" md="2">
          <v-card @click="goDetail(v)">
            <QueuedImage :src="v.pic" aspect="3/4" />
            <v-card-text class="pa-2">
              <div class="text-truncate font-weight-medium">{{ v.name }}</div>
              <div class="text-caption text-medium-emphasis text-truncate">{{ v.remarks }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-alert v-if="searched && !results.length" type="info" variant="tonal" class="mt-4">
      没有搜到结果
    </v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, type SourceInfo, type VideoItem } from '../api'
import QueuedImage from '../components/QueuedImage.vue'

const router = useRouter()
const sources = ref<SourceInfo[]>([])
const selected = ref<string[]>([])
const wd = ref('')
const results = ref<VideoItem[]>([])
const loading = ref(false)
const searched = ref(false)

const grouped = computed(() => {
  const map = new Map<string, { source: string; sourceName: string; items: VideoItem[] }>()
  for (const v of results.value) {
    let g = map.get(v.source)
    if (!g) {
      g = { source: v.source, sourceName: v.sourceName, items: [] }
      map.set(v.source, g)
    }
    g.items.push(v)
  }
  return [...map.values()]
})

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
}

async function doSearch() {
  if (!wd.value.trim()) return
  loading.value = true
  try {
    results.value = await api.search(wd.value.trim(), selected.value)
  } finally {
    loading.value = false
    searched.value = true
  }
}

function goDetail(v: VideoItem) {
  router.push({ name: 'detail', query: { source: v.source, id: v.id } })
}

onMounted(async () => {
  sources.value = await api.sources()
})
</script>
