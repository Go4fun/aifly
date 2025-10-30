const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');
const Logger = require('./logger');

class WeChatGroupCreator {
    constructor(configPath) {
        this.logger = new Logger();
        this.accessToken = null;
        this.tokenExpireTime = 0;
        this.config = this.loadConfig(configPath);
    }

    loadConfig(configPath) {
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            this.logger.info(`配置文件加载成功: ${configPath}`);
            return config;
        } catch (error) {
            this.logger.error(`配置文件加载失败: ${error.message}`);
            throw error;
        }
    }

    async getAccessToken() {
        const now = Date.now();

        if (this.accessToken && now < this.tokenExpireTime) {
            return this.accessToken;
        }

        const { corpId, corpSecret } = this.config.corp;
        const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`;

        try {
            const token = await this.makeRequest('GET', url);

            if (token.errcode !== 0) {
                this.logger.error(`获取access_token失败: ${token.errmsg}`);
                throw new Error(`获取access_token失败: ${token.errmsg}`);
            }

            this.accessToken = token.access_token;
            this.tokenExpireTime = now + (token.expires_in - 300) * 1000;

            this.logger.success('Access token 获取成功');
            return this.accessToken;
        } catch (error) {
            this.logger.error(`获取access_token时出错: ${error.message}`);
            throw error;
        }
    }

    makeRequest(method, url, data = null) {
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

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async createGroup(groupInfo) {
        const accessToken = await this.getAccessToken();
        const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/create?access_token=${accessToken}`;

        const groupData = {
            name: groupInfo.name,
            description: groupInfo.description || '',
            owner: groupInfo.members[0]?.userId || '',
            userlist: groupInfo.members.map(member => member.userId)
        };

        try {
            this.logger.info(`正在创建群聊: ${groupInfo.name}，包含 ${groupInfo.members.length} 个成员`);
            const result = await this.makeRequest('POST', url, groupData);

            if (result.errcode !== 0) {
                this.logger.error(`创建群聊失败 ${groupInfo.name}: ${result.errmsg}`);
                throw new Error(`创建群聊失败: ${result.errmsg}`);
            }

            this.logger.success(`群聊创建成功: ${groupInfo.name} (群ID: ${result.chatid})`);

            return {
                success: true,
                chatid: result.chatid,
                groupName: groupInfo.name,
                memberCount: groupInfo.members.length
            };
        } catch (error) {
            this.logger.error(`创建群聊失败 ${groupInfo.name}: ${error.message}`);
            return {
                success: false,
                groupName: groupInfo.name,
                error: error.message
            };
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async createAllGroups() {
        this.logger.info('开始创建企业微信群聊...');
        this.logger.info(`总共需要创建 ${this.config.groups.length} 个群聊`);

        const results = [];
        const { maxRetries, delayBetweenRequests } = this.config.options;

        for (let i = 0; i < this.config.groups.length; i++) {
            const group = this.config.groups[i];
            let retryCount = 0;
            let success = false;

            while (retryCount < maxRetries && !success) {
                try {
                    const result = await this.createGroup(group);
                    results.push(result);
                    success = result.success;

                    if (!success && retryCount < maxRetries - 1) {
                        this.logger.warning(`等待 ${delayBetweenRequests}ms 后重试...`);
                        await this.sleep(delayBetweenRequests);
                    }
                } catch (error) {
                    this.logger.error(`处理群 ${group.name} 时发生异常: ${error.message}`);
                    results.push({
                        success: false,
                        groupName: group.name,
                        error: error.message
                    });
                }

                retryCount++;
            }

            if (i < this.config.groups.length - 1) {
                this.logger.info(`等待 ${delayBetweenRequests}ms 后处理下一个群聊...`);
                await this.sleep(delayBetweenRequests);
            }
        }

        return results;
    }

    printSummary(results) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        this.logger.info('=' .repeat(50));
        this.logger.info('创建结果汇总');
        this.logger.info('=' .repeat(50));
        this.logger.info(`成功创建: ${successful.length} 个群聊`);
        this.logger.info(`创建失败: ${failed.length} 个群聊`);

        if (successful.length > 0) {
            this.logger.info('成功创建的群聊:');
            successful.forEach(result => {
                this.logger.info(`  - ${result.groupName} (群ID: ${result.chatid})`);
            });
        }

        if (failed.length > 0) {
            this.logger.warning('创建失败的群聊:');
            failed.forEach(result => {
                this.logger.warning(`  - ${result.groupName}: ${result.error}`);
            });
        }

        this.logger.info('处理完成!');
    }
}

async function main() {
    const configPath = path.join(__dirname, 'config.json');

    try {
        const creator = new WeChatGroupCreator(configPath);
        const results = await creator.createAllGroups();
        creator.printSummary(results);
    } catch (error) {
        console.error('程序执行失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = WeChatGroupCreator;