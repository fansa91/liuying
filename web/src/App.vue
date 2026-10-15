<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title class="font-weight-bold">流影</v-app-bar-title>
      <template #append>
        <v-btn icon="mdi-magnify" to="/search" />
        <v-btn icon="mdi-cog" to="/settings" />
      </template>
    </v-app-bar>

    <v-navigation-drawer permanent rail>
      <v-list nav>
        <v-list-item prepend-icon="mdi-home" title="首页" to="/" exact />
        <v-list-item prepend-icon="mdi-magnify" title="搜索" to="/search" />
        <v-list-item prepend-icon="mdi-history" title="历史" to="/history" />
        <v-list-item prepend-icon="mdi-database-cog" title="源管理" to="/sources" />
        <v-list-item prepend-icon="mdi-cog" title="设置" to="/settings" />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'
import { initTheme } from './theme'

// M3 主题色 / 深浅模式, 设置变化时自动重算
initTheme(useTheme())
</script>
