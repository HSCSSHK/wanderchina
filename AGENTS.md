# AGENTS.md

本仓库是 **sdd-project** —— 一个由 AI coding agent 驱动、Spec-Driven 的全栈项目。任何 agent 进入仓库时，**先读这一份**。

## 仓库拓扑与子模块说明

本项目采用前后端分离目录，统一在根目录下管理规范（非 git submodule 模式，以降低复杂度，业务代码直接写入对应目录）：

- **父目录（治理层）**：`.` (根目录) | 包含 Harness (`.qoder/`) + Spec (`openspec/`)
- **Frontend**：`frontend/` | **Vue 3 + Vite + TypeScript + Element Plus**（UI 层，端口 5173）
- **Backend**：`backend/` | **Java 17 + Spring Boot 3.3.x**，HTTP API（端口 8080）

### 启动与测试命令

- **前端**：`cd frontend && npm install && npm run dev` (默认 5173 端口) | 测试：`npm test`
- **后端**：`mvn -f backend/pom.xml spring-boot:run` | 测试：`mvn -f backend/pom.xml test`

## 三层架构（父仓内的治理层）

| 层          | 目录             | 职责                                      |
| ----------- | ---------------- | ----------------------------------------- |
| Harness     | `.qoder/`        | agent 配置（rules / skills / commands）   |
| OpenSpec    | `openspec/`      | Spec-driven 工作流：先对齐 spec，再写代码 |
| Superpowers | `.qoder/skills/` | 可组合的 skill 方法论，自动触发（如 TDD） |

## 技术选型约束（锁定栈）

| 层        | 选型                                                         | 决定性理由                                          |
| --------- | ------------------------------------------------------------ | --------------------------------------------------- |
| 前端框架  | **Vue 3 (Composition API, `<script setup>`) + Vite + TypeScript** | 团队已有基础，轻量高效，AI 生成友好                 |
| UI 组件库 | **Element Plus**                                             | 成熟的 Vue 3 生态企业级组件库                       |
| 样式方案  | **SCSS (支持 scoped) + Element Plus 内置样式**               | 避免引入额外原子化 CSS 框架导致复杂度上升           |
| 后端      | **Spring Boot 3.3.x**                                        | 团队经验 + 生态完备 + 分层约定强                    |
| 接口契约  | **OpenAPI / springdoc-openapi**                              | 后端生成 schema，前端生成 TS 类型，弥补跨语言上下文 |
| 数据库    | MySQL                                                        | 生态成熟                                            |

### 禁止动作（不可违反）

- ❌ **禁止在前端引入或生成任何 React / Next.js / Angular 相关的代码、依赖或模式**。（后果：与锁定的 Vue 3 技术栈严重冲突，导致编译和运行崩溃）。
- ❌ **禁止引入 Tailwind CSS / MUI / Ant Design 等其它 UI/CSS 方案**，必须统一使用 Element Plus。
- ❌ **禁止在 Controller 中编写业务逻辑或直接访问 Repository**，必须严格遵循 `Controller -> Service -> Repository` 三层架构。
- ❌ 用 "AI 生成质量更高" 单一理由推翻已锁定栈。

## 硬规则（不可违反）

1. **任何代码改动前必须先走 OpenSpec 流程**：在 `openspec/changes/<change-name>/` 下产出 `proposal.md` → `design.md` → `tasks.md`，人类签字后才动代码。
2. **TDD 不可绕过**：实现阶段严格 RED → GREEN → REFACTOR，先写失败测试。
3. **YAGNI / DRY**：不做没要求的事，不搞预防性抽象。
4. **变更完成后归档**：把 `openspec/changes/<name>/` 移入 `archive/<date>-<name>/`。

## 快速入口
- OpenSpec 官方命令：`.qoder/skills/openspec-*/SKILL.md`
- Superpowers skills：`.qoder/skills/*/SKILL.md`