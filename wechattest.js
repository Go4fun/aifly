const express = require('express');
const crypto = require('crypto');
const app = express();

// 1. 配置企业微信参数（需替换为你的实际信息）
const config = {
  token: 'wechatcallbacktoken2024', // 企业微信后台设置的Token
  encodingAESKey: 'JznExhhRBeGBpyUKislLgtWT6mQoN7MftnOz2vh52Tq', // 企业微信后台设置的EncodingAESKey
  corpId: 'ww8e5d54432be38f7c' // 你的企业ID
};

// 2. 解析URL查询参数的中间件
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 3. 验证并响应企业微信后台请求的接口
app.get('/wechat/callback', (req, res) => {
  console.log('\n=== 收到企业微信验证请求 ===');
  console.log('请求时间:', new Date().toLocaleString());
  console.log('请求来源IP:', req.ip || req.connection.remoteAddress);
  console.log('完整查询参数:', req.query);

  try {
    // 3.1 获取企业微信传入的参数
    const { msg_signature, timestamp, nonce, echostr } = req.query;

    console.log('\n--- 解析到的参数 ---');
    console.log('msg_signature:', msg_signature);
    console.log('timestamp:', timestamp);
    console.log('nonce:', nonce);
    console.log('echostr:', echostr ? '已收到(长度:' + echostr.length + ')' : '未提供');

    // 3.2 验证参数完整性
    if (!msg_signature || !timestamp || !nonce || !echostr) {
      console.log('❌ 参数验证失败 - 缺少必要参数');
      return res.status(400).send('参数不完整');
    }

    console.log('✅ 参数完整性验证通过');

    // 3.3 按照文档规则生成签名
    console.log('\n--- 开始签名验证 ---');
    const sortedArr = [config.token, timestamp, nonce].sort(); // 按字典序排序
    console.log('排序前参数:', [config.token, timestamp, nonce]);
    console.log('排序后参数:', sortedArr);
    const combinedStr = sortedArr.join(''); // 拼接成字符串
    console.log('拼接字符串:', combinedStr);

    const sha1 = crypto.createHash('sha1');
    const signature = sha1.update(combinedStr).digest('hex'); // 生成SHA1签名
    console.log('生成的签名:', signature);
    console.log('接收到的签名:', msg_signature);

    // 3.4 对比签名，验证请求来源
    if (signature !== msg_signature) {
      console.log('❌ 签名验证失败 - 签名不匹配');
      console.log('服务器生成的签名:', signature);
      console.log('企业微信发送的签名:', msg_signature);
      return res.status(403).send('签名验证失败，非法请求');
    }

    console.log('✅ 签名验证通过');

    // 3.5 签名验证通过，返回解密后的echostr
    console.log('\n--- 开始解密echostr ---');
    console.log('加密的echostr长度:', echostr.length);
    const decodedEchostr = decryptEchostr(echostr, config.encodingAESKey, config.corpId);
    console.log('解密后的echostr:', decodedEchostr);
    console.log('✅ 解密成功，返回给企业微信');
    console.log('=== 验证请求处理完成 ===\n');
    res.send(decodedEchostr);

  } catch (error) {
    console.error('❌ 处理请求失败：', error);
    console.error('错误堆栈:', error.stack);
    console.log('=== 请求处理失败 ===\n');
    res.status(500).send('服务器内部错误');
  }
});

// 4. 解密echostr的工具函数（遵循企业微信AES加密规则）
function decryptEchostr(encryptedStr, encodingAESKey, corpId) {
  console.log('  --- AES解密详情 ---');
  console.log('  加密字符串长度:', encryptedStr.length);
  console.log('  企业ID:', corpId);

  try {
    // 4.1 处理EncodingAESKey，补全Base64编码
    const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
    const iv = aesKey.slice(0, 16); // IV取AESKey前16位
    console.log('  AES密钥长度:', aesKey.length);
    console.log('  IV长度:', iv.length);

    // 4.2 创建AES解密器（CBC模式，PKCS7填充）
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(true);

    // 4.3 解密并处理结果
    let decoded = decipher.update(encryptedStr, 'base64', 'utf8');
    decoded += decipher.final('utf8');
    console.log('  解密后总长度:', decoded.length);

    // 4.4 提取CorpId并验证（解密结果格式：random(16B) + msg + CorpId）
    const corpIdInDecoded = decoded.slice(-corpId.length);
    console.log('  解出的CorpId:', corpIdInDecoded);

    if (corpIdInDecoded !== corpId) {
      console.log('  ❌ CorpId验证失败');
      throw new Error('解密后CorpId不匹配');
    }

    console.log('  ✅ CorpId验证通过');

    // 4.5 返回原始消息（去掉16位随机数和CorpId）
    const result = decoded.slice(16, -corpId.length);
    console.log('  最终解密结果:', result);
    console.log('  --- AES解密完成 ---');

    return result;

  } catch (error) {
    console.log('  ❌ AES解密失败:', error.message);
    throw new Error('echostr解密失败：' + error.message);
  }
}

// 5. 启动服务，监听3000端口（允许所有地址访问）
const port = 3000;
app.listen(port, '0.0.0.0', () => {
  console.log('\n=================================');
  console.log('🚀 企业微信回调验证服务已启动');
  console.log('=================================');
  console.log('📍 监听地址：http://0.0.0.0:' + port);
  console.log('🔗 回调URL：http://0.0.0.0:' + port + '/wechat/callback');
  console.log('⏰ 启动时间：' + new Date().toLocaleString());
  console.log('\n📋 配置信息：');
  console.log('  - Token:', config.token);
  console.log('  - CorpId:', config.corpId);
  console.log('  - EncodingAESKey:', config.encodingAESKey.substring(0, 20) + '...');

  console.log('\n⚠️  请在企业微信后台配置回调URL：');
  console.log('  http://你的服务器公网IP:' + port + '/wechat/callback');
  console.log('=================================\n');

  console.log('等待企业微信验证请求...\n');
});