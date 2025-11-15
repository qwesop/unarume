/**
 * {choice:'a'|percent,'b'|percent,'c'|percent} a, b, c를 각각의 확률에 따라 답변합니다. 전부 확률을 적지 않으면 균등확률로 답변합니다.
 * {mention} 채팅을 입력한 사람을 멘션합니다.
 * {br} 채팅 하나 안에서 줄을 바꿉니다.
 * {rand(a, b)} a~b 사이 정수를 랜덤으로 출력합니다.
 * {wait:x} 이 태그를 기준으로 앞 뒤가 다른 채팅으로 나뉘며, 이 태그 앞 메시지 전송 후 x초 기다린 후 뒤의 내용이 전송됩니다.
 */

const { SlashCommandBuilder } = require("discord.js");
const NormalMessage = require("../models/NormalMessage.js");
const judgetemplete = require("../tools/judgetemplete.js")

async function run({ interaction }) {
    try {
        await interaction.deferReply({ ephemeral: false });
            const userId = interaction.user.id;
            const input = interaction.options.getString('input');
            const response = interaction.options.getString('response');
            const username = await interaction.user.username;
            const duplicateExist = await NormalMessage.exists({
                inputmsg: input
            });

            if (duplicateExist) {
                console.log(`${username}(${userId})님이 '${input}'을(를) '${response}'(이)라고 가르치려고 했으나 우나르메는 이미 그 단어를 배웠어요.`);
                return interaction.followUp('저... 그거, 이미 아는데요?.\n-# 자신이 가르친 단어라면 지우고 다시 시도해주세요.');
            }

            /** if (input.includes(" ")) {
                console.log(`${username}(${userId})님이 ${input}에 단어가 아닌 걸 넣어서 ${response}라는 답변을 배우지 않았어요.`);
                return interaction.followUp('반응할 메시지는 단어로 입력해 주세요.');
            } */

            const doesErrorExist = judgetemplete(response, userId, username, input);

            if (doesErrorExist == null) {
                const normalMessage = new NormalMessage({
                    inputmsg: input,
                    response: response,
                    userId: userId,
                })

                normalMessage
                    .save()
                    .then(() => {
                        console.log(`${username}(${userId})님이 '${input}'을(를) '${response}'(이)라고 가르쳤어요.`);
                        interaction.followUp(`'${input}'은(는) 그렇게 말하면 되는 거네요, 잘 알겠어요!\n-# 답변을 DB에 성공적으로 저장했습니다.`);
                    }).catch((e) => {
                        console.log(`${username}(${userId})님이 '${input}'을(를) '${response}'(이)라고 알려준 걸 배우는 과정에서 오류가 발생했어요...`, e);
                        interaction.followUp(`으앙... 알려주신 내용이 머릿속에 들어가지 않아요...\n-# 답변을 DB에 저장하는 도중 문제가 발생했습니다.`);
                    });
            } else {
                interaction.followUp(`${doesErrorExist}`);
            }

    } catch (e) {
        console.log(`There's an error in learn_response.js!`, e);
    }
}

const data = new SlashCommandBuilder()
    .setName('배워')
    .setDescription('우나르메에게 답변을 가르칩니다.')
    .addStringOption((option) => option
        .setName('input')
        .setDescription('우나르메가 반응해줄 단어를 입력해주세요.')
        .setRequired(true)
    )
    .addStringOption((option) => option
        .setName('response')
        .setDescription('우나르메가 답변할 내용을 입력해주세요.')
        .setRequired(true)
    )

module.exports = { data, run }
