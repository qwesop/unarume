require('dotenv').config();
const { client } = require('./index.js');

const logChannelId = process.env.LOGGING_CHANNEL;

const sendLog = async (message) => {
  try {
    const channel = await client.channels.fetch(logChannelId);
    if (!channel) return console.error('로깅할 채널을 찾을 수 없어요...');
    await channel.send(message);
  } catch (e) {
    console.error('로그를 전송하는 도중 오류가 발생해 버렸어요...', e);
  }
};

const originalLog = console.log;

console.log = (...args) => {
  const processedArgs = args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    } else if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    } else {
      return String(arg);
    }
  });

  const msg = processedArgs.join(' ');

  originalLog(...processedArgs);

  sendLog(msg);
};