const { SlashCommandBuilder, userMention } = require("discord.js");
const NormalMessage = require("../models/NormalMessage.js");

async function run({ interaction }) {
    try {
        await interaction.deferReply({ ephemeral: false });
            const userId = interaction.user.id;
            const input = interaction.options.getString('input');
            const username = await interaction.user.username;
            const findmsg = await NormalMessage.findOne({
                inputmsg: input,
            });

            if (findmsg) {
                // 코드 동작
                /** if (input.includes(" ")) {
                    console.log(`${username}(${userId})님이 ${input}라고 단어가 아닌 걸 삭제하려고 했어요.`);
                    return interaction.followUp('반응할 메시지는 단어로 입력해 주세요.');
                } */

                if (findmsg.userId !== userId) {
                    console.log(`${username}(${userId})님이 '${input}'을 잊으라고 했는데, 그건 그 분이 알려주신 게 아니에요.`);
                    return interaction.followUp(`${userMention(userId)}님이 알려주신 게 아니잖아요...?`);
                }

                NormalMessage.findOneAndDelete({ inputmsg: input })
                    .then(() => {
                        console.log(`${username}(${userId})님이 '${input}'을 잊게 했어요.`);
                        interaction.followUp(`'${input}'? 그런 거 저는 잘 모르겠어요...`);
                    }).catch((e) => {
                        console.log(`${username}(${userId})님이 '${input}'을 잊으라고 했는데, 이상하게 머릿속에서 떠나지 않아요...`, e);
                        interaction.followUp(`으앙... 어째서 머릿속에 계속 기억이 남을까요...`);
                    });

            } else {
                console.log(`${username}(${userId})님이 '${input}'라는 제가 모르는 걸 잊으라고 했어요.`);
                return interaction.followUp('그런 건 저는 모르는데요...?\n-# 등록되지 않은 단어입니다.');
            }

    } catch (e) {
        console.log(`There's an error in learn_response.js!`, e);
    }
}

const data = new SlashCommandBuilder()
    .setName('잊어')
    .setDescription('우나르메가 답변을 잊게 합니다.')
    .addStringOption((option) => option
        .setName('input')
        .setDescription('우나르메가 잊을 메시지를 입력해 주세요.')
        .setRequired(true)
    )

module.exports = { data, run }
