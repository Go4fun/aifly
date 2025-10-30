const https = require('https');
const Logger = require('./logger');

class WeChatDiagnostic {
    constructor(config) {
        this.config = config;
        this.logger = new Logger();
    }

    async checkAccessToken() {
        const { corpId, corpSecret } = this.config.corp;
        const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;

        console.log('🔍 正在检查企业微信API连接...');

        try {
            const result = await this.makeRequest('GET', url);

            if (result.errcode === 0) {
                console.log('✅ Access token 获取成功');
                console.log(`   Token: ${result.access_token.substring(0, 20)}...`);
                console.log(`   过期时间: ${result.expires_in}秒`);
                return true;
            } else {
                console.log('❌ Access token 获取失败');
                console.log(`   错误代码: ${result.errcode}`);
                console.log(`   错误信息: ${result.errmsg}`);
                return false;
            }
        } catch (error) {
            console.log('❌ 网络请求失败');
            console.log(`   错误: ${error.message}`);
            return false;
        }
    }

    makeRequest(method, url) {
        return new Promise((resolve, reject) => {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const req = https.request(url, options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`响应解析失败: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    }

    async testCreateGroup() {
        console.log('\n🧪 测试创建群聊接口...');

        // 先获取token
        const { corpId, corpSecret } = this.config.corp;
        const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;

        try {
            const tokenResult = await this.makeRequest('GET', tokenUrl);
            if (tokenResult.errcode !== 0) {
                console.log('❌ 无法获取access_token，请检查corpId和corpSecret');
                return false;
            }

            const accessToken = tokenResult.access_token;
            const createUrl = `https://qyapi.weixin.qq.com/cgi-bin/appchat/create?access_token=${accessToken}`;

            const testGroupData = {
                name: "测试群聊_请删除",
                description: "这是一个测试群，用于检查API权限",
                owner: "test_user",
                userlist: ["test_user"]
            };

            const result = await this.makeRequest('POST', createUrl, testGroupData);

            if (result.errcode === 0) {
                console.log('✅ 群聊创建API正常工作');
                console.log(`   测试群ID: ${result.chatid}`);
                return true;
            } else {
                console.log('❌ 群聊创建API失败');
                console.log(`   错误代码: ${result.errcode}`);
                console.log(`   错误信息: ${result.errmsg}`);

                // 根据错误代码提供建议
                this.provideSolution(result.errcode, result.errmsg);
                return false;
            }
        } catch (error) {
            console.log('❌ API测试失败');
            console.log(`   错误: ${error.message}`);
            return false;
        }
    }

    provideSolution(errcode, errmsg) {
        const solutions = {
            '60020': 'IP地址被限制。需要在企业微信后台添加当前IP到可信IP列表。',
            '60001': '应用无权限。请检查应用是否开启了通讯录管理权限。',
            '60003': '成员不存在。请检查配置的用户ID是否正确。',
            '601052': '群主ID不存在。请检查owner字段的用户ID。',
            '60011': '无权限创建群聊。请检查应用权限配置。',
        };

        if (solutions[errcode]) {
            console.log(`\n💡 解决方案: ${solutions[errcode]}`);
        } else {
            console.log(`\n💡 请根据错误代码 ${errcode} 在企业微信开发文档中查找解决方案`);
        }

        if (errmsg.includes('not allow to access from your ip')) {
            console.log('\n📋 IP白名单配置步骤:');
            console.log('1. 登录企业微信管理后台');
            console.log('2. 进入"应用管理" → 选择您的应用');
            console.log('3. 找到"企业可信IP"设置');
            console.log(`4. 添加当前IP: 14.145.163.87`);
            console.log('5. 保存配置后等待几分钟生效');
        }
    }
}

async function runDiagnostic() {
    try {
        const config = require('./config.json');
        const diagnostic = new WeChatDiagnostic(config);

        console.log('🔧 企业微信API诊断工具\n');

        const tokenOk = await diagnostic.checkAccessToken();
        if (tokenOk) {
            await diagnostic.testCreateGroup();
        }

        console.log('\n📝 诊断完成！');
        console.log('\n如果问题仍未解决，请:');
        console.log('1. 确认企业微信应用权限配置');
        console.log('2. 联系企业微信技术支持');
        console.log('3. 或联系您的IT管理员协助配置');

    } catch (error) {
        console.error('❌ 诊断失败:', error.message);
        console.log('\n请检查config.json文件格式是否正确');
    }
}

if (require.main === module) {
    runDiagnostic();
}

module.exports = WeChatDiagnostic;