const { SlashCommandBuilder } = require("discord.js");
const NormalMessage = require("../models/NormalMessage.js");

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
                console.log(`${username}(${userId})님이 ${input}을 ${response}라고 가르치려고 했으나 우나르메는 이미 그 단어를 배웠어요.`);
                return interaction.followUp('저... 그거, 이미 아는데요?.\n-# (자신이 가르친 단어라면 지우고 다시 시도해주세요.)');
            }

            /** if (input.includes(" ")) {
                console.log(`${username}(${userId})님이 ${input}에 단어가 아닌 걸 넣어서 ${response}라는 답변을 배우지 않았어요.`);
                return interaction.followUp('반응할 메시지는 단어로 입력해 주세요.');
            } */

            const normalMessage = new NormalMessage({
                inputmsg: input,
                response: response,
                userId: userId,
            })

            normalMessage
                .save()
                .then(() => {
                    console.log(`${username}(${userId})님이 ${input}을 ${response}라고 가르쳤어요.`);
                    interaction.followUp(`'${input}'은 '${response}'라고 말하면 되는 거군요, 잘 알겠어요!`);
                }).catch((e) => {
                    console.log(`${username}(${userId})님이 ${input}을 ${response}라고 알려준 걸 배우는 과정에서 오류가 발생했어요...`, e);
                    interaction.followUp(`으앙... 알려주신 내용이 머릿속에 들어가지 않아요...`);
                });

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