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

const FASTCAPS_MODES = {
    '1': 'FC Mode 1 (No weapons, No movement aids)',
    '2': 'FC Mode 2 (Weapons + Movement aids)',
    '3': 'FC Mode 3 (No weapons, Movement aids)',
    '4': 'FC Mode 4 (Weapons, No movement aids)',
    '5': 'FC Mode 5 (Swinging hook)',
    '6': 'FC Mode 6 (Quake3 hook)',
    '7': 'FC Mode 7 (Vanilla Quake3)',
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
		
		// Add periodic refresh every 30 seconds when server browser is open
		this.refreshInterval = setInterval(() => {
			if (this.props.appstate.isServerBrowserOpen) {
				this.fetchServers()
			}
		}, 15000)
	}

	componentWillUnmount() {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval)
		}
	}

	toggle() {
		// Check if we're about to open (currently closed)  
		if (!this.props.appstate.isServerBrowserOpen) {
			this.fetchServers()
		} else {
		}
		this.props.toggleServerBrowser()
	}

    // Update streaming status for all players with Twitch usernames
    async updateStreamingStatus(servers) {
        // Collect all unique Twitch usernames from all servers
        const twitchUsernames = new Set()
        
        Object.values(servers).forEach(server => {
            const players = this.getPlayerWithScores(server)
            players.forEach(player => {
                const twitchUsername = this.getTwitchUsername(player)
                if (twitchUsername) {
                    twitchUsernames.add(twitchUsername)
                }
            })
        })
        
        if (twitchUsernames.size === 0) {
            return servers // No streamers to check
        }
        
        console.log('[ServerBrowser] Found streamers with live status from defraglive bot:', Array.from(twitchUsernames))
        
        // Use live status from defraglive bot c1 field
        Object.values(servers).forEach(server => {
            const players = Object.values(server.players || {})
            players.forEach(player => {
                const twitchUsername = this.getTwitchUsername(player)
                if (twitchUsername) {
                    const isLive = this.isPlayerLive(player)
                    player.hasTwitchLink = true
                    player.twitchUsername = twitchUsername
                    player.isStreaming = isLive
                    
                    if (isLive) {
                        console.log(`[ServerBrowser] 🔴 ${player.name} is LIVE on Twitch: ${twitchUsername}`)
                    } else {
                        console.log(`[ServerBrowser] 🔗 ${player.name} has Twitch link: ${twitchUsername} (not live)`)
                    }
                }
            })
        })
        
        return servers
    }

    async fetchServers() {		
		if (this.state.loading) {
			return;
		}
		
        this.setState({ loading: true, error: null })        
        try {
            // First get the current server info from tw.defrag.racing to get actual player data
            let currentServerData = null
            let currentServerAddress = null
            
            try {
                const serverstateResponse = await fetch('https://tw.defrag.racing/serverstate.json')
                const serverstate = await serverstateResponse.json()
                
                if (serverstate.ip) {
                    currentServerData = {
                        map: serverstate.mapname,
                        hostname: serverstate.hostname,
                        defrag: serverstate.df_promode === '1' ? 'cpm' : 'vq3',
                        address: serverstate.ip,
                        timestamp: new Date().toISOString(),
                        players: {},
                        scores: { players: [], num_players: Object.keys(serverstate.players || {}).length }
                    }
                    currentServerAddress = serverstate.ip
                    
                    // Convert serverstate players to the expected format
                    Object.values(serverstate.players || {}).forEach((player, index) => {
                        console.log(`[ServerBrowser] Converting serverstate player:`, {
                            name: player.n,
                            id: player.id,
                            c1: player.c1,
                            allFields: Object.keys(player)
                        })
                        
                        currentServerData.players[player.id || index + 1] = {
                            clientId: parseInt(player.id) || index + 1,
                            name: player.n,
                            logged: false,
                            mddId: 0,
                            country: player.country || 'Unknown',
                            nospec: parseInt(player.nospec) || 0,
                            model: player.model || 'sarge',
                            headmodel: player.hmodel || 'sarge',
                            c1: player.c1 || '' // Make sure c1 field is preserved
                        }
                    })
                }
            } catch (error) {
                console.warn('Could not fetch current server data from tw.defrag.racing:', error)
            }
            
            // Then get the servers list from defrag.racing
            const response = await fetch('https://defrag.racing/servers/json')
			
            if (!response.ok) {
                throw new Error('Failed to fetch servers')
            }
            
            const data = await response.json()
			let activeServers = data.active || {}
			
			// If we have current server data and it matches a server in the list, enrich it
			if (currentServerData && currentServerAddress && activeServers[currentServerAddress]) {
			    const serverFromAPI = activeServers[currentServerAddress]
			    
			    // Check if all players from serverstate match players in the API (with partial matching for truncated names)
			    const serverstatePlayerNames = Object.values(currentServerData.players).map(p => 
			        p.name.replace(/\^./g, '').toLowerCase().trim()
			    )
			    const apiPlayerNames = Object.values(serverFromAPI.players || {}).map(p => 
			        p.name.replace(/\^./g, '').toLowerCase().trim()
			    )
			    
			    // Helper function to check if two names match (exact or partial for truncated names)
			    const namesMatch = (name1, name2) => {
			        if (name1 === name2) return true
			        // Check if one is a truncation of the other (at least 8 chars to avoid false positives)
			        if (name1.length >= 8 && name2.length >= 8) {
			            // Handle truncated names ending with "..." or more dots
			            const cleanName1 = name1.replace(/\.{3,}$/, '')
			            const cleanName2 = name2.replace(/\.{3,}$/, '')
			            
			            return name1.startsWith(name2) || name2.startsWith(name1) ||
			                   name1.startsWith(cleanName2) || cleanName1.startsWith(name2) ||
			                   cleanName1.startsWith(cleanName2) || cleanName2.startsWith(cleanName1)
			        }
			        return false
			    }
			    
			    // Check if each serverstate player has a match in API
			    const allServerstatePlayersMatch = serverstatePlayerNames.every(serverstatePlayer => 
			        apiPlayerNames.some(apiPlayer => namesMatch(serverstatePlayer, apiPlayer))
			    )
			    
			    // Check if each API player has a match in serverstate
			    const allApiPlayersMatch = apiPlayerNames.every(apiPlayer => 
			        serverstatePlayerNames.some(serverstatePlayer => namesMatch(apiPlayer, serverstatePlayer))
			    )
			    
			    // Check for duplicate partial matches (ambiguous cases)
			    let hasDuplicateMatches = false
			    for (const serverstatePlayer of serverstatePlayerNames) {
			        const matches = apiPlayerNames.filter(apiPlayer => namesMatch(serverstatePlayer, apiPlayer))
			        if (matches.length > 1) {
			            hasDuplicateMatches = true
			            break
			        }
			    }
			    
			    const allPlayersMatch = allServerstatePlayersMatch && allApiPlayersMatch && !hasDuplicateMatches
			    
			    if (allPlayersMatch) {
			        // Use enriched data from API since all players match, but preserve c1 fields from serverstate
			        console.log('[ServerBrowser] All players match - using enriched API data with c1 fields preserved')
			        
			        // Merge c1 fields from serverstate into API data
			        const enrichedServer = { ...serverFromAPI }
			        
			        // Match players and preserve c1 fields
			        Object.values(enrichedServer.players || {}).forEach(apiPlayer => {
			            const cleanApiName = apiPlayer.name.replace(/\^./g, '').toLowerCase().trim()
			            
			            // Find matching player in serverstate data
			            const matchingServerstatePlayer = Object.values(currentServerData.players).find(serverstatePlayer => {
			                const cleanServerstateName = serverstatePlayer.name.replace(/\^./g, '').toLowerCase().trim()
			                return namesMatch(cleanApiName, cleanServerstateName)
			            })
			            
			            // Preserve c1 field if found
			            if (matchingServerstatePlayer && matchingServerstatePlayer.c1) {
			                apiPlayer.c1 = matchingServerstatePlayer.c1
			            }
			        })
			        
			        // Update the server data with merged information
			        activeServers[currentServerAddress] = enrichedServer
			    } else {
			        // Use serverstate data since it has more complete player list
			        console.log('[ServerBrowser] Player lists differ - using serverstate data')
			        activeServers[currentServerAddress] = currentServerData
			    }
			} else if (currentServerData && currentServerAddress && !activeServers[currentServerAddress]) {
			    // Current server not in API list - add it with serverstate data
			    console.log('[ServerBrowser] Current server not in API - adding serverstate data')
			    activeServers[currentServerAddress] = currentServerData
			}
			
			const serverCount = Object.keys(activeServers).length
			
			// Check for players with Twitch usernames
			const playersWithTwitch = Object.values(activeServers).flatMap(server => 
			    this.getPlayerWithScores(server).filter(p => this.getTwitchUsername(p))
			)
			if (playersWithTwitch.length > 0) {
			    console.log('[ServerBrowser] Found players with Twitch:', 
			        playersWithTwitch.map(p => `${p.name} -> ${this.getTwitchUsername(p)}`))
			}
			
			// Update streaming status for players with Twitch usernames
			const serversWithStreamingStatus = await this.updateStreamingStatus(activeServers)
			
            this.setState({ 
                servers: serversWithStreamingStatus,
                loading: false 
            })
		
        } catch (error) {
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

    // Extract Twitch username from player c1 field
    getTwitchUsername(player) {
        const c1 = player.c1 || ''
        // Match patterns like "twitch.tv/username,live", "nospec.twitch.tv/username,not"
        const twitchMatch = c1.match(/(?:nospec\.)?(?:twitch\.tv\/|tw\.tv\/)([\w\d_]+)(?:,(?:live|not))?/i)
        return twitchMatch ? twitchMatch[1] : null
    }

    // Check if player is currently live on Twitch based on c1 field
    isPlayerLive(player) {
        const c1 = player.c1 || ''
        // Check if c1 field contains ",live" suffix
        return c1.includes(',live')
    }

    // Parse physics string to human-readable format
    parsePhysicsType(physicsString) {
        if (!physicsString) return null

        // Handle basic physics types
        if (physicsString === 'vq3') return 'VQ3'
        if (physicsString === 'cpm') return 'CPM'

        // Parse complex physics strings
        const fastcapsMatch = physicsString.match(/^(vq3|cpm)-ctf(\d)$/i)
        if (fastcapsMatch) {
            const [, physics, mode] = fastcapsMatch
            const physicsLabel = physics.toUpperCase()
            const modeDescription = FASTCAPS_MODES[mode] || `FC Mode ${mode}`
            return `${physicsLabel} ${modeDescription}`
        }

        // Parse regular game mode physics strings
        const gameModeMatch = physicsString.match(/^(vq3|cpm)\.(\d)$/i)
        if (gameModeMatch) {
            const [, physics, gameType] = gameModeMatch
            const physicsLabel = physics.toUpperCase()
            const gameMode = SV_TYPE[gameType] || `mode ${gameType}`
            return `${physicsLabel} ${gameMode}`
        }

        // Fallback: return capitalized string
        return physicsString.toUpperCase()
    }

    // Get Twitch app access token
    async getTwitchAccessToken() {
        // Twitch extensions have strict CSP that blocks OAuth token requests to id.twitch.tv
        // For now, we'll disable live status checking and focus on showing Twitch links
        console.log('[ServerBrowser] Twitch live status checking disabled: CSP blocks OAuth requests in extension environment')
        return null
    }

    // Check if Twitch channel is currently live
    async checkTwitchLiveStatus(username) {
        try {
            const TWITCH_CLIENT_ID = 'u8qaeps5664v7ddm7hgh42d9ynkanr'
            // Get app access token (cached, auto-renewed when expired)
            let TWITCH_ACCESS_TOKEN = await this.getTwitchAccessToken()
            
            if (!TWITCH_ACCESS_TOKEN) {
                console.warn('[ServerBrowser] No Twitch access token available')
                return false
            }
            
            const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${TWITCH_ACCESS_TOKEN}`
                }
            })
            
            if (!response.ok) {
                console.warn(`[ServerBrowser] Twitch API error for ${username}:`, response.status)
                return false
            }
            
            const data = await response.json()
            return data.data && data.data.length > 0
            
        } catch (error) {
            console.warn(`[ServerBrowser] Error checking Twitch status for ${username}:`, error)
            return false
        }
    }

    getPlayerWithScores(server) {
        const players = Object.values(server.players || {})
        const scores = server.scores?.players || []
        
        return players.map(player => {
            const scoreData = scores.find(score => score.player_num === player.clientId)
            const twitchUsername = this.getTwitchUsername(player)
            
            return {
                ...player,
                time: scoreData?.time || 0,
                follow_num: scoreData?.follow_num || -1,
                team: scoreData?.follow_num === -1 ? '0' : '3',
                twitchUsername: twitchUsername
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

    // Handle player name clicks - redirect to Twitch if has Twitch link (prioritize live streamers)
    handlePlayerClick(player) {
        if (player.hasTwitchLink && player.twitchUsername) {
            // Redirect to Twitch channel (works for both live and offline)
            const twitchUrl = `https://www.twitch.tv/${player.twitchUsername}`
            window.open(twitchUrl, '_blank')
            return
        }
        // No default behavior - players can't be clicked for connection anymore
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
						<div className="server-header">
							<button 
								className={`connect-to-server-btn ${connectable ? 'connectable' : 'disabled'}`}
								onClick={() => connectable && this.connectToServer(address, server)}
								disabled={!connectable}
								title={connectable ? `Connect to ${address}` : `Cannot connect: ${reason}`}
							>
								<span className="connect-text">CONNECT</span>
								<div className="connect-btn-ripple"></div>
							</button>
						</div>
						<div className="server-name-row">
							<div className="server-name">
								<Q3STR s={server.hostname}/>
							</div>
						</div>
						
						<div className="server-details">
							<div className="detail-row">
								<span>Copy IP:</span>
								<button 
									className={`copy-button-small ${this.state.copySuccess === address ? 'copied' : ''}`}
									onClick={() => this.copyToClipboard(address)}
									title={`Copy IP address: ${address}`}
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
                                <span className="server-physics">{this.parsePhysicsType(server.defrag) || 'Unknown'}</span>
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
                                                className={`player-name-container ${player.hasTwitchLink ? 'twitch-streamer' : ''}`}
                                                onMouseEnter={() => this.setState({ hoveredPlayer: player })}
                                                onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                {...(player.hasTwitchLink ? {
                                                    onClick: () => this.handlePlayerClick(player),
                                                    style: { cursor: 'pointer' },
                                                    title: player.isStreaming ? `Watch ${player.twitchUsername} LIVE on Twitch!` : `Visit ${player.twitchUsername} on Twitch`
                                                } : {})}
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
                                                {/* Next-line Twitch indicators (PlayerList style layout) */}
                                                {player.hasTwitchLink && (
                                                    <div className="twitch-info-section">
                                                        <span className={`twitch-live-indicator ${player.isStreaming ? 'live' : ''}`}>
                                                            {player.isStreaming ? '🔴 CURRENTLY LIVE' : '🟣 TWITCH'}
                                                        </span>
                                                        <div className="twitch-url" onClick={(e) => { e.stopPropagation(); this.handlePlayerClick(player); }}>
                                                            twitch.tv/{player.twitchUsername}
                                                        </div>
                                                    </div>
                                                )}
                                                {this.state.hoveredPlayer === player && (
                                                    <div className="player-tooltip-container">
                                                        {this.renderPlayerTooltip(player)}
                                                    </div>
                                                )}
                                            </div>
                                            {followingSpecs.map((spec) => (
                                                <div 
                                                    key={spec.clientId} 
                                                    className={`player-name-container spectator ${spec.hasTwitchLink ? 'twitch-streamer' : ''}`}
                                                    onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                    onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                    {...(spec.hasTwitchLink ? {
                                                        onClick: () => this.handlePlayerClick(spec),
                                                        style: { cursor: 'pointer' },
                                                        title: spec.isStreaming ? `Watch ${spec.twitchUsername} LIVE on Twitch!` : `Visit ${spec.twitchUsername} on Twitch`
                                                    } : {})}
                                                >
                                                    <span className={`player-name ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}>
                                                        👁️ <Q3STR s={spec.name}/>
                                                        {this.getPlayerStatus(spec).length > 0 && (
                                                            <span className="status-indicator">!</span>
                                                        )}
                                                    </span>
                                                    {/* Next-line Twitch indicators (PlayerList style layout) */}
                                                    {spec.hasTwitchLink && (
                                                        <div className="twitch-info-section">
                                                            <span className={`twitch-live-indicator ${spec.isStreaming ? 'live' : ''}`}>
                                                                {spec.isStreaming ? '🔴 CURRENTLY LIVE' : '🟣 TWITCH'}
                                                            </span>
                                                            <div className="twitch-url" onClick={(e) => { e.stopPropagation(); this.handlePlayerClick(spec); }}>
                                                                twitch.tv/{spec.twitchUsername}
                                                            </div>
                                                        </div>
                                                    )}
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
                                                className={`player-name-container ${spec.hasTwitchLink ? 'twitch-streamer' : ''}`}
                                                onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
                                                onMouseLeave={() => this.setState({ hoveredPlayer: null })}
                                                {...(spec.hasTwitchLink ? {
                                                    onClick: () => this.handlePlayerClick(spec),
                                                    style: { cursor: 'pointer' },
                                                    title: spec.isStreaming ? `Watch ${spec.twitchUsername} LIVE on Twitch!` : `Visit ${spec.twitchUsername} on Twitch`
                                                } : {})}
                                            >
                                                <span className={`player-name ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}>
                                                    <Q3STR s={spec.name}/>
                                                    {this.getPlayerStatus(spec).length > 0 && (
                                                        <span className="status-indicator">!</span>
                                                    )}
                                                </span>
                                                {/* Next-line Twitch indicators (PlayerList style layout) */}
                                                {spec.hasTwitchLink && (
                                                    <div className="twitch-info-section">
                                                        <span className={`twitch-live-indicator ${spec.isStreaming ? 'live' : ''}`}>
                                                            {spec.isStreaming ? '🔴 CURRENTLY LIVE' : '🟣 TWITCH'}
                                                        </span>
                                                        <div className="twitch-url" onClick={(e) => { e.stopPropagation(); this.handlePlayerClick(spec); }}>
                                                            twitch.tv/{spec.twitchUsername}
                                                        </div>
                                                    </div>
                                                )}
                                                {this.state.hoveredPlayer === spec && (
                                                    <div className="player-tooltip-container">
                                                        {this.renderPlayerTooltip(spec)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
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
                <div className="serverbrowser-button" onClick={this.toggle}>
                    {this.props.appstate.isServerBrowserOpen ? svgClose : svgServers}
                </div>
                <div className="serverbrowser-content-wrap">
                    <div className="serverbrowser-content">
                        <div className="header-top">
                            <div className="h1">Server Browser</div>
							<div className="header-controls">
								<div className="refresh-button" onClick={() => {
									this.refreshServers()
								}} title="Refresh Server List" style={{ transform: 'scale(1.6)' }}>
									<svg className="refresh-svg animated-refresh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ 
										transition: 'transform 0.3s ease',
										animation: this.state.loading ? 'spin 1s linear infinite' : 'none'
									}}>
										<path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
									</svg>
								</div>
								<div className="close" onClick={this.toggle} title="Close Server Browser" style={{ transform: 'scale(1.3)' }}>
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.10a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
								</div>
							</div>
                        </div>
                        
                        <div className="twitch-explanation">
                            <div className="explanation-title">🟣 Twitch Integration</div>
                            <div className="explanation-content">
                                <span><strong>🔴 CURRENTLY LIVE</strong> - Player is streaming live on Twitch</span>
                                <span><strong>🟣 TWITCH</strong> - Player has Twitch account (offline)</span>
                                <span>Click any player name with Twitch indicators to open their stream</span>
                            </div>
                        </div>
                        
                        <div className="section">
                            <div className="content" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
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