<template>
  <el-dialog :model-value="modelValue" title="本地演示数据与多端同步" width="560px" @update:model-value="emit('update:modelValue', $event)">
    <div class="bf-hint">
      当前为「本地演示模式」：数据保存在浏览器 LocalStorage，通过 BroadcastChannel 在**同一浏览器的多个标签页**之间同步。
      这不是云端多人协同，也不会与其他人共享数据。
    </div>

    <el-descriptions :column="1" border class="desc">
      <el-descriptions-item label="组织">{{ db.org.name }}</el-descriptions-item>
      <el-descriptions-item label="数据模式">本地演示模式（无后端）</el-descriptions-item>
      <el-descriptions-item label="数据修订号">#{{ db.meta.revision }}</el-descriptions-item>
      <el-descriptions-item label="存储占用">
        <el-progress
          :percentage="Math.round(usage.ratio * 1000) / 10"
          :stroke-width="8"
          :status="usage.ratio > 0.8 ? 'exception' : undefined"
        />
        <span class="bf-sub">{{ fmtBytes(usage.bytes) }} / 5 MB（浏览器 LocalStorage 上限）</span>
      </el-descriptions-item>
      <el-descriptions-item label="最近跨标签页同步">
        {{ lastRemoteSync ? fromNow(lastRemoteSync) : '尚未收到其他标签页的变更' }}
      </el-descriptions-item>
      <el-descriptions-item label="同步事件计数">{{ remoteEventCount }} 次</el-descriptions-item>
    </el-descriptions>

    <div class="bf-hint warn actions-hint">
      大型示波器波形（数十 MB）不适合浏览器存储。演示环境限制单文件 ≤ 2MB，真实项目需接入对象存储与后端数据库。
    </div>

    <template #footer>
      <div class="footer">
        <el-button @click="exportJson">导出本地数据 JSON</el-button>
        <el-button @click="reload">从本地存储重新载入</el-button>
        <el-button type="danger" plain @click="reset">恢复初始演示数据</el-button>
        <el-button type="primary" @click="emit('update:modelValue', false)">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { db, loadDb, storageUsage } from '@/services/db'
import { useWorkspaceStore } from '@/stores/workspace'
import { fmtBytes, fromNow } from '@/utils/format'
import { downloadText } from '@/utils/csv'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const workspace = useWorkspaceStore()
const usage = computed(() => storageUsage())
const lastRemoteSync = computed(() => workspace.lastRemoteSync)
const remoteEventCount = computed(() => workspace.remoteEventCount)

const reload = () => {
  loadDb()
  ElMessage.success('已从 LocalStorage 重新载入本地演示数据')
}

const reset = async () => {
  await ElMessageBox.confirm(
    '恢复初始演示数据会覆盖当前所有本地修改（项目、执行、缺陷等），且不可撤销。是否继续？',
    '恢复演示数据',
    { type: 'warning', confirmButtonText: '确认恢复', cancelButtonText: '取消' },
  )
  workspace.reset()
  ElMessage.success('已恢复初始演示数据')
  emit('update:modelValue', false)
}

const exportJson = () => {
  downloadText(`benchflow-local-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), 'application/json')
}
</script>

<style scoped>
.desc {
  margin: 14px 0;
}
.actions-hint {
  margin-top: 4px;
}
.footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
