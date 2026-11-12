<template>
  <div class="m-page">
    <header class="m-head">
      <div>
        <h1>消息中心</h1>
        <p>未读 {{ unread }} 条 · 演示通知</p>
      </div>
      <button type="button" class="mark-all" @click="markAll">全部已读</button>
    </header>

    <div class="list">
      <button
        v-for="notice in notices"
        :key="notice.id"
        type="button"
        class="notice"
        :class="{ unread: !notice.read }"
        @click="open(notice)"
      >
        <span class="kind" :class="notice.kind" />
        <span class="body">
          <strong>{{ notice.title }}</strong>
          <span class="text">{{ notice.body }}</span>
          <span class="time">{{ fromNow(notice.at) }}</span>
        </span>
        <span v-if="!notice.read" class="dot" />
      </button>
      <EmptyState v-if="notices.length === 0" text="暂无消息" />
    </div>

    <div class="tip">真实部署后，消息将由服务端推送并通过微信订阅消息 / 企业微信发送。</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { notificationService } from '@/services/orgService'
import { useAppStore } from '@/stores/app'
import EmptyState from '@/components/common/EmptyState.vue'
import { fromNow } from '@/utils/format'
import { toMobileLink } from '@/utils/mobileLink'

const router = useRouter()
const app = useAppStore()

const notices = computed(() => notificationService.list(app.currentUser.id))
const unread = computed(() => notificationService.unread(app.currentUser.id))

const markAll = () => notificationService.markAllRead(app.currentUser.id)

const open = (notice: { id: string; read: boolean; link?: string }) => {
  if (!notice.read) notificationService.markRead(notice.id)
  if (notice.link) router.push(toMobileLink(notice.link))
}
</script>

<style scoped>
.m-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.m-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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

.mark-all {
  border: 1px solid var(--bf-border);
  background: #fff;
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 11px;
  color: var(--bf-ink-2);
  font-family: inherit;
}

.list {
  background: #fff;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  overflow: hidden;
}

.notice {
  display: flex;
  gap: 9px;
  width: 100%;
  text-align: left;
  padding: 11px 12px;
  border: none;
  border-bottom: 1px solid var(--bf-border);
  background: transparent;
  font-family: inherit;
  align-items: flex-start;
}

.notice:last-child {
  border-bottom: none;
}

.kind {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 5px;
  flex: none;
  background: #4a7ba7;
}

.kind.warning {
  background: #c07a1a;
}

.kind.danger {
  background: #b02a1f;
}

.kind.success {
  background: #157a5b;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.body strong {
  font-size: 12.3px;
  font-weight: 550;
  line-height: 1.4;
}

.body .text {
  font-size: 11px;
  color: var(--bf-ink-2);
  line-height: 1.5;
}

.body .time {
  font-size: 10px;
  color: var(--bf-ink-3);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b02a1f;
  margin-top: 5px;
  flex: none;
}

.tip {
  font-size: 10.5px;
  color: var(--bf-ink-3);
  padding: 0 2px;
  line-height: 1.5;
}
</style>
