# 老乡同行 HomeTogether

## 快速开始

### 1. 导入项目
用微信开发者工具打开 \B:/Codex file/HomeTogether\ 目录

### 2. 修改配置
- \project.config.json\ 中的 \ppid\ → 替换为你自己的 AppID
- \miniprogram/utils/map.js\ 中的 \YOUR_QQ_MAP_KEY\ → 替换为腾讯地图 Key

### 3. 开通云开发
在开发者工具顶部菜单 → 云开发 → 开通 → 创建环境

### 4. 创建数据库集合
在云开发控制台中创建以下集合：
- users, vehicles, trips, requests, applications, ratings, messages

### 5. 设置数据库安全规则
按 \私家车顺风车小程序-技术文档.md\ 第 9 章配置

### 6. 部署云函数
右键 \cloudfunctions/\ 下的每个函数 → 上传并部署
建议部署顺序: login → 其他函数

### 7. 编译运行
点击开发者工具的「编译」按钮

## 项目结构
\HomeTogether/
├── miniprogram/          # 小程序前端
│   ├── pages/               # 8 个页面
│   ├── components/          # 7 个组件
│   ├── utils/               # 6 个工具模块
│   ├── assets/              # 图标与样式
│   └── store/               # 状态管理
├── cloudfunctions/      # 14 个云函数
└── project.config.json  # 项目配置
\