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
  try {
    // 3.1 获取企业微信传入的参数
    const { msg_signature, timestamp, nonce, echostr } = req.query;

    // 3.2 验证参数完整性
    if (!msg_signature || !timestamp || !nonce || !echostr) {
      return res.status(400).send('参数不完整');
    }

    // 3.3 按照文档规则生成签名
    const sortedArr = [config.token, timestamp, nonce].sort(); // 按字典序排序
    const combinedStr = sortedArr.join(''); // 拼接成字符串
    const sha1 = crypto.createHash('sha1');
    const signature = sha1.update(combinedStr).digest('hex'); // 生成SHA1签名

    // 3.4 对比签名，验证请求来源
    if (signature !== msg_signature) {
      return res.status(403).send('签名验证失败，非法请求');
    }

    // 3.5 签名验证通过，返回解密后的echostr
    const decodedEchostr = decryptEchostr(echostr, config.encodingAESKey, config.corpId);
    res.send(decodedEchostr);

  } catch (error) {
    console.error('处理请求失败：', error);
    res.status(500).send('服务器内部错误');
  }
});

// 4. 解密echostr的工具函数（遵循企业微信AES加密规则）
function decryptEchostr(encryptedStr, encodingAESKey, corpId) {
  try {
    // 4.1 处理EncodingAESKey，补全Base64编码
    const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
    const iv = aesKey.slice(0, 16); // IV取AESKey前16位

    // 4.2 创建AES解密器（CBC模式，PKCS7填充）
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(true);

    // 4.3 解密并处理结果
    let decoded = decipher.update(encryptedStr, 'base64', 'utf8');
    decoded += decipher.final('utf8');

    // 4.4 提取CorpId并验证（解密结果格式：random(16B) + msg + CorpId）
    const corpIdInDecoded = decoded.slice(-corpId.length);
    if (corpIdInDecoded !== corpId) {
      throw new Error('解密后CorpId不匹配');
    }

    // 4.5 返回原始消息（去掉16位随机数和CorpId）
    return decoded.slice(16, -corpId.length);

  } catch (error) {
    throw new Error('echostr解密失败：' + error.message);
  }
}

// 5. 启动服务，监听3000端口（允许所有地址访问）
const port = 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`服务已启动，监听地址：http://0.0.0.0:${port}/wechat/callback`);
  console.log('请确保企业微信后台的回调URL配置为：你的服务器公网IP:3000/wechat/callback');
});