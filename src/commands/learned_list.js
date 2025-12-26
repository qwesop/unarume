const { SlashCommandBuilder, userMention, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const NormalMessage = require("../models/NormalMessage.js");

async function run({ interaction }) {
    try {
        await interaction.deferReply({ ephemeral: false });
            const userId = interaction.user.id;
            const username = await interaction.user.username;
            const findmsg = await NormalMessage.find({
                userId: userId
            });

            if (findmsg) {
                const entries = findmsg.map(m => `- ${m.inputmsg}`);

                // 3) 페이지로 분할하는 유틸 (임베드 description 제한을 고려)
                function paginateEntries(entries, maxLen = 4000) {
                    const pages = [];
                    let current = '';

                    for (const e of entries) {
                        // 항목이 너무 길면 잘라서 넣거나 별도 페이지로 처리 (여기서는 항목 길이 > maxLen이면 항목을 잘라 넣음)
                        if (e.length > maxLen) {
                            // 길게 보이는 항목을 안전하게 잘라서 여러 줄로 나눔
                            const parts = [...e].join('').match(new RegExp(`.{1,${maxLen}}`, 'gs')) || [e];
                            for (const part of parts) {
                                if (current.length + part.length + 1 <= maxLen) {
                                    current += (current ? '\n' : '') + part;
                                } else {
                                    if (current) pages.push(current);
                                    current = part;
                                }
                            }
                            continue;
                        }

                        // 현재 페이지에 넣어도 되면 추가, 넘치면 새 페이지
                        if (current.length + e.length + 1 <= maxLen) {
                            current += (current ? '\n' : '') + e;
                        } else {
                            pages.push(current);
                            current = e;
                        }
                    }

                    if (current) pages.push(current);
                    return pages;
                }

                const pagesContent = paginateEntries(entries, 4000); // 안전하게 4000자로 설정
                const totalPages = pagesContent.length;

                // 4) 첫 페이지 임베드 생성
                let pageIndex = 0;
                const makeEmbed = (idx) => new EmbedBuilder()
                    .setTitle(`${username}님이 가르친 대화`)
                    .setDescription(pagesContent[idx])
                    .setFooter({ text: `대화 목록 [${idx + 1}/${totalPages}]` });

                // 버튼 생성 (disabled는 페이지 수에 따라 조정)
                const prevButton = new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('⬅️ 이전')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true); // 첫 페이지이므로 비활성화

                const nextButton = new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('➡️ 다음')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(totalPages <= 1);

                const row = new ActionRowBuilder().addComponents(prevButton, nextButton);

                // initial reply
                const replyMsg = await interaction.editReply({ embeds: [makeEmbed(pageIndex)], components: [row] });

                // 5) 버튼 인터랙션 수집기 (작성자만 허용)
                const collector = replyMsg.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 120000, // 2분 타임아웃 (필요에 따라 조정)
                });

                collector.on('collect', async (i) => {
                    // 버튼을 누른 사람이 명령어 실행자와 같지 않으면 거절
                    if (i.user.id !== userId) {
                        await i.reply({ content: '다른 분 걸 건들지 말아주세요...', ephemeral: true });
                        return;
                    }

                    // 이전/다음 처리
                    if (i.customId === 'prev') {
                        pageIndex = Math.max(0, pageIndex - 1);
                    } else if (i.customId === 'next') {
                        pageIndex = Math.min(totalPages - 1, pageIndex + 1);
                    }

                    // 버튼 활성/비활성 상태 업데이트
                    prevButton.setDisabled(pageIndex === 0);
                    nextButton.setDisabled(pageIndex === totalPages - 1);
                    const updatedRow = new ActionRowBuilder().addComponents(prevButton, nextButton);

                    // 업데이트 응답 (업데이트는 update()로 응답)
                    await i.update({ embeds: [makeEmbed(pageIndex)], components: [updatedRow] });
                });

                // collector 끝났을 때 버튼 비활성화
                collector.on('end', async () => {
                    try {
                        prevButton.setDisabled(true);
                        nextButton.setDisabled(true);
                        const disabledRow = new ActionRowBuilder().addComponents(prevButton, nextButton);
                        await interaction.editReply({ content:'2분이 지나서 상호작용을 종료했어요.', components: [disabledRow] });
                    } catch (err) {
                        // 대개 메시지 삭제로 인한 오류임
                    }
                });

            } else {
                return interaction.followUp(`${userMention(userId)}님은 저에게 가르쳐주신 게 없으시잖아요...?`);
            }

    } catch (e) {
        console.log(`There's an error in learned_list.js!`, e);
    }
}

const data = new SlashCommandBuilder()
    .setName('학습목록')
    .setDescription('우나르메에게 가르친 대화 목록을 확인합니다.')

module.exports = { data, run }