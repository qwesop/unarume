const { SlashCommandBuilder, PermissionFlagsBits, userMention } = require("discord.js");

async function run({ interaction }) {
    try {
        await interaction.deferReply({ ephemeral: true });
            const userId = interaction.user.id;
            const number = interaction.options.getInteger('number');
            const includes = interaction.options.getString('includes');
            const targetUser = interaction.options.getUser('user');
            const mode = interaction.options.getString('mode')
            const serverId = interaction.guildId;
            const channelId = interaction.channelId;
            const username = await interaction.user.username;
            
            if (number <= 0) {
                return interaction.followUp('어... 없는 메시지를 만들라는 건가요...?\n-# 1 이상 100 이하의 정수를 입력해주세요.');
            }
            if (number > 100) {
                return interaction.followUp('으에... 메시지가 너무 많... 에러...\n-# 디스코드 API 정책 상 메시지는 한 번에 100개까지만 처리 가능합니다.');
            }

            try {
                let targetMessages = await interaction.channel.messages.fetch({ limit: number })
                let typetext = '';

                if (includes) {
                    if (!mode || mode == 'include') {
                        targetMessages = targetMessages.filter(msg => msg.content.includes(includes));
                        typetext = '포함된 '
                    } else if (mode == 'exclude') {
                        targetMessages = targetMessages.filter(msg => !msg.content.includes(includes));
                        typetext = '포함되지 않은 '
                    } else {
                        return interaction.followUp(`${mode}라는 모드는 처음 들어보는데요...?`);
                    }

                    if (targetMessages.size === 0 && !targetUser) { //일치하는 메시지가 범위 내에 없음
                        const msgcont = `${number}개의 메시지 중에 \`${includes}\`이(가) ` + typetext + `메시지가 없는 것 같아요...`
                        return interaction.followUp(msgcont);
                    }
                }

                if (targetUser) {
                    targetMessages = targetMessages.filter(msg => msg.author.id === targetUser.id);
                    if (targetMessages.size === 0) { //일치하는 메시지가 범위 내에 없음
                        const rtmsgcontents =
                            `${number}개의 메시지 중에 ${targetUser}님이 작성한 `
                            + (includes ? `메시지가 없거나, \`${includes}\`이(가) ` : ``)
                            + typetext
                            + `메시지가 없는 것 같아요...`  
                        return interaction.followUp(rtmsgcontents);
                    }
                }

                // 배열 형태로 변환
                targetMessages = targetMessages.first(number);

                // 구한 타겟 메시지들로 일괄 삭제를 진행합니다. (14일 지난 메시지는 자동 무시됨)
                const deletedMessages = await interaction.channel.bulkDelete(targetMessages, true);
            
                // 삭제하려고 했던 원본 개수와 실제로 삭제된 개수
                const deletedCount = deletedMessages.size;
                const skippedCount = number - deletedCount;

                // 결과 안내 메시지 작성
                let replyContent = 
                    `${number}개의 메시지 중 ` 
                    + (targetUser ? `${userMention(targetUser)} 님이 작성한 ` : ``)
                    + (includes ? `\`${includes}\`이(가) ` : ``)
                    + typetext
                    + `메시지 ${deletedCount}개를 삭제했어요! `;

                let logContent =
                    `${username}(${userId})님이 ${serverId}.${channelId}에서 `
                    + (includes ? `${number}개의 메시지 중 ${includes}이(가) ` : ``)
                    + typetext
                    + (targetUser ? `${targetUser}님이 작성한 ` : ``)
                    + `메시지 ${deletedCount}개를 삭제했어요. `;


                // 삭제하지 못한 14일 경과 메시지가 있다면 안내 문구 추가
                if (skippedCount > 0) {
                    replyContent += `\n-# ⚠️ 그 중 ${skippedCount}개는 메시지 전송 이후 14일이 지났거나, 존재하지 않는 메시지라서 삭제하지 못했어요...`;
                    logContent += ` (그 중 ${skippedCount}개는 삭제에 실패했어요.)`
                }

                console.log(logContent);
                return interaction.followUp(replyContent);
            
            } catch (error) {
                console.error(error);
                return interaction.followUp('메시지를 삭제하는 도중 오류가 발생했어요...');
            }

    } catch (e) {
        console.log(`There's an error in message_delete.js!`, e);
    }
}

const data = new SlashCommandBuilder()
    .setName('메시지삭제')
    .setDescription('채팅을 간편하게 일괄삭제하는 명령어입니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) => option
        .setName('number')
        .setDescription('삭제할 메시지의 갯수(특정 메시지 값의 경우 범위)를 입력해주세요.')
        .setRequired(true)
    )
    .addStringOption((option) => option
        .setName('includes')
        .setDescription('이 칸을 입력하는 경우, 입력한 수의 채팅 중 입력한 값을 포함하는 채팅만 삭제합니다.')
        .setRequired(false)
    )
    .addStringOption((option) => option
        .setName('mode')
        .setDescription('include에 대해 포함/제외 모드를 설정할 수 있습니다. include 미입력 시 해당 옵션은 무시되며, 해당 옵션 미입력 시 포함모드로 설정됩니다.')
        .setRequired(false)
        .addChoices(
            { name: 'include', value: 'include' },
            { name: 'exclude', value: 'exclude' }
        )
    )
    .addUserOption((option) => option
        .setName('user')
        .setDescription('삭제 대상이 되는 유저를 입력하세요.')
        .setRequired(false)
    );

module.exports = { data, run }
