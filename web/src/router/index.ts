import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PlayView from '../views/PlayView.vue'
import SearchView from '../views/SearchView.vue'
import SourcesView from '../views/SourcesView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/play', name: 'play', component: PlayView },
    { path: '/sources', name: 'sources', component: SourcesView },
  ],
})
