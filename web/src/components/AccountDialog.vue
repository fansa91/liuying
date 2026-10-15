<template>
  <v-dialog v-model="show" max-width="420">
    <v-card>
      <template v-if="!loggedIn">
        <v-tabs v-model="tab" grow>
          <v-tab value="login">登录</v-tab>
          <v-tab value="register">注册</v-tab>
        </v-tabs>
        <v-card-text>
          <v-text-field v-model="username" label="用户名" density="comfortable" class="mb-2" />
          <v-text-field
            v-model="password"
            label="密码"
            type="password"
            density="comfortable"
            @keyup.enter="submit"
          />
          <div class="text-caption text-medium-emphasis mb-2">
            登录后播放历史、设置自动同步到云端, 源列表存在账号下多端一致。
            注册会自动继承服务端当前源列表。
          </div>
          <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="show = false">取消</v-btn>
          <v-btn color="primary" :loading="loading" @click="submit">
            {{ tab === 'login' ? '登录' : '注册' }}
          </v-btn>
        </v-card-actions>
      </template>

      <template v-else>
        <v-card-title>账号</v-card-title>
        <v-card-text>
          <div class="mb-1">
            当前用户: <b>{{ username }}</b>
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ lastSyncText }}
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" :loading="syncing" @click="doSync">立即同步</v-btn>
          <v-spacer />
          <v-btn variant="text" color="error" @click="logout">退出登录</v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { apiLogin, apiLogout, apiRegister, isLoggedIn, setToken } from '../auth'
import { getLastSyncAt, syncNow } from '../sync'

const show = ref(false)
const tab = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const syncing = ref(false)
const loggedIn = ref(isLoggedIn())
const displayName = ref(localStorage.getItem('liuying-username') ?? '')

const lastSyncText = computed(() => {
  const t = getLastSyncAt()
  if (!t) return '尚未同步'
  return `上次同步: ${new Date(t).toLocaleString()}`
})

function open() {
  loggedIn.value = isLoggedIn()
  displayName.value = localStorage.getItem('liuying-username') ?? ''
  error.value = ''
  show.value = true
}

async function submit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const r =
      tab.value === 'login'
        ? await apiLogin(username.value.trim(), password.value)
        : await apiRegister(username.value.trim(), password.value)
    setToken(r.token)
    localStorage.setItem('liuying-username', r.username)
    show.value = false
    // 登录后源列表变为账号维度, 整页刷新最稳
    location.reload()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function doSync() {
  syncing.value = true
  try {
    await syncNow()
  } finally {
    syncing.value = false
  }
}

async function logout() {
  await apiLogout()
  localStorage.removeItem('liuying-username')
  location.reload()
}

defineExpose({ open })
</script>
