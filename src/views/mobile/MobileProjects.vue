<template>
  <div class="m-page">
    <header class="m-head">
      <h1>我的项目</h1>
      <p>{{ projects.length }} 个项目 · 点击查看完整项目视图</p>
    </header>

    <div class="cards">
      <article v-for="project in projects" :key="project.id" class="proj">
        <header class="p-head">
          <div>
            <div class="p-code mono">{{ project.code }}</div>
            <h2>{{ project.name }}</h2>
          </div>
          <StatusPill :label="projectStatus.get(project.status).label" :tone="projectStatus.get(project.status).tone" />
        </header>
        <p class="p-desc">{{ project.description }}</p>
        <div class="p-progress">
          <div class="bf-between">
            <span class="bf-sub">项目进度</span>
            <span class="bf-sub">{{ projectService.stats(project.id).progress }}%</span>
          </div>
          <el-progress :percentage="projectService.stats(project.id).progress" :stroke-width="6" :show-text="false" />
        </div>
        <div class="p-stats">
          <div><b class="num">{{ projectService.stats(project.id).passRate }}%</b><span>通过率</span></div>
          <div><b class="num">{{ projectService.stats(project.id).runCount }}</b><span>执行</span></div>
          <div><b class="num" :class="{ danger: projectService.stats(project.id).openDefects > 0 }">{{ projectService.stats(project.id).openDefects }}</b><span>缺陷</span></div>
        </div>
        <footer class="p-foot">
          <div class="bf-avatar-stack">
            <UserAvatar
              v-for="member in membersOf(project.memberIds)"
              :key="member.id"
              :name="member.name"
              :color="member.color"
              size="sm"
            />
          </div>
          <div class="actions">
            <router-link :to="`/mobile/record`" class="mini primary">记录</router-link>
            <router-link :to="`/mobile/projects/${project.id}`" class="mini">详情</router-link>
          </div>
        </footer>
      </article>
      <EmptyState v-if="projects.length === 0" text="没有可访问的项目" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { db } from '@/services/db'
import { projectService } from '@/services/projectService'
import { useAppStore } from '@/stores/app'
import StatusPill from '@/components/common/StatusPill.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { projectStatus } from '@/utils/format'
import type { Member } from '@/types'

const app = useAppStore()

const projects = computed(() => app.visibleProjects)
const membersOf = (ids: string[]): Member[] =>
  ids.map((id) => db.members.find((m) => m.id === id)).filter(Boolean) as Member[]
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

.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.proj {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.p-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}

.p-code {
  font-size: 10.5px;
  color: var(--bf-primary);
}

.p-head h2 {
  font-size: 13.5px;
  font-weight: 620;
  margin-top: 1px;
  line-height: 1.4;
}

.p-desc {
  font-size: 11.5px;
  color: var(--bf-ink-2);
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.p-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px dashed var(--bf-border);
  border-bottom: 1px dashed var(--bf-border);
  padding: 7px 0;
}

.p-stats > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  border-right: 1px solid var(--bf-border);
}

.p-stats > div:last-child {
  border-right: none;
}

.p-stats b {
  font-size: 15px;
  font-weight: 620;
}

.p-stats b.danger {
  color: var(--bf-danger);
}

.p-stats span {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.p-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions {
  display: flex;
  gap: 6px;
}

.mini {
  border: 1px solid var(--bf-border);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11.5px;
  color: var(--bf-ink-2);
  background: #fff;
}

.mini.primary {
  background: var(--bf-primary);
  border-color: var(--bf-primary);
  color: #fff;
}
</style>
