# Visual Story Editor

Visual Story Editor 是一个面向 RPG、互动小说和分支剧情设计的可视化编辑器。它使用 Vue 3、Pinia、TypeScript 和 Vite 构建，核心目标是把剧情节点、条件、随机分支、状态变更和运行预览放在同一个工作区里，让故事结构更容易被设计、验证和导出。

## 功能亮点

- 节点式剧情编辑：故事、选择、条件、随机、状态变更、战斗与结局节点。
- 运行时预览：在编辑器内模拟流程，检查分支与状态变化。
- 项目导入 / 导出：支持 JSON 项目文件与 Markdown 剧情文档导出。
- 本地草稿保存：降低误关页面造成的损失。
- AI 辅助文本生成入口：可配置 OpenAI 兼容服务生成剧情片段。
- 测试覆盖：包含运行时、表达式、导入导出、状态效果等 Vitest 测试。

## 项目结构

```text
.
├─ docs/                    # 设计文档与开发清单
├─ src/
│  ├─ ai/                   # AI 生成相关 schema、provider 与 prompt
│  ├─ components/           # 编辑器界面与节点组件
│  ├─ data/                 # 示例项目与空项目模板
│  ├─ domain/               # 剧情领域模型、表达式与状态效果
│  ├─ io/                   # 项目导入导出、校验、草稿存储
│  ├─ runtime/              # 流程执行与随机源
│  └─ stores/               # Pinia 状态管理
├─ tests/                   # Vitest 测试
├─ package.json
└─ vite.config.ts
```

## 本地运行

要求 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

默认本地地址为 `http://127.0.0.1:5173/`。

## 测试与构建

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

构建产物位于 `dist/`，可部署到任意静态站点服务，也可以用 `DistDesktopLauncher` 打包为 Windows 桌面启动器。

## 部署说明

静态部署时上传 `dist/` 目录即可。若部署在子路径，请按目标平台调整 Vite `base` 配置。前端本身不包含服务端，AI 生成功能需要用户自行提供兼容接口与 Key。

## 感谢与支持

感谢你关注这个编辑器。分支故事很迷人，也很容易在复杂度里迷路，我希望这个工具能帮创作者更清楚地看见自己的世界。如果你喜欢它，欢迎 Star、Fork、提建议或分享给同样喜欢叙事工具的朋友，你的支持非常珍贵。
