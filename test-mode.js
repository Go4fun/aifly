const WeChatGroupCreator = require('./createWechatGroup');
const Logger = require('./logger');

class TestModeWeChatGroupCreator extends WeChatGroupCreator {
    constructor(configPath) {
        super(configPath);
        this.testMode = true;
        this.logger = new Logger();
        console.log('🧪 运行在测试模式 - 不会实际创建企业微信群聊');
    }

    async getAccessToken() {
        console.log('🔐 模拟获取 access_token...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ 模拟 access_token 获取成功');
        return 'mock_access_token_' + Date.now();
    }

    async createGroup(groupInfo) {
        console.log(`📱 模拟创建群聊: ${groupInfo.name}`);
        console.log(`   群描述: ${groupInfo.description || '无描述'}`);
        console.log(`   成员数量: ${groupInfo.members.length}`);

        groupInfo.members.forEach((member, index) => {
            console.log(`   成员${index + 1}: ${member.name} (${member.userId})`);
        });

        await new Promise(resolve => setTimeout(resolve, 1500));

        const mockChatId = 'mock_chat_' + Math.random().toString(36).substr(2, 9);

        console.log(`✅ 模拟群聊创建成功: ${groupInfo.name}`);
        console.log(`   模拟群ID: ${mockChatId}`);

        return {
            success: true,
            chatid: mockChatId,
            groupName: groupInfo.name,
            memberCount: groupInfo.members.length
        };
    }
}

async function testRun() {
    console.log('🚀 开始测试运行企业微信群聊创建程序\n');

    const configPath = './config.json';
    const creator = new TestModeWeChatGroupCreator(configPath);

    try {
        const results = await creator.createAllGroups();
        creator.printSummary(results);

        console.log('\n🎉 测试运行完成！');
        console.log('\n📝 要实际使用，请：');
        console.log('1. 编辑 config.json 文件');
        console.log('2. 填入真实的企业微信信息');
        console.log('3. 运行 npm start 开始实际创建群聊');

    } catch (error) {
        console.error('❌ 测试运行失败:', error.message);
    }
}

if (require.main === module) {
    testRun();
}

module.exports = TestModeWeChatGroupCreator;