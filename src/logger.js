require('dotenv').config();
const { client } = require('./index.js');

const logChannelId = process.env.LOGGING_CHANNEL;

const sendLog = async (message) => {
  try {
    const channel = await client.channels.fetch(logChannelId);
    if (!channel) return console.error('로깅할 채널을 찾을 수 없어요...');
    await channel.send(`${message}`);
  } catch (e) {
    console.error('로그를 전송하는 도중 오류가 발생해 버렸어요...', e);
  }
};

const originalLog = console.log;
console.log = (...args) => {
  const msg = args.join(' ');
  originalLog(...args);
  sendLog(msg);
};
