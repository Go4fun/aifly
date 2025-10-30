const crypto = require('crypto');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const Logger = require('./logger');

class WeChatCallbackServer {
    constructor(port = 3000, token = 'your_callback_token') {
        this.port = port;
        this.token = token;
        this.logger = new Logger();
        this.server = null;
    }

    // 企业微信URL验证 - 根据signature验证请求
    verifySignature(signature, timestamp, nonce, echostr) {
        // 1. 将token、timestamp、nonce三个参数进行字典序排序
        const tmpArr = [this.token, timestamp, nonce].sort();

        // 2. 将三个参数字符串拼接成一个字符串进行sha1加密
        const tmpStr = tmpArr.join('');
        const hash = crypto.createHash('sha1').update(tmpStr).digest('hex');

        // 3. 开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
        console.log('🔐 URL验证详情:');
        console.log(`   Token: ${this.token}`);
        console.log(`   Timestamp: ${timestamp}`);
        console.log(`   Nonce: ${nonce}`);
        console.log(`   Echostr: ${echostr}`);
        console.log(`   收到的Signature: ${signature}`);
        console.log(`   计算的Signature: ${hash}`);
        console.log(`   验证结果: ${hash === signature ? '✅ 成功' : '❌ 失败'}`);

        return hash === signature;
    }

    // 处理企业微信的验证请求
    handleVerification(req, res) {
        const query = url.parse(req.url, true).query;
        const { signature, timestamp, nonce, echostr } = query;

        this.logger.info(`收到企业微信验证请求: ${req.url}`);

        if (!signature || !timestamp || !nonce || !echostr) {
            this.logger.error('验证请求缺少必要参数');
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing required parameters');
            return;
        }

        if (this.verifySignature(signature, timestamp, nonce, echostr)) {
            this.logger.success('URL验证成功，返回echostr');
            // 验证成功，直接返回echostr
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(echostr);
        } else {
            this.logger.error('URL验证失败，signature不匹配');
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Verification failed');
        }
    }

    // 处理企业微信的消息推送
    handleMessage(req, res) {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            this.logger.info(`收到企业微信消息: ${body}`);

            try {
                const message = JSON.parse(body);
                this.logger.info(`消息类型: ${message.msgtype || 'unknown'}`);

                // 处理不同类型的消息
                this.processMessage(message);

                // 返回成功响应
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ errcode: 0, errmsg: 'ok' }));

            } catch (error) {
                this.logger.error(`消息解析失败: ${error.message}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ errcode: -1, errmsg: 'Invalid message format' }));
            }
        });
    }

    // 处理收到的消息
    processMessage(message) {
        const { msgtype, touser, fromuser, agentid } = message;

        this.logger.info(`收到消息详情:`);
        this.logger.info(`  消息类型: ${msgtype}`);
        this.logger.info(`  接收者: ${touser}`);
        this.logger.info(`  发送者: ${fromuser}`);
        this.logger.info(`  应用ID: ${agentid}`);

        switch (msgtype) {
            case 'text':
                this.logger.info(`  文本内容: ${message.content}`);
                break;
            case 'image':
                this.logger.info(`  图片媒体ID: ${message.mediaid}`);
                break;
            case 'voice':
                this.logger.info(`  语音媒体ID: ${message.mediaid}`);
                break;
            case 'video':
                this.logger.info(`  视频媒体ID: ${message.mediaid}`);
                break;
            case 'event':
                this.handleEventMessage(message);
                break;
            default:
                this.logger.info(`  未知消息类型: ${JSON.stringify(message)}`);
        }
    }

    // 处理事件消息
    handleEventMessage(message) {
        const { event } = message;

        this.logger.info(`🎉 收到事件消息: ${event}`);

        switch (event) {
            case 'subscribe':
                this.logger.info('用户关注事件');
                break;
            case 'unsubscribe':
                this.logger.info('用户取消关注事件');
                break;
            case 'enter_agent':
                this.logger.info('用户进入应用事件');
                break;
            case 'location':
                this.logger.info(`位置更新: ${message.latitude}, ${message.longitude}`);
                break;
            case 'click':
                this.logger.info(`菜单点击: ${message.eventkey}`);
                break;
            default:
                this.logger.info(`其他事件: ${JSON.stringify(message)}`);
        }
    }

    // 启动服务器
    start() {
        this.server = http.createServer((req, res) => {
            const method = req.method;
            const pathname = url.parse(req.url).pathname;

            this.logger.info(`${method} ${pathname}`);

            // 添加CORS头，方便测试
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            if (method === 'GET' && pathname === '/wechat/callback') {
                // 处理企业微信的URL验证
                this.handleVerification(req, res);
            } else if (method === 'POST' && pathname === '/wechat/callback') {
                // 处理企业微信的消息推送
                this.handleMessage(req, res);
            } else if (method === 'GET' && pathname === '/') {
                // 提供状态页面
                this.showStatus(res);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });

        this.server.listen(this.port, () => {
            this.logger.success(`🚀 企业微信回调服务器启动成功！`);
            this.logger.info(`📡 服务器运行在: http://localhost:${this.port}`);
            this.logger.info(`🔗 回调URL: http://localhost:${this.port}/wechat/callback`);
            this.logger.info(`🔐 验证Token: ${this.token}`);
            this.logger.info(`\n📝 请在企业微信后台配置以下信息:`);
            this.logger.info(`   回调URL: http://YOUR_PUBLIC_IP:${this.port}/wechat/callback`);
            this.logger.info(`   Token: ${this.token}`);
            this.logger.info(`   EncodingAESKey: 留空（明文模式）`);
            this.logger.info(`\n💡 如果需要公网访问，请使用ngrok等内网穿透工具`);
        });

        this.server.on('error', (error) => {
            this.logger.error(`服务器启动失败: ${error.message}`);
        });
    }

    // 显示服务器状态
    showStatus(res) {
        const statusPage = `
<!DOCTYPE html>
<html>
<head>
    <title>企业微信回调服务器</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { padding: 20px; background: #f0f8ff; border-radius: 5px; }
        .success { color: #28a745; }
        .info { color: #17a2b8; }
        .code { background: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 企业微信回调服务器</h1>
        <div class="status">
            <h2 class="success">✅ 服务器运行中</h2>
            <p><strong>端口:</strong> ${this.port}</p>
            <p><strong>验证Token:</strong> <code class="code">${this.token}</code></p>
            <p><strong>回调URL:</strong> <code class="code">/wechat/callback</code></p>
        </div>

        <h2>📋 配置说明</h2>
        <p>在企业微信后台配置以下信息:</p>
        <ul>
            <li><strong>回调URL:</strong> <code class="code">http://YOUR_PUBLIC_IP:${this.port}/wechat/callback</code></li>
            <li><strong>Token:</strong> <code class="code">${this.token}</code></li>
            <li><strong>EncodingAESKey:</strong> 留空（使用明文模式）</li>
        </ul>

        <h2>🔧 测试端点</h2>
        <ul>
            <li><a href="/wechat/callback?signature=test&timestamp=1234567890&nonce=test&echostr=hello">模拟验证请求</a></li>
        </ul>

        <div class="info">
            <p>💡 提示: 如果需要公网访问，可以使用ngrok: <code class="code">ngrok http ${this.port}</code></p>
        </div>
    </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(statusPage);
    }

    // 停止服务器
    stop() {
        if (this.server) {
            this.server.close(() => {
                this.logger.info('服务器已停止');
            });
        }
    }
}

// 命令行使用
if (require.main === module) {
    const args = process.argv.slice(2);
    const port = parseInt(args[0]) || 3000;
    const token = args[1] || 'wechat_callback_token_2024';

    const server = new WeChatCallbackServer(port, token);
    server.start();

    // 优雅关闭
    process.on('SIGINT', () => {
        console.log('\n正在关闭服务器...');
        server.stop();
        process.exit(0);
    });
}

module.exports = WeChatCallbackServer;