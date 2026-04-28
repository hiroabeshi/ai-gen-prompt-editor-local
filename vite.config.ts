import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

export default defineConfig({
    base: '/ai-gen-prompt-editor-local/',
    plugins: [
        UnoCSS(),
        vue(),
    ],
})
