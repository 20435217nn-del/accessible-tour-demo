# 零里说 · 无障碍在线导览

## 当前交付

- `index.html`：项目统一展示入口。双击后可进入离线交互 Demo 或项目级 PRD。
- `demo/index.html`：iPhone 16 离线交互 Demo，双击即可运行，不需要 npm、服务器或网络。
- `demo/原型说明.md`：当前 Demo 的点位、固定推荐、设备尺寸和交互边界。
- `demo/assets/figma-make/`：从 Figma Make 参考项目原样复制的17个 PNG，包括1张地图、15张讲解员图标和1张参考插画。
- `demo/screenshots/`：393×852、DPR 3 环境生成的1179×2556验收截图。
- `PRD.md`：整个项目的背景、用户需求、信息架构、产品需求、状态边界和推进责任真源。
- `brand-spec.md`：从 Figma Make 实现翻译出的临时视觉规范。
- `验收说明.md`：离线运行、自动验收和截图对照说明。
- `output/html/零里说-无障碍在线导览-PRD.html`：可视化项目级 PRD 网页。
- `output/pdf/零里说-无障碍在线导览-PRD.pdf`：稳定文件名的项目级 PRD PDF。

## 展示与分发

1. 双击项目根目录的 `index.html`。
2. 从左侧 Demo 卡片体验可点击导览，或从右侧 PRD 卡片阅读项目需求。
3. Demo 与 PRD 页面左侧均提供“项目首页”返回入口。
4. 对外分发时请压缩并发送**完整项目文件夹**，不要只发送 `index.html`；入口页、Demo、截图、脚本和图片通过相对路径离线加载。

## Demo 使用

1. 从项目首页点击“进入 Demo”；也可以直接双击 `demo/index.html`。
2. 顶部切换“讲解点 / 便民服务 / 无障碍服务”。
3. “讲解点”显示15个讲解员头像；点击底部“听讲解”可体验模拟定位和最近讲解点。
4. “便民服务”显示2个服务点和3个 WC 点，行李寄存仅在图例中注明“位置确认中”。
5. “无障碍服务”显示3个 WC 点和5个坡板点。
6. 点位采用两段式点击：第一次选中并显示名称，第二次进入讲解或服务详情；服务详情可启动示意语音辅助指引。
7. 讲解完成后选择“前往下一个讲解点”会先回到地图并打开下一站候选弹层；可跳过、听讲解或关闭后留在地图。

## 主设计尺寸

- CSS 逻辑画板：393×852
- 设备像素比：3
- 截图输出：1179×2556
- 320px 宽度：贴合视口并保持无横向溢出
- 桌面：393px 画板居中显示

## 参考与边界

- 项目级产品决策以 `PRD.md` 为真源；当前 Demo 实现细节以 `demo/原型说明.md` 为准。
- Demo 初始界面与素材参考 `C:\Users\10189\Downloads\无障碍在线导览界面设计`，但不定义正式产品的信息架构和技术方案。
- 地图、点位和路线均为示意信息，尚未完成现场走测。
- “可提供坡板”不等同于“完全无障碍”。
- Demo 不发起网络请求，不上传或保存定位信息。
- Lucide 图标许可与参考项目声明见 `demo/ATTRIBUTIONS.md`。

## 自动验收

```powershell
node scripts/verify_demo.mjs
node scripts/verify_prd_html.mjs
node scripts/verify_portal.mjs
python scripts/verify_prd_outputs.py
```

参考项目在 `http://127.0.0.1:5173/` 运行时，可继续执行：

```powershell
node scripts/capture_reference.mjs
node scripts/compare_screenshots.mjs
```
