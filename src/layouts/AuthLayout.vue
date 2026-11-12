<template>
  <div class="auth">
    <section class="brand-side">
      <div class="brand-line">
        <div class="logo">BF</div>
        <div>
          <strong>BenchFlow</strong>
          <span>Hardware R&amp;D Test Management</span>
        </div>
      </div>
      <div class="pitch">
        <h1>硬件研发测试管理与多端协作平台</h1>
        <p>把测试计划、测试执行、测量数据、缺陷闭环与质量报告放在同一条可追溯链路上。</p>
        <ul>
          <li><span class="num">01</span> 项目 · 产品版本 · 测试条件一一绑定</li>
          <li><span class="num">02</span> 执行 → 缺陷 → 回归 → 关闭 完整闭环</li>
          <li><span class="num">03</span> PC / 移动端 / 平板工位三种使用场景</li>
        </ul>
      </div>
      <div class="foot">
        <span class="dot" /> 本地演示模式 · 数据仅保存在当前浏览器
      </div>
    </section>
    <section class="form-side">
      <router-view />
    </section>
  </div>
</template>

<script setup lang="ts">
// 登录布局：仅用于演示身份选择，不含真实认证。
</script>

<style scoped>
.auth {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(420px, 520px);
  background: #fff;
}

.brand-side {
  background: #14202e;
  color: #dbe6f1;
  padding: 40px 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
}

.brand-side::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 36px 36px;
  pointer-events: none;
}

.brand-line {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  background: #1f6f8b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}

.brand-line strong {
  display: block;
  font-size: 16px;
  color: #fff;
}

.brand-line span {
  font-size: 10.5px;
  color: #7f93a8;
  letter-spacing: 0.04em;
}

.pitch {
  position: relative;
  z-index: 1;
  max-width: 460px;
}

.pitch h1 {
  font-size: 27px;
  line-height: 1.35;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.01em;
}

.pitch p {
  margin-top: 14px;
  font-size: 13px;
  line-height: 1.7;
  color: #a9bccf;
}

.pitch ul {
  list-style: none;
  padding: 0;
  margin: 26px 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pitch li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #c6d5e3;
}

.pitch .num {
  font-family: var(--bf-mono);
  font-size: 10px;
  color: #6fa5a0;
  border: 1px solid #2c4553;
  border-radius: 3px;
  padding: 1px 5px;
}

.foot {
  font-size: 11px;
  color: #7f93a8;
  display: flex;
  align-items: center;
  gap: 7px;
  position: relative;
  z-index: 1;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d9a441;
}

.form-side {
  padding: 48px 44px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .auth {
    grid-template-columns: minmax(0, 1fr);
  }

  .brand-side {
    display: none;
  }

  .form-side {
    padding: 28px 20px;
  }
}
</style>
