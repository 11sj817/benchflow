<template>
  <div class="bf-page-header">
    <div class="head-text">
      <h1>
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="subtitle" class="sub">{{ subtitle }}</p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions" class="bf-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>()
</script>

<style scoped>
.head-text {
  min-width: 0;
}
</style>
