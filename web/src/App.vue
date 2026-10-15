<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title class="font-weight-bold">流影</v-app-bar-title>
      <template #append>
        <v-btn icon="mdi-magnify" to="/search" />
        <v-btn icon="mdi-cog" to="/settings" />
        <v-btn
          :icon="loggedIn ? 'mdi-account-check' : 'mdi-account-outline'"
          :color="loggedIn ? 'primary' : undefined"
          @click="accountDlg?.open()"
        />
      </template>
    </v-app-bar>

    <v-navigation-drawer v-if="mdAndUp" permanent rail>
      <v-list nav>
        <v-list-item prepend-icon="mdi-home" title="首页" to="/" exact />
        <v-list-item prepend-icon="mdi-magnify" title="搜索" to="/search" />
        <v-list-item prepend-icon="mdi-history" title="历史" to="/history" />
        <v-list-item prepend-icon="mdi-database-cog" title="源管理" to="/sources" />
        <v-list-item prepend-icon="mdi-cog" title="设置" to="/settings" />
      </v-list>
    </v-navigation-drawer>

    <!-- 移动端: 底部导航 -->
    <v-bottom-navigation v-else :model-value="$route.name" grow color="primary">
      <v-btn value="home" to="/">
        <v-icon>mdi-home</v-icon>
        首页
      </v-btn>
      <v-btn value="search" to="/search">
        <v-icon>mdi-magnify</v-icon>
        搜索
      </v-btn>
      <v-btn value="history" to="/history">
        <v-icon>mdi-history</v-icon>
        历史
      </v-btn>
      <v-btn value="sources" to="/sources">
        <v-icon>mdi-database-cog</v-icon>
        源管理
      </v-btn>
      <v-btn value="settings" to="/settings">
        <v-icon>mdi-cog</v-icon>
        设置
      </v-btn>
    </v-bottom-navigation>

    <v-main>
      <router-view />
    </v-main>

    <AccountDialog ref="accountDlg" />
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
import AccountDialog from './components/AccountDialog.vue'
import { isLoggedIn } from './auth'
import { initTheme } from './theme'

// M3 主题色 / 深浅模式, 设置变化时自动重算
initTheme(useTheme())

// 桌面端用左侧 rail, 移动端 (<960px) 用底部导航
const { mdAndUp } = useDisplay()

const accountDlg = ref<InstanceType<typeof AccountDialog> | null>(null)
const loggedIn = isLoggedIn()
</script>
