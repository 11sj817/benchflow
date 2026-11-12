<template>
  <div class="notfound">
    <div class="code">404</div>
    <h1>页面不存在</h1>
    <p>链接可能已失效，或该页面在本地演示版本中尚未开放。</p>
    <div class="actions">
      <el-button type="primary" @click="router.push('/dashboard')">返回工作台</el-button>
      <el-button @click="router.back()">返回上一页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.notfound {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bf-bg);
  padding: 20px;
  text-align: center;
}

.code {
  font-family: var(--bf-mono);
  font-size: 52px;
  font-weight: 700;
  color: var(--bf-border-strong);
  letter-spacing: 0.04em;
}

h1 {
  font-size: 19px;
  font-weight: 650;
}

p {
  font-size: 12.5px;
  color: var(--bf-ink-3);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
</style>
