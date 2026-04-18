import {
    filterAuthor,
    filterMessage,
    stripQ3Colors,
    stripRepeatedCharacters,
    cleanString,
    replaceSpecialChars
} from './NickFilter'

describe('stripQ3Colors', () => {
    test('strips numeric color codes', () => {
        expect(stripQ3Colors('^1red^7white')).toBe('redwhite')
    })
    test('strips X color codes', () => {
        expect(stripQ3Colors('^XFFFFFFtest')).toBe('test')
    })
    test('handles alphabetic color codes', () => {
        expect(stripQ3Colors('^adata')).toBe('data')
    })
})

describe('stripRepeatedCharacters', () => {
    test('collapses consecutive duplicates', () => {
        expect(stripRepeatedCharacters('niggers')).toBe('nigers')
        expect(stripRepeatedCharacters('fuuuck')).toBe('fuck')
        expect(stripRepeatedCharacters('aaabbbccc')).toBe('abc')
    })
    test('empty string', () => {
        expect(stripRepeatedCharacters('')).toBe('')
    })
})

describe('cleanString', () => {
    test('removes colors and non-alphanumeric', () => {
        expect(cleanString('^1fag^7! niggers!')).toBe('fag! nigers!')
    })
})

describe('replaceSpecialChars', () => {
    test('expands leet variants', () => {
        const variants = replaceSpecialChars('f4g')
        expect(variants).toContain('fag')
        expect(variants).toContain('fhg')
    })
    test('no leet chars returns single variant', () => {
        expect(replaceSpecialChars('xyz')).toEqual(['xyz'])
    })
})

describe('filterAuthor', () => {
    test('passes clean nicks through unchanged', () => {
        expect(filterAuthor('iBondza')).toBe('iBondza')
        expect(filterAuthor('roger wilco')).toBe('roger wilco')
        expect(filterAuthor('HAC  narb')).toBe('HAC  narb')
    })

    test('censors blacklisted exact match', () => {
        expect(filterAuthor('nigger')).toBe('UnnamedPlayer')
        expect(filterAuthor('faggot')).toBe('UnnamedPlayer')
    })

    test('censors blacklisted with space', () => {
        expect(filterAuthor('fag niggers')).toBe('UnnamedPlayer')
    })

    test('censors blacklisted without space', () => {
        expect(filterAuthor('fagniggers')).toBe('UnnamedPlayer')
    })

    test('censors leetspeak', () => {
        expect(filterAuthor('f4g')).toBe('UnnamedPlayer')
        expect(filterAuthor('n1gger')).toBe('UnnamedPlayer')
        expect(filterAuthor('nigg4')).toBe('UnnamedPlayer')
        expect(filterAuthor('n1gg4')).toBe('UnnamedPlayer')
    })

    test('censors through repeated chars', () => {
        expect(filterAuthor('niiigggeeer')).toBe('UnnamedPlayer')
    })

    test('censors through Q3 color codes', () => {
        expect(filterAuthor('^2fag^7')).toBe('UnnamedPlayer')
        expect(filterAuthor('^1ni^2gg^3er')).toBe('UnnamedPlayer')
    })

    test('returns empty input as-is', () => {
        expect(filterAuthor('')).toBe('')
        expect(filterAuthor(null)).toBe(null)
        expect(filterAuthor(undefined)).toBe(undefined)
    })

    test('unicode cyrillic lookalikes pass through (out of scope)', () => {
        // intentionally not caught
        expect(filterAuthor('піггеr')).toBe('піггеr')
    })
})

describe('filterMessage', () => {
    test('passes clean messages through unchanged', () => {
        expect(filterMessage('hello world')).toBe('hello world')
        expect(filterMessage('sorry testing something')).toBe('sorry testing something')
    })

    test('replaces blacklisted word with asterisks', () => {
        const out = filterMessage('hello nigger world')
        expect(out).toContain('*')
        expect(out.toLowerCase()).not.toContain('nigger')
    })

    test('censors multiple bad words', () => {
        const out = filterMessage('fag and nazi')
        expect(out.toLowerCase()).not.toContain('fag')
        expect(out.toLowerCase()).not.toContain('nazi')
    })

    test('exempts finish line messages', () => {
        const msg = 'iBondza reached the finish line in 26:752'
        expect(filterMessage(msg)).toBe(msg)
    })

    test('exempts record messages', () => {
        const msg = 'player broke the server record'
        expect(filterMessage(msg)).toBe(msg)
    })

    test('empty input', () => {
        expect(filterMessage('')).toBe('')
        expect(filterMessage(null)).toBe(null)
    })

    test('preserves color codes around censored word', () => {
        const out = filterMessage('^2hello ^1nigger^7 world')
        expect(out).toContain('^2')
        expect(out.toLowerCase()).not.toContain('nigger')
    })

    test('censors leetspeak in message body', () => {
        const out = filterMessage('hello n1gger world')
        expect(out).not.toContain('n1gger')
        expect(out).toContain('*')
    })

    test('censors leet with special chars', () => {
        const out = filterMessage('such f4g behavior')
        expect(out).not.toContain('f4g')
    })

    test('censors repeated-letter obfuscation', () => {
        // blacklist contains "fucker", so stretched variants match
        const out = filterMessage('pure fuuuuucker')
        expect(out).not.toContain('fuuuuucker')
        expect(out).toContain('*')
    })

    test('leaves benign text with overlapping letters untouched', () => {
        expect(filterMessage('nice grip')).toBe('nice grip')
        expect(filterMessage('finger painting')).toBe('finger painting')
    })
})
