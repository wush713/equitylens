# EquityLens 后端

当前后端实现第一条黄金路径：分析贵州茅台最近两期完整可比年度（2025 年与 2024 年）的经营表现和主要风险。

数据来自贵州茅台官网发布的 2025 年年度报告固定样本。固定样本用于先验证会话、任务阶段、指标复算、Claim 校验和证据展示；当前流程尚未调用 Tushare 或模型服务。

## 启动

```bash
/opt/homebrew/bin/python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
uvicorn app.main:app --reload --port 8000
```

在第二个终端启动单进程研究 Worker：

```bash
cd backend
source .venv/bin/activate
python -m app.runtime.worker
```

在第三个终端启动前端：

```bash
cd ../frontend
npm run dev
```

浏览器使用“先体验一下”进入 Chat，发送：

```text
分析贵州茅台最近两期的经营表现和主要风险
```

## 本地配置

复制 `.env.example` 为 `.env` 后填写本地凭证。`DEEPSEEK_API_KEY` 和 `TUSHARE_TOKEN` 已预留给后续模型与实时数据接入；最小黄金路径不会读取外部接口，因此没有凭证也能运行。`.env` 已被 Git 忽略。

## 验证

```bash
pytest
```

SQLite 是当前可直接运行的开发存储。首版通过文件锁限制为一个 Worker，并在阶段边界保存状态；数据库地址可以通过 `DATABASE_URL` 修改。接入 PostgreSQL 时会补充租约、fencing 和正式迁移。
