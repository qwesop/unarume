/**
 * 짝이 맞는 닫는 괄호 '}'의 인덱스를 찾습니다.
 * @param {string} str - 검색할 문자열
 * @param {number} start - 여는 괄호 '{' 다음 인덱스
 * @returns {number} - 닫는 괄호 '}'의 인덱스, 없으면 -1
 */
function findMatchingBrace(str, start) {
    let depth = 1;
    for (let i = start; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') depth--;
        if (depth === 0) return i;
    }
    return -1; // 짝을 찾지 못함
}

/**
 * {choice} 태그의 옵션을 파싱하여 배열로 반환합니다.
 * @param {string} choiceContent - choice: 뒤의 내용물
 * @returns {Array<object>|string} - 파싱된 옵션 객체 배열 또는 에러 문자열
 */
function parseChoiceOptionsForValidation(choiceContent) {
    const options = [];
    let inQuote = false;
    let start = 0;
    let depth = 0; // 중첩 괄호 추적

    for (let i = 0; i < choiceContent.length; i++) {
        if (choiceContent[i] === '\'') {
            inQuote = !inQuote;
        } else if (!inQuote) {
            if (choiceContent[i] === '{') depth++;
            else if (choiceContent[i] === '}') depth--;
            else if (choiceContent[i] === ',' && depth === 0) {
                options.push(choiceContent.substring(start, i).trim());
                start = i + 1;
            }
        }
    }
    options.push(choiceContent.substring(start).trim());

    const parsedOptions = [];
    for (const opt of options) {
        if (opt.trim() === '') continue; // 빈 옵션 무시

        const lastQuoteIndex = opt.lastIndexOf('\'');
        if (opt[0] !== '\'' || lastQuoteIndex <= 0) {
            return `선택지 태그 형식이 잘못되었어요...\n-# (오류사항: ${opt})`;
        }
        
        const text = opt.substring(1, lastQuoteIndex);
        const probPart = opt.substring(lastQuoteIndex + 1);
        const probMatch = probPart.match(/^\s*\|\s*([0-9.]+)\s*$/);
        
        let prob = null;
        if (probPart.trim() === '') {
            prob = null; // 확률 부분 없음
        } else if (probMatch) {
            prob = parseFloat(probMatch[1]);
        } else {
            return `선택지 태그 형식이 잘못되었어요...\n-# (오류사항: ${opt})`;
        }
        parsedOptions.push({ text, prob });
    }

    if (parsedOptions.length === 0) {
        return `선택지가 없는데 어떻게 골라요...?\n-# (입력한 내용: ${choiceContent})`;
    }

    if (parsedOptions.length === 1) {
        return `이거 들은 적 있어요. 강요라는 거죠...?\n-# {choice} 태그에는 2개 이상의 선택지가 필요합니다. (입력한 내용: ${choiceContent})`;
    }

    return parsedOptions;
}

/**
 * DB 저장 전 문자열의 유효성을 검사합니다.
 * @param {string} text - 검사할 원본 문자열
 * @param {string} userId
 * @param {string} username
 * @param {string} input
 * @param {boolean} [isNested=false] - {choice} 내부의 재귀 호출인지 여부
 * @returns {string|null} - 에러 메시지 또는 null
 */
function judgetemplete(text, userId, username, input, isNested = false) {
    // 1. {wait:x}가 맨 뒤에 오는지 검사
    // 참고: trim()을 써서 " " {wait:0.5} 같은 공백도 잡음
    if (/{wait:[0-9.]+}(\s*)$/.test(text)) {
        console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 {wait} 태그로 끝나서 배우지 않았어요.`);
        return `답변을 다 하고 기다릴 필요는 없지 않나요...?\n-# {wait} 태그로 답변을 마무리지을 수 없습니다. (입력하신 문자열: ${text})`;
    }

    // 1b. {wait:x}가 맨 처음에 오는지 검사
    if (/^(\s*){wait:[0-9.]+}/.test(text)) {
        console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 {wait} 태그로 시작해서 배우지 않았어요.`);
        return `답변 하기도 전에 기다리기부터 해야 해요...?\n-# {wait} 태그로 답변을 시작할 수 없습니다. (입력하신 문자열: ${text})`;
    }

    let i = 0;
    while (i < text.length) {
        const startIndex = text.indexOf('{', i);
        if (startIndex === -1) {
            break; // 태그 없음, 종료
        }

        const endIndex = findMatchingBrace(text, startIndex + 1);
        if (endIndex === -1) {
            console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 괄호의 짝이 맞지 않아서 배우지 않았어요.`);
            return `답변을 알아 볼 수 없어요. 이상해요...\n-# 괄호의 짝이 맞지 않습니다. (위치: ${startIndex}, 입력하신 문자열: ${text})`;
        }

        const tagContent = text.substring(startIndex + 1, endIndex);

        // 2. {rand} 태그 검사 (a, b가 정수가 아닌 경우)
        if (tagContent.startsWith('rand(')) {
            if (!/^rand\(\s*\d+\s*,\s*\d+\s*\)$/.test(tagContent)) {
                console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 랜덤 범위가 두 정수 사이가 아니라서 배우지 않았어요.`);
                return `랜덤 범위가 두 정수 사이가 아니에요...\n-# 정수 2개가 필요합니다. (입력하신 문자열: ${text})`;
            }
        }
        // 3. {wait} 태그 검사 (초 미입력)
        else if (tagContent.startsWith('wait')) {
            if (!/^wait:[0-9.]+$/.test(tagContent)) {
                console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 {wait}에 초가 입력되지 않아서 배우지 않았어요.`);
                return `몇 초를 기다려야 하는 걸까요...?\n-# {wait} 태그에 초를 입력하지 않았습니다. (입력하신 문자열: ${text})`;
            }

            const waitTime = parseFloat(tagContent.substring('wait:'.length));
            if (waitTime > 300) {
                console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 {wait} 태그의 대기 시간이 300초를 초과해서 배우지 않았어요.`);
                return `정말로 그 긴 시간동안 기다려요...?\n-# 최대 대기 시간은 300초입니다. (입력한 시간: ${waitTime}초)`;
            }

            // 3b. {wait} 태그가 연속으로 오는지 검사 (공백 무시)
            const nextContent = text.substring(endIndex + 1).trim();
            if (nextContent.startsWith('{wait:')) {
                console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 {wait} 태그가 연속으로 와서 배우지 않았어요.`);
                return `기다렸다가... 또 기다리라고요...?\n-# {wait} 태그를 연속으로 사용할 수 없습니다. (입력하신 문자열: ${text})`;
            }
        }
        // 4. {choice} 태그 검사
        else if (tagContent.startsWith('choice:')) {
            const choiceContent = tagContent.substring('choice:'.length);
            const optionsOrError = parseChoiceOptionsForValidation(choiceContent);

            if (typeof optionsOrError === 'string') {
                return optionsOrError; // 파싱 중 에러 발생
            }

            const options = optionsOrError;
            const hasProb = options.some(opt => opt.prob !== null);
            const allHaveProb = options.every(opt => opt.prob !== null);

            // 4a. 확률이 일부만 명시된 경우
            if (hasProb && !allHaveProb) {
                console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 {choice} 태그에 확률이 부분만 입력되어 있어서 배우지 않았어요.`);
                return `이건 확률이 있는데, 저건 없고... 제 마음대로 골라서 답변하면 되나요?\n-# {choice} 태그에 확률을 부분적으로만 입력했습니다. 전부 입력하거나 전부 미입력해주세요. (입력하신 문자열: ${text})`;
            }

            // 4b. 확률 합이 1이 아닌 경우
            if (allHaveProb) {
                const sum = options.reduce((acc, opt) => acc + opt.prob, 0);
                if (Math.abs(sum - 1) > 0.001) { // 부동소수점 오차 감안
                    console.log(`${username}(${userId})님이 '${input}'에 대해 가르치려고 했는데 '${text}'에는 {choice} 태그의 확률 합이 1이 아니라서 배우지 않았어요.`);
                    if (sum - 1 > 0) {
                        return `이거... 러시아?\n-# choice 태그의 확률 합이 1이 아닙니다. (현재 합: ${sum}, 입력하신 문자열: ${text})`;
                    } else {
                        return `으음... 남는 경우의 수에는 어떤 답변을 해야 하는 걸까요...\n-# choice 태그의 확률 합이 1이 아닙니다. (현재 합: ${sum}, 입력하신 문자열: ${text})`;
                    }
                }
            }

            // 4c. *** 재귀 검사 ***
            // 각 선택지(text)의 내용물도 유효한지 검사
            for (const opt of options) {
                // 재귀 호출 시 모든 인수를 전달하고, isNested 플래그를 true로 설정
                const nestedError = judgetemplete(opt.text, userId, username, input, true);
                if (nestedError) {
                    return `${nestedError}`;
                }
            }
        }

        i = endIndex + 1;
    }

    // 모든 검사 통과
    return null;
}

module.exports = judgetemplete;