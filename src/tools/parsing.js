/**
 * 짝이 맞는 닫는 괄호 '}'의 인덱스를 찾습니다.
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
 * {choice} 태그의 내용물을 처리하여 하나의 옵션을 선택
 */
function processChoice(choiceContent) {
    // 1. 옵션 분리 (중첩 괄호 및 '...' 고려)
    const options = [];
    let inQuote = false;
    let start = 0;
    let depth = 0; // 중첩 {choice} 태그를 위한 깊이

    for (let i = 0; i < choiceContent.length; i++) {
        if (choiceContent[i] === '\'') {
            inQuote = !inQuote;
        } else if (!inQuote) {
            if (choiceContent[i] === '{') depth++;
            else if (choiceContent[i] === '}') depth--;
            // 쉼표(,)가 중첩 괄호 밖에 있을 때만 분리
            else if (choiceContent[i] === ',' && depth === 0) {
                options.push(choiceContent.substring(start, i).trim());
                start = i + 1;
            }
        }
    }
    options.push(choiceContent.substring(start).trim());

    // 2. 각 옵션을 { text, prob } 객체로 파싱
    const parsedOptions = options
        .filter(opt => opt.length > 0) // 비어있는 옵션 제거
        .map(opt => {
            const lastQuoteIndex = opt.lastIndexOf('\'');
            const text = opt.substring(1, lastQuoteIndex);
            const probPart = opt.substring(lastQuoteIndex + 1);
            const probMatch = probPart.match(/\|\s*([0-9.]+)/);
            const prob = probMatch ? parseFloat(probMatch[1]) : null;
            return { text, prob };
        });

    // 3. 확률 처리 (유효성 검사 단계에서 '일부만 명시'는 걸러짐)
    const allProbsNull = parsedOptions.every(p => p.prob === null);
    
    let finalOptions;
    if (allProbsNull) {
        // 모든 옵션에 확률이 없으면 균일 확률
        const equalProb = 1 / parsedOptions.length;
        finalOptions = parsedOptions.map(p => ({ ...p, prob: equalProb }));
    } else {
        // 확률이 명시된 대로 사용 (null은 0으로 간주, 어차피 합은 1)
        finalOptions = parsedOptions.map(p => ({ ...p, prob: p.prob === null ? 0 : p.prob }));
    }

    // 4. 가중치 확률에 따라 하나 선택
    const rand = Math.random();
    let cumulativeProb = 0;
    for (const opt of finalOptions) {
        cumulativeProb += opt.prob;
        if (rand < cumulativeProb) {
            return opt.text; // 선택된 텍스트 반환
        }
    }

    // 부동소수점 오류 등 대비, 마지막 옵션 반환
    return finalOptions[finalOptions.length - 1].text;
}

/**
 * 헬퍼 함수: 단일 태그 내용을 평가 (예: 'mention', 'br', 'rand(1,10)', 'choice:...')
 */
function evaluateTag(tagContent, mention) {
    const trimmedContent = tagContent.trim();

    // {mention}
    if (trimmedContent === 'mention') {
        return mention;
    }

    // {br}
    if (trimmedContent === 'br') {
        return '\n';
    }

    // {rand(a, b)}
    let match = trimmedContent.match(/^rand\((\d+)\s*,\s*(\d+)\)$/);
    if (match) {
        const a = Math.floor(Math.random() * (parseInt(match[2]) - parseInt(match[1]) + 1)) + parseInt(match[1]);
        return a.toString();
    }

    // {choice:...}
    match = trimmedContent.match(/^choice:(.*)$/s); // s 플래그: .이 줄바꿈 문자도 포함
    if (match) {
        return processChoice(match[1]);
    }

    // {wait} 태그는 processTags가 호출되기 전에 분리되므로 이 함수로 오지 않음
    // 알 수 없는 태그는 그대로 반환
    return `{${tagContent}}`;
}

/**
 * 핵심 함수: {wait}를 제외한 모든 태그를 재귀적으로 처리
 */
function processTags(text, mention) {
    let result = '';
    let i = 0;

    while (i < text.length) {
        const startIndex = text.indexOf('{', i);

        // 1. 남은 문자열에 {가 없으면, 나머지 텍스트를 추가하고 종료
        if (startIndex === -1) {
            result += text.substring(i);
            break;
        }

        // 2. { 앞까지의 일반 텍스트 추가
        result += text.substring(i, startIndex);

        // 3. 매칭되는 } 찾기
        const endIndex = findMatchingBrace(text, startIndex + 1);

        // 4. }를 못 찾으면, {를 일반 문자로 처리 (유효성 검사에서 걸러졌어야 함)
        if (endIndex === -1) {
            result += '{';
            i = startIndex + 1;
            continue;
        }

        // 5. 태그 내용 { ... } 추출 및 평가
        const tagContent = text.substring(startIndex + 1, endIndex);
        const evaluatedContent = evaluateTag(tagContent, mention);
        
        // [수정 시작]
        const originalFullTag = text.substring(startIndex, endIndex + 1);

        // 6. *** 재귀 또는 원본 출력 ***
        // evaluateTag가 태그를 처리하지 못해 원본 태그({tagContent})를 반환했는지 확인
        // (예: "{MENTION}" -> "{MENTION}")
        // 이것은 처리되지 않은 태그(대문자 등)를 의미하므로, 재귀 호출 대신 원본 태그 문자열을 그대로 추가.
        if (evaluatedContent === originalFullTag) {
            result += originalFullTag;
        } else {
            // 태그가 성공적으로 처리되었고 (예: "{mention}" -> "User")
            // 그 결과({choice} 등)에 또 다른 태그가 있을 수 있으므로 재귀 처리
            result += processTags(evaluatedContent, mention);
        }
        // [수정 끝]
        
        // 7. 인덱스 이동
        i = endIndex + 1;
    }
    return result;
}

// 객체 배열로 반환하는 함수
function processDatabaseString(input, mention) {
    // 1. {wait:x} 태그를 기준으로 문자열 분할
    // split 정규식에 캡처 그룹()을 사용하면, 구분자(wait 시간)도 결과 배열에 포함됨
    const waitRegex = /{wait:([0-9.]+)}/g;
    const parts = input.split(waitRegex);
    
    const messages = [];

    // 2. 첫 번째 텍스트 (wait: 0)
    // parts[0]는 항상 존재 (빈 문자열일 수도 있음)
    const firstProcessedText = processTags(parts[0], mention);
    if (firstProcessedText.length > 0) {
        messages.push({ text: firstProcessedText, wait: 0 });
    }

    // 3. 이후 텍스트 (wait: x)
    // parts 배열은 [text, waitTime, text, waitTime, ...] 순서가 됨
    for (let i = 1; i < parts.length; i += 2) {
        const waitTime = parseFloat(parts[i]);
        const textContent = parts[i + 1];

        if (textContent !== undefined) {
            const processedText = processTags(textContent, mention);
            // 텍스트 내용이 있는 경우에만 추가
            if (processedText.length > 0) {
                messages.push({ text: processedText, wait: waitTime });
            }
        }
    }

    return messages;
}

module.exports = processDatabaseString;