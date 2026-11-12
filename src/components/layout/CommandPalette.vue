<template>
  <Teleport to="body">
    <div v-if="modelValue" class="cmdk-overlay" @mousedown.self="close">
      <div class="cmdk" role="dialog" aria-label="全局搜索与快捷操作">
        <div class="cmdk-input">
          <Search :size="18" />
          <input
            ref="inputRef"
            v-model="keyword"
            placeholder="搜索项目、需求、计划、用例、执行、缺陷、产品、设备、数据、报告…"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="runActive"
            @keydown.esc.prevent="close"
          />
          <kbd>ESC</kbd>
        </div>

        <div class="cmdk-body">
          <template v-if="!keyword.trim()">
            <div class="cmdk-section-title">快捷操作</div>
            <button
              v-for="(action, index) in actions"
              :key="action.key"
              type="button"
              class="cmdk-row"
              :class="{ active: activeIndex === index }"
              @mouseenter="activeIndex = index"
              @click="runAction(action)"
            >
              <span class="row-icon"><component :is="action.icon" :size="16" /></span>
              <span class="row-body">
                <strong>{{ action.label }}</strong>
                <span>{{ action.hint }}</span>
              </span>
              <span class="row-shortcut">{{ action.shortcut }}</span>
            </button>
          </template>

          <template v-else>
            <div class="cmdk-section-title">
              搜索结果 <span>{{ hits.length }}</span>
            </div>
            <button
              v-for="(hit, index) in hits"
              :key="`${hit.type}-${hit.id}`"
              type="button"
              class="cmdk-row"
              :class="{ active: activeIndex === index }"
              @mouseenter="activeIndex = index"
              @click="runHit(hit)"
            >
              <span class="type-badge">{{ hit.typeLabel }}</span>
              <span class="row-body">
                <strong>{{ hit.title }}</strong>
                <span>{{ hit.subtitle }}</span>
              </span>
              <CornerDownLeft :size="14" class="enter-icon" />
            </button>
            <div v-if="hits.length === 0" class="cmdk-empty">
              没有匹配结果。可以尝试项目编号（P-2401）、执行编号（RUN-0017）或缺陷标题。
            </div>
          </template>
        </div>

        <footer class="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 打开</span>
          <span><kbd>Ctrl</kbd> + <kbd>K</kbd> 随时唤起</span>
          <span class="grow" />
          <span>本地演示数据 · 仅当前浏览器</span>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Component } from 'vue'
import {
  Bug,
  CalendarPlus,
  ClipboardPlus,
  CornerDownLeft,
  FileText,
  FlaskConical,
  FolderPlus,
  ListPlus,
  Search,
  Upload,
} from 'lucide-vue-next'
import { db } from '@/services/db'
import { useAppStore } from '@/stores/app'
import { buildSearchIndex, searchIndex } from '@/utils/search'
import type { SearchHit } from '@/utils/search'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const router = useRouter()
const app = useAppStore()

interface PaletteAction {
  key: string
  label: string
  hint: string
  shortcut: string
  icon: Component
  to: string
  permission?: 'create'
}

const ALL_ACTIONS: PaletteAction[] = [
  { key: 'project', label: '创建项目', hint: '建立新的研发项目与成员', shortcut: 'P', icon: FolderPlus, to: '/projects?create=1' },
  { key: 'requirement', label: '创建需求', hint: '录入需求并关联验收标准', shortcut: 'R', icon: ListPlus, to: '/requirements?create=1' },
  { key: 'plan', label: '创建测试计划', hint: '选择产品版本与测试用例', shortcut: 'T', icon: CalendarPlus, to: '/test-plans?create=1' },
  { key: 'case', label: '创建测试用例', hint: '配置步骤、测量参数与阈值', shortcut: 'C', icon: FlaskConical, to: '/test-cases/new' },
  { key: 'record', label: '创建测试记录', hint: '移动端分步录入，自动判定', shortcut: 'M', icon: ClipboardPlus, to: '/mobile/record' },
  { key: 'defect', label: '提交缺陷', hint: '现场异常快速建单', shortcut: 'B', icon: Bug, to: '/defects?create=1' },
  { key: 'dataset', label: '上传数据', hint: 'CSV / 图片 / 报告附件', shortcut: 'U', icon: Upload, to: '/datasets?upload=1' },
  { key: 'report', label: '生成报告', hint: '基于计划 / 执行 / 版本数据', shortcut: 'G', icon: FileText, to: '/reports?create=1' },
]

