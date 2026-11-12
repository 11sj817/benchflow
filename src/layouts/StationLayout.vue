<template>
  <div class="station-shell">
    <header class="station-top">
      <div class="left">
        <span class="logo">BF</span>
        <div>
          <strong>BenchFlow 工位模式</strong>
          <span>A-01 电气测试台 · 平板演示界面</span>
        </div>
      </div>
      <div class="right">
        <span class="station-chip"><span class="dot" /> 设备已连接（模拟）</span>
        <router-link class="exit" to="/dashboard">退出工位模式</router-link>
      </div>
    </header>
    <main class="station-body">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// 平板工位模式：面向实验室现场录入，独立布局与更大的触控目标。
</script>

<style scoped>
.station-shell {
  min-height: 100vh;
  background: #eef1f5;
  display: flex;
  flex-direction: column;
}

.station-top {
  height: 62px;
  background: #1a2b3d;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px;
  gap: 14px;
  flex-wrap: wrap;
}

.left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: #2f7f8f;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10.5px;
  font-weight: 700;
}

.left div {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.left strong {
  font-size: 13.5px;
}

.left span {
  font-size: 10.5px;
  color: #93a8bd;
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.station-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #365066;
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 11px;
  color: #b9cddd;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #46a58c;
}

.exit {
  color: #d6e2ee;
  font-size: 12px;
  border: 1px solid #365066;
  border-radius: 5px;
  padding: 4px 10px;
}

.exit:hover {
  background: #24384c;
  text-decoration: none;
}

.station-body {
  flex: 1;
  padding: 18px 22px 28px;
  min-width: 0;
}

@media (max-width: 720px) {
  .station-top {
    height: auto;
    padding: 10px 14px;
  }

  .station-body {
    padding: 12px;
  }
}
</style>
