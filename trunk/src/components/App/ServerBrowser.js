import React from 'react'
import { Q3STR } from '../../partials/Quake3'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

const PHYSICS_TYPES = {
    'vq3': 'VQ3',
    'cpm': 'CPM',
    'cpm.1': 'CPM FC',
    'cpm.2': 'CPM FC',
    'cpm-ctf2': 'CPM CTF',
    'vq3.7': 'VQ3 FS',
}

export function ServerBrowserLoader(props) {
    return (
        <div style={{'color': 'red'}}>Loading servers...</div>
    )
}

class ServerBrowserBase extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            servers: {},
            loading: false,
            error: null,
            hoveredPlayer: null,
            copySuccess: null,
            hoveredHelp: null // For question mark tooltip
        }

        this.connect_timeout = null

        this.toggle = this.toggle.bind(this)
        this.connectToServer = this.connectToServer.bind(this)
        this.fetchServers = this.fetchServers.bind(this)
        this.refreshServers = this.refreshServers.bind(this)
        this.copyToClipboard = this.copyToClipboard.bind(this)
    }

    componentDidMount() {
        this.fetchServers()
    }

    toggle() {
        this.props.toggleServerBrowser()
        if (this.props.appstate.isServerBrowserOpen) {
            this.fetchServers()
        }
    }

    async fetchServers() {
        this.setState({ loading: true, error: null })
        
        try {
            const response = await fetch('https://defrag.racing/servers/json')
            if (!response.ok) {
                throw new Error('Failed to fetch servers')
            }
            
            const data = await response.json()
            this.setState({ 
                servers: data.active || {},
                loading: false 
            })
        } catch (error) {
            console.error('Error fetching servers:', error)
            this.setState({ 
                error: 'Failed to load servers',
                loading: false 
            })
        }
    }

    refreshServers() {
        this.fetchServers()
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

    formatTime(timeMs) {
        if (!timeMs || timeMs === 0) return 'No time'
        
        const totalMs = parseInt(timeMs)
        const minutes = Math.floor(totalMs / 60000)
        const seconds = Math.floor((totalMs % 60000) / 1000)
        const milliseconds = totalMs % 1000
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`
    }

    getPlayerWithScores(server) {
        const players = Object.values(server.players || {})
        const scores = server.scores?.players || []
        
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

    isServerConnectable(server) {
        const playersWithScores = this.getPlayerWithScores(server)
        
        const activePlayers = playersWithScores.filter(player => player.follow_num === -1)
        
        if (activePlayers.length === 0) {
            return { connectable: true, reason: null }
        }

        const allNospec = activePlayers.every(player => player.nospec === 1)

        if (allNospec) {
            return { 
                connectable: false, 
                reason: 'All active players have nospec enabled. Cannot spectate anyone on this server.' 
            }
        }

        return { connectable: true, reason: null }
    }

    connectToServer(address, server) {
        if (this.props.twitchUser.role === 'guest') {
            return
        }

        const { connectable, reason } = this.isServerConnectable(server)
        
        if (!connectable) {
            alert(reason)
            return
        }

        if (this.connect_timeout != null) {
            return
        }

        this.connect_timeout = setTimeout(() => {
            const serversTable = document.querySelector('.servers-table')
            if (serversTable) {
                serversTable.classList.remove('loading')
            }
            this.connect_timeout = null
        }, 5000)

        this.props.sendCommand({
            'action': 'connect',
            'value': address
        })

        const serversTable = document.querySelector('.servers-table')
        if (serversTable) {
            serversTable.classList.add('loading')
        }
    }

    getPlayerStatus(player) {
        const statuses = []
        
        if (player.nospec === 1) {
            statuses.push('No Spectating Enabled')
        }

        //if (player.follow_num && player.follow_num !== -1) {
        //    statuses.push(`Spectating Player ID ${player.follow_num}`)
        //}

        return statuses
    }

    renderPlayerTooltip(player) {
        const statuses = this.getPlayerStatus(player)
        
        return (
            <div className="player-tooltip">
                <div className="tooltip-name"><Q3STR s={player.name}/></div>
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

    renderServerRow(address, server) {
        const playersWithScores = this.getPlayerWithScores(server)
        const playerCount = playersWithScores.length
        const { connectable, reason } = this.isServerConnectable(server)
        
        // Separate active players and spectators
        const activePlayers = playersWithScores.filter(player => player.follow_num === -1)
        const allSpectators = playersWithScores.filter(player => player.follow_num !== -1)
        const freeSpectators = playersWithScores.filter(player => 
            player.follow_num === -1 && 
            !activePlayers.some(ap => ap.clientId === player.clientId)
        )

        return (
            <tr key={address} className={`${playerCount > 0 ? 'has-players' : 'empty'} ${!connectable ? 'not-connectable' : ''}`}>
                <td style={{ width: '42%' }}>
                    <div className="server-info">
                        <div className="server-name-row">
                            <div 
                                className={`server-name ${connectable ? 'link' : 'disabled-link'}`}
                                onClick={() => connectable && this.connectToServer(address, server)}
                                title={`Connect to ${address}`}
                            >
                                <Q3STR s={server.hostname}/>
                            </div>
                        </div>
                        
                        <div className="server-details">
                            <div className="detail-row">
                                <span className="server-address">{address}</span>
                                <button 
                                    className={`copy-button-small ${this.state.copySuccess === address ? 'copied' : ''}`}
                                    onClick={() => this.copyToClipboard(address)}
                                    title="Copy IP address"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="detail-row">
                                <span className="server-map">
                                    Map: <a 
                                        href={`https://defrag.racing/maps/${server.map}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Q3STR s={server.map}/>
                                    </a>
                                </span>
                                <button 
                                    className={`copy-button-small ${this.state.copySuccess === server.map ? 'copied' : ''}`}
                                    onClick={() => this.copyToClipboard(server.map)}
                                    title="Copy map name"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="detail-row">
                                <span className="server-physics">{PHYSICS_TYPES[server.defrag] || server.defrag.toUpperCase()}</span>
                                <span className="player-count-inline">Players: {playerCount}</span>
                            </div>
                        </div>
                        
                        {!connectable && (
                            <div className="server-warning">
                                ⚠️ {reason}
                            </div>
                        )}
                    </div>
                </td>
                <td style={{ width: '58%' }}>
                    <div className="player-names">
                        {playerCount === 0 ? (
                            <div className="empty-text">No players</div>
                        ) : (
                            <div className="players-list">
                                {activePlayers.map((player) => {
                                    const followingSpecs = allSpectators.filter(spec => 
                                        spec.follow_num === player.clientId
                                    )
                                    return (
                                        <div key={player.clientId} className="player-group">
                                            <div 
                                                className="player-name-container"
                                                onMouseEnter={() => this.setState({ hoveredPlayer: player })}
                                                onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                            >
                                                <span className={`player-name ${this.getPlayerStatus(player).length > 0 ? 'has-status' : ''}`}>
                                                    <Q3STR s={player.name}/>
                                                    {player.time > 0 && (
                                                        <span className="player-time"> ({this.formatTime(player.time)})</span>
                                                    )}
                                                    {this.getPlayerStatus(player).length > 0 && (
                                                        <span className="status-indicator">!</span>
                                                    )}
                                                </span>
                                                {this.state.hoveredPlayer === player && (
                                                    <div className="player-tooltip-container">
                                                        {this.renderPlayerTooltip(player)}
                                                    </div>
                                                )}
                                            </div>
                                            {followingSpecs.map((spec) => (
                                                <div 
                                                    key={spec.clientId} 
                                                    className="player-name-container spectator"
                                                    onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                    onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                >
                                                    <span className={`player-name ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}>
                                                        👁️ <Q3STR s={spec.name}/>
                                                        {this.getPlayerStatus(spec).length > 0 && (
                                                            <span className="status-indicator">!</span>
                                                        )}
                                                    </span>
                                                    {this.state.hoveredPlayer === spec && (
                                                        <div className="player-tooltip-container">
                                                            {this.renderPlayerTooltip(spec)}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })}
                                {freeSpectators.length > 0 && (
                                    <div className="free-spectators">
                                        {freeSpectators.map((spec) => (
                                            <div 
                                                key={spec.clientId} 
                                                className="player-name-container"
                                                onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                            >
                                                <span className={`player-name ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}>
                                                    <Q3STR s={spec.name}/>
                                                    {this.getPlayerStatus(spec).length > 0 && (
                                                        <span className="status-indicator">!</span>
                                                    )}
                                                </span>
                                                {this.state.hoveredPlayer === spec && (
                                                    <div className="player-tooltip-container">
                                                        {this.renderPlayerTooltip(spec)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {playerCount > 5 && (
                                    <div className="more-players">and {playerCount - 5} more...</div>
                                )}
                            </div>
                        )}
                    </div>
                </td>
            </tr>
        )
    }

    render() {
        let svgServers = <svg className="serverbrowser-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" title="Toggle Server Browser"><path d="M0 2C0 .9.9 0 2 0h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm0 6C0 6.9.9 6 2 6h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V8zm0 6C0 12.9.9 12 2 12h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2zM5 2v2h2V2H5zm0 6v2h2V8H5zm0 6v2h2v-2H5z"/></svg>
        let svgClose = <svg className="serverbrowser-svg opened" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" title="Close Server Browser"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
        
        return (
            <div className={`serverbrowser-wrap serverbrowser-${this.props.appstate.isServerBrowserOpen ? 'opened' : 'closed'}`}>
                <div className="serverbrowser-button" onClick={this.toggle} title="Toggle Server Browser">
                    {this.props.appstate.isServerBrowserOpen ? svgClose : svgServers}
                </div>
                <div className="serverbrowser-content-wrap">
                    <div className="serverbrowser-content">
                        <div className="header-top">
                            <div className="h1">Server Browser</div>
                            <div className="header-controls">
                                <div className="refresh-button" onClick={this.refreshServers} title="Refresh Server List">
                                    <svg className="refresh-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                                </div>
                                <div className="close" onClick={this.toggle} title="Close Server Browser">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
                                </div>
                            </div>
                        </div>
                        <div className="section">
                            <div className="content" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                                <div className="instructions">
                                    Click a server name to connect. Switch servers by selecting a new one from the list.
                                </div>
                                {this.state.loading && (
                                    <div className="loading-message">Loading servers...</div>
                                )}
                                {this.state.error && (
                                    <div className="error-message">
                                        {this.state.error}
                                        <button className="retry-button" onClick={this.refreshServers} title="Retry Loading Servers">Retry</button>
                                    </div>
                                )}
                                {!this.state.loading && !this.state.error && Object.keys(this.state.servers).length === 0 && (
                                    <div className="no-servers">No servers available</div>
                                )}
                                {!this.state.loading && !this.state.error && Object.keys(this.state.servers).length > 0 && (
                                    <table className="servers-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '42%' }}>
                                                    Server <span 
                                                        className="help-icon" 
                                                        onMouseEnter={() => this.setState({ hoveredHelp: 'server' })}
                                                        onMouseLeave={() => this.setState({ hoveredHelp: null })}
                                                    >
                                                        ?
                                                    </span>
                                                    {this.state.hoveredHelp === 'server' && (
                                                        <div className="help-tooltip">
                                                            Click the server name to connect. Select a different server to switch.
                                                        </div>
                                                    )}
                                                </th>
                                                <th style={{ width: '58%' }}>Players</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(this.state.servers).map(([address, server]) => 
                                                this.renderServerRow(address, server)
                                            )}
                                        </tbody>
                                    </table>
                                )}
                                <div className="note">
                                    Click on the server name to connect
                                    {this.props.twitchUser.role === 'guest' && (
                                        <div className="guest-warning">Guests cannot connect to servers. Please log in.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export const ServerBrowser = connect(mapState, mapDispatch)(ServerBrowserBase)