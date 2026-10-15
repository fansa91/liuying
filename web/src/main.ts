import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { initSync } from './sync'

createApp(App).use(router).use(vuetify).mount('#app')

// 账号同步: 设置变化自动推, 启动/每5分钟/回前台自动拉
initSync()
