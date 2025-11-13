require('dotenv').config();
const { Routes, REST, Client, IntentsBitField, userMention, EmbedBuilder } = require('discord.js');
const { CommandHandler } = require('djs-commander');
const mongoose = require('mongoose');
const path = require('path');
const NormalMessage = require('./models/NormalMessage');
const parsing = require('./tools/parsing.js');

const rest = new REST().setToken(process.env.TOKEN);

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});

client.on('clientReady', (c) => {
    console.log(`${c.user.tag}가 활동을 시작했어요!`); //누가봐도 봇 시작시 로그
    /**rest.delete(Routes.applicationCommand('1172826374139039805', 'commandid'))
	.then(() => console.log('Successfully deleted application command'))
	.catch(console.error);*/
    //이거 슬래시커맨드 잘못 등록했을때 지우는 코드임
});

// 메시지 올라온 거 감지
client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id) return;

	const prefix = '우나르메야';

    if (message.content.startsWith(prefix)) {
        const msg = message.content.substring(prefix.length).trim();

        // 답변 찾기
        const foundmsg = await NormalMessage.findOne({ inputmsg: msg });

        if (foundmsg !== null && foundmsg !== undefined) {
            completemsg = parsing(foundmsg.response, userMention(message.author.id))
            const user = await client.users.fetch(foundmsg.userId)

            for (const sendmsg of completemsg) {
                await new Promise(resolve => setTimeout(resolve, sendmsg.wait * 1000)); // wait 초 만큼 대기
                const userWatermark = foundmsg.userId == '899881722559205396' ? "" : `\n-# ${user.username}님이 가르쳐 주셨어요!`;
                await message.channel.send(sendmsg.text + userWatermark);
            }
            console.log(`${message.author.username}(${message.author.id})님이 '${msg}'(이)라고 저에게 말했어요.`)
        } else {
            console.log(`${message.author.username}(${message.author.id})님이 '${msg}'(이)라고 저에게 말했는데, 저는 그걸 모르는데 어떡하죠...`)
            await message.channel.send('...?\n-# 우나르메가 알아듣지 못한 것 같다. (우나르메가 아직 배우지 못한 말이에요.)')
        }
    }

    // TODO: 밴한 사람 답변 안해주는 로직 만들기
    // 걍 학습을 금지시키는게 맞는듯 이상한거 가르치는 애들

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

module.exports = { client };

require('./logger.js');

// rand(} 따구로 적은거 정수 아니라고 난리치는거 형식 오류라고 출력해주기 <- 큰 문제 아니라서 일단은 넘어감

/**
 * TODO: 아래 오류 고치기
 * 
 * choice 안에서 wait로 메시지 쪼개면 이상하게 파싱되어서 출력됨
 * 
 * 예시:
 * {choice:'레몬은 레몬 4개만큼의 비타민이 있다고 해요. {wait:1} {br}근데 우나르메는 자동차에서 아이스크림을 먹다가 사장님이 잘리는 걸 봤어요. {wait:1} {br}그래서 소방서에 가서 몰로토프 칵테일 제조법을 배워서 경찰 진영에 협력했어요.'|0.3, '아무말'|0.4, '저는 사실 파일럿이 아니라 나무꾼이 되서 정의로운 도둑이 되고 싶었어요.'|0.3} {br} {wait:1.3} {mention}님 제 말 먹고 있는거 맞죠?

# 니 메시지 분석
    ## 30퍼
        ```레몬은 레몬 4개만큼의 비타민이 있다고 해요.
        1초 휴식 
        근데 우나르메는 자동차에서 아이스크림을 먹다가 사장님이 잘리는 걸 봤어요. 
        1초 휴식
        그래서 소방서에 가서 몰로토프 칵테일 제조법을 배워서 경찰 진영에 협력했어요.```
    ## 40퍼
        ```아무말```
    ## 30퍼
        ```저는 사실 파일럿이 아니라 나무꾼이 되서 정의로운 도둑이 되고 싶었어요.```
    # choice 탈피 후 공통메시지
        ```1.3초 휴식
        {mention}님 제 말 먹고 있는거 맞죠?```
 */