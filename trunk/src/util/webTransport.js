// Web-native transport for the extension - replaces the raw WebSocket link to
// the bridge (wss://tw.defrag.racing/ws).
//
// Live events: subscribe to the public 'defraglive' Reverb channel and listen
// for the '.stream' event (Laravel broadcastAs('stream')). The payload is the
// same {action, message, ...} object the bridge used to relay, so the existing
// onConsoleMessage handler works unchanged.
//
// Outbound: the old code sent everything over the WS. Here each message is
// routed to the matching web API endpoint instead.
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { WEB_CONFIG } from '../webConfig'

const base = () => WEB_CONFIG.API_BASE.replace(/\/$/, '')

export function initEcho() {
    window.Pusher = Pusher
    return new Echo({
        broadcaster: 'reverb',
        key: WEB_CONFIG.REVERB.key,
        wsHost: WEB_CONFIG.REVERB.wsHost,
        wsPort: WEB_CONFIG.REVERB.wsPort,
        wssPort: WEB_CONFIG.REVERB.wsPort,
        forceTLS: WEB_CONFIG.REVERB.forceTLS,
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
    })
}

function postJson(path, body) {
    return fetch(base() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }).then(r => r.ok).catch(() => false)
}

// Routes an outbound message (built in the old WS shape) to the web API.
// `onCurrentSettings` is called with the settings object for a
// get_current_settings request (so the caller can dispatch its UI event).
export function sendToWeb(msg, botSecret, onCurrentSettings) {
    // Viewer chat typed in the console -> said in-game by the bot.
    if (msg.action === 'message') {
        postJson('/api/defraglive/say', {
            content: msg.message.content,
            author: msg.message.author,
        })
        return true
    }

    if (msg.action === 'ext_command') {
        const content = msg.message && msg.message.content
        if (!content || typeof content !== 'object') {
            return false
        }

        if (content.action === 'settings_batch') {
            postJson('/api/defraglive/settings', {
                settings: content.settings,
                username: msg.message.author,
                bot_secret: botSecret,
            })
            return true
        }

        if (content.action === 'get_current_settings') {
            fetch(base() + '/api/defraglive/settings')
                .then(r => (r.ok ? r.json() : null))
                .then(d => { if (d && onCurrentSettings) onCurrentSettings(d.settings) })
                .catch(() => {})
            return true
        }

        // Translation is handled client-side now (see Rows.js); nothing to send.
        if (content.action === 'translate_message') {
            return true
        }

        // spectate / spectate_request / afk_control / connect / delete_message
        postJson('/api/defraglive/command', {
            content,
            author: msg.message.author,
            bot_secret: botSecret,
        })
        return true
    }

    return false
}
