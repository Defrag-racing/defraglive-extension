import Authentication from './Authentication'
import "isomorphic-fetch"

let normalToken = 'xxxx' // add token
let modToken = 'xxxx' // add token

let auth = new Authentication()

test('able to create new Authenciation instance', ()=>{
    expect(auth).toBeDefined()
})

test('able to set a token', ()=>{
    auth.setToken(normalToken,'U12345678')
    expect(auth.isAuthenticated()).toEqual(true)    
})


describe('makeCall tests', ()=>{
    test('able to call a test URL', async ()=>{
        let response = await auth.makeCall('https://twitch.tv/')
        expect(response.status).toEqual(200)
    })
    
    test('rejects when no credentials', ()=>{
        auth.setToken('','')
        return expect(auth.makeCall('https://twitch.tv/')).rejects.toEqual('Unauthorized')
    })

    test('rejects on invalid response',()=>{
        auth.setToken('abc123','U12345678')
        return expect(auth.makeCall('htts://api')).rejects.toBeDefined()
    })

    test('rejecsts on bad credentials',async ()=>{
        return expect(auth.makeCall('https://google.com')).rejects.toBeDefined()
    })
})

describe('moderator tests', ()=>{
    test('returns valid mod status',()=>{
        auth.setToken(modToken,'ABC123')
        expect(auth.isModerator()).toEqual(true)

        auth.setToken(normalToken,'ABC123')
        expect(auth.isModerator()).toEqual(false)
    })
})