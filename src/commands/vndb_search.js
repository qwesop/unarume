/**
 * 유저들이 부르는 다른 이름(allies인가 뭐시기) 추가할지 말지 고민중 (지금 다른이름 칸은 공식이 부르는 다른 이름(altitle) 칸임)
 * 스파게티 코드 언젠가 정리 해야겟네
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");

// 텍스트 자르기 헬퍼 함수
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...(more)';
}

// [수정됨] 1. 스토리 스포일러 처리 함수 (태그용)
// level: 0=Safe, 1=Minor, 2=Major
function processStorySpoiler(content, level, showSpoilerButtonState) {
    if (level === 0) return { text: content, hidden: false, spoiler: false };

    if (showSpoilerButtonState) {
        // 버튼 ON: 1=표시, 2=스포일러 처리
        if (level === 1) return { text: content, hidden: false, spoiler: false };
        if (level === 2) return { text: `||${content}||`, hidden: false, spoiler: true };
    } else {
        // 버튼 OFF: 1=스포일러 처리, 2=미표시(숨김)
        if (level === 1) return { text: `||${content}||`, hidden: false, spoiler: true };
        if (level === 2) return { text: '', hidden: true, spoiler: true };
    }
    
    return { text: content, hidden: false, spoiler: false };
}

// [수정됨] 2. 수위(선정성/폭력성) 처리 함수 (이미지/캐릭터용)
// level: 0=Safe, 1=Suggestive, 2=Explicit
function processExplicitContent(content, level, isNsfwChannel) {
    // 수위가 0이면 안전함 -> 항상 표시
    if (level === 0) return { text: content, hidden: false, spoiler: false };

    if (isNsfwChannel) {
        // NSFW 채널: 수위(1, 2) 상관없이 정상 표시
        return { text: content, hidden: false, spoiler: false };
    } else {
        // [변경점] 일반 채널: 수위가 1 이상이면 스포일러 처리도 안 하고 아예 숨김(null 처리 유도)
        return { text: '', hidden: true, spoiler: true };
    }
}

// description에 스포일러 처리하는 함수
function safeFormatAndTruncate(text, maxLength) {
    if (!text) return '설명 없음';

    // 1. 먼저 VNDB 태그를 디스코드 문법으로 변환
    let formatted = text
        .replace(/\[url=([^\]]+)\]([^\[]+)\[\/url\]/gi, (match, url, linkText) => {
            const fullUrl = url.startsWith('/') ? `https://vndb.org${url}` : url;
            return `[${linkText}](${fullUrl})`;
        })
        .replace(/\[b\]/gi, '**').replace(/\[\/b\]/gi, '**')
        .replace(/\[i\]/gi, '*').replace(/\[\/i\]/gi, '*')
        .replace(/\[u\]/gi, '__').replace(/\[\/u\]/gi, '__')
        .replace(/\[s\]/gi, '~~').replace(/\[\/s\]/gi, '~~')
        .replace(/\[spoiler\]/gi, '||').replace(/\[\/spoiler\]/gi, '||');

    // 2. 글자 수 제한으로 자르기
    if (formatted.length <= maxLength) {
        return formatted;
    }

    let truncated = formatted.substring(0, maxLength);

    // 3. 서식 무결성 체크 (태그 닫기)
    const checkAndClose = (str, tag) => {
        // 해당 태그의 개수를 세어서 홀수이면 하나 더 붙여줌
        // 정규식 escape 처리를 위해 tag가 *일 경우 등을 대비
        const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const count = (str.match(new RegExp(escapedTag, 'g')) || []).length;
        return count % 2 !== 0 ? str + tag : str;
    };

    // 역순으로 닫아주어야 중첩된 서식이 깨지지 않음 (스택 구조와 유사)
    truncated = checkAndClose(truncated, '||'); // 스포일러
    truncated = checkAndClose(truncated, '~~'); // 취소선
    truncated = checkAndClose(truncated, '__'); // 밑줄
    truncated = checkAndClose(truncated, '**'); // 볼드
    truncated = checkAndClose(truncated, '*');  // 이탤릭

    return truncated + '...(more)';
}

async function run({ interaction }) {
    try {
        await interaction.deferReply({ ephemeral: false });
        const userId = interaction.user.id;
        const username = await interaction.user.username;
        let vnTitle = interaction.options.getString('vn_title');

        vnTitle = vnTitle === 'atri' ? 'ATRI -My Dear Moments' : vnTitle;

        // --- 1. VN 검색 (VNDB API) ---
        const queryFilters = ["search", "=", vnTitle];
        const queryFields = [
            "id", "title", "alttitle", "description", "length_minutes", "rating", "votecount", 
            "image.url", "image.sexual", "image.violence", 
            "screenshots.url", "screenshots.sexual", "screenshots.violence", "screenshots.thumbnail",
            "tags.name", "tags.rating", "tags.spoiler", "tags.category",
            "developers.name", "developers.original",
            "languages", "aliases"
        ].join(", ");

        const vnResponse = await fetch('https://api.vndb.org/kana/vn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: queryFilters, fields: queryFields })
        });

        const vnData = await vnResponse.json();

        if (!vnData.results || vnData.results.length === 0) {
            console.log(`'${vnTitle}'이라는 비쥬얼 노벨을 찾을 수 없었어요...`);
            return interaction.followUp(`'${vnTitle}'...? 처음 들어보는 비쥬얼 노벨이에요...\n-# 검색 결과가 없습니다.`);
        }

        const vn = vnData.results[0];
        const vnUrl = `https://vndb.org/${vn.id}`;

        // --- 2. 캐릭터 정보 추가 검색 ---
        const charResponse = await fetch('https://api.vndb.org/kana/character', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filters: ["vn", "=", ["id", "=", vn.id]], 
                // traits.id가 반드시 필요합니다.
                fields: "name, original, description, image.url, image.sexual, image.violence, blood_type, height, weight, bust, waist, hips, cup, age, birthday, sex, traits.id, traits.name, traits.group_name, traits.spoiler" 
            })
        });

        let characters = [];
        if (charResponse.ok) {
            const charData = await charResponse.json();
            characters = charData.results || [];
        } else {
            console.log("Character fetch failed");
        }

        // 2단계: 캐릭터들이 가진 모든 특성(Trait)의 ID를 수집합니다.
        const traitIds = new Set();
        characters.forEach(c => {
            if (c.traits) {
                c.traits.forEach(t => traitIds.add(t.id));
            }
        });

        // 3단계: 수집한 ID로 'Trait' 엔드포인트에서 수위 정보 조회
        if (traitIds.size > 0) {
            const traitIdsArray = Array.from(traitIds).slice(0, 100); // 안전을 위해 50개로 제한
    
            // [핵심 수정] filters를 ["or", ["id", "=", "t1"], ["id", "=", "t2"], ...] 구조로 변환
            const orFilters = ["or"];
            traitIdsArray.forEach(id => {
                orFilters.push(["id", "=", id]);
            });

            try {
                const traitResponse = await fetch('https://api.vndb.org/kana/trait', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filters: orFilters, // 수정된 필터 적용
                        fields: "id, sexual, group_id, group_name",
                        results: 100
                    })
                });

                if (!traitResponse.ok) {
                    const errorText = await traitResponse.text();
                    console.error(`Trait API Error: ${traitResponse.status} - ${errorText}`);
                } else {
                    const traitData = await traitResponse.json();

                    const traitMap = {};
                    if (traitData.results) {
                        traitData.results.forEach(t => {
                            // [보완] sexual이 true이거나, 특정 성인용 그룹에 속해 있다면 수위 태그로 간주
                            // 보통 'Sexual' 그룹(t16)이나 그 하위 그룹들을 포함합니다.
                            const isSexualGroup = t.group_name?.toLowerCase().includes('sexual') || t.group_name?.toLowerCase().includes('subject');
                            traitMap[t.id] = (t.sexual === true || isSexualGroup);
                        });
                    }

                    // 4단계: 캐릭터 데이터에 주입
                    characters.forEach(c => {
                        if (!c.traits) return;
                        c.traits.forEach(t => {
                            // 이제 undefined가 아닌 true/false가 주입됨
                            t.sexual = traitMap[t.id] ?? false; 
                        });
                    });
                }
            } catch (fetchError) {
                console.error('Trait fetch failed:', fetchError);
            }
        }

        // --- 3. 명대사(Quotes) 추가 검색 (NEW) ---
        // 문서에 따라 score 기준으로 내림차순 정렬하여 인기 있는 대사부터 가져옴
        const quoteResponse = await fetch('https://api.vndb.org/kana/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filters: ["vn", "=", ["id", "=", vn.id]],
                fields: "quote, character.name, score",
                sort: "score",
                reverse: true
            })
        });
        const quoteData = await quoteResponse.json();
        const quotes = quoteData.results || [];

        const isNsfw = interaction.channel.nsfw;
        const validScreenshots = (vn.screenshots || []).filter(shot => {
            const shotLevel = Math.max(shot.sexual || 0, shot.violence || 0);
            const check = processExplicitContent(shot.url, shotLevel, isNsfw);
            return !check.hidden;
        });

        // --- 상태 관리 변수들 ---
        let currentView = 'basic'; // basic, desc, image, tag, quote, char
        let imageIndex = 0;
        let charIndex = 0;
        let tagPageIndex = 0;
        let showSpoilers = false;

        // 엠베드 생성 헬퍼 함수
        const createEmbed = () => {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'from vndb.org', url: 'https://vndb.org' })
                .setColor(0x0096FF);

            const isNsfw = interaction.channel.nsfw;
            let footerText = `ID: ${vn.id}`;

            // --- 1. 기본창 (Basic) ---
            if (currentView === 'basic') {
                const coverLevel = Math.max(vn.image?.sexual || 0, vn.image?.violence || 0);
                const coverCheck = processExplicitContent(vn.image?.url, coverLevel, isNsfw);
                
                embed.setTitle(vn.title)
                    .setDescription(`${safeFormatAndTruncate(vn.description, 300)}`)
                    .setURL(vnUrl);

                if (!coverCheck.hidden && vn.image?.url) {
                    embed.setImage(vn.image.url);
                } else if (coverCheck.hidden) {
                    // 수위 때문에 숨겨진 경우에만 표시
                    embed.addFields({ name: '🖼️ 커버 이미지', value: `해당 채널에서는 커버 이미지를 표시할 수 없습니다.`, inline: false });
                }

                const timeStr = vn.length_minutes ? `${Math.floor(vn.length_minutes / 60)}시간 ${vn.length_minutes % 60}분` : '정보 없음';
                const ratingStr = vn.rating ? (vn.rating / 10).toFixed(2) : '0.00';
                const devStr = vn.developers?.map(d => `[${d.name}](https://vndb.org/${d.id})`).join(', ') || '정보 없음';
                
                const sortedTags = vn.tags ? vn.tags.sort((a, b) => b.rating - a.rating).slice(0, 3) : [];
                const tagStr = sortedTags.length > 0 
                    ? sortedTags.map(t => `[${t.name}](https://vndb.org/${t.id})`).join(', ') + (vn.tags.length > 3 ? '...(more)' : '')
                    : '정보 없음';

                const charStr = characters.length > 0
                    ? characters.slice(0, 3).map(c => `[${c.name}](https://vndb.org/${c.id})`).join(', ') + (characters.length > 3 ? '...(more)' : '')
                    : '정보 없음';

                // 명대사 하나 (Footer 용) - 데이터가 있으면 첫 번째(가장 인기있는) 대사 사용
                const randomQuote = quotes.length > 0 ? `"${quotes[0].quote}"` : 'VNDB.org';
                footerText = truncate(randomQuote, 2000);

                embed.addFields(
                    { name: '⏳ 플레이타임', value: `${timeStr} (${vn.votecount} vote)`, inline: true },
                    { name: '📊 평점', value: `${ratingStr}점 (${vn.votecount} vote)`, inline: true },
                    { name: '💬 주요 언어', value: vn.languages?.join(', ') || '정보 없음', inline: true },
                    { name: '🛠 개발사', value: devStr, inline: true },
                    { name: '🏷️ 태그', value: tagStr, inline: true },
                    { name: '👤 캐릭터', value: charStr, inline: true },
                    { name: '✏️ 다른 이름', value: vn.alttitle || '없음', inline: false }
                );
            }

            // --- 2. 설명창 (Description) ---
            else if (currentView === 'desc') {
                embed.setTitle(`Description 📝`)
                     .setURL(vnUrl)
                     .setDescription(safeFormatAndTruncate(vn.description, 4000) || '설명 없음');
                footerText = `Description of '${vn.title}'`;
            }

            // --- 3. 이미지창 (Images) ---
            else if (currentView === 'image') {
                embed.setTitle(`Images 🏞️`).setURL(vnUrl);
                // [수정됨] 필터링된 validScreenshots 사용
                if (validScreenshots.length === 0) {
                    embed.setDescription("표시할 수 있는 이미지가 없습니다.");
                    embed.setImage(null);
                } else {
                    // 인덱스 안전장치 (필터링으로 인해 길이가 줄어들었을 경우 대비)
                    if (imageIndex >= validScreenshots.length) imageIndex = 0;

                    const shot = validScreenshots[imageIndex];
                    const shotLevel = Math.max(shot.sexual || 0, shot.violence || 0);
                    const shotCheck = processExplicitContent(shot.url, shotLevel, isNsfw);

                    // hidden인 경우는 이미 위에서 걸러졌으므로, 
                    // 여기서는 '표시' 혹은 '스포일러 처리(가림)'만 존재함
                    if (shotCheck.spoiler) {
                        // 스포일러 처리: 이미지는 가리고 링크만 클릭해서 보게 유도
                        embed.setDescription(`⚠️ **스포일러/수위 주의**\n클릭하여 보기: || ${shot.url} ||`);
                        embed.setImage(null); // 미리보기 방지
                    } else {
                        // 일반 표시
                        embed.setImage(shot.url);
                        embed.setDescription(null);
                    }
                    
                    footerText = `Images of '${vn.title}' [${imageIndex + 1}/${validScreenshots.length}]`;
                }
            }

            // --- 4. 태그창 (Tags) ---
            else if (currentView === 'tag') {
                embed.setTitle(`Tags 🔖`).setURL(vnUrl);
                const allTags = vn.tags || [];
    
                if (allTags.length === 0) {
                embed.setDescription("표시할 태그가 없습니다.");
                } else {
                    // 1. 태그 가공
                    const tagLinks = allTags.map(t => {
                        // Ero 카테고리 태그 필터링
                        // 태그의 category가 'ero'이고, 일반 채널(Non-NSFW)이라면 아예 숨김
                        if (!isNsfw && t.category === 'ero') return null;

                        // [수정] 스토리 스포일러 로직 적용 (버튼 상태 showSpoilers 반영)
                        const tCheck = processStorySpoiler(t.name, t.spoiler, showSpoilers);
                        
                        // hidden이면 아예 리스트에서 제외 (null 반환)
                        if (tCheck.hidden) return null;
                        
                        return `[${tCheck.text}](https://vndb.org/${t.id})`;
                    }).filter(t => t !== null);

                    // 2. 페이지네이션 설정 (한 페이지당 30개)
                    const itemsPerPage = 30;
                    const totalPages = Math.ceil(tagLinks.length / itemsPerPage);
                    const start = tagPageIndex * itemsPerPage;
                    const end = start + itemsPerPage;
                    const currentPageTags = tagLinks.slice(start, end);

                    embed.setDescription(currentPageTags.join(', ') || "이 페이지에 표시할 태그가 없습니다.");
                    footerText = `Tags of ${vn.title} [${tagPageIndex + 1}/${totalPages}]`;
                }
            }

            // --- 5. 명대사 (Quotes) - 구현 완료 ---
            else if (currentView === 'quote') {
                embed.setTitle(`Quotes 💬`).setURL(vnUrl);
                
                if (quotes.length === 0) {
                    embed.setDescription("등록된 명대사가 없습니다.");
                } else {
                    // 모든 명대사를 가져오되 4096자 제한 고려
                    // 형식: "대사 내용" - 캐릭터이름
                    const quoteText = quotes.map(q => {
                        const charName = q.character?.name ? `**${q.character.name}**` : '(Unknown)';
                        return `> "${q.quote}"\n> \\- ${charName}`; 
                    }).join('\n\n');

                    embed.setDescription(truncate(quoteText, 4000));
                }
                footerText = `Quotes of '${vn.title}'`;
            }

            // --- 6. 캐릭터창 (Characters) ---
            else if (currentView === 'char') {
                if (characters.length === 0) {
                    embed.setTitle("Characters").setDescription("캐릭터 정보가 없습니다.");
                } else {
                    const char = characters[charIndex];
                    embed.setTitle(char.name).setURL(`https://vndb.org/${char.id}`);
                    embed.setDescription(safeFormatAndTruncate(char.description, 4000) || '설명 없음');

                    const charLevel = Math.max(char.image?.sexual || 0, char.image?.violence || 0);
                    const charImgCheck = processExplicitContent(char.image?.url, charLevel, isNsfw);

                    if (!charImgCheck.hidden && char.image?.url) {
                        embed.setThumbnail(charImgCheck.text.replace(/\|\|/g, ''));
                    } else {
                        embed.setThumbnail(null); // 숨김 처리 시 썸네일 제거
                    }

                    let traitStr = '정보 없음';
                    if (char.traits && char.traits.length > 0) {
                        const processedTraits = char.traits.map(t => {
                            // 1. sexual 판정 (위에서 보완한 t.sexual 값 사용)
                            if (t.sexual === true && !isNsfw) return null;

                            // [추가] 만약 group_name에 'Sexual'이 포함되어 있는데 걸러지지 않았다면 2차 방어
                            if (!isNsfw && t.group_name?.toLowerCase().includes('sexual')) return null;

                            const spCheck = processStorySpoiler(t.name, t.spoiler || 0, showSpoilers);
                            return spCheck.hidden ? null : spCheck.text;
                        }).filter(t => t !== null);

                        traitStr = processedTraits.join(', ');
                    }
                    
                    // [수정됨] 성별 및 나이 출력 로직 보완
                    const sexMap = {
                        'm': '남성 ♂',
                        'f': '여성 ♀',
                        'b': '양성',
                        'n': '무성(또는 정보 없음)'
                    };
                    
                    let genderStr = '정보 없음';

                    if (char.sex) {
                        if (Array.isArray(char.sex)) {
                            // 배열인 경우 (예: ["f", "f"] 또는 ["m", "f"])
                            // 중복을 제거하고(Set) 한글로 변환한 뒤 콤마로 연결
                            const uniqueSexes = [...new Set(char.sex)];
                            genderStr = uniqueSexes
                                .map(s => sexMap[s] || s)
                                .join(', ');
                        } else {
                            // 단일 문자열인 경우
                            genderStr = sexMap[char.sex] || char.sex;
                        }
                    }   
                    
                    // age는 숫자 0일 수도 있으므로 명시적으로 체크
                    const ageStr = (char.age !== null && char.age !== undefined) ? char.age.toString() : '정보 없음';

                    embed.addFields(
                        { name: '🚻 성별', value: genderStr, inline: true },
                        { name: '📆 나이', value: ageStr, inline: true },
                        { name: '🎂 생일', value: char.birthday ? `${char.birthday[0]}월 ${char.birthday[1]}일` : '정보 없음', inline: true },
                        { name: '✨ 특성', value: truncate(traitStr, 1000) || '정보 없음', inline: false }
                    );

                    footerText = `Characters of '${vn.title}' [${charIndex + 1}/${characters.length}]`;
                }
            }

            embed.setFooter({ text: footerText });
            return embed;
        };

        // --- 버튼 및 메뉴 생성 ---
        const getComponents = () => {
            const rows = [];

            // 1. 선택 메뉴
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('view_select')
                .setPlaceholder('화면 선택')
                .addOptions([
                    { label: '기본 정보', value: 'basic', emoji: '🏠', default: currentView === 'basic' },
                    { label: '설명', value: 'desc', emoji: '📝', default: currentView === 'desc' },
                    { label: '이미지', value: 'image', emoji: '🖼️', default: currentView === 'image' },
                    { label: '태그', value: 'tag', emoji: '🏷️', default: currentView === 'tag' },
                    { label: '명대사', value: 'quote', emoji: '💬', default: currentView === 'quote' },
                    { label: '캐릭터', value: 'char', emoji: '👥', default: currentView === 'char' },
                ]);
            rows.push(new ActionRowBuilder().addComponents(selectMenu));

            // 2. 버튼
            const buttonRow = new ActionRowBuilder();
            let hasButtons = false;

            if (currentView === 'image' && validScreenshots.length > 1) {
                buttonRow.addComponents(
                    new ButtonBuilder().setCustomId('prev').setLabel('⬅️ 이전').setStyle(ButtonStyle.Secondary).setDisabled(imageIndex === 0),
                    new ButtonBuilder().setCustomId('next').setLabel('➡️ 다음').setStyle(ButtonStyle.Secondary).setDisabled(imageIndex === (validScreenshots.length - 1))
                );
                hasButtons = true;
            } else if (currentView === 'char' && characters.length > 1) {
                buttonRow.addComponents(
                    new ButtonBuilder().setCustomId('prev').setLabel('⬅️ 이전').setStyle(ButtonStyle.Secondary).setDisabled(charIndex === 0),
                    new ButtonBuilder().setCustomId('next').setLabel('➡️ 다음').setStyle(ButtonStyle.Secondary).setDisabled(charIndex === (characters.length - 1))
                );
                hasButtons = true;
            } else if (currentView === 'tag') {
                const tagCount = vn.tags?.length || 0;
                const calcTotalTagPages = Math.ceil(tagCount / 30); // 한 페이지당 30개 기준

                if (calcTotalTagPages > 1) {
                    buttonRow.addComponents(
                        new ButtonBuilder().setCustomId('prev').setLabel('⬅️ 이전').setStyle(ButtonStyle.Secondary).setDisabled(tagPageIndex === 0),
                        new ButtonBuilder().setCustomId('next').setLabel('➡️ 다음').setStyle(ButtonStyle.Secondary).setDisabled(tagPageIndex === calcTotalTagPages - 1)
                    );
                    hasButtons = true;
                }
            }

            buttonRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('toggle_spoiler')
                    .setLabel(showSpoilers ? '🔒 스포일러 숨기기' : '🔍 스포일러 표시')
                    .setStyle(showSpoilers ? ButtonStyle.Danger : ButtonStyle.Success)
            );
            hasButtons = true;

            if (hasButtons) rows.push(buttonRow);

            return rows;
        };

        // 초기 메시지 전송
        console.log(`${username}(${userId})님이 '${vn.title}'를 검색했어요. (검색어: '${vnTitle}')`);
        const responseMsg = await interaction.followUp({
            content: `여기 요청하신 비쥬얼노벨 정보예요!`,
            embeds: [createEmbed()],
            components: getComponents()
        });

        const collector = responseMsg.createMessageComponentCollector({
            time: 300_000 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ content: '다른 분 걸 건들지 말아주세요...', ephemeral: true });
            }

            if (i.customId === 'view_select') {
                currentView = i.values[0];
            } else if (i.customId === 'prev') {
                if (currentView === 'image' && imageIndex >= validScreenshots.length) imageIndex = 0;
                if (currentView === 'char') charIndex = Math.max(0, charIndex - 1);
                if (currentView === 'tag') tagPageIndex = Math.max(0, tagPageIndex - 1);
            } else if (i.customId === 'next') {
                if (currentView === 'image') imageIndex = Math.min(validScreenshots.length - 1, imageIndex + 1);
                if (currentView === 'char') charIndex = Math.min(characters.length - 1, charIndex + 1);
                if (currentView === 'tag') {
                    const totalTagPages = Math.ceil((vn.tags?.length || 0) / 30); // 직접 계산
                    tagPageIndex = Math.min(totalTagPages - 1, tagPageIndex + 1);
                }
            } else if (i.customId === 'toggle_spoiler') {
                showSpoilers = !showSpoilers;
            }

            await i.update({
                embeds: [createEmbed()],
                components: getComponents()
            });
        });

        collector.on('end', () => {
            responseMsg.edit({ content: '5분이 지나 상호작용을 종료했어요.', components: [] }).catch(() => {});
        });

    } catch (e) {
        console.error('Error in vndb_search.js! ', e);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '오류가 발생했어요...', ephemeral: true });
            // 인증서 오류시 이쪽 출력됨
        } else {
            await interaction.reply({ content: '오류가 발생했어요...', ephemeral: true });
        }
    }
}

const data = new SlashCommandBuilder()
    .setName('미연시검색')
    .setDescription('VNDB.org에서 비쥬얼노벨을 검색합니다.')
    .addStringOption(option =>
        option.setName('vn_title')
            .setDescription('비쥬얼노벨 제목을 입력하세요 (영어/일본어 권장)')
            .setRequired(true)
    );

module.exports = { data, run };