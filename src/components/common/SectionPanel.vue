<template>
  <section class="bf-panel">
    <header v-if="title || $slots.actions" class="bf-panel-header">
      <div class="title-wrap">
        <h2>{{ title }}</h2>
        <span v-if="subtitle" class="sub">{{ subtitle }}</span>
      </div>
      <div v-if="$slots.actions" class="bf-row">
        <slot name="actions" />
      </div>
    </header>
    <div class="bf-panel-body" :class="{ flush }">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string; flush?: boolean }>()
</script>

<style scoped>
.title-wrap {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.sub {
  color: var(--bf-ink-3);
  font-size: 11.5px;
  font-weight: 400;
}
</style>
