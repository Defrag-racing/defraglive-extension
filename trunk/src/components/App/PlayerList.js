import React from 'react'
import { Q3STR } from '../../partials/Quake3'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

const SV_TYPE = {
    '0': 'auto',
    '1': 'defrag',
    '2': 'tricks',
    '3': 'fastcaps',
    '4': 'reserved',
    '5': 'run',
    '6': 'freestyle',
    '7': 'fastcaps',
}
const PHYSICS = {
    '0': 'VQ3',
    '1': 'CPM',
}

const PHYSICS_TYPES = {
    'vq3': 'VQ3',
    'cpm': 'CPM',
    'cpm.1': 'CPM FC',
    'cpm.2': 'CPM FC',
    'cpm-ctf2': 'CPM CTF',
    'vq3.7': 'VQ3 FS',
}

export function PlayerListLoader(props) {
    return (
        <div style={{'color': 'red'}}>Loading...</div>
    )
}

class PlayerListBase extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            hoveredPlayer: null,
            hoveredHelp: null,
            requestCooldowns: new Map(),
            afkControlCooldown: 0,
            copySuccess: null,
            currentServerAddress: null,
            serverInfo: null,
            serverName: null
        }

        this.spec_timeout = null

        this.toggle = this.toggle.bind(this)
        this.spectatePlayerID = this.spectatePlayerID.bind(this)
        this.spectateNext = this.spectateNext.bind(this)
        this.requestSpectate = this.requestSpectate.bind(this)
        this.handleAfkReset = this.handleAfkReset.bind(this)
        this.handleAfkExtend = this.handleAfkExtend.bind(this)
        this.copyToClipboard = this.copyToClipboard.bind(this)
        this.fallbackCopyTextToClipboard = this.fallbackCopyTextToClipboard.bind(this)
        this.fetchServerData = this.fetchServerData.bind(this)
    }

    componentDidMount() {
        this.props.getServerstate()
        this.fetchServerData()
    }

    componentDidUpdate(prevProps) {
        // Refetch server data when serverstate changes or when opening player list
        if (prevProps.serverstate !== this.props.serverstate ||
            (!prevProps.appstate.isPlayerlistOpen && this.props.appstate.isPlayerlistOpen)) {
            this.fetchServerData()
        }
    }

    async fetchServerData() {
        try {
            // First get current server IP from bot
            const serverstateResponse = await fetch('https://tw.defrag.racing/serverstate.json')
            const serverstate = await serverstateResponse.json()
            
            if (!serverstate.ip) {
                return
            }
            
            // Then get full server details from servers API
            const serversResponse = await fetch('https://defrag.racing/servers/json')
            const serversData = await serversResponse.json()
            
            const currentServerInfo = serversData.active?.[serverstate.ip]
            
            this.setState({
                currentServerAddress: serverstate.ip,
                serverInfo: currentServerInfo || {},
                serverName: serverstate.hostname || currentServerInfo?.hostname || 'Unknown'
            })
            
        } catch (error) {
            console.error('Error fetching server data:', error)
        }
    }

    toggle() {
        this.props.getServerstate()
        this.props.togglePlayerlist()
        if (!this.props.appstate.isPlayerlistOpen) {
            this.fetchServerData()
        }
    }

    spectatePlayerID(id) {
        if(this.props.twitchUser.role == 'guest') {
            return
        }

        if(this.spec_timeout != null) {
            return
        }

        this.spec_timeout = setTimeout(() => {
            const table = document.querySelector('.players-table')
            if (table) {
                table.classList.remove('loading')
            }
            this.spec_timeout = null
        }, 5000)

        this.props.sendCommand({
            'action': 'spectate',
            'value': `id:${id}`
        })

        const table = document.querySelector('.players-table')
        if (table) {
            table.classList.add('loading')
        }
    }

    spectateNext() {
        this.props.sendCommand({
            'action': 'spectate',
            'value': 'next'
        })
    }

    requestSpectate(playerName) {
        if(this.props.twitchUser.role == 'guest') {
            return
        }

        const now = Date.now()
        const lastRequest = this.state.requestCooldowns.get(playerName) || 0
        const cooldownTime = 30000

        if (now - lastRequest < cooldownTime) {
            return
        }

        this.props.sendCommand({
            'action': 'spectate_request',
            'value': playerName
        })

        this.setState(prevState => ({
            requestCooldowns: new Map(prevState.requestCooldowns.set(playerName, now))
        }))

        setTimeout(() => {
            this.setState(prevState => {
                const newCooldowns = new Map(prevState.requestCooldowns)
                if (newCooldowns.get(playerName) === now) {
                    newCooldowns.delete(playerName)
                }
                return { requestCooldowns: newCooldowns }
            })
        }, cooldownTime)
    }

    handleAfkReset() {
        if (Date.now() < this.state.afkControlCooldown) {
            return
        }

        this.props.sendCommand({
            'action': 'afk_control',
            'command': 'reset'
        })

        this.setState({ afkControlCooldown: Date.now() + 5000 })
    }

    handleAfkExtend() {
        if (Date.now() < this.state.afkControlCooldown) {
            return
        }

        this.props.sendCommand({
            'action': 'afk_control', 
            'command': 'extend'
        })

        this.setState({ afkControlCooldown: Date.now() + 5000 })
    }

    copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.setState({ copySuccess: text })
                setTimeout(() => {
                    this.setState({ copySuccess: null })
                }, 2000)
            }).catch(() => {
                this.fallbackCopyTextToClipboard(text)
            })
        } else {
            this.fallbackCopyTextToClipboard(text)
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea")
        textArea.value = text
        
        textArea.style.top = "0"
        textArea.style.left = "0"
        textArea.style.position = "fixed"
        
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        try {
            const successful = document.execCommand('copy')
            if (successful) {
                this.setState({ copySuccess: text })
                setTimeout(() => {
                    this.setState({ copySuccess: null })
                }, 2000)
            }
        } catch (err) {
            console.error('Fallback copy failed', err)
        }
        
        document.body.removeChild(textArea)
    }

	getPlayerWithScores() {
		const players = Object.values(this.props.serverstate.players || {})
		const scores = this.props.serverstate.scores?.players || []
		
		// Copy the exact logic from ServerBrowser
		return players.map(player => {
			const scoreData = scores.find(score => score.player_num === player.clientId)
			return {
				...player,
				time: scoreData?.time || 0,
				follow_num: scoreData?.follow_num || -1,
				team: scoreData?.follow_num === -1 ? '0' : '3'
			}
		})
	}
    
    getPlayerStatus(player) {
        const statuses = []
        
        if (player.nospec === 1) {
            statuses.push('No Spectating Enabled')
        }

        return statuses
    }

    renderPlayerTooltip(player) {
        const statuses = this.getPlayerStatus(player)
        
        return (
            <div className="player-tooltip">
                <div className="tooltip-name"><Q3STR s={player.n}/></div>
                <div className="tooltip-info">
                    <div>Role: {player.follow_num === -1 ? 'Player' : 'Spectator'}</div>
                    {player.time > 0 && <div>Best Time: {this.formatTime(player.time)}</div>}
                    <div>Country: {player.country}</div>
                    {player.logged && <div>Status: Logged in</div>}
                    {statuses.length > 0 && (
                        <div className="tooltip-status">
                            {statuses.map((status, idx) => (
                                <div key={idx} className="status-item">{status}</div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    formatTime(timeMs) {
        if (!timeMs || timeMs === 0) return 'No time'
        
        const totalMs = parseInt(timeMs)
        const minutes = Math.floor(totalMs / 60000)
        const seconds = Math.floor((totalMs % 60000) / 1000)
        const milliseconds = totalMs % 1000
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`
    }

    canSpectatePlayer(player) {        
        return player.nospec !== 1 && 
               player.nospec !== '1' && 
               player.c1 !== 'nospec' && 
               player.c1 !== 'nospecpm'
    }

    isOnCooldown(playerName) {
        const now = Date.now()
        const lastRequest = this.state.requestCooldowns.get(playerName) || 0
        return (now - lastRequest) < 30000
    }

// In PlayerList.js, replace the getPlayerWithScores method and the render section with this:

getPlayerWithScores() {
    const players = Object.values(this.props.serverstate.players || {})
    const scores = this.props.serverstate.scores?.players || []
    
    // Copy the exact logic from ServerBrowser
    return players.map(player => {
        const scoreData = scores.find(score => score.player_num === player.clientId)
        return {
            ...player,
            time: scoreData?.time || 0,
            follow_num: scoreData?.follow_num || -1,
            team: scoreData?.follow_num === -1 ? '0' : '3'
        }
    })
}

// Replace the render method's player table section with this:
render() {
    const svgPlayers = <svg className="playerlist-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" title="Toggle Player List"><path d="M10 .4C4.697.4.399 4.698.399 10A9.6 9.6 0 0 0 10 19.601c5.301 0 9.6-4.298 9.6-9.601 0-5.302-4.299-9.6-9.6zm.896 3.466c.936 0 1.211.543 1.211 1.164 0 .775-.62 1.492-1.679 1.492-.886 0-1.308-.445-1.282-1.164 0-.621.396-1.492 1.75-1.492zm-1.75 8.727c-2.066 0-3.744-1.678-3.744-3.744s1.678-3.744 3.744-3.744 3.744 1.678 3.744 3.744-1.678 3.744-3.744 3.744zm0-6.008c-1.392 0-2.523 1.132-2.523 2.523s1.132 2.523 2.523 2.523 2.523-1.132 2.523-2.523-1.131-2.523-2.523-2.523z"/></svg>
    let svgClose = <svg className="playerlist-svg opened" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" title="Close Player List"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.10a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
    
    const playersWithScores = this.getPlayerWithScores()
    
    // Fixed logic: Active players are those with follow_num === -1
    const activePlayers = playersWithScores.filter(player => player.follow_num === -1)
    // Spectators are those with follow_num !== -1 (they're following someone)
    const allSpectators = playersWithScores.filter(player => player.follow_num !== -1)
    
    // Debug logging
    console.log('Active players:', activePlayers.map(p => `${p.n} (follow_num: ${p.follow_num})`))
    console.log('All spectators:', allSpectators.map(p => `${p.n} (follow_num: ${p.follow_num})`))

    const isOnAfkCooldown = Date.now() < this.state.afkControlCooldown

    // Use server data from API calls
    const serverAddress = this.state.currentServerAddress || 'Unknown'
    const serverName = this.state.serverName || 'Unknown Server'
    const serverMap = this.props.serverstate.mapname || 'Unknown'
    const serverPhysics = this.state.serverInfo?.defrag ? 
                        (PHYSICS_TYPES[this.state.serverInfo.defrag] || this.state.serverInfo.defrag.toUpperCase()) : 
                        (this.props.serverstate.df_promode === '1' ? 'CPM' : 'VQ3')

    return (
        <div className={`playerlist-wrap playerlist-${this.props.appstate.isPlayerlistOpen ? 'opened' : 'closed'}`}>
            <div className="playerlist-button" onClick={this.toggle} title="Toggle Player List">
                {this.props.appstate.isPlayerlistOpen ? svgClose : svgPlayers}
            </div>
            <div className="playerlist-content-wrap">
                <div className="playerlist-content">
                    <div className="header-top">
                        <div className="h1">Player List</div>
                        <div className="header-controls">
                            <div className="spectate-next-button" onClick={this.spectateNext} title="Spectate Next Player">
                                <svg className="spectate-next-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                            </div>
                            <div className="afk-controls">
                                <button 
                                    className={`afk-control-btn reset ${isOnAfkCooldown ? 'cooldown' : ''}`}
                                    onClick={this.handleAfkReset}
                                    disabled={isOnAfkCooldown}
                                    title="Reset AFK timer"
                                >
                                    ↻
                                </button>
                                <button 
                                    className={`afk-control-btn extend ${isOnAfkCooldown ? 'cooldown' : ''}`}
                                    onClick={this.handleAfkExtend}
                                    disabled={isOnAfkCooldown}
                                    title="Extend AFK timer by 5 minutes"
                                >
                                    +5m
                                </button>
                            </div>
                            <div className="close" onClick={this.toggle} title="Close Player List">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="section server-info-section">
                        <div className="header">Current Server</div>
                        <div className="content">
                            <div className="server-details">
                                <div className="detail-row">
                                    <span className="server-name-display">
                                        <Q3STR s={serverName}/>
                                    </span>
                                </div>
                                
                                <div className="detail-row">
                                    <span className="server-address">{serverAddress}</span>
                                    <button 
                                        className={`copy-button-small ${this.state.copySuccess === serverAddress ? 'copied' : ''}`}
                                        onClick={() => this.copyToClipboard(serverAddress)}
                                        title="Copy IP address"
                                    >
                                        📋
                                    </button>
                                </div>
                                
                                <div className="detail-row">
                                    <span className="server-map">
                                        Map: <a 
                                            href={`https://defrag.racing/maps/${serverMap}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Q3STR s={serverMap}/>
                                        </a>
                                    </span>
                                    <button 
                                        className={`copy-button-small ${this.state.copySuccess === serverMap ? 'copied' : ''}`}
                                        onClick={() => this.copyToClipboard(serverMap)}
                                        title="Copy map name"
                                    >
                                        📋
                                    </button>
                                </div>
                                
                                <div className="detail-row">
                                    <span className="server-physics">
                                        {serverPhysics}
                                    </span>
                                    <span className="player-count-inline">
                                        Players: {Object.keys(this.props.serverstate.players || {}).length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="section">
                        <div className="content" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                            <div className="instructions">
                                Click a player name to switch spectator POV. Or use twitch chat with "?n" to cycle through players. Players with 🙏 have nospec enabled - click the icon to request spectating.
                            </div>
                            {Object.keys(this.props.serverstate.players).length === 0 ? (
                                <div className="no-players">No players available</div>
                            ) : (
                                <div>
                                    <table className="players-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    Player <span 
                                                        className="help-icon" 
                                                        onMouseEnter={() => this.setState({ hoveredHelp: 'player' })}
                                                        onMouseLeave={() => this.setState({ hoveredHelp: null })}
                                                    >
                                                        ?
                                                    </span>
                                                    {this.state.hoveredHelp === 'player' && (
                                                        <div className="help-tooltip">
                                                            Click a player name to spectate their POV. Players with 🙏 have nospec enabled - click to politely request spectating. "Spectate Next" cycles automatically.
                                                        </div>
                                                    )}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activePlayers.map((player) => {
                                                // Copy exact logic from ServerBrowser - only use clientId
                                                const followingSpecs = allSpectators.filter(spec => 
                                                    spec.follow_num === player.clientId
                                                )
                                                
                                                const canSpectate = this.canSpectatePlayer(player)
                                                const isOnCooldown = this.isOnCooldown(player.n)
                                                
                                                return (
                                                    <React.Fragment key={`player-${player.id || player.clientId}`}>
                                                        <tr className={!canSpectate ? 'nospec-player' : ''}>
                                                            <td>
                                                                <div className="player-row">
                                                                    <div 
                                                                        className={`player-info ${canSpectate ? 'link' : 'nospec-link'} ${this.getPlayerStatus(player).length > 0 ? 'has-status' : ''}`}
                                                                        onClick={canSpectate ? () => this.spectatePlayerID(player.id) : undefined}
                                                                        onMouseEnter={() => this.setState({ hoveredPlayer: player })}
                                                                        onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                                    >
                                                                        <Q3STR s={player.n}/>
                                                                        {player.time > 0 && (
                                                                            <span className="player-time"> ({this.formatTime(player.time)})</span>
                                                                        )}
                                                                        {this.getPlayerStatus(player).length > 0 && (
                                                                            <span className="status-indicator">!</span>
                                                                        )}
                                                                        {!canSpectate && (
                                                                            <span className="nospec-indicator"> (No Spectating)</span>
                                                                        )}
                                                                    </div>
                                                                    {!canSpectate && this.props.twitchUser.role !== 'guest' && (
                                                                        <div 
                                                                            className={`request-spectate-btn ${isOnCooldown ? 'cooldown' : ''}`}
                                                                            onClick={!isOnCooldown ? () => this.requestSpectate(player.n) : undefined}
                                                                            title={isOnCooldown ? "Please wait before requesting again" : "Politely request to spectate this player"}
                                                                        >
                                                                            🙏
                                                                        </div>
                                                                    )}
                                                                    {this.state.hoveredPlayer === player && (
                                                                        <div className="player-tooltip-container">
                                                                            {this.renderPlayerTooltip(player)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {followingSpecs.map((spec) => (
                                                            <tr key={`spec-${spec.id || spec.clientId}`} className="spectator">
                                                                <td>
                                                                    <div className="player-row">
                                                                        <div 
                                                                            className={`player-info link ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}
                                                                            onClick={() => this.spectatePlayerID(spec.id)}
                                                                            onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                                            onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                                        >
                                                                            👁️ <Q3STR s={spec.n}/> <span className="spectating-info">(spectating <Q3STR s={player.n}/>)</span>
                                                                            {this.getPlayerStatus(spec).length > 0 && (
                                                                                <span className="status-indicator">!</span>
                                                                            )}
                                                                        </div>
                                                                        {this.state.hoveredPlayer === spec && (
                                                                            <div className="player-tooltip-container">
                                                                                {this.renderPlayerTooltip(spec)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                    
                                    {/* Show free spectators (those not following any active player) */}
                                    {allSpectators.length > 0 && (
                                        (() => {
                                            // Find spectators who aren't following any active player - copy ServerBrowser logic
                                            const freeSpectators = allSpectators.filter(spec => {
                                                const isFollowingActivePlayer = activePlayers.some(player => 
                                                    spec.follow_num === player.clientId
                                                )
                                                return !isFollowingActivePlayer
                                            })
                                            
                                            console.log('Free spectators:', freeSpectators.map(p => `${p.n} (follow_num: ${p.follow_num})`))
                                            
                                            if (freeSpectators.length > 0) {
                                                return (
                                                    <div className="free-spectators">
                                                        <div className="header">Free Spectators</div>
                                                        <table className="players-table">
                                                            <tbody>
                                                                {freeSpectators.map((spec) => (
                                                                    <tr key={`free-spec-${spec.id || spec.clientId}`}>
                                                                        <td>
                                                                            <div className="player-row">
                                                                                <div 
                                                                                    className={`player-info link ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}
                                                                                    onClick={() => this.spectatePlayerID(spec.id)}
                                                                                    onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                                                    onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                                                >
                                                                                    <Q3STR s={spec.n}/> <span className="spectating-info">(free spectator)</span>
                                                                                    {this.getPlayerStatus(spec).length > 0 && (
                                                                                        <span className="status-indicator">!</span>
                                                                                    )}
                                                                                </div>
                                                                                {this.state.hoveredPlayer === spec && (
                                                                                    <div className="player-tooltip-container">
                                                                                        {this.renderPlayerTooltip(spec)}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            }
                                            return null
                                        })()
                                    )}
                                    <div className="note m-t m-b">Click on the player name to spectate that person. Players with 🙏 have nospec enabled.</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export const PlayerList = connect(mapState, mapDispatch)(PlayerListBase)