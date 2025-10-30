# 企业微信群聊自动创建工具

这是一个基于Node.js的企业微信群聊自动创建工具，可以根据配置文件批量创建企业微信群聊并添加指定成员。

## 功能特性

- 🚀 批量创建企业微信群聊
- 📋 从配置文件读取群信息和成员列表
- 🔄 自动重试机制
- 📝 详细的日志记录
- ⚡ 请求频率控制
- ✅ 创建结果汇总报告

## 环境要求

- Node.js >= 12.0.0
- 企业微信管理员权限

## 安装和使用

### 1. 安装依赖

```bash
npm install
```

### 2. 配置企业微信参数

编辑 `config.json` 文件，填入您的企业微信信息：

```json
{
  "corp": {
    "corpId": "你的企业ID",
    "corpSecret": "你的应用Secret",
    "agentId": 1000001
  },
  "groups": [
    {
      "name": "项目讨论群",
      "description": "用于项目相关讨论",
      "members": [
        {
          "userId": "user001",
          "name": "张三"
        },
        {
          "userId": "user002",
          "name": "李四"
        }
      ]
    }
  ],
  "options": {
    "maxRetries": 3,
    "delayBetweenRequests": 1000
  }
}
```

### 3. 配置参数说明

#### corp（企业信息）
- `corpId`: 企业ID，可在企业微信管理后台获取
- `corpSecret`: 应用的Secret，需要创建一个自建应用
- `agentId`: 应用的ID，可在应用详情页面查看

#### groups（群聊配置）
- `name`: 群聊名称
- `description`: 群聊描述（可选）
- `members`: 群成员列表
  - `userId`: 成员的企业微信用户ID
  - `name`: 成员姓名（仅用于显示）

#### options（选项配置）
- `maxRetries`: 最大重试次数
- `delayBetweenRequests`: 请求间隔时间（毫秒）

### 4. 运行程序

```bash
npm start
```

或者直接运行：

```bash
node createWechatGroup.js
```

## 获取企业微信参数

### 1. 获取企业ID (corpId)
1. 登录企业微信管理后台
2. 进入"我的企业" → "企业信息"
3. 可以看到企业ID

### 2. 创建自建应用并获取Secret
1. 进入"应用管理" → "应用" → "自建"
2. 创建新应用或选择现有应用
3. 在应用详情页面可以获取到 `agentId` 和 `Secret`
4. 确保应用有"通讯录管理"权限

### 3. 获取用户ID (userId)
可以通过企业微信API获取通讯录中的用户ID，或者：
1. 进入"通讯录" → "成员管理"
2. 点击成员详情，查看成员信息
3. 用户ID通常类似于 "user001" 的格式

## 日志文件

程序运行时会在 `logs` 目录下生成日志文件：
- 文件名格式：`wechat-group-YYYY-MM-DD.log`
- 包含详细的操作记录和错误信息

## 错误处理

程序包含完善的错误处理机制：

1. **配置文件错误**：程序启动时会验证配置文件格式
2. **API调用失败**：会自动重试，达到最大重试次数后跳过
3. **权限错误**：检查应用权限配置
4. **网络错误**：自动重试机制处理

## 常见问题

### Q: 提示"获取access_token失败"
A: 检查 `corpId` 和 `corpSecret` 是否正确，确保应用已启用且有相应权限

### Q: 提示"创建群聊失败"
A: 检查用户ID是否正确，确保用户在企业通讯录中，检查应用是否有创建群聊权限

### Q: 部分群聊创建失败
A: 查看日志文件了解具体错误原因，可能是某些用户ID不存在或权限问题

### Q: 如何获取用户ID？
A: 可以通过企业微信API `https://qyapi.weixin.qq.com/cgi-bin/user/list?access_token=ACCESS_TOKEN&department_id=1` 获取部门成员列表

## 安全注意事项

1. 不要将 `config.json` 文件提交到版本控制系统
2. 妥善保管企业微信的 `corpSecret`
3. 建议使用专门的测试账号进行调试
4. 定期更换应用的Secret

## 许可证

MIT License


## 说明
测试用
