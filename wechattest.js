const express = require('express');
const crypto = require('crypto');
const app = express();

// 1. 配置企业微信参数（务必替换为你的实际信息）
const config = {
  token: '6yplmY3qEQhrpkahlD4NuMRf1W', // 企业微信后台设置的Token
  encodingAESKey: '1RnfUOuFj8oKK52rsVJmItVOkNQ0zlNSNfaXFNiAmxq', // 企业微信后台设置的EncodingAESKey
  corpId: 'ww8e5d54432be38f7c' // 你的企业ID
};

// 2. 中间件配置（保持不变）
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 3. 修复后的回调接口（核心：增加URL解码）
app.get('/wechat/callback', (req, res) => {
  try {
    // 3.1 获取参数并执行URL解码（关键修复步骤）
    const msg_signature = decodeURIComponent(req.query.msg_signature || '');
    const timestamp = decodeURIComponent(req.query.timestamp || '');
    const nonce = decodeURIComponent(req.query.nonce || '');
    const echostr = decodeURIComponent(req.query.echostr || '');

    // 3.2 验证参数完整性（保持不变）
    if (!msg_signature || !timestamp || !nonce || !echostr) {
      return res.status(400).send('参数不完整');
    }

    // 3.3 生成签名（逻辑不变，但基于解码后的参数）
    const sortedArr = [config.token, timestamp, nonce].sort(); // 按字典序排序
    const combinedStr = sortedArr.join(''); // 拼接字符串
    const signature = crypto.createHash('sha1').update(combinedStr).digest('hex'); // 生成SHA1签名

    // 3.4 对比签名（基于解码后的参数）
    if (signature !== msg_signature) {
      console.error('签名不匹配：生成的签名=', signature, '传入的签名=', msg_signature);
      return res.status(403).send('签名验证失败，非法请求');
    }

    // 3.5 解密并返回echostr（保持不变）
    const decodedEchostr = decryptEchostr(echostr, config.encodingAESKey, config.corpId);
    res.send(decodedEchostr);

  } catch (error) {
    console.error('处理请求失败：', error);
    res.status(500).send('服务器内部错误');
  }
});

// 4. 解密工具函数（保持不变）
function decryptEchostr(encryptedStr, encodingAESKey, corpId) {
  try {
    const aesKey = Buffer.from(encodingAESKey + '=', 'base64');
    const iv = aesKey.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(true);

    let decoded = decipher.update(encryptedStr, 'base64', 'utf8');
    decoded += decipher.final('utf8');

    const corpIdInDecoded = decoded.slice(-corpId.length);
    if (corpIdInDecoded !== corpId) {
      throw new Error('解密后CorpId不匹配');
    }

    return decoded.slice(16, -corpId.length);

  } catch (error) {
    throw new Error('echostr解密失败：' + error.message);
  }
}

// 5. 启动服务（保持不变）
const port = 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`服务已启动，监听地址：http://0.0.0.0:${port}/wechat/callback`);
  console.log('请确保企业微信后台的回调URL配置为：你的服务器公网IP:3000/wechat/callback');
});