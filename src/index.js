require('dotenv').config();
require('./logger.js');
const { Routes, REST, Client, IntentsBitField, userMention, EmbedBuilder } = require('discord.js');
const { CommandHandler } = require('djs-commander');
const mongoose = require('mongoose');
const path = require('path');
const NormalMessage = require('./models/NormalMessage');

const rest = new REST().setToken(process.env.TOKEN);

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

client.on('ready', (c) => {
    console.log(`%c${c.user.tag} is online:)`, 'color: aqua'); //누가봐도 봇 시작시 로그
    /**rest.delete(Routes.applicationCommand('1172826374139039805', 'commandid'))
	.then(() => console.log('Successfully deleted application command'))
	.catch(console.error);*/
    //이거 슬래시커맨드 잘못 등록했을때 지우는 코드임
});

// 메시지 올라온 거 감지
client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id) return;

	const prefix = '우나르메야 ';
    if (message.content.startsWith(prefix)) {
        const msg = message.content.substring(prefix.length).trim();

        // 답변 찾기
        const foundmsg = await NormalMessage.findOne({ inputmsg: msg });

        if (foundmsg !== null) {
            console.log(`${message.author.username}(${message.author.id})님이 ${msg}라고 저에게 말했어요.`)
            await message.channel.send(foundmsg.response);
        } else {
            console.log(`${message.author.username}(${message.author.id})님이 ${msg}라고 저에게 말했는데, 저는 그걸 모르는데 어떡하죠...`)
            await message.channel.send('...?\n-# 우나르메가 알아듣지 못한 것 같다. (우나르메가 아직 배우지 못한 말이에요.)')
        }
    }
    // TODO: 밴한 사람 답변 안해주는 로직 만들기

});

new CommandHandler({ //../commands 폴더에 있는 커맨드들 다 등록
    client,
    commandsPath: path.join(__dirname, 'commands'),
    //eventsPath: path.join(__dirname, 'events'),
});

mongoose.connect(process.env.MONGODB_URI).then(() => { //db연결, 봇 로그인
    client.login(process.env.TOKEN);
    console.log('connected database');
}); 

module.exports = {};
