<template>
  <div class="bf-empty">
    <div class="icon"><Inbox :size="22" /></div>
    <p>{{ text }}</p>
    <p v-if="hint" class="hint">{{ hint }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'

withDefaults(defineProps<{ text?: string; hint?: string }>(), {
  text: '暂无数据',
})
</script>

<style scoped>
.icon {
  display: inline-flex;
  color: var(--bf-ink-3);
  margin-bottom: 6px;
}
.hint {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  margin-top: 4px;
}
</style>
