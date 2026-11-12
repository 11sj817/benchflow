import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@/styles/tokens.css'
import '@/styles/global.css'
import App from './App.vue'
import router from './router'
import { useAppStore } from './stores/app'
import { useWorkspaceStore } from './stores/workspace'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(ElementPlus, { locale: zhCn })

const appStore = useAppStore(pinia)
appStore.bootstrap()
useWorkspaceStore(pinia).init()

app.use(router)
app.mount('#app')
