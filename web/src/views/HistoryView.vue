<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <h2 class="text-h6">播放历史</h2>
      <v-spacer />
      <v-btn v-if="items.length" variant="text" color="error" @click="clearAll">清空</v-btn>
    </div>

    <v-row v-if="items.length">
      <v-col v-for="h in items" :key="h.source + h.id" cols="4" sm="3" md="2">
        <v-card class="history-card" @click="goDetail(h)">
          <QueuedImage :src="h.pic" aspect="3/4" />
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            class="del-btn"
            @click.stop="remove(h)"
          />
          <v-card-text class="pa-2">
            <div class="text-truncate font-weight-medium">{{ h.name }}</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ h.episodeName }} · {{ timeAgo(h.updatedAt) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-alert v-else type="info" variant="tonal">还没有播放记录</v-alert>
  </v-container>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import QueuedImage from '../components/QueuedImage.vue'
import {
  clearHistory,
  getHistory,
  removeHistory,
  timeAgo,
  type HistoryItem,
} from '../history'

const router = useRouter()
const items = ref<HistoryItem[]>([])

function refresh() {
  items.value = getHistory()
}

function goDetail(h: HistoryItem) {
  router.push({ name: 'detail', query: { source: h.source, id: h.id } })
}

function remove(h: HistoryItem) {
  removeHistory(h.source, h.id)
  refresh()
}

function clearAll() {
  clearHistory()
  refresh()
}

onMounted(() => {
  refresh()
  // 其他设备同步下来的历史变更, 自动刷新列表
  window.addEventListener('liuying-history-changed', refresh)
})
onBeforeUnmount(() => {
  window.removeEventListener('liuying-history-changed', refresh)
})
</script>

<style scoped>
.history-card {
  position: relative;
}
.del-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5);
}
</style>
