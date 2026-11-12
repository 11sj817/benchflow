<template>
  <span class="bf-pill" :class="tone">
    <span v-if="dot" class="bf-dot" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type { Tone } from '@/utils/format'

withDefaults(defineProps<{ label: string; tone?: Tone; dot?: boolean }>(), {
  tone: 'neutral',
  dot: false,
})
</script>
