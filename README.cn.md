# 中文说明

> 面向 RPG、分支剧情和互动小说的可视化编辑器，支持状态变化、运行预览与 AI 辅助写作。

这个仓库已经改成 **英文优先、中文在后** 的双语 README，方便 GitHub 全球用户第一眼理解项目，同时保留中文开发者阅读体验。

## 为什么值得 Star / Fork

- 目标场景清晰，不是空壳项目。
- 项目规模适合学习、二次开发和快速改造。
- README、路线图、贡献入口和部署说明更完整。
- topics 会尽量贴近当前 GitHub 热门方向，例如 AI、LLM、OpenAI-compatible、TypeScript、developer-tools、automation、local-first、gamedev 等。

## 功能亮点

- Node-based story graph editing
- Choice, condition, random branch, state effect, battle, and ending nodes
- Runtime preview for validating branches
- JSON project import/export and Markdown export
- AI-assisted story text generation entry point

## 快速开始

`ash
npm install`nnpm run dev`n`nnpm run typecheck`nnpm run test`nnpm run build
`

## 部署与安全

- 不要提交 .env、API Key、生成媒体、大型文件、数据库、日志和构建产物。
- 前端项目可以部署 dist/ 到 GitHub Pages、Vercel、Netlify 或 Nginx。
- 桌面/移动端项目建议只发布干净环境构建出来的 release 文件。

## 后续计划

- [ ] Collaborative story review mode
- [ ] More export formats for game engines
- [ ] Timeline and character relationship views
- [ ] Prompt packs for writers and quest designers

