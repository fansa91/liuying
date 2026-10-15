import { createRouter, createWebHistory } from 'vue-router'
import DetailView from '../views/DetailView.vue'
import HistoryView from '../views/HistoryView.vue'
import HomeView from '../views/HomeView.vue'
import PlayView from '../views/PlayView.vue'
import SearchView from '../views/SearchView.vue'
import SettingsView from '../views/SettingsView.vue'
import SourcesView from '../views/SourcesView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/detail', name: 'detail', component: DetailView },
    { path: '/play', name: 'play', component: PlayView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/sources', name: 'sources', component: SourcesView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})
