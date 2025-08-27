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
            copySuccess: null
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
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.setState({ copySuccess: text })
                setTimeout(() => {
                    this.setState({ copySuccess: null })
                }, 2000)
            }).catch(() => {
                // Fallback to older method
                this.fallbackCopyTextToClipboard(text)
            })
        } else {
            // Fallback for browsers without clipboard API
            this.fallbackCopyTextToClipboard(text)
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea")
        textArea.value = text
        
        // Avoid scrolling to bottom
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
        
        // Convert milliseconds to mm:ss:mmm format
        const totalMs = parseInt(timeMs)
        const minutes = Math.floor(totalMs / 60000)
        const seconds = Math.floor((totalMs % 60000) / 1000)
        const milliseconds = totalMs % 1000
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`
    }

    getPlayerWithScores(server) {
        // Merge players data with scores data
        const players = Object.values(server.players || {})
        const scores = server.scores?.players || []
        
        return players.map(player => {
            // Find matching score data by clientId
            const scoreData = scores.find(score => score.player_num === player.clientId)
            return {
                ...player,
                time: scoreData?.time || 0,
                follow_num: scoreData?.follow_num || -1,
                team: scoreData?.follow_num === -1 ? '0' : '3' // 0 = player, 3 = spectator
            }
        })
    }

    isServerConnectable(server) {
        const playersWithScores = this.getPlayerWithScores(server)
        
        // Filter out spectators (team === '3' or follow_num !== -1)
        const activePlayers = playersWithScores.filter(player => player.follow_num === -1)
        
        if (activePlayers.length === 0) {
            return { connectable: true, reason: null }
        }

        // Check if all active players have nospec enabled
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
            // Show error message instead of connecting
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

        // Check if player is spectating someone
        if (player.follow_num && player.follow_num !== -1) {
            statuses.push(`Spectating Player ID ${player.follow_num}`)
        }

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
        
        return (
            <tr key={address} className={`${playerCount > 0 ? 'has-players' : 'empty'} ${!connectable ? 'not-connectable' : ''}`}>
                <td>
                    <div className="server-info">
                        <div className="server-name-row">
                            <div 
                                className={`server-name ${connectable ? 'link' : 'disabled-link'}`}
                                onClick={() => connectable && this.connectToServer(address, server)}
                                title={!connectable ? reason : `Connect to ${address}`}
                            >
                                <Q3STR s={server.hostname}/>
                            </div>
                            <div className="server-actions">
                                <button 
                                    className={`copy-button ${this.state.copySuccess === address ? 'copied' : ''}`}
                                    onClick={() => this.copyToClipboard(address)}
                                    title="Copy IP address"
                                >
                                    {this.state.copySuccess === address ? '✓' : '📋'}
                                </button>
                            </div>
                        </div>
                        <div className="server-details">
                            <span className="server-address">{address}</span>
                            <span className="server-map">Map: <Q3STR s={server.map}/></span>
                            <span className="server-physics">{PHYSICS_TYPES[server.defrag] || server.defrag.toUpperCase()}</span>
                        </div>
                        {!connectable && (
                            <div className="server-warning">
                                ⚠️ {reason}
                            </div>
                        )}
                    </div>
                </td>
                <td className="player-count">
                    <div className="count">{playerCount}</div>
                </td>
                <td className="player-names">
                    {playerCount > 0 ? (
                        <div className="players-list">
                            {playersWithScores.slice(0, 4).map((player, idx) => {
                                const statuses = this.getPlayerStatus(player)
                                const hasStatus = statuses.length > 0 || player.time > 0
                                
                                return (
                                    <div 
                                        key={idx} 
                                        className={`player-name-container ${hasStatus ? 'has-status' : ''}`}
                                        onMouseEnter={() => this.setState({hoveredPlayer: `${address}-${idx}`})}
                                        onMouseLeave={() => this.setState({hoveredPlayer: null})}
                                    >
                                        <span className="player-name">
                                            <Q3STR s={player.name}/>
                                            {player.follow_num === -1 ? '' : ' (SPEC)'}
                                            {hasStatus && <span className="status-indicator">*</span>}
                                        </span>
                                        {this.state.hoveredPlayer === `${address}-${idx}` && hasStatus && (
                                            <div className="player-tooltip-container">
                                                {this.renderPlayerTooltip(player)}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {playerCount > 4 && <span className="more-players">+{playerCount - 4} more</span>}
                        </div>
                    ) : (
                        <span className="empty-text">Empty</span>
                    )}
                </td>
            </tr>
        )
    }
    
    render() {
        const svgServers = <svg className="serverbrowser-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm0 2v4h16V4H4zm0 6v4h16v-4H4zm0 6v4h16v-4H4zm2-8h2v2H6v-2zm0 6h2v2H6v-2zm0 6h2v2H6v-2z"/></svg>
        const svgClose = <svg className="serverbrowser-svg opened" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
        const svgRefresh = <svg className="refresh-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        
        const maxHeight = `${document.querySelector('.app-wrap').clientHeight - 220}px`
        const serverEntries = Object.entries(this.state.servers)
        
        // Sort servers: connectable with players first, then by player count
        const sortedServers = serverEntries.sort(([addressA, serverA], [addressB, serverB]) => {
            const playersA = this.getPlayerWithScores(serverA).length
            const playersB = this.getPlayerWithScores(serverB).length
            const connectableA = this.isServerConnectable(serverA).connectable
            const connectableB = this.isServerConnectable(serverB).connectable
            
            // Prioritize connectable servers with players
            if (connectableA && playersA > 0 && (!connectableB || playersB === 0)) return -1
            if (connectableB && playersB > 0 && (!connectableA || playersA === 0)) return 1
            
            // Then sort by player count
            return playersB - playersA
        })
        
        return (
            <div className={`serverbrowser-wrap serverbrowser-${this.props.appstate.isServerBrowserOpen ? 'opened' : 'closed'}`}>
                <div className="serverbrowser-button" onClick={this.toggle}>
                    {this.props.appstate.isServerBrowserOpen ? svgClose : svgServers}
                </div>

                <div className="serverbrowser-content-wrap">
                    <div className="serverbrowser-content" style={{maxHeight}}>
                        <div className="header-top">
                            <div className="h1">Server Browser</div>
                            <div className="header-controls">
                                <div className="refresh-button" onClick={this.refreshServers} title="Refresh server list">
                                    {svgRefresh}
                                </div>
                                <div className="close" onClick={this.toggle}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
                                </div>
                            </div>
                        </div>
                        
                        {this.state.loading ? (
                            <div className="loading-message">Loading servers...</div>
                        ) : this.state.error ? (
                            <div className="error-message">
                                {this.state.error}
                                <button onClick={this.refreshServers} className="retry-button">Retry</button>
                            </div>
                        ) : (
                            <div className="section">
                                <div className="content">
                                    <table className="servers-table">
                                        <thead>
                                            <tr>
                                                <th>Server</th>
                                                <th>Players</th>
                                                <th>Player Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedServers.length > 0 ? (
                                                sortedServers.map(([address, server]) => 
                                                    this.renderServerRow(address, server)
                                                )
                                            ) : (
                                                <tr>
                                                    <td colSpan="3" className="no-servers">No servers available</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="note m-t">
                                        <div>Total servers: {sortedServers.length}</div>
                                        <div>* = Player has special status (hover for details)</div>
                                        <div>(SPEC) = Player is spectating</div>
                                        <div>📋 = Copy IP</div>
                                        {this.props.twitchUser.role === 'guest' && (
                                            <div className="guest-warning">You must be logged in to connect to servers</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }
}

export const ServerBrowser = connect(mapState, mapDispatch)(ServerBrowserBase)