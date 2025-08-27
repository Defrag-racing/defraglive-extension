import { init } from "@rematch/core"


const defaultAppState = {
    isConsoleOpen: false,
    isNotifyOpen: false,
    isPlayerlistOpen: false,
    isServerBrowserOpen: false,  // Added server browser state
}
const defaultServerState = {
    'initialized': false,
    'bot_id': '0',
    'mapname': 'st1',
    'defrag_gametype': '0',
    'df_promode': '0',
    'num_players': 0,
    'current_player': {
        'n': 'UnnamedPlayer'
    },
    'players': {},
}
export const appState = {
    state: defaultAppState,
    reducers: {
        TOGGLE_CONSOLE: (state, data) => {
            return {
                isConsoleOpen: !state.isConsoleOpen,
                isNotifyOpen: false,
                isPlayerlistOpen: false,
                isServerBrowserOpen: false,  // Close server browser when console opens
            }
        },

        TOGGLE_NOTIFY: (state, data) => {
            return {
                isConsoleOpen: false,
                isNotifyOpen: !state.isNotifyOpen,
                isPlayerlistOpen: false,
                isServerBrowserOpen: false,  // Close server browser when notify opens
            }
        },

        TOGGLE_PLAYERLIST: (state, data) => {
            return {
                isConsoleOpen: false,
                isNotifyOpen: false,
                isPlayerlistOpen: !state.isPlayerlistOpen,
                isServerBrowserOpen: false,  // Close server browser when player list opens
            }
        },

        // Added server browser toggle reducer
        TOGGLE_SERVERBROWSER: (state, data) => {
            return {
                isConsoleOpen: false,
                isNotifyOpen: false,
                isPlayerlistOpen: false,
                isServerBrowserOpen: !state.isServerBrowserOpen,
            }
        }
    },
    effects: (dispatch) => ({
        toggleConsole() {
            dispatch.appState.TOGGLE_CONSOLE()
        },

        toggleNotify() {
            dispatch.appState.TOGGLE_NOTIFY()
        },

        togglePlayerlist() {
            dispatch.appState.TOGGLE_PLAYERLIST()
        },

        // Added server browser toggle effect
        toggleServerBrowser() {
            dispatch.appState.TOGGLE_SERVERBROWSER()
        },
    })
}

export const serverState = {
    state: defaultServerState,
    reducers: {
        SET_SERVERSTATE: (state, data) => {
            if(typeof data === undefined)
                return state
            data.initialized = true
            return data
        }
    },
    effects: (dispatch) => ({
        updateServerstate(newData) {
            dispatch.serverState.SET_SERVERSTATE(newData)
        },

        async getServerstate() {
            const response = await fetch("https://tw.defrag.racing/serverstate.json").catch(err => {})
            if(response == undefined) {
                return defaultServerState
            }
            if(!response.ok) {
                return defaultServerState
            }
            let data = await response.json()
            dispatch.serverState.SET_SERVERSTATE(data)
        }
    })
}

export const appStore = init({
    name: 'state',
    models: { appState, serverState }
})

export const mapState = (state) => ({
    appstate: state.appState,
    serverstate: state.serverState
})

export const mapDispatch = (dispatch) => ({
    toggleConsole: () => dispatch.appState.toggleConsole(),
    toggleNotify: () => dispatch.appState.toggleNotify(),
    togglePlayerlist: () => dispatch.appState.togglePlayerlist(),
    toggleServerBrowser: () => dispatch.appState.toggleServerBrowser(),  // Added server browser dispatch

    getServerstate: () => dispatch.serverState.getServerstate(),
    updateServerstate: (data) => dispatch.serverState.updateServerstate(data),
})