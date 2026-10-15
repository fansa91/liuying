<template>
  <v-container>
    <h2 class="text-h6 mb-4">源管理</h2>

    <v-text-field
      v-model="token"
      label="管理密钥 (服务端设置 ADMIN_TOKEN 后必填, 否则留空)"
      type="password"
      density="comfortable"
      class="mb-4"
      style="max-width: 480px"
      @change="saveToken"
    />

    <v-btn color="primary" prepend-icon="mdi-plus" class="mb-4" @click="openAdd">添加源</v-btn>

    <v-list lines="two" class="rounded-lg">
      <v-list-item v-for="s in sources" :key="s.id" :title="s.name" :subtitle="s.api">
        <template #append>
          <v-btn icon="mdi-pencil" variant="text" @click="openEdit(s)" />
          <v-btn icon="mdi-delete" variant="text" color="error" @click="confirmDelete(s)" />
        </template>
      </v-list-item>
      <v-list-item v-if="!sources.length" title="还没有源, 点上面添加一个吧" />
    </v-list>

    <v-dialog v-model="dialog" max-width="560">
      <v-card>
        <v-card-title>{{ editing ? '编辑源' : '添加源' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="源名称" density="comfortable" class="mb-2" />
          <v-text-field
            v-model="form.api"
            label="采集接口地址 (AppleCMS 格式)"
            placeholder="https://example.com/api.php/provide/vod"
            density="comfortable"
          />
          <v-alert v-if="testResult" :type="testResult.ok ? 'success' : 'error'" variant="tonal" class="mt-2">
            {{ testResult.ok ? `连接成功, 读取到 ${testResult.types} 个分类` : `连接失败: ${testResult.error}` }}
          </v-alert>
          <v-alert v-if="formError" type="error" variant="tonal" class="mt-2">{{ formError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" :loading="testing" @click="doTest">测试连接</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" :loading="saving" @click="doSave">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title>删除源</v-card-title>
        <v-card-text>确定删除「{{ deleting?.name }}」吗?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog = false">取消</v-btn>
          <v-btn color="error" :loading="saving" @click="doDelete">删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="2500">{{ snackbarText }}</v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminToken, api, type SourceInfo } from '../api'

const sources = ref<SourceInfo[]>([])
const token = ref(adminToken.get())

const dialog = ref(false)
const editing = ref<SourceInfo | null>(null)
const form = ref({ name: '', api: '' })
const testing = ref(false)
const saving = ref(false)
const testResult = ref<{ ok: boolean; types?: number; error?: string } | null>(null)
const formError = ref('')

const deleteDialog = ref(false)
const deleting = ref<SourceInfo | null>(null)

const snackbar = ref(false)
const snackbarText = ref('')

function saveToken() {
  adminToken.set(token.value.trim())
}

async function load() {
  sources.value = await api.sources()
}

function openAdd() {
  editing.value = null
  form.value = { name: '', api: '' }
  testResult.value = null
  formError.value = ''
  dialog.value = true
}

async function openEdit(s: SourceInfo) {
  editing.value = s
  form.value = { name: s.name, api: s.api ?? '' }
  testResult.value = null
  formError.value = ''
  dialog.value = true
}

async function doTest() {
  if (!form.value.api.trim()) return
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await api.testSource(form.value.api.trim())
  } catch (e: any) {
    testResult.value = { ok: false, error: e.message }
  } finally {
    testing.value = false
  }
}

async function doSave() {
  formError.value = ''
  if (!form.value.name.trim() || !form.value.api.trim()) {
    formError.value = '名称和接口地址都要填'
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await api.updateSource(editing.value.id, form.value.name.trim(), form.value.api.trim())
      snackbarText.value = '已保存'
    } else {
      await api.addSource(form.value.name.trim(), form.value.api.trim())
      snackbarText.value = '已添加'
    }
    dialog.value = false
    snackbar.value = true
    await load()
  } catch (e: any) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function confirmDelete(s: SourceInfo) {
  deleting.value = s
  deleteDialog.value = true
}

async function doDelete() {
  if (!deleting.value) return
  saving.value = true
  try {
    await api.deleteSource(deleting.value.id)
    snackbarText.value = '已删除'
    snackbar.value = true
    deleteDialog.value = false
    await load()
  } catch (e: any) {
    snackbarText.value = e.message
    snackbar.value = true
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
