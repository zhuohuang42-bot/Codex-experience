# 拾光 · 学习时间记录

一个安静、轻量的中文学习计时网站。点击「开始学习」开始计时，点击「停止并保存」记录本次学习。在日历中选择日期，即可查看当天累计时长及每次专注明细。

## 本地运行

需要 Node.js 22.12+（也支持 Node.js 20.19+）。

```sh
npm ci
npm run dev
```

开发服务默认使用 5173 端口。生产构建运行 `npm run build`，输出在 `dist/`，可以部署到支持静态网站的托管服务；`npm run preview` 用于本地检查构建结果。

## 发布到 GitHub Pages

仓库已包含 `.github/workflows/deploy-pages.yml`，推送到 `main` 后会自动测试、构建并发布网站。

首次发布需要在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。这一步启用网站托管；Codex 中的「发布环境」用于保存开发环境，与网站上线是两个操作。

启用后，在 **Actions** 中确认 `Deploy study journal to GitHub Pages` 运行成功；若首次运行因 Pages 尚未启用而失败，启用后重新运行该工作流即可。实际访问网址以部署结果显示的地址为准。

构建资源使用相对路径，因此支持 GitHub Pages 的 `/Codex-experience/` 子目录。发布不需要给项目添加任何个人访问令牌或密钥。

云环境如果默认 npm 缓存目录不可写，可以使用：

```sh
npm ci --cache /workspace/.cache/npm
```

## 使用说明

- 开始后按真实经过的时间计时，切换标签页、刷新或关闭页面后仍会继续；结束学习时请点击「停止并保存」。
- 每次结束后的记录会自动累加；跨午夜的学习会按浏览器所在时区分配到对应日期。
- 日历颜色代表当天学习总时长：不足 30 分钟、30–59 分钟、1–2 小时、2 小时及以上。
- 数据仅存在当前浏览器的本地存储中，不上传服务器，也不会自动跨浏览器或跨设备同步。清除网站数据或无痕模式结束可能删除记录。
- 「导出记录」可下载每天累计时长的 CSV 表格，方便在 Excel 等软件中查看、留存。
- 同一浏览器的多个标签页共享一个计时器；在任一标签页停止会更新其余标签页。

## 验证

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

如果系统已经安装 Chromium，可以跳过浏览器下载：

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

单元测试覆盖跨午夜、夏令时、时长统计与存储校验；浏览器测试覆盖计时、刷新恢复、日历、CSV 导出、多标签页同步、存储错误和手机布局。
