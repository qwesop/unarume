// 유저가 원래 입력한 검색어 로그+메시지에 넣기

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js")

async function run({ interaction }) {
    try {
        await interaction.deferReply({ ephemeral: false });
        const userId = interaction.user.id;
        const username = await interaction.user.username;
        const animeName = interaction.options.getString('anime_name');
        
        const query = `
        query ($search: String) {
            Media(search: $search, type: ANIME) {
                id
                title {
                    romaji
                    native
                }
                description(asHtml: false)
                coverImage {
                    large
                }
                startDate {
                    year
                }
                season
                studios(isMain: true) {
                    nodes {
                        name
                    }
                }
                averageScore
                genres
                tags {
                    name
                }
                isAdult 
                siteUrl
                recommendations(sort: RATING_DESC, page: 1, perPage: 100) {
                    nodes {
                        mediaRecommendation {
                            id
                            title {
                                romaji
                                native
                            }
                            description(asHtml: false)
                            coverImage {
                                large
                            }
                            startDate {
                                year
                            }
                            season
                            studios(isMain: true) {
                                nodes {
                                    name
                                }
                            }
                            averageScore
                            genres
                            tags {
                                name
                            }
                            isAdult 
                            siteUrl
                        }
                    }
                }
            }
        }
        `;

        const variables = { search: animeName };
        
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables }),
        });
        
        const data = await response.json();
        
        if (!data.data.Media) {
            console.log(`'${animeName}'라는 애니를 찾는 데 실패했어요.`);
            return interaction.followUp(`그런 이름의 애니는 모르겠어요...\n-# 애니 검색에 실패했습니다. 다른 이름으로 시도해주세요. (유효한 이름: 로마자, 애니 원어 이름, 영어 번역 이름)`);
        }
        
        const anime = data.data.Media;
        
        // NSFW 체크 (이전과 동일)
        if (anime.isAdult && !interaction.channel.nsfw) {
            console.log(`${username}(${userId})님이 ${anime.title.romaji}(을)를 nsfw 채널이 아닌 곳에서 검색했어요... 우으...`);
            interaction.followUp(`${animeName}...?`);
            await new Promise(resolve => setTimeout(resolve, 700));
            interaction.channel.send('... *(생각 중)*');
            await new Promise(resolve => setTimeout(resolve, 2000));
            return interaction.channel.send('...! 하... 하우우... 그런 건 안돼요...!\n-# 해당 애니는 NSFW 채널에서만 검색 가능합니다.');
        }

        // 추천 애니메이션 데이터 정제
        // mediaRecommendation이 null인 경우(직접적인 추천 미디어 데이터가 없는 경우) 필터링
        // 추천 목록 필터링 (null 값 제거 + NSFW 채널이 아닐 경우 성인물 제외)
        const recommendations = anime.recommendations.nodes
            .map(node => node.mediaRecommendation)
            .filter(media => {
                // 데이터가 없으면 제외
                if (!media) return false;
                // 애니가 성인물인데, 채널이 NSFW가 아니면 제외
                if (media.isAdult && !interaction.channel.nsfw) return false;
                return true;
            });

        // 엠베드 생성 헬퍼 함수 (검색 애니와 추천 애니 모두 사용)
        const createEmbed = (data, footerText = null) => {
            const studios = data.studios.nodes.map(studio => studio.name).join(', ') || '정보 없음';
            const score = data.averageScore ? (data.averageScore / 10).toFixed(1) : '정보 없음';
            let cleanDesc = data.description ? data.description.replace(/<[^>]+>/g, '') : '설명 없음';
            const title = data.title.romaji || data.title.native || '정보 없음';

            // (Source: 부분부터 끝까지 제거
            if (cleanDesc.includes('(Source:')) {
                cleanDesc = cleanDesc.split('(Source:')[0].trim();
            }
            
            // 태그 데이터 처리 (상위 5개만)
            const tags = data.tags && data.tags.length > 0 
                ? data.tags.slice(0, 10).map(t => t.name).join(', ') 
                : '정보 없음';

            // 시즌 -> 분기 변환 맵핑
            const seasonMap = {
                'WINTER': '1분기',
                'SPRING': '2분기',
                'SUMMER': '3분기',
                'FALL': '4분기'
            };
            const seasonText = data.season ? (seasonMap[data.season] || data.season) : '';

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'From Anilist.co', url: 'https://anilist.co' })
                .setTitle(title)
                .setDescription(cleanDesc)
                .setURL(data.siteUrl)
                .setImage(data.coverImage.large)
                .addFields(
                    { name: '📆 방영시기', value: `${data.startDate.year + '년' || '정보 없음'} ${seasonText}`, inline: true },
                    { name: '📽️ 제작사', value: studios, inline: true },
                    { name: '📊 평점', value: score, inline: true },
                    { name: '🏷️ 태그', value: tags, inline: true },
                    { name: '📚 장르', value: data.genres.join(', ') || '정보 없음', inline: true }
                );

            if (footerText) {
                embed.setFooter({ text: footerText });
            }

            return embed;
        };

        // 초기 상태 설정
        let isRecommendationMode = false;
        let currentIndex = 0; // 추천 애니 인덱스

        // 버튼 생성 함수
        const getComponents = () => {
            const row = new ActionRowBuilder();

            if (!isRecommendationMode) {
                // 검색 애니 화면: 추천 보기 버튼만 표시 (추천 애니가 있을 경우에만)
                if (recommendations.length > 0) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('recommendations')
                            .setLabel('✨ 추천 애니')
                            .setStyle(ButtonStyle.Primary)
                    );
                }
            } else {
                // 추천 애니 화면: 이전/원래대로/다음 버튼
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('view_original')
                        .setLabel('🎞️ 이전 화면으로')
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentIndex === 0), // 첫 번째면 비활성화

                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('➡️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentIndex === recommendations.length - 1) // 마지막이면 비활성화
                );
            }
            return row.components.length > 0 ? [row] : [];
        };

        // 초기 메시지 전송
        const initialEmbed = createEmbed(anime);
        const responseMsg = await interaction.followUp({ 
            content: '여기 요청하신 애니 정보에요!',
            embeds: [initialEmbed], 
            components: getComponents() 
        });

        console.log(`${username}(${userId})님이 ${anime.title.romaji}(을)를 검색했어요.`);

        // 버튼 인터랙션 컬렉터
        const collector = responseMsg.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 180_000 // 3분간 유효
        });

        collector.on('collect', async (i) => {
            // 요청자 본인만 버튼 조작 가능
            if (i.user.id !== userId) {
                return i.reply({ content: '다른 분 걸 건들지 말아주세요...', ephemeral: true });
            }

            // 버튼 동작 처리
            if (i.customId === 'recommendations') {
                isRecommendationMode = true;
                currentIndex = 0;
            } else if (i.customId === 'view_original') {
                isRecommendationMode = false;
            } else if (i.customId === 'prev') {
                if (currentIndex > 0) currentIndex--;
            } else if (i.customId === 'next') {
                if (currentIndex < recommendations.length - 1) currentIndex++;
            }

            // 화면 업데이트
            if (isRecommendationMode) {
                const targetAnime = recommendations[currentIndex];
                const searchAnimeTitle = anime.title.romaji || anime.title.native;
                const footerText = `Recommandation anime of '${searchAnimeTitle}' [${currentIndex + 1}/${recommendations.length}]`;
                
                const newEmbed = createEmbed(targetAnime, footerText);
                await i.update({ content: '여기 요청하신 애니 정보에요!', embeds: [newEmbed], components: getComponents() });
            } else {
                // 원래 화면으로 복귀
                await i.update({ content: '여기 요청하신 애니 정보에요!', embeds: [initialEmbed], components: getComponents() });
            }
        });

        collector.on('end', () => {
            responseMsg.edit({ content:'3분이 지나서 상호작용을 종료했어요.', components: [] }).catch(console.error);
        });

    } catch (e) {
        console.log(`There's an error in anilist_viewer.js!`, e);
    }
}

const data = new SlashCommandBuilder()
    .setName('애니검색')
    .setDescription('Anilist.co 사이트에서 애니메이션을 검색합니다.')
    .addStringOption((option) => option
        .setName('anime_name')
        .setDescription('애니 제목을 입력해주세요. (일본어/로마자/영어 제목 사용 권장)')
        .setRequired(true)
    )

module.exports = { data, run }
