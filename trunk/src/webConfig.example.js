// Copy this file to src/webConfig.js and fill in. (webConfig.js is gitignored,
// like botConfig.js.)
//
// Web-native DefragLive config: the extension talks to the defrag.racing web
// app instead of the old tw.defrag.racing WebSocket bridge - it subscribes to
// the 'defraglive' Reverb channel for live events and POSTs commands to the
// web API.
export const WEB_CONFIG = {
    // Base URL of the web API (no trailing slash).
    API_BASE: 'https://defrag.racing',

    // Laravel Reverb (Pusher-protocol) connection. Must match the web's
    // REVERB_APP_KEY and the public Reverb host/port.
    REVERB: {
        key: 'your_reverb_app_key',
        wsHost: 'tw.defrag.racing',
        wsPort: 443,
        forceTLS: true,
    },
};
