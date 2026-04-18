// Mirrors DefragLive/src/filters.py (filter_author, filter_message, clean_string,
// strip_repeated_characters, replace_special_chars, SPECIAL_NUMBERS).
// Defense-in-depth: backend already filters, but we also filter on the frontend
// so UI never displays blacklisted words even if backend sends raw data.

const SPECIAL_NUMBERS = {
    '0': ['o'],
    '1': ['i', 'l'],
    '2': ['z'],
    '3': ['e'],
    '4': ['a', 'h'],
    '5': ['s'],
    '6': ['g', 'b'],
    '7': ['t'],
    '8': ['b', 'g'],
    '9': ['g'],
    'l': ['i'],
    '!': ['i', 'l'],
    '|': ['i', 'l']
}

// Kept in sync with DefragLive/lists/blacklist_names and blacklist_chat.
const BLACKLIST_NAMES_RAW = [
    'simp', 'incel', 'virgin', 'nigger', 'nigga', 'kike', 'chink', 'gook', 'spic',
    'wetback', 'towelhead', 'sandnigger', 'raghead', 'faggot', 'fag',
    'homo', 'dyke', 'tranny', 'cunt', 'whore', 'slut', 'bitch', 'analsex',
    'assfuck', 'cocksucker', 'pussyfuck', 'retard', 'retarded', 'rape',
    'rapist', 'nazi', 'hitler', 'asshole', 'dickhead', 'fucker', 'motherfucker'
]

const BLACKLIST_CHAT_RAW = BLACKLIST_NAMES_RAW.slice()

// Skip filtering for game event messages so timings/ranks never get mangled
// (parity with Python filter_message exemptions).
const MESSAGE_EXEMPTIONS = [
    'reached the finish line',
    'broke the server record',
    'sets the first time',
    'you are now rank'
]

// Cap Cartesian explosion for pathological inputs like "!!!!!!!!!!".
const MAX_LEET_VARIANTS = 512

export function stripQ3Colors(value) {
    if (!value) return ''
    return String(value).replace(/\^(X.{6}|[0-9a-z])/gi, '')
}

export function stripRepeatedCharacters(value) {
    if (!value) return ''
    let out = ''
    for (const ch of value) {
        if (out.length === 0 || out[out.length - 1] !== ch) out += ch
    }
    return out
}

export function cleanString(value) {
    const noColors = stripQ3Colors(value)
    const allowed = noColors.replace(/[^a-zA-Z0-9!|: ]/g, '')
    return stripRepeatedCharacters(allowed)
}

export function replaceSpecialChars(msg) {
    let variants = ['']
    for (const ch of msg) {
        const options = SPECIAL_NUMBERS[ch] || [ch]
        const next = []
        for (const v of variants) {
            for (const o of options) next.push(v + o)
        }
        if (next.length > MAX_LEET_VARIANTS) return [msg]
        variants = next
    }
    return variants
}

const NORMALIZED_NAMES = BLACKLIST_NAMES_RAW.map(w => stripRepeatedCharacters(w.toLowerCase()))
const NORMALIZED_CHAT = BLACKLIST_CHAT_RAW.map(w => stripRepeatedCharacters(w.toLowerCase()))

// Reverse of SPECIAL_NUMBERS: for each target letter, list all source chars
// that could be used to type it (e.g., 'i' can come from '1', 'l', '!', '|').
const REVERSE_LEET = (() => {
    const map = {}
    for (const [src, targets] of Object.entries(SPECIAL_NUMBERS)) {
        for (const t of targets) {
            if (!map[t]) map[t] = new Set([t])
            map[t].add(src)
        }
    }
    return map
})()

// Build a regex that matches any leet/repeat variant of a blacklist word.
// Each letter becomes a character class with all possible source chars,
// followed by `+` so repeats like "niggger" also match.
function buildLeetRegex(normalizedWord) {
    let pattern = ''
    for (const ch of normalizedWord) {
        const sources = REVERSE_LEET[ch] ? [...REVERSE_LEET[ch]] : [ch]
        // Our alphabet (a-z, 0-9, !, |) is safe inside [...] without escaping.
        pattern += `[${sources.join('')}]+`
    }
    return new RegExp(pattern, 'gi')
}

const NAME_REGEXES = NORMALIZED_NAMES.map(buildLeetRegex)
const CHAT_REGEXES = NORMALIZED_CHAT.map(buildLeetRegex)

function findMatch(normalizedInput, blacklist) {
    for (const word of blacklist) {
        if (word && normalizedInput.includes(word)) {
            return { word, index: normalizedInput.indexOf(word) }
        }
    }
    return null
}

export function filterAuthor(name, replaceWith = 'UnnamedPlayer') {
    if (name === null || name === undefined || name === '') return name
    const stripped = stripQ3Colors(String(name))
    // Test against the stripped-colors form directly using the leet regex.
    for (const regex of NAME_REGEXES) {
        regex.lastIndex = 0
        if (regex.test(stripped)) return replaceWith
    }
    return name
}

// Replaces matched blacklist words with same-length asterisk runs in the
// color-stripped form, then reinserts Q3 color codes from the original so
// Q3STR still renders colors around the censored region.
export function filterMessage(msg) {
    if (msg === null || msg === undefined || msg === '') return msg
    const original = String(msg)

    for (const pattern of MESSAGE_EXEMPTIONS) {
        if (original.includes(pattern)) return original
    }

    const stripped = stripQ3Colors(original)
    let censored = stripped
    let matched = false

    for (const regex of CHAT_REGEXES) {
        regex.lastIndex = 0
        censored = censored.replace(regex, (m) => {
            matched = true
            return '*'.repeat(m.length)
        })
    }

    if (!matched) return original
    return rebuildWithColors(original, censored)
}

function extractColorCodes(text) {
    const codes = []
    const re = /\^(X.{6}|[0-9a-z])/gi
    let m
    while ((m = re.exec(text)) !== null) {
        codes.push({ code: m[0], position: m.index, length: m[0].length })
    }
    return codes
}

function rebuildWithColors(originalText, censoredClean) {
    const codes = extractColorCodes(originalText)
    const cleanOriginal = stripQ3Colors(originalText)
    if (cleanOriginal === censoredClean) return originalText

    let result = ''
    let cleanIdx = 0
    let origIdx = 0
    let colorIdx = 0

    while (origIdx < originalText.length && cleanIdx < censoredClean.length) {
        if (colorIdx < codes.length && codes[colorIdx].position === origIdx) {
            result += codes[colorIdx].code
            origIdx += codes[colorIdx].length
            colorIdx++
        } else {
            result += censoredClean[cleanIdx]
            cleanIdx++
            origIdx++
        }
    }
    while (cleanIdx < censoredClean.length) {
        result += censoredClean[cleanIdx++]
    }
    while (colorIdx < codes.length) {
        if (codes[colorIdx].position <= originalText.length) {
            result += codes[colorIdx].code
        }
        colorIdx++
    }
    return result
}
