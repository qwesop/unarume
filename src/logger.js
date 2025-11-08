const fs = require('fs');
const logs = [];

const originalLog = console.log;
console.log = (...args) => {
  const message = args.join(' ');
  logs.push(message);
  originalLog(...args);
};

const saveLogs = () => {
  if (logs.length > 0) {
    try {
      fs.writeFileSync('bot-logs.txt', logs.join('\n'), 'utf-8');
      console.log('로그 저장 완료.');
    } catch (err) {
      console.error('로그 저장 실패:', err);
    }
  }
};

process.on('exit', saveLogs);
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

module.exports = {}; // 필요 시 다른 파일에서 require 가능
