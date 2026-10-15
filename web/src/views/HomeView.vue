<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md="4">
        <v-select
          v-model="sourceId"
          :items="sources"
          item-title="name"
          item-value="id"
          label="选择源"
          density="comfortable"
        />
      </v-col>
    </v-row>

    <v-tabs v-model="typeId" show-arrows class="mb-4">
      <v-tab v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</v-tab>
    </v-tabs>

    <v-row>
      <v-col v-for="v in videos" :key="v.source + v.id" cols="4" sm="3" md="2">
        <v-card @click="goPlay(v)">
          <v-img :src="v.pic" aspect-ratio="3/4" cover>
            <template #error>
              <v-sheet height="100%" color="surface-container" class="d-flex align-center justify-center">
                <v-icon>mdi-image-off</v-icon>
              </v-sheet>
            </template>
          </v-img>
          <v-card-text class="pa-2">
            <div class="text-truncate font-weight-medium">{{ v.name }}</div>
            <div class="text-caption text-medium-emphasis text-truncate">{{ v.remarks }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <div v-if="pagecount > 1" class="text-center my-6">
      <v-pagination v-model="page" :length="pagecount" :total-visible="7" />
    </div>
    <v-alert v-if="!videos.length && loaded" type="info" variant="tonal">
      该分类暂无数据, 换个源或分类试试
    </v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, type SourceInfo, type VideoItem, type VodType } from '../api'

const router = useRouter()
const sources = ref<SourceInfo[]>([])
const sourceId = ref('')
const types = ref<VodType[]>([])
const typeId = ref('')
const videos = ref<VideoItem[]>([])
const page = ref(1)
const pagecount = ref(1)
const loaded = ref(false)

async function loadSources() {
  sources.value = await api.sources()
  if (sources.value.length && !sourceId.value) sourceId.value = sources.value[0].id
}

async function loadTypes() {
  if (!sourceId.value) return
  types.value = await api.types(sourceId.value)
  typeId.value = types.value[0]?.id ?? ''
}

async function loadList() {
  if (!sourceId.value || !typeId.value) return
  loaded.value = false
  const d = await api.list(sourceId.value, typeId.value, page.value)
  videos.value = d.list
  pagecount.value = Math.min(d.pagecount, 50)
  loaded.value = true
}

function goPlay(v: VideoItem) {
  router.push({ name: 'play', query: { source: v.source, id: v.id } })
}

watch(sourceId, () => {
  page.value = 1
  loadTypes()
})
watch(typeId, () => {
  page.value = 1
  loadList()
})
watch(page, loadList)
onMounted(loadSources)
</script>
