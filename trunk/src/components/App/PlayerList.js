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
            hoveredHelp: null, // For question mark tooltip
            requestCooldowns: new Map() // Track cooldowns for request buttons
        }

        this.spec_timeout = null

        this.toggle = this.toggle.bind(this)
        this.spectatePlayerID = this.spectatePlayerID.bind(this)
        this.spectateNext = this.spectateNext.bind(this)
        this.requestSpectate = this.requestSpectate.bind(this)
    }

    componentDidMount() {
        this.props.getServerstate()
    }

    toggle() {
        this.props.getServerstate()
        this.props.togglePlayerlist()
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

        // Check cooldown
        const now = Date.now()
        const lastRequest = this.state.requestCooldowns.get(playerName) || 0
        const cooldownTime = 30000 // 30 seconds

        if (now - lastRequest < cooldownTime) {
            return // Still on cooldown
        }

        // Send spectate request command to backend
        this.props.sendCommand({
            'action': 'spectate_request',
            'value': playerName
        })

        // Update cooldown
        this.setState(prevState => ({
            requestCooldowns: new Map(prevState.requestCooldowns.set(playerName, now))
        }))

        // Clear cooldown after time expires
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

    // Merge players with scores for follow_num
    getPlayerWithScores() {
        const players = Object.values(this.props.serverstate.players || {})
        const scores = this.props.serverstate.scores?.players || []
        
        return players.map(player => {
            const scoreData = scores.find(score => score.player_num === player.clientId || score.player_num === player.id)
            return {
                ...player,
                time: scoreData?.time || 0,
                follow_num: scoreData?.follow_num || -1,
                team: scoreData?.follow_num === -1 ? '0' : '3' // 0 = player, 3 = spectator
            }
        })
    }
    
    getPlayerStatus(player) {
        const statuses = []
        
        if (player.nospec === 1) {
            statuses.push('No Spectating Enabled')
        }

        if (player.follow_num && player.follow_num !== -1) {
            statuses.push(`Spectating Player ID ${player.follow_num}`)
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
        // Check multiple possible nospec indicators
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

    render() {
        const svgPlayers = <svg className="playerlist-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" title="Toggle Player List"><path d="M10 .4C4.697.4.399 4.698.399 10A9.6 9.6 0 0 0 10 19.601c5.301 0 9.6-4.298 9.6-9.601 0-5.302-4.299-9.6-9.6-9.6zm.896 3.466c.936 0 1.211.543 1.211 1.164 0 .775-.62 1.492-1.679 1.492-.886 0-1.308-.445-1.282-1.164 0-.621.396-1.492 1.75-1.492zm-1.75 8.727c-2.066 0-3.744-1.678-3.744-3.744s1.678-3.744 3.744-3.744 3.744 1.678 3.744 3.744-1.678 3.744-3.744 3.744zm0-6.008c-1.392 0-2.523 1.132-2.523 2.523s1.132 2.523 2.523 2.523 2.523-1.132 2.523-2.523-1.131-2.523-2.523-2.523z"/></svg>
        let svgClose = <svg className="playerlist-svg opened" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" title="Close Player List"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
        
        const playersWithScores = this.getPlayerWithScores()
        const activePlayers = playersWithScores.filter(player => player.follow_num === -1)
        const allSpectators = playersWithScores.filter(player => player.follow_num !== -1)
        const freeSpectators = playersWithScores.filter(player => 
            player.follow_num === -1 && 
            !activePlayers.some(ap => ap.clientId === player.clientId)
        )

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
                                    <svg className="spectate-next-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 6v2h2v-1h4v3.5c0 .83-.67 1.5-1.5 1.5H11v2h3.5c1.83 0 3.5-1.67 3.5-3.5V7c0-1.83-1.67-3.5-3.5-3.5h-7C4.67 3.5 3 5.17 3 7v4c0 1.83 1.67 3.5 3.5 3.5h.5v-2H6.5C5.67 12.5 5 11.83 5 11V7c0-1.33 1.17-2.5 2.5-2.5h7C14.33 4.5 15 5.17 15 6v-.5c0-1.83-1.67-3.5-3.5-3.5h-7C2.67 2 1 3.67 1 6v4c0 3.31 2.69 6 6 6h1v2H7c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h7c3.31 0 6 2.69 6 6v1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6c0-2.21-1.79-4-4-4h-7c-2.21 0-4 1.79-4 4v4c0 2.21 1.79 4 4 4h1v-2H7c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3h7c1.66 0 3 1.34 3 3v3.5c0 1.11-.89 2-2 2H10v-2h2V8h-2V6h-2v2h-.5c-1.38 0-2.5 1.12-2.5 2.5V11c0 1.38 1.12 2.5 2.5 2.5H10v2H7c-2.76 0-5-2.24-5-5V6c0-2.76 2.24-5 5-5h7c2.76 0 5 2.24 5 5v1.5c0 2.21-1.79 4-4 4H10c-1.66 0-3-1.34-3-3V8h2V6h2zm10 10v-2h-2v2h-2v2h2v2h2v-2h2v-2h-2z"/></svg>
                                </div>
                                <div className="close" onClick={this.toggle} title="Close Player List">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
                                </div>
                            </div>
                        </div>
                        <div className="section">
                            <div className="content" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                                <div className="instructions">
                                    Click a player name to switch spectator POV. Use "Spectate Next" to cycle through players. Players with 🙏 have nospec enabled - click the icon to request spectating.
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
                                                    const followingSpecs = allSpectators.filter(spec => spec.follow_num === player.id || spec.follow_num === player.clientId)
                                                    const canSpectate = this.canSpectatePlayer(player)
                                                    const isOnCooldown = this.isOnCooldown(player.n)
                                                    
                                                    return (
                                                        <React.Fragment key={player.id}>
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
                                                                <tr key={spec.id} className="spectator">
                                                                    <td>
                                                                        <div className="player-row">
                                                                            <div 
                                                                                className={`player-info link ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}
                                                                                onClick={() => this.spectatePlayerID(spec.id)}
                                                                                onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                                                onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                                            >
                                                                                👁️ <Q3STR s={spec.n}/>
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
                                        {freeSpectators.length > 0 && (
                                            <div className="free-spectators">
                                                <div className="header">Free Spectators</div>
                                                <table className="players-table">
                                                    <tbody>
                                                        {freeSpectators.map((spec) => (
                                                            <tr key={spec.id}>
                                                                <td>
                                                                    <div className="player-row">
                                                                        <div 
                                                                            className={`player-info link ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}
                                                                            onClick={() => this.spectatePlayerID(spec.id)}
                                                                            onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                                            onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                                        >
                                                                            <Q3STR s={spec.n}/>
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
}

export const PlayerList = connect(mapState, mapDispatch)(PlayerListBase)