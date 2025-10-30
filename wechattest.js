const express = require('express');
const crypto = require('crypto');
const app = express();

// 1. 配置企业微信参数（务必替换为你的实际信息）
const config = {
  token: 'YOUR_ENTERPRISE_WECHAT_TOKEN', // 企业微信后台配置的Token
  encodingAESKey: 'YOUR_ENTERPRISE_WECHAT_AES_KEY', // 企业微信后台配置的EncodingAESKey
  corpId: 'YOUR_ENTERPRISE_WECHAT_CORP_ID' // 你的企业ID（文档中“ReceiverId”，即接收方CorpID）
};

// 2. 中间件：解析URL参数 + 处理POST请求体（文档要求POST为XML格式，需xml2js解析）
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// 安装xml2js依赖：npm install xml2js
const { parseString } = require('xml2js');

// 3. 核心回调接口（同时支持GET验证和POST消息接收，完全对照文档）
app.all('/wechat/callback', (req, res) => {
  try {
    // 3.1 提取URL参数并URL解码（文档要求：参数可能经过URL编码）
    const msgSignature = decodeURIComponent(req.query.msg_signature || '');
    const timestamp = decodeURIComponent(req.query.timestamp || '');
    const nonce = decodeURIComponent(req.query.nonce || '');

    // 3.2 区分请求类型：GET验证 / POST接收消息
    if (req.method === 'GET') {
      // --- GET请求：验证回调URL（文档3.1节）---
      const echostr = decodeURIComponent(req.query.echostr || '');
      // 步骤1：验证参数完整性
      if (!msgSignature || !timestamp || !nonce || !echostr) {
        return res.status(400).send('参数不完整（缺少msg_signature/timestamp/nonce/echostr）');
      }
      // 步骤2：生成签名（文档3.2节：签名源串 = Token + Timestamp + Nonce + Echostr）
      const signatureSource = [config.token, timestamp, nonce, echostr].sort().join('');
      const generatedSignature = crypto.createHash('sha1').update(signatureSource).digest('hex');
      // 步骤3：对比签名
      if (generatedSignature !== msgSignature) {
        console.error(`GET签名不匹配：生成=${generatedSignature}，传入=${msgSignature}`);
        return res.status(403).send('签名验证失败（GET）');
      }
      // 步骤4：解密echostr并返回（文档3.3节：AES解密）
      const decodedEchostr = decryptMsg(echostr, config.encodingAESKey, config.corpId);
      res.send(decodedEchostr);

    } else if (req.method === 'POST') {
      // --- POST请求：接收企业微信消息（文档4.1节）---
      // 步骤1：获取POST的XML消息体（文档要求：消息体为XML格式）
      let xmlBody = '';
      req.on('data', chunk => xmlBody += chunk);
      req.on('end', async () => {
        // 步骤2：解析XML为JSON（提取加密消息体Encrypt）
        parseString(xmlBody, (err, result) => {
          if (err) {
            console.error('XML解析失败：', err);
            return res.status(400).send('消息体不是合法XML');
          }
          const encryptMsg = result.xml.Encrypt[0] || '';
          // 步骤3：验证参数完整性
          if (!msgSignature || !timestamp || !nonce || !encryptMsg) {
            return res.status(400).send('参数不完整（缺少msg_signature/timestamp/nonce或Encrypt）');
          }
          // 步骤4：生成签名（文档4.2节：签名源串 = Token + Timestamp + Nonce + Encrypt）
          const signatureSource = [config.token, timestamp, nonce, encryptMsg].sort().join('');
          const generatedSignature = crypto.createHash('sha1').update(signatureSource).digest('hex');
          // 步骤5：对比签名
          if (generatedSignature !== msgSignature) {
            console.error(`POST签名不匹配：生成=${generatedSignature}，传入=${msgSignature}`);
            return res.status(403).send('签名验证失败（POST）');
          }
          // 步骤6：解密Encrypt消息体（文档4.3节：得到原始消息XML）
          const decryptedMsg = decryptMsg(encryptMsg, config.encodingAESKey, config.corpId);
          console.log('解密后的原始消息：', decryptedMsg);
          // 步骤7：返回成功响应（企业微信要求：需返回XML格式的success）
          res.set('Content-Type', 'application/xml');
          res.send('<xml><return_code><![CDATA[success]]></return_code></xml>');
        });
      });

    } else {
      res.status(405).send('不支持的请求方法（仅支持GET/POST）');
    }

  } catch (error) {
    console.error('回调处理异常：', error);
    res.status(500).send('服务器内部错误');
  }
});

// 4. 通用解密函数（完全对照文档3.3节/AES-256-CBC规范）
/**
 * @param {string} encryptedData - 待解密的字符串（echostr或Encrypt）
 * @param {string} encodingAESKey - 企业微信配置的EncodingAESKey
 * @param {string} receiverId - 接收方ID（企业CorpID）
 * @returns {string} 解密后的原始数据
 */
function decryptMsg(encryptedData, encodingAESKey, receiverId) {
  try {
    // 步骤1：EncodingAESKey解码（文档：EncodingAESKey = Base64编码的32字节密钥）
    const aesKey = Buffer.from(encodingAESKey, 'base64');
    if (aesKey.length !== 32) {
      throw new Error('EncodingAESKey无效（需为32字节Base64编码）');
    }

    // 步骤2：IV生成（文档：IV = AESKey前16字节）
    const iv = aesKey.slice(0, 16);

    // 步骤3：AES解密（CBC模式，PKCS#7填充，Base64解码密文）
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    // 启用PKCS#7填充（Node.js默认PKCS#5，需手动指定PKCS#7）
    decipher.setAutoPadding(true);

    // 解密过程：先Base64解码密文，再解密
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // 步骤4：验证并提取原始数据（文档：解密后格式 = 16字节随机串 + 4字节数据长度 + 原始数据 + 接收方ID）
    // 4.1 提取4字节数据长度（网络字节序，大端）
    const lengthBuf = Buffer.from(decrypted.slice(16, 20), 'utf8');
    const dataLength = lengthBuf.readUInt32BE(0); // 大端读取32位整数

    // 4.2 提取原始数据和接收方ID
    const rawData = decrypted.slice(20, 20 + dataLength);
    const decryptedReceiverId = decrypted.slice(20 + dataLength);

    // 4.3 验证接收方ID（防止数据篡改）
    if (decryptedReceiverId !== receiverId) {
      throw new Error(`接收方ID不匹配：解密得到=${decryptedReceiverId}，预期=${receiverId}`);
    }

    return rawData;

  } catch (error) {
    throw new Error(`解密失败：${error.message}`);
  }
}

// 5. 启动服务（监听3000端口，允许所有地址访问）
const port = 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`服务已启动，回调地址：http://0.0.0.0:${port}/wechat/callback`);
  console.log('请确保企业微信后台配置：');
  console.log(`- 回调URL：http://你的公网IP:${port}/wechat/callback`);
  console.log('- 消息加解密模式：需与代码一致（当前为“安全模式”，需配置EncodingAESKey）');
});