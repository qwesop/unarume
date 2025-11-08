/** const { SlashCommandBuilder, EmbedBuilder } = require("discord.js")

async function run({ interaction }) {
    try {
        await interaction.deferReply({ ephemeral: true });

            const query = 
                `query ($search: String) {
                    Media(search: $search, type: ANIME) {
                        id
                        title {
                            romaji
                            native
                        }
                        description(asHtml: false)
                        averageScore
                        coverImage {
                            large
                        }
                        season
                        seasonYear
                        genres
                        siteUrl
                        isAdult
                        studios(isMain: true) {
                            edges {
                                node {
                                    name
                                }
                            }
                        }
                    }
                }`;

            const variables = { search: interaction.options.getString('title') };

            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query, variables}),
            });

            const data = await response.json();
            const anime = data.data?.Media;

            if (!anime) {
                return interaction.followUp('애니를 찾을 수가 없어요')
            }

            const animeinfo = new EmbedBuilder()
                .setTitle(`${anime.title.native}(${anime.title.romaji})`)
                .setDescription(anime.description)


    } catch (e) {
        console.log(`There's an error in anilist_viewer.js!`, e);
    }
}

const data = new SlashCommandBuilder()
    .setName('애니검색')
    .setDescription('Anilist.co 사이트에서 애니메이션을 검색합니다.')
    .addStringOption((option) => option
        .setName('aniname_input')
        .setDescription('애니 제목을 입력해주세요. (일본어/로마자/영어 제목 사용 권장)')
        .setRequired(true)
    )

module.exports = { data, run }

*/