require('dotenv').config();
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');

// 이미지를 다운받은 뒤 어디에 임시로 올리고 그 링크를 보내는 형식이어야 할 듯...?
// 암만 해도 php에서 이미지를 바로 따오는 방법을 몰루겠음
// 의도적으로 크롤링으로 자원 소모되는 거 막으려고 한 거 같은데

module.exports = async (message) => {
    // 1. 봇 메시지 무시
    if (message.author.bot) return;

    if (message.author.id !== process.env.ADMINID) return;

    const originalContent = message.content.trim();

    // 2. 디씨인사이드 링크 감지 정규식
    const dcUrlRegex = /^(https?:\/\/(?:gall|m)\.dcinside\.com\/(?:[^/]+\/)*board\/(?:view\/?\?|[^/]+\/?)?.*)$/;

    if (!dcUrlRegex.test(originalContent)) return;

    try {
        // URL 파싱
        const urlObj = new URL(originalContent);
        const params = urlObj.searchParams;

        let galleryId = '';
        let postNo = '';

        // 3. ID 및 게시글 번호 추출
        if (urlObj.hostname === 'gall.dcinside.com') {
            galleryId = params.get('id');
            postNo = params.get('no');
        } else if (urlObj.hostname === 'm.dcinside.com') {
            const pathSegments = urlObj.pathname.split('/').filter(Boolean);
            const boardIndex = pathSegments.indexOf('board');
            if (boardIndex !== -1 && pathSegments.length > boardIndex + 2) {
                galleryId = pathSegments[boardIndex + 1];
                postNo = pathSegments[boardIndex + 2];
            }
        }

        if (!galleryId || !postNo) return;

        // 4. 모바일 URL로 표준화
        const targetUrl = `https://m.dcinside.com/board/${galleryId}/${postNo}`;

        // 5. HTML 요청 (WAF 우회 헤더 포함)
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://m.dcinside.com/',
            }
        });

        const $ = cheerio.load(response.data);

        const title = $('meta[name="twitter:title"]').attr('content');
        const description = $('meta[name="twitter:description"]').attr('content');
        // const imageUrl = $('meta[name="twitter:image"]').attr('content'); 디씨가 php에서 스트리밍 하는 방식으로 쓰고 있어서 안됨

        if (!title) return;

        // 6. 엠베드 생성
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: 'DCinside', 
                url: 'https://www.dcinside.com' 
            })
            .setTitle(title)
            .setURL(targetUrl)
            .setColor(0x3b4890)
            .setDescription(description)
            // .setThumbnail(imageUrl);
            
        // 7. 메시지 전송 및 삭제
        await message.channel.send({
            content: `${message.author}: ${targetUrl}`,
            embeds: [embed],
            allowedMentions: { users: [] }
        });

        await message.delete().catch(() => {});

    } catch (error) {
        return;
    }
};