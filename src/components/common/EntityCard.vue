<template>
  <article class="entity-card" :class="{ selected }" @click="emit('click')">
    <header class="ec-head">
      <div class="ec-title">
        <strong>{{ title }}</strong>
        <span>{{ subtitle }}</span>
      </div>
      <slot name="badge" />
    </header>
    <div v-if="$slots.default" class="ec-body">
      <slot />
    </div>
    <footer v-if="$slots.actions" class="ec-foot">
      <slot name="actions" />
    </footer>
  </article>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; subtitle?: string; selected?: boolean }>(), {
  subtitle: '',
  selected: false,
})

const emit = defineEmits<{ click: [] }>()
</script>

<style scoped>
.entity-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 7px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  cursor: pointer;
}

.entity-card:hover {
  border-color: var(--bf-border-strong);
  box-shadow: var(--bf-shadow-sm);
}

.entity-card.selected {
  border-color: var(--bf-primary);
  background: #fbfcfe;
}

.ec-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.ec-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ec-title strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-title span {
  font-size: 10.8px;
  color: var(--bf-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11.5px;
  color: var(--bf-ink-2);
  min-width: 0;
}

.ec-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  border-top: 1px solid var(--bf-border);
  padding-top: 8px;
  margin-top: auto;
}
</style>
