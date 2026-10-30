import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { setupInstall } from './lib/install.js'
import { setupAutoUpdate } from './lib/appUpdate.js'
import { trackUsage } from './utils/usage.js'
import './utils/screenPin.js' // keeps the bug button at the real bottom of the screen (iOS cuts the page short)

// One anonymous ping per open → Bug Desk's Visitors tab (house module).
trackUsage('rewatchr')

setupInstall()
setupAutoUpdate()
createApp(App).mount('#app')