const actions = computed(() => ALL_ACTIONS.filter(() => app.can('create')))
const keyword = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const index = computed(() => buildSearchIndex(db))

const hits = computed(() => {
  if (!keyword.value.trim()) return [] as SearchHit[]
  const rows = searchIndex(index.value, keyword.value, 30)
  if (!app.isGuest) return rows.slice(0, 20)
  return rows.filter((hit) => hit.type === 'project' || hit.type === 'report').slice(0, 20)
})

const reset = () => {
  keyword.value = ''
  activeIndex.value = 0
}

const close = () => emit('update:modelValue', false)

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    reset()
    await nextTick()
    inputRef.value?.focus()
  },
)

watch(keyword, () => {
  activeIndex.value = 0
})

const move = (offset: number) => {
  const total = keyword.value.trim() ? hits.value.length : actions.value.length
  if (total === 0) return
  activeIndex.value = (activeIndex.value + offset + total) % total
}

const runHit = (hit: SearchHit) => {
  close()
  router.push(hit.to)
}

const runAction = (action: PaletteAction) => {
  close()
  router.push(action.to)
}

const runActive = () => {
  if (keyword.value.trim()) {
    const hit = hits.value[activeIndex.value]
    if (hit) runHit(hit)
    return
  }
  const action = actions.value[activeIndex.value]
  if (action) runAction(action)
}
</script>

<style scoped>
.cmdk-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(12, 20, 30, 0.42);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 12vh 16px 16px;
}

.cmdk {
  width: 100%;
  max-width: 680px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 24px 80px rgba(10, 18, 28, 0.32);
  overflow: hidden;
  border: 1px solid rgba(20, 32, 46, 0.08);
}

.cmdk-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--bf-border);
  color: var(--bf-ink-3);
}

.cmdk-input input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  font-family: inherit;
  color: var(--bf-ink);
  background: transparent;
}

kbd {
  border: 1px solid var(--bf-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0 5px;
  font-size: 10px;
  font-family: var(--bf-mono);
  color: var(--bf-ink-3);
  background: var(--bf-surface-2);
}

.cmdk-body {
  max-height: 54vh;
  overflow-y: auto;
  padding: 6px;
}

.cmdk-section-title {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  letter-spacing: 0.06em;
  padding: 8px 10px 4px;
  display: flex;
  gap: 6px;
}

.cmdk-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.cmdk-row.active {
  background: var(--bf-primary-soft);
}

.row-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--bf-surface-3);
  color: var(--bf-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.row-body strong {
  font-size: 12.8px;
  font-weight: 600;
  color: var(--bf-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-body span {
  font-size: 11.2px;
  color: var(--bf-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-shortcut {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  border: 1px solid var(--bf-border);
  border-radius: 4px;
  padding: 1px 6px;
  font-family: var(--bf-mono);
}

.type-badge {
  font-size: 10px;
  color: var(--bf-primary);
  background: var(--bf-primary-soft);
  border-radius: 3px;
  padding: 2px 6px;
  flex: none;
  min-width: 36px;
  text-align: center;
}

.enter-icon {
  color: var(--bf-ink-3);
  flex: none;
}

.cmdk-empty {
  padding: 26px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--bf-ink-3);
  line-height: 1.7;
}

.cmdk-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid var(--bf-border);
  background: var(--bf-surface-2);
  font-size: 10.5px;
  color: var(--bf-ink-3);
  flex-wrap: wrap;
}

.cmdk-foot span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.grow {
  flex: 1;
}

@media (max-width: 700px) {
  .cmdk-overlay {
    padding: 8vh 10px 10px;
  }

  .cmdk-foot .grow,
  .cmdk-foot span:last-child {
    display: none;
  }
}
</style>
