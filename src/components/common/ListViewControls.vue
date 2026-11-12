<template>
  <div class="list-controls">
    <span v-if="selection" class="selection">已选 {{ selection }} 项</span>
    <slot name="bulk" />

    <button type="button" class="ctl-btn" :class="{ active: advanced }" @click="emit('update:advanced', !advanced)">
      <SlidersHorizontal :size="14" />
      高级筛选
      <span v-if="activeCount" class="count">{{ activeCount }}</span>
    </button>

    <el-dropdown trigger="click" @command="onSavedCommand">
      <button type="button" class="ctl-btn" :disabled="savedViews.length === 0">
        <Bookmark :size="14" />
        筛选方案
        <span v-if="savedViews.length" class="count">{{ savedViews.length }}</span>
        <ChevronDown :size="12" />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-for="view in savedViews" :key="view.name" :command="`apply:${view.name}`">
            应用：{{ view.name }}
          </el-dropdown-item>
          <el-dropdown-item v-if="savedViews.length === 0" disabled>暂无保存的筛选方案</el-dropdown-item>
          <el-dropdown-item v-for="view in savedViews" :key="`del-${view.name}`" :command="`delete:${view.name}`" divided>
            删除：{{ view.name }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <button type="button" class="ctl-btn" @click="saveCurrent">
      <Bookmark :size="14" /> 保存筛选
    </button>

    <button v-if="activeCount" type="button" class="ctl-btn clear" @click="emit('clear')">
      <X :size="13" /> 清空
    </button>

    <div class="view-toggle" role="group" aria-label="视图切换">
      <button type="button" :class="{ active: view === 'table' }" title="表格视图" @click="emit('update:view', 'table')">
        <List :size="15" />
      </button>
      <button type="button" :class="{ active: view === 'cards' }" title="卡片视图" @click="emit('update:view', 'cards')">
        <LayoutGrid :size="15" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bookmark, ChevronDown, LayoutGrid, List, SlidersHorizontal, X } from 'lucide-vue-next'
import type { SavedView, ViewMode } from '@/composables/useListView'

const props = defineProps<{
  view: ViewMode
  advanced: boolean
  savedViews: SavedView[]
  activeCount: number
  selection?: number
}>()

const emit = defineEmits<{
  'update:view': [ViewMode]
  'update:advanced': [boolean]
  save: [string]
  apply: [SavedView]
  clear: []
  'delete-view': [string]
}>()

const onSavedCommand = (command: string) => {
  const [action, ...rest] = command.split(':')
  const name = rest.join(':')
  const row = props.savedViews.find((view) => view.name === name)
  if (action === 'apply' && row) emit('apply', row)
  if (action === 'delete') emit('delete-view', name)
}

const saveCurrent = async () => {
  try {
    const { value } = await ElMessageBox.prompt('为当前筛选条件命名，便于下次快速恢复。', '保存筛选方案', {
      inputPlaceholder: '例如：我的电源项目 / 本周失败执行',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    if (!value?.trim()) {
      ElMessage.warning('请输入方案名称')
      return
    }
    emit('save', value.trim())
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.list-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.selection {
  font-size: 11px;
  color: var(--bf-primary);
  background: var(--bf-primary-soft);
  border-radius: 3px;
  padding: 2px 7px;
  font-variant-numeric: tabular-nums;
}

.ctl-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 5px;
  padding: 0 8px;
  font-family: inherit;
  font-size: 11.5px;
  color: var(--bf-ink-2);
  cursor: pointer;
}

.ctl-btn:hover {
  border-color: var(--bf-border-strong);
}

.ctl-btn.active {
  border-color: var(--bf-primary);
  color: var(--bf-primary);
  background: var(--bf-primary-soft);
}

.ctl-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.ctl-btn.clear {
  color: var(--bf-danger);
  border-color: transparent;
  background: transparent;
}

.count {
  font-size: 9.5px;
  background: var(--bf-primary);
  color: #fff;
  border-radius: 8px;
  padding: 0 5px;
  line-height: 14px;
}

.view-toggle {
  display: inline-flex;
  border: 1px solid var(--bf-border);
  border-radius: 5px;
  overflow: hidden;
}

.view-toggle button {
  width: 32px;
  height: 30px;
  border: none;
  background: #fff;
  color: var(--bf-ink-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.view-toggle button + button {
  border-left: 1px solid var(--bf-border);
}

.view-toggle button.active {
  background: var(--bf-primary-soft);
  color: var(--bf-primary);
}
</style>
