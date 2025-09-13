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
        this.handleEscKey = this.handleEscKey.bind(this)
    }

    handleEscKey(event) {
        if (event.key === 'Escape' && this.props.appstate.isServerBrowserOpen) {
            event.preventDefault()
            event.stopPropagation()
            this.props.toggleServerBrowser()
        }
    }

	componentDidMount() {
		this.fetchServers()

        // Add ESC key listener
        document.addEventListener('keydown', this.handleEscKey)

		// Add periodic refresh every 30 seconds when server browser is open
		this.refreshInterval = setInterval(() => {
			if (this.props.appstate.isServerBrowserOpen) {
				this.fetchServers()
			}
		}, 15000)
	}

	componentWillUnmount() {
        // Remove ESC key listener
        document.removeEventListener('keydown', this.handleEscKey)

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
                    } else {
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

			    // Special handling for GTK servers - always use API data since name matching is more reliable than clientId
			    const isGTKCurrentServer = currentServerAddress?.includes('83.243.73.220')

			    if (allPlayersMatch || isGTKCurrentServer) {
			        // Use enriched data from API since all players match, but preserve c1 fields from serverstate
			        
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
				        activeServers[currentServerAddress] = currentServerData
			    }
			} else if (currentServerData && currentServerAddress && !activeServers[currentServerAddress]) {
			    // Current server not in API list - add it with serverstate data
				    activeServers[currentServerAddress] = currentServerData
			}
			
			const serverCount = Object.keys(activeServers).length
			
			// Check for players with Twitch usernames
			const playersWithTwitch = Object.values(activeServers).flatMap(server => 
			    this.getPlayerWithScores(server).filter(p => this.getTwitchUsername(p))
			)
			if (playersWithTwitch.length > 0) {
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
        // Store current scroll position before refresh
        const scrollContainer = document.querySelector('.serverbrowser-content')
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0

        this.fetchServers().then(() => {
            // Restore scroll position after refresh completes
            if (scrollContainer) {
                setTimeout(() => {
                    scrollContainer.scrollTop = scrollTop
                }, 50)
            }
        })
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

    // Check if server is GTK (unreliable ID matching)
    isGTKServer(server) {
        const serverIP = server.address
        return serverIP?.includes('83.243.73.220')
    }

    // Helper function to strip Quake 3 color codes
    stripQuakeColors(text) {
        if (!text) return ''
        return text.replace(/\^./g, '').toLowerCase().trim()
    }

    getPlayerWithScores(server) {
        const players = Object.values(server.players || {})
        const scores = server.scores?.players || []
        const isGTK = this.isGTKServer(server)


        if (isGTK) {
            // GTK SERVER SPECIAL HANDLING - match players with scores by name
            return players.map(player => {
                const cleanPlayerName = this.stripQuakeColors(player.name)
                const twitchUsername = this.getTwitchUsername(player)

                // Find spectator data from scores by matching names (GTK has unreliable clientId)
                const scoreData = scores.find(score => {
                    // For GTK, we need to match the score with a player by finding the corresponding
                    // player entry and comparing names, since clientId is unreliable
                    const scorePlayerData = Object.values(server.players || {}).find(p =>
                        p.clientId === score.player_num
                    )
                    if (scorePlayerData) {
                        const cleanScorePlayerName = this.stripQuakeColors(scorePlayerData.name)
                        return cleanScorePlayerName === cleanPlayerName
                    }
                    return false
                })


                return {
                    ...player,
                    time: scoreData?.time || 0,
                    follow_num: scoreData?.follow_num || -1,
                    team: scoreData?.follow_num === -1 ? '0' : '3',
                    twitchUsername: twitchUsername,
                    clientId: scoreData?.player_num || player.clientId,
                    dataSource: scoreData ? 'gtk-matched' : 'gtk-no-score'
                }
            })
        } else {
            // NON-GTK SERVER - use normal clientId matching
            return players.map(player => {
                const scoreData = scores.find(score => score.player_num === player.clientId)
                const twitchUsername = this.getTwitchUsername(player)


                return {
                    ...player,
                    time: scoreData?.time || 0,
                    follow_num: scoreData?.follow_num || -1,
                    team: scoreData?.follow_num === -1 ? '0' : '3',
                    twitchUsername: twitchUsername,
                    dataSource: scoreData ? 'matched' : 'serverstate-only'
                }
            })
        }
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
								className={`compact-spectate-btn ${connectable ? '' : 'disabled'}`}
								onClick={() => connectable && this.connectToServer(address, server)}
								disabled={!connectable}
								title={connectable ? `Connect to ${address}` : `Cannot connect: ${reason}`}
							>
								{connectable ? 'CONNECT' : 'Cannot Connect'}
							</button>
						</div>
						<div className="server-name-row">
							<div className="server-name">
								<Q3STR s={server.hostname}/>
							</div>
						</div>
						
						<div className="server-details">
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
								<div className="copy-buttons">
									<button
										className={`copy-btn ${this.state.copySuccess === address ? 'copied' : ''}`}
										onClick={() => this.copyToClipboard(address)}
										title={`Copy IP: ${address}`}
									>
										📋 Copy IP
									</button>
									<button
										className={`copy-btn ${this.state.copySuccess === server.map ? 'copied' : ''}`}
										onClick={() => this.copyToClipboard(server.map)}
										title="Copy map name"
									>
										📋 Copy MAP
									</button>
								</div>
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

    renderServerCard(address, server) {
        const playersWithScores = this.getPlayerWithScores(server)
        const playerCount = playersWithScores.length
        const { connectable, reason } = this.isServerConnectable(server)

        // Separate active players and spectators
        const activePlayers = playersWithScores.filter(player => player.follow_num === -1)
        const allSpectators = playersWithScores.filter(player => player.follow_num !== -1)

        return (
            <div key={address} className="server-card">
                {/* Server Name Row with Play and Connect buttons */}
                <div className="server-name-row">
                    <span className="server-name">
                        <Q3STR s={server.hostname}/>
                    </span>
                    <div className="server-action-buttons">
                        <button
                            className="play-btn"
                            onClick={() => {
                                try {
                                    window.open(`defrag://${address}`, '_blank')
                                } catch (e) {
                                    window.location.href = `defrag://${address}`
                                }
                            }}
                            title={`Play on server: ${address}`}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>
                            </svg>
                            Play
                        </button>
                        <button
                            className={`compact-spectate-btn ${connectable ? '' : 'disabled'}`}
                            onClick={() => connectable && this.connectToServer(address, server)}
                            disabled={!connectable}
                            title={connectable ? `Connect to ${address}` : `Cannot connect: ${reason}`}
                        >
                            {connectable ? 'Connect' : 'Cannot Connect'}
                        </button>
                    </div>
                </div>

                {/* Map Name Row with Copy buttons */}
                <div className="map-name-row">
                    <span className="map-info">
                        Map: <a
                            href={`https://defrag.racing/maps/${server.map}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Q3STR s={server.map}/>
                        </a>
                    </span>
                    <div className="copy-buttons">
                        <button
                            className={`copy-btn ${this.state.copySuccess === server.map ? 'copied' : ''}`}
                            onClick={() => this.copyToClipboard(server.map)}
                            title="Copy map name"
                        >
                            📋 Copy MAP
                        </button>
                        <button
                            className={`copy-btn ${this.state.copySuccess === address ? 'copied' : ''}`}
                            onClick={() => this.copyToClipboard(address)}
                            title={`Copy IP: ${address}`}
                        >
                            📋 Copy IP
                        </button>
                    </div>
                </div>

                {/* Physics and Player Count Row */}
                <div className="server-info-row">
                    <span className="server-physics">{this.parsePhysicsType(server.defrag) || 'Unknown'}</span>
                    <span className="player-count">Players: {playerCount}</span>
                </div>

                {/* Warning for non-connectable servers */}
                {!connectable && (
                    <div className="server-warning">
                        ⚠️ {reason}
                    </div>
                )}

                {/* Small gap */}
                <div className="server-gap"></div>

                {/* Player List */}
                {playerCount > 0 && (
                    <div className="server-players">
                        <div className="players-list">
                            {activePlayers.map((player) => {
                                const followingSpecs = allSpectators.filter(spec =>
                                    spec.follow_num === player.clientId
                                )
                                return (
                                    <div key={player.clientId} className="player-group">
                                        <div className="player-item">
                                            <span className="player-name">
                                                <Q3STR s={player.name}/>
                                                {player.time > 0 && (
                                                    <span className="player-time"> ({this.formatTime(player.time)})</span>
                                                )}
                                            </span>
                                        </div>
                                        {followingSpecs.map((spec) => (
                                            <div key={spec.clientId} className="player-item spectator">
                                                <span className="player-name">
                                                    👁️ <Q3STR s={spec.name}/>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
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
                        <div className="compact-header">
							<div className="header-controls">
								<button
									className="compact-header-btn refresh-btn"
									onClick={() => this.refreshServers()}
									title="Refresh Server List"
								>
									Refresh
								</button>
								<button
									className="compact-header-btn close-btn"
									onClick={this.toggle}
									title="Close Server Browser"
								>
									✕
								</button>
							</div>
                        </div>
                        
                        
                        <div className="section">
                            <div className="content">
                                {this.state.error && (
                                    <div className="error-message">
                                        {this.state.error}
                                        <button className="retry-button" onClick={this.refreshServers} title="Retry Loading Servers">Retry</button>
                                    </div>
                                )}
                                {!this.state.error && Object.keys(this.state.servers).length === 0 && !this.state.loading && (
                                    <div className="no-servers">No servers available</div>
                                )}
                                {!this.state.error && Object.keys(this.state.servers).length > 0 && (
                                    <div className="servers-list-container">
                                        {this.state.loading && (
                                            <div className="loading-overlay">
                                                <div className="loading-spinner">Refreshing servers...</div>
                                            </div>
                                        )}
                                        <div className={`servers-list ${this.state.loading ? 'loading' : ''}`}>
                                            {Object.entries(this.state.servers).map(([address, server]) =>
                                                this.renderServerCard(address, server)
                                            )}
                                        </div>
                                    </div>
                                )}
                                {this.state.loading && Object.keys(this.state.servers).length === 0 && (
                                    <div className="loading-message">Loading servers...</div>
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