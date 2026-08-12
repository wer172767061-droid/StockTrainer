# Stock Trainer - 美股模拟交易系统

基于富途牛牛 OpenD 数据的美股K线模拟交易训练器，支持做多/做空/止损/画线。

## 数据说明

- **数据源**: 富途牛牛 OpenD
- **股票池**: 纳斯达克100 + 标普500科技股 + 热门科技股
- **排除**: 中概股、医疗健康/保险股、传统金融、能源、材料、消费
- **数据范围**: 近3年日K线
- **市值过滤**: 近3年每一年平均市值都 > $100亿（$10B）

## 快速开始

### 1. 安装富途 OpenD

1. 下载并安装 [富途牛牛客户端](https://www.futunn.com/download)
2. 打开富途牛牛 → 设置 → OpenD → 启动 OpenD（默认端口 11111）
3. 确保已登录美股账户

### 2. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 3. 下载数据

```bash
python3 download.py
```

脚本会自动：
- 连接富途 OpenD
- 下载近3年K线数据
- 按年计算每只股票市值
- 过滤掉近3年任意一年市值 < $100亿的股票
- 保存到 `stock_data/` 目录

### 4. 启动服务

```bash
python3 server_backend.py
```

### 5. 打开浏览器

访问 http://localhost:8765

## 一键启动

```bash
# Mac/Linux
chmod +x start.sh
./start.sh
```

## 部署到 Render

1. 上传所有文件到 GitHub 仓库（含 `stock_data/` 目录）
2. 在 Render 创建 Web Service
3. 构建命令: `pip install -r requirements.txt`
4. 启动命令: `gunicorn server_backend:app`
5. 环境变量: `PORT=8765`（可选，Render 会自动设置）

## 文件结构

```
StockTrainer/
├── download.py          # 数据下载脚本（富途 OpenD）
├── server_backend.py    # Flask 后端服务
├── app.js               # 前端交易逻辑
├── index.html           # 前端页面
├── style.css            # 前端样式
├── requirements.txt     # Python 依赖
├── start.sh             # 一键启动脚本
├── stock_data/          # 数据目录（下载后生成）
│   ├── _index.json      # 股票索引
│   ├── AAPL.json        # 单只股票K线数据
│   └── ...
```

## 功能特性

- K线图模拟交易（做多/做空/平仓）
- 画线工具（趋势线、水平线、矩形、黄金分割等）
- 止损单设置
- 财报日提醒
- 交易记录
- 累计统计
- 红涨绿跌（中国股市惯例）
