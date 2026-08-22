import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { setupInstall } from './lib/install.js'

setupInstall()
createApp(App).mount('#app')
