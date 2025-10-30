# 企业微信回调服务器使用指南

这个服务器用于接收企业微信的验证请求和消息推送，帮助您配置IP白名单。

## 🚀 快速开始

### 1. 启动服务器

```bash
# 使用默认配置（端口3000，token: wechat_callback_token_2024）
node callback-server.js

# 自定义端口和token
node callback-server.js 8080 my_custom_token

# 当前正在运行
# 端口: 3000
# Token: my_wechat_token
```

### 2. 获取公网URL

由于企业微信需要访问公网URL，您需要：

#### 选项A: 使用ngrok（推荐）

```bash
# 安装ngrok
brew install ngrok  # macOS
# 或者从 https://ngrok.com 下载

# 启动ngrok
ngrok http 3000
```

#### 选项B: 使用其他内网穿透工具
- 花生壳
- frp
- SSH隧道

### 3. 配置企业微信回调

在企业微信管理后台：

1. **进入应用管理**
   - 选择您的应用（AgentId: 1000002）

2. **配置接收消息**
   - 找到"接收消息"或"回调配置"
   - 填入以下信息：

```
URL: http://YOUR_NGROK_URL.ngrok.io/wechat/callback
Token: my_wechat_token
EncodingAESKey: (留空，使用明文模式)
```

3. **保存配置**
   - 企业微信会自动发送验证请求
   - 服务器会自动处理验证

## 🔧 验证过程

企业微信会发送GET请求到您的回调URL，包含以下参数：

```
GET /wechat/callback?signature=xxx&timestamp=xxx&nonce=xxx&echostr=xxx
```

服务器会：
1. 验证signature的正确性
2. 如果验证成功，直接返回echostr
3. 记录详细的验证日志

## 📋 监控和日志

服务器会记录所有请求：
- ✅ URL验证成功/失败
- 📨 收到的消息类型
- 🎉 事件通知
- ❌ 错误信息

## 🛠️ 测试功能

### 访问状态页面
打开浏览器访问：http://localhost:3000

### 模拟验证请求
```
http://localhost:3000/wechat/callback?signature=test&timestamp=1234567890&nonce=test&echostr=hello
```

## 📝 配置IP白名单

在回调配置成功后：

1. **进入应用的安全设置**
2. **找到"企业可信IP"配置**
3. **添加当前服务器IP：** `14.145.163.87`
4. **保存配置**

## 🔍 常见问题

### Q: 验证失败怎么办？
A: 检查Token是否正确配置，确保服务器能正常访问。

### Q: 没有公网IP怎么办？
A: 使用ngrok等内网穿透工具获取临时公网URL。

### Q: 验证成功后仍然无法创建群聊？
A: 确认IP白名单配置已生效，可能需要等待几分钟。

## 📞 获取帮助

如果遇到问题：
1. 检查服务器日志
2. 确认网络连接
3. 验证企业微信配置
4. 查看企业微信开发文档