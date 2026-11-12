# BenchFlow 部署说明

适用于：GitHub Pages 静态部署（当前） / 任意静态文件服务器。

---

## 1. 前置条件

- Node.js ≥ 20（CI 使用 20）
- npm ≥ 10
- 仓库默认分支 `main`

---

## 2. 本地运行

```bash
npm install
npm run dev
# http://127.0.0.1:5178
```

> `vite.config.ts` 将开发端口固定为 5178，仅绑定 `127.0.0.1`，避免与既有项目冲突。

### 生产构建

```bash
npm run build
npm run preview   # 预览 dist
```

`build` 先执行 `vue-tsc --noEmit`，类型错误会阻止产物生成。

### 质量门禁

```bash
npm run typecheck
npm run lint
npm run test
```

---

## 3. GitHub Pages 自动部署

### 3.1 仓库设置

1. 将项目推送到 GitHub，默认分支为 `main`。
2. 打开 **Settings → Pages**。
3. **Build and deployment → Source** 选择 **GitHub Actions**（不要选 “Deploy from a branch”）。
4. 不需要手动设置 base 或环境变量。

### 3.2 工作流

`.github/workflows/deploy.yml`：

```text
push(main) / workflow_dispatch
  └─ build job
       checkout → setup-node(20, npm cache) → npm ci
       → typecheck → lint → test → build
       → configure-pages → upload-pages-artifact(dist)
  └─ deploy job（environment: github-pages）
       → deploy-pages
```

权限：`contents: read`、`pages: write`、`id-token: write`；并发组 `pages` 会取消旧部署。

### 3.3 路径与刷新

- `vite.config.ts` 使用 `base: './'`，资源相对路径，兼容 `https://<user>.github.io/<repo>/`。
- 路由使用 `createWebHashHistory`，地址形如 `.../#/projects/P-2401`，刷新不会 404。
- 不需要 404.html 回退，也不依赖服务器 rewrite。

### 3.4 访问

部署完成后：

```text
https://<user>.github.io/<repo>/
https://<user>.github.io/<repo>/#/mobile/home
https://<user>.github.io/<repo>/#/station
```

首页会进入演示身份选择（`#/login`）；可直接选择“测试负责人视角”。

---

## 4. 其他静态托管

构建产物 `dist/` 可直接部署到 Nginx、OSS、COS、Vercel、Netlify 等：

```nginx
server {
  listen 80;
  root /var/www/benchflow;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

因为是 hash 路由，实际上不需要 rewrite；保留 `try_files` 可兼容未来切换 history 模式。

---

## 5. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 页面白屏、资源 404 | Pages Source 选成了分支部署；改选 GitHub Actions，确认工作流成功 |
| 刷新后 404 | 误用了 history 路由；本项目已使用 hash，检查是否改动 `createWebHashHistory` |
| 图标/字体异常 | 无外链字体；检查是否被 CSP 拦截内联样式 |
| 数据为空 | LocalStorage 被清理或 schema 升级；进入「系统设置 → 数据管理 → 恢复初始演示数据」 |
| 多标签页不同步 | 浏览器禁用了 BroadcastChannel；`storage` 事件仍生效，刷新即可 |
| 上传提示超限 | 演示环境单文件 ≤ 2MB；大文件需后端对象存储 |
| 打印为空白 | 打印样式仅保留 `.print-area`；请在报告详情页打印 |
| CI 失败于 lint | 本地先执行 `npm run lint`；规则见 `eslint.config.js` |
| CI 失败于 test | 本地 `npm run test`；测试不依赖浏览器 |

---

## 6. 回滚

- 在 Actions 中找到上一次成功的部署记录，重新运行该 commit 的 workflow。
- 或在本地 `git revert` 后推送，触发自动部署。
- Pages 不保留历史版本，需以 commit 为单位回滚。

---

## 7. 安全与合规

- 不提交任何密钥、Token、真实客户数据；`.env*` 已在 `.gitignore` 中忽略。
- 演示数据均为虚构（BenchFlow Demo Lab）。
- 前端权限不是安全边界；接入后端前，不得将本演示用于真实客户数据处理。
- 恢复演示数据会覆盖本地修改，操作前有二次确认。

---

## 8. 部署验收清单

- [ ] `npm ci` 成功
- [ ] `npm run typecheck` 通过
- [ ] `npm run lint` 无错误/警告
- [ ] `npm run test` 全部通过
- [ ] `npm run build` 生成 `dist/index.html` 与 `dist/assets/*`
- [ ] Actions 的 build 与 deploy 均为绿色
- [ ] 访问首页可进入，刷新任意 hash 路由不 404
- [ ] 移动端与工位模式可打开（顶部“终端预览”）
- [ ] 数据刷新后保留，恢复演示数据可用

> 当前仓库未配置远程地址，未执行 `git push`；请在你的 GitHub 仓库按上述步骤启用 Pages。部署是否成功以 Actions 与线上访问为准，不以本地构建替代。
