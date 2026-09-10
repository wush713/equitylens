# EquityLens 前端原型

当前原型包含登录、注册、Chat、自选股和理财偏好设置。身份、对话、自选股和偏好仅保存在当前浏览器；密码不会保存或发送。行情与 AI 回复均为界面演示，尚未连接后端与 Tushare。

## 本地启动

```bash
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:5173`。点击“先体验一下”可以直接进入 Chat。

## 生产构建

```bash
npm run build
```

构建产物位于 `dist`。
