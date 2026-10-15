<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title class="font-weight-bold">流影</v-app-bar-title>
      <template #append>
        <v-btn icon="mdi-magnify" to="/search" />
        <v-btn
          :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
          @click="toggleTheme"
        />
      </template>
    </v-app-bar>

    <v-navigation-drawer permanent rail>
      <v-list nav>
        <v-list-item prepend-icon="mdi-home" title="首页" to="/" exact />
        <v-list-item prepend-icon="mdi-magnify" title="搜索" to="/search" />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useTheme } from 'vuetify'

const theme = useTheme()
function toggleTheme() {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
}
</script>
