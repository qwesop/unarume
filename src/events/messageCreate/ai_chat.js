const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// 나중에 사용할 일 생길 거 같아서 임시로 만들어놓는 코드

/** 임시 로깅
 * 
 * function logMessage(username, userinput, response) {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir); // logs 폴더 없으면 생성

    const date = new Date();
    const fileName = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.txt`; // 날짜별 파일
    const logPath = path.join(logDir, fileName);

    const logEntry = `
[${date.toLocaleString('ko-KR')}]
유저: ${username}
입력: ${userinput}
응답: ${response}
${'─'.repeat(50)}`;

    fs.appendFileSync(logPath, logEntry, 'utf8');
}*/

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // 소넷 하루 100달러 무료때 쓴 거 (아무래도 클로드는 비싸서 나중에 돈 생기면 젬민이 쓸 듯)
});

/** 테스트용 서버만 걸러내는거 
 * 
 * const ALLOWED_CHANNEL_IDS = [
    '채널id였던것', // 허용할 채널 ID
]; */

async function aichat(username, userinput) {
    const message = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 8096,
        system: null, // username이 프롬에 쓰임 (내가 만든 프롬이 아니라서 제거함)
        messages: [
            { role: "user", content: `${userinput}` }
        ],
    });

    console.log(message.content[0].text);
    return message.content[0].text;
}

module.exports = async (message) => {
    const prefix = 'ai)'; // ai채팅이랑 일반 입력 구별하는 접두사. 나중에 ai채팅은 ai채팅방에서 봇이 생성한 스레드에서만 하게 하고 싶음
    if (message.author.bot) return;
    // if (!ALLOWED_CHANNEL_IDS.includes(message.channel.id)) return;
    if (!message.content.startsWith(prefix)) return;

    // 1. "입력 중..." 메시지 먼저 답장으로 전송
    const waitMessage = await message.reply('⏳ 답변을 생성하고 있어요...');

    const msgcontent = message.content.substring(prefix.length).trim();

    try {
        await message.channel.sendTyping(); // 입력하고 있어요 <- 이거보다 slashcommand 쓸 때처럼 deferReply 같이 보이는 거 쓰면 좋겟는데 몰루겟슴

        const givenmessage = await aichat(message.author.username, msgcontent);
        // logMessage(message.author.username, message.content, givenmessage);

        const result = givenmessage.split("Response:")[1]?.trim();

        if (result.length > 2000) { // 봇도 킹갓니트로 기능 주면 안되냐
            const chunks = result.match(/.{1,2000}/gs); // 2000자씩 자동 분할
            try {
                await waitMessage.edit(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    await message.channel.send(chunks[i]); // 나머지는 추가 전송
                }
            } catch {
                await waitMessage.edit('형식 안맞아서 메시지 출력 실패함'); // rp 아닌 답변은 거름
                console.log(result);
            }
        } else {
            try {
                await waitMessage.edit(result);
            } catch {
                await waitMessage.edit('형식 안맞아서 메시지 출력 실패함');
                console.log(result);
            }
        }

    } catch (err) {
        console.error("오류:", err);
        // 3. 오류 시 대기 메시지를 오류 메시지로 편집
        await waitMessage.edit('❌ 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    }
}