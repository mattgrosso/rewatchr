import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { setupInstall } from './lib/install.js'
import { setupAutoUpdate } from './lib/appUpdate.js'

setupInstall()
setupAutoUpdate()
createApp(App).mount('#app')
