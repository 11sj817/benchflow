<template>
  <div class="station-shell">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// 平板工位模式使用独立全屏布局；连接状态与头信息统一由 StationView 呈现，
// 避免出现两个头栏或把模拟连接误写成真实仪器连接。
</script>

<style scoped>
.station-shell {
  min-height: 100vh;
  background: #eef2f7;
  padding: 14px;
  box-sizing: border-box;
}

@media (max-width: 760px) {
  .station-shell {
    padding: 8px;
  }
}
</style>
