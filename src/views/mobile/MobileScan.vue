<template>
  <div class="m-page">
    <header class="m-head">
      <h1>扫码进入</h1>
      <p>扫描项目 / 设备二维码，快速进入现场任务</p>
    </header>

    <div class="scan-box">
      <div class="corners">
        <span /><span /><span /><span />
      </div>
      <ScanLine :size="42" class="scan-icon" />
      <p>将二维码放入框内（演示环境无摄像头调用）</p>
      <button type="button" class="scan-btn" @click="simulate">模拟扫码</button>
    </div>

    <section class="m-card">
      <header class="m-card-head"><h2>手动输入项目编号</h2></header>
      <div class="manual">
        <el-input v-model="code" size="large" placeholder="例如 P-2401" @keyup.enter="lookup" />
        <el-button size="large" type="primary" @click="lookup">进入</el-button>
      </div>
      <div v-if="message" class="msg">{{ message }}</div>
    </section>

    <section class="m-card" v-if="scannedProject">
      <header class="m-card-head">
        <h2>{{ scannedProject.name }}</h2>
        <StatusPill :label="projectStatus.get(scannedProject.status).label" :tone="projectStatus.get(scannedProject.status).tone" />
      </header>
      <div class="proj-body">
        <div class="p-row"><span>项目编号</span><b class="mono">{{ scannedProject.code }}</b></div>
        <div class="p-row"><span>负责人</span><b>{{ memberName(scannedProject.ownerId) }}</b></div>
        <div class="p-row"><span>测试计划</span><b>{{ planCount }} 个</b></div>
        <div class="p-row"><span>未关闭缺陷</span><b>{{ openDefects }}</b></div>
      </div>
      <div class="p-actions">
        <router-link to="/mobile/record" class="p-btn primary">创建测试记录</router-link>
        <router-link :to="`/projects/${scannedProject.id}`" class="p-btn">项目详情</router-link>
      </div>
    </section>

    <section class="m-card">
      <header class="m-card-head"><h2>最近项目</h2></header>
      <router-link v-for="project in db.projects.slice(0, 3)" :key="project.id" :to="`/projects/${project.id}`" class="recent">
        <span class="mono">{{ project.code }}</span>
        <span class="name">{{ project.name }}</span>
        <ChevronRight :size="14" />
      </router-link>
    </section>

    <div class="tip">
      <Info :size="13" />
      真实小程序中使用 wx.scanCode 获取二维码内容；设备二维码采用 benchflow://device/DEV-001 形式（演示）。
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, Info, ScanLine } from 'lucide-vue-next'
import type { Project } from '@/types'
import { db } from '@/services/db'
import StatusPill from '@/components/common/StatusPill.vue'
import { projectStatus } from '@/utils/format'

const code = ref('')
const message = ref('')
const scannedProject = ref<Project | null>(null)

const simulate = () => {
  const project = db.projects.find((p) => p.status === 'active') ?? db.projects[0]
  if (!project) return
  scannedProject.value = project
  code.value = project.code
  message.value = `已识别二维码：benchflow://project/${project.code}`
}

const lookup = () => {
  const value = code.value.trim().toUpperCase()
  if (!value) {
    message.value = '请输入项目编号'
    return
  }
  const project = db.projects.find((p) => p.code.toUpperCase() === value || p.name.includes(value))
  if (!project) {
    scannedProject.value = null
    message.value = `未找到项目 ${value}。演示数据中的项目编号：${db.projects.map((p) => p.code).join('、')}`
    return
  }
  scannedProject.value = project
  message.value = ''
}

const planCount = computed(() => (scannedProject.value ? db.plans.filter((p) => p.projectId === scannedProject.value!.id).length : 0))
const openDefects = computed(() =>
  scannedProject.value ? db.defects.filter((d) => d.projectId === scannedProject.value!.id && d.status !== 'closed').length : 0,
)
const memberName = (id: string) => db.members.find((m) => m.id === id)?.name ?? id
</script>

<style scoped>
.m-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.m-head h1 {
  font-size: 18px;
  font-weight: 650;
}

.m-head p {
  font-size: 11px;
  color: var(--bf-ink-3);
  margin-top: 3px;
}

.scan-box {
  background: #14202e;
  border-radius: 10px;
  padding: 26px 18px;
  color: #c9d6e3;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
}

.corners span {
  position: absolute;
  width: 22px;
  height: 22px;
  border: 2px solid #4aa08a;
}

.corners span:nth-child(1) {
  top: 16px;
  left: 16px;
  border-right: none;
  border-bottom: none;
}

.corners span:nth-child(2) {
  top: 16px;
  right: 16px;
  border-left: none;
  border-bottom: none;
}

.corners span:nth-child(3) {
  bottom: 16px;
  left: 16px;
  border-right: none;
  border-top: none;
}

.corners span:nth-child(4) {
  bottom: 16px;
  right: 16px;
  border-left: none;
  border-top: none;
}

.scan-icon {
  color: #7fa5c2;
}

.scan-box p {
  font-size: 11px;
  color: #93a8bd;
  text-align: center;
}

.scan-btn {
  border: 1px solid #3b566e;
  background: #223449;
  color: #e3edf6;
  border-radius: 5px;
  padding: 7px 18px;
  font-size: 12px;
  font-family: inherit;
}

.m-card {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.m-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.m-card-head h2 {
  font-size: 12.8px;
  font-weight: 620;
}

.manual {
  display: flex;
  gap: 8px;
}

.msg {
  font-size: 11.5px;
  color: var(--bf-ink-3);
  line-height: 1.55;
}

.proj-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.p-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.p-row span {
  color: var(--bf-ink-3);
}

.p-actions {
  display: flex;
  gap: 8px;
}

.p-btn {
  flex: 1;
  text-align: center;
  border: 1px solid var(--bf-primary);
  color: var(--bf-primary);
  border-radius: 5px;
  padding: 8px;
  font-size: 12px;
  background: #fff;
}

.p-btn.primary {
  background: var(--bf-primary);
  color: #fff;
}

.recent {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--bf-border);
  color: var(--bf-ink);
  font-size: 12px;
}

.recent:last-child {
  border-bottom: none;
}

.recent .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tip {
  display: flex;
  gap: 6px;
  font-size: 10.5px;
  color: var(--bf-ink-3);
  line-height: 1.55;
  padding: 0 2px;
}
</style>
