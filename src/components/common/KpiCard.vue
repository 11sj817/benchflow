<template>
  <div class="bf-kpi" :class="tone ? `tone-${tone}` : undefined">
    <div class="label">
      <component :is="icon" v-if="icon" :size="14" />
      {{ label }}
    </div>
    <div class="value">
      {{ value }}<small v-if="unit">{{ unit }}</small>
    </div>
    <div v-if="foot || $slots.foot" class="foot">
      <slot name="foot">{{ foot }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  value: string | number
  unit?: string
  foot?: string
  tone?: 'danger' | 'warning' | 'success'
  icon?: Component
}>()
</script>
