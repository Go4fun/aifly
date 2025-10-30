const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logDir = './logs') {
        this.logDir = logDir;
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    writeToFile(level, message) {
        const logFile = path.join(this.logDir, `wechat-group-${new Date().toISOString().split('T')[0]}.log`);
        const formattedMessage = this.formatMessage(level, message);

        try {
            fs.appendFileSync(logFile, formattedMessage + '\n');
        } catch (error) {
            console.error('写入日志文件失败:', error.message);
        }
    }

    info(message) {
        console.log(`[INFO] ${message}`);
        this.writeToFile('info', message);
    }

    error(message) {
        console.error(`[ERROR] ${message}`);
        this.writeToFile('error', message);
    }

    success(message) {
        console.log(`[SUCCESS] ${message}`);
        this.writeToFile('success', message);
    }

    warning(message) {
        console.warn(`[WARNING] ${message}`);
        this.writeToFile('warning', message);
    }
}

module.exports = Logger;