<template>
  <span
    class="bf-avatar"
    :class="size"
    :style="{ background: color }"
    :title="name"
  >{{ name.slice(-2) }}</span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; color?: string; size?: 'sm' | 'md' | 'lg' }>(), {
  color: '#1e3a5f',
  size: 'md',
})
</script>
