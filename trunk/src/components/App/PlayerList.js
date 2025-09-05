import React from 'react'
import { Q3STR } from '../../partials/Quake3'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'
import { BOT_CONFIG } from '../../botConfig';

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
			serverName: null,
			hasSpectatorData: false,
			isRefreshing: false,
			refreshSuccess: false
		}
        this.spec_timeout = null
        this.refreshInterval = null
        
        this.toggle = this.toggle.bind(this)
        this.spectatePlayerID = this.spectatePlayerID.bind(this)
        this.requestSpectate = this.requestSpectate.bind(this)
        this.handleAfkReset = this.handleAfkReset.bind(this)
        this.handleAfkExtend = this.handleAfkExtend.bind(this)
        this.copyToClipboard = this.copyToClipboard.bind(this)
        this.fallbackCopyTextToClipboard = this.fallbackCopyTextToClipboard.bind(this)
        this.fetchServerData = this.fetchServerData.bind(this)
    }
    
	toggle() {
		// Check if we're about to open (currently closed)
		if (!this.props.appstate.isPlayerlistOpen) {
			this.fetchServerData()
		}
		this.props.togglePlayerlist()
	}
	
    componentDidMount() {
        this.props.getServerstate()
        this.fetchServerData()
        // Optional: Add periodic refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (this.props.appstate.isPlayerlistOpen) {
                this.fetchServerData()
            }
        }, 15000)
    }
    
    componentDidUpdate(prevProps) {
        // Refetch server data when serverstate changes or when opening player list
        if (prevProps.serverstate !== this.props.serverstate ||
            (!prevProps.appstate.isPlayerlistOpen && this.props.appstate.isPlayerlistOpen)) {
            this.fetchServerData()
        }
    }
    
    componentWillUnmount() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }
    }

	async fetchServerData() {		
		try {
			// Prevent multiple simultaneous refreshes
			if (this.state.isRefreshing) {
				return;
			}
			
			this.setState({ isRefreshing: true, refreshSuccess: false });
			
			// Get current server IP and player data from bot (always available)
			const serverstateResponse = await fetch('https://tw.defrag.racing/serverstate.json')
			const serverstate = await serverstateResponse.json()
			
			if (!serverstate.ip) {
				this.setState({ isRefreshing: false, refreshSuccess: false });
				return
			}
			
			// Try to get full server details including spectator data from servers API
			let currentServerInfo = {}
			let hasSpectatorData = false
			
			try {
				const serversResponse = await fetch('https://defrag.racing/servers/json')
				const serversData = await serversResponse.json()
				currentServerInfo = serversData.active?.[serverstate.ip] || {}
				hasSpectatorData = !!currentServerInfo.scores?.players
			} catch (error) {
				console.error('[PlayerList] Could not fetch spectator data from servers API:', error)
			}
			
			this.setState({
				currentServerAddress: serverstate.ip,
				serverInfo: currentServerInfo,
				serverName: serverstate.hostname || currentServerInfo?.hostname || 'Unknown',
				hasSpectatorData: hasSpectatorData,
				isRefreshing: false,
				refreshSuccess: true
			});
						
			// Clear success indicator after 2 seconds
			setTimeout(() => {
				this.setState({ refreshSuccess: false });
			}, 2000);
			
		} catch (error) {
			console.error('[PlayerList] Error during refresh:', error)
			console.error('[PlayerList] Error stack:', error.stack)
			this.setState({ isRefreshing: false, refreshSuccess: false });
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

    // Helper function to identify bot players
	isBotPlayer(player) {
		// Use dynamic secret from serverstate if available, fallback to config
		const botSecret = this.props.serverstate.bot_secret || BOT_CONFIG.SECRET;
		return player.c1 === botSecret;
	}

// Helper function to strip Quake 3 color codes
stripQuakeColors(text) {
    if (!text) return ''
    return text.replace(/\^./g, '').toLowerCase().trim()
}

// Check if current server is GTK (unreliable ID matching)
isGTKServer() {
    const serverIP = this.state.currentServerAddress || this.props.serverstate.ip
    return serverIP?.includes('83.243.73.220')
}

	// REVISED: GTK-aware getPlayerWithScores method
	getPlayerWithScores() {
		const serverstatePlayersRaw = Object.values(this.props.serverstate.players || {})
		const serverstatePlayersNonBot = serverstatePlayersRaw.filter(player => !this.isBotPlayer(player))
		
		let enrichedPlayers = []
		
		if (this.state.hasSpectatorData && this.state.serverInfo?.scores?.players) {
			const apiScores = this.state.serverInfo.scores.players
			const isGTK = this.isGTKServer()
			
			if (isGTK) {
				// GTK SERVER SPECIAL HANDLING
				console.log('[GTK] Using special GTK server logic for player matching')
				
				enrichedPlayers = serverstatePlayersNonBot.map(player => {
					// Try to match by name only (with color stripping)
					const cleanServerstateName = this.stripQuakeColors(player.n)
					const scoreData = apiScores.find(score => {
						const cleanAPIName = this.stripQuakeColors(score.name)
						return cleanAPIName === cleanServerstateName
					})
					
					if (scoreData) {
						// Name match found - use API spectator data
						const follow_num = scoreData.follow_num
						console.log(`[GTK] Matched "${cleanServerstateName}" -> follow_num: ${follow_num}`)
						
						return {
							...player,
							time: scoreData.time || 0,
							follow_num: follow_num,
							team: follow_num === -1 ? '0' : '3',
							t: player.t, // Always prefer serverstate team status
							nospec: player.nospec,
							c1: player.c1,
							clientId: scoreData.player_num, // Use API player_num as clientId
							dataSource: 'gtk-matched'
						}
					} else {
						// No name match - show as regular player from serverstate
						console.log(`[GTK] No match for "${cleanServerstateName}" - using serverstate only`)
						
						return {
							...player,
							time: 0,
							follow_num: -1, // Assume not spectating anyone
							team: player.t || '0',
							t: player.t || '0',
							nospec: player.nospec,
							c1: player.c1,
							clientId: parseInt(player.id),
							dataSource: 'gtk-serverstate-only'
						}
					}
				})
				
				// For GTK, don't add API-only players since serverstate is more reliable
				
			} else {
				// NORMAL SERVER HANDLING (non-GTK)
				enrichedPlayers = serverstatePlayersNonBot.map(player => {
					// Try multiple matching criteria for non-GTK servers
					const scoreData = apiScores.find(score => {
						const idMatch = score.player_num === parseInt(player.id)
						const clientIdMatch = player.clientId && score.player_num === player.clientId
						
						// Name matching as fallback
						const cleanServerstateName = this.stripQuakeColors(player.n)
						const cleanAPIName = this.stripQuakeColors(score.name)
						const nameMatch = cleanAPIName === cleanServerstateName
						
						return idMatch || clientIdMatch || nameMatch
					})
					
					const follow_num = scoreData ? scoreData.follow_num : -1
					
					return {
						...player,
						time: scoreData?.time || 0,
						follow_num: follow_num,
						team: follow_num === -1 ? '0' : '3',
						t: player.t || (follow_num === -1 ? '0' : '3'),
						nospec: player.nospec,
						c1: player.c1,
						clientId: player.clientId || parseInt(player.id),
						dataSource: scoreData ? 'normal-matched' : 'normal-serverstate-only'
					}
				})
				
				// Check for API-only players (for non-GTK servers)
				const serverstatePlayerNames = serverstatePlayersNonBot.map(p => this.stripQuakeColors(p.n))
				const apiOnlyPlayers = apiScores.filter(score => {
					const cleanAPIName = this.stripQuakeColors(score.name)
					return score.name && !serverstatePlayerNames.includes(cleanAPIName)
				}).map(score => ({
					id: score.player_num,
					n: score.name,
					clientId: score.player_num,
					time: score.time || 0,
					follow_num: score.follow_num,
					team: score.follow_num === -1 ? '0' : '3',
					t: score.follow_num === -1 ? '0' : '3',
					nospec: 0,
					country: 'Unknown',
					logged: false,
					dataSource: 'api-only'
				}))
				
				if (apiOnlyPlayers.length > 0) {
					enrichedPlayers = [...enrichedPlayers, ...apiOnlyPlayers]
				}
			}
			
		} else {
			// No API data available - use serverstate only for all servers
			enrichedPlayers = serverstatePlayersNonBot.map(player => ({
				...player,
				time: 0,
				follow_num: -1,
				team: player.t || '0',
				t: player.t || '0',
				nospec: player.nospec,
				c1: player.c1,
				clientId: player.clientId || parseInt(player.id),
				dataSource: 'serverstate-only'
			}))
		}
		
		return enrichedPlayers
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
                    <div>Data: {player.dataSource}</div>
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
		// Don't allow spectating spectators (t === '3' or follow_num !== -1)
		if (player.t === '3' || player.follow_num !== -1) {
			return false;
		}
		
		// Don't allow spectating players with nospec enabled
		const hasNospec = player.nospec === 1 || 
			   player.nospec === '1' || 
			   player.c1 === 'nospec' || 
			   player.c1 === 'nospecpm';
			   
		if (hasNospec) {
			return false;
		}
		
		return true;
	}

    isOnCooldown(playerName) {
        const now = Date.now()
        const lastRequest = this.state.requestCooldowns.get(playerName) || 0
        return (now - lastRequest) < 30000
    }

	render() {
		const svgPlayers = <svg className="playerlist-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" title="Toggle Player List"><path d="M10 .4C4.697.4.399 4.698.399 10A9.6 9.6 0 0 0 10 19.601c5.301 0 9.6-4.298 9.6-9.601 0-5.302-4.299-9.6-9.6-9.6zm.896 3.466c.936 0 1.211.543 1.211 1.164 0 .775-.62 1.492-1.679 1.492-.886 0-1.308-.445-1.282-1.164 0-.621.396-1.492 1.75-1.492zm-1.75 8.727c-2.066 0-3.744-1.678-3.744-3.744s1.678-3.744 3.744-3.744 3.744 1.678 3.744 3.744-1.678 3.744-3.744 3.744zm0-6.008c-1.392 0-2.523 1.132-2.523 2.523s1.132 2.523 2.523 2.523 2.523-1.132 2.523-2.523-1.131-2.523-2.523-2.523z"/></svg>
		let svgClose = <svg className="playerlist-svg opened" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" title="Close Player List"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.10a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
		
		const playersWithScores = this.getPlayerWithScores()
		// UPDATED: Use serverstate 't' field instead of unreliable follow_num
		const activePlayers = playersWithScores.filter(player => 
			player.t !== '3'
		)
		const allSpectators = playersWithScores.filter(player => 
			player.t === '3'
		)

		const isOnAfkCooldown = Date.now() < this.state.afkControlCooldown

		// Use server data from API calls or fallback to serverstate
		const serverAddress = this.state.currentServerAddress || this.props.serverstate.ip || 'Unknown'
		const serverName = this.state.serverName || this.props.serverstate.hostname || 'Unknown Server'
		const serverMap = this.props.serverstate.mapname || 'Unknown'
		const serverPhysics = this.state.serverInfo?.defrag ? 
							(PHYSICS_TYPES[this.state.serverInfo.defrag] || this.state.serverInfo.defrag.toUpperCase()) : 
							(this.props.serverstate.df_promode === '1' ? 'CPM' : 'VQ3')
		
		// Calculate total player count from serverstate (most accurate)
		const totalPlayerCount = Object.keys(this.props.serverstate.players || {}).length;

		return (
			<div className={`playerlist-wrap playerlist-${this.props.appstate.isPlayerlistOpen ? 'opened' : 'closed'}`}>
				<div className="playerlist-button" onClick={this.toggle}>
					{this.props.appstate.isPlayerlistOpen ? svgClose : svgPlayers}
				</div>
				<div className="playerlist-content-wrap" style={{ width: '45%', minWidth: '400px', maxWidth: '650px' }}>
					<div className="playerlist-content">
						<div className="header-top">
							<div className="h1">Player List</div>
							<div className="header-controls">
								<div className="refresh-button" onClick={() => {
									this.fetchServerData()
								}} title="Refresh Player List" style={{ transform: 'scale(1.6)' }}>
									<svg className="refresh-svg animated-refresh" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ 
										transition: 'transform 0.3s ease',
										animation: this.state.isRefreshing ? 'spin 1s linear infinite' : 'none'
									}}>
										<path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
									</svg>
								</div>
								<div className="afk-controls" style={{ gap: '8px', display: 'flex', alignItems: 'center', marginLeft: '12px' }}>
									<button 
										className={`afk-control-btn reset ${isOnAfkCooldown ? 'cooldown' : ''}`}
										onClick={this.handleAfkReset}
										disabled={isOnAfkCooldown}
										title="Reset AFK timer"
										style={{ transform: 'scale(1.3)' }}
									>
										🔄
									</button>
									<button 
										className={`afk-control-btn extend ${isOnAfkCooldown ? 'cooldown' : ''}`}
										onClick={this.handleAfkExtend}
										disabled={isOnAfkCooldown}
										title="Extend AFK timer by 5 minutes"
										style={{ transform: 'scale(1.3)' }}
									>
										+5m
									</button>
								</div>
								<div className="close" onClick={this.toggle} title="Close Player List" style={{ transform: 'scale(1.3)', marginLeft: '12px' }}>
									<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.10a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
								</div>
							</div>
						</div>
						<div className="section" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
							{/* Left Column - Server Info */}
							<div style={{ flex: '0 0 32%', minWidth: '150px' }}>
								<div className="server-info-section" style={{ overflow: 'visible' }}>
									<div className="header" style={{ fontSize: '0.85rem', marginBottom: '6px' }}>Current Server</div>
									<div className="content" style={{ overflow: 'visible' }}>
										<div className="server-details" style={{ overflow: 'visible' }}>
											<div className="detail-row" style={{ marginBottom: '2px' }}>
												<span className="server-name-display" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
													<Q3STR s={serverName}/>
												</span>
											</div>
											
											<div className="detail-row" style={{ marginBottom: '2px' }}>
												<span style={{ fontSize: '0.7rem' }}>Copy IP:</span>
												<button 
													className={`copy-button-small ${this.state.copySuccess === serverAddress ? 'copied' : ''}`}
													onClick={() => this.copyToClipboard(serverAddress)}
													title={`Copy IP address: ${serverAddress}`}
													style={{ fontSize: '0.65rem', padding: '1px 2px', marginLeft: '4px' }}
												>
													📋
												</button>
											</div>
											
											<div className="detail-row" style={{ marginBottom: '2px', overflow: 'visible', position: 'static' }}>
												<span className="server-map" style={{ fontSize: '0.7rem' }}>
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
													style={{ 
														fontSize: '0.65rem', 
														padding: '1px 2px',
														marginLeft: '4px'
													}}
												>
													📋
												</button>
											</div>
											
											<div className="detail-row">
												<span className="server-physics" style={{ fontSize: '0.7rem' }}>
													{serverPhysics}
												</span>
												<span className="player-count-inline" style={{ fontSize: '0.7rem' }}>
													Players: {totalPlayerCount}
												</span>
											</div>
										</div>
									</div>
								</div>

								<div className="instructions" style={{ marginTop: '8px', fontSize: '0.65rem', padding: '4px', lineHeight: '1.3', width: '140px' }}>
									Click a player name to switch spectator POV. Or use twitch chat with "?n" to cycle through players. Players with 🙏 have nospec enabled - click the icon to request spectating.
									{!this.state.hasSpectatorData && (
										<div style={{ marginTop: '4px', color: '#ff9800', fontStyle: 'italic', fontSize: '0.6rem' }}>
											Note: Using real-time serverstate data. API spectator relationships may be outdated.
										</div>
									)}
									{this.state.hasSpectatorData && (
										<div style={{ marginTop: '4px', color: '#4CAF50', fontStyle: 'italic', fontSize: '0.6rem' }}>
											Showing real-time serverstate data enhanced with API spectator info.
										</div>
									)}
								</div>
							</div>

							{/* Right Column - Player Table */}
							<div style={{ flex: '1', minWidth: '220px', maxWidth: '350px' }}>
								<div className="content" style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
									{playersWithScores.length === 0 ? (
										<div className="no-players">No players available</div>
									) : (
										<div>
											<table className="players-table" style={{ fontSize: '0.85rem' }}>
												<thead>
													<tr>
														<th style={{ padding: '4px 6px' }}>
															Player <span 
																className="help-icon" 
																onMouseEnter={() => this.setState({ hoveredHelp: 'player' })}
																onMouseLeave={() => this.setState({ hoveredHelp: null })}
															>
																?
															</span>
															{this.state.hoveredHelp === 'player' && (
																<div className="help-tooltip">
																	Click a player name to spectate their POV. Players with 🙏 have nospec enabled - click to politely request spectating. "Spectate Next" cycles automatically. Data shows real-time serverstate info{this.state.hasSpectatorData ? ' enhanced with API data' : ''}.
																</div>
															)}
														</th>
													</tr>
												</thead>
												<tbody>
													{activePlayers.map((player) => {
														// UPDATED: GTK-aware spectator relationship detection
														let followingSpecs = []
														
														if (this.state.hasSpectatorData) {
															const isGTK = this.isGTKServer()
															
															if (isGTK) {
																// For GTK servers: Only use follow_num for spectators that were successfully matched by name
																followingSpecs = allSpectators.filter(spec => {
																	const hasReliableData = spec.dataSource === 'gtk-matched'
																	const isFollowingThisPlayer = spec.follow_num === player.clientId || spec.follow_num === parseInt(player.id)
																	
																	return hasReliableData && isFollowingThisPlayer
																})
															} else {
																// For non-GTK servers: Use normal follow_num logic
																followingSpecs = allSpectators.filter(spec => 
																	spec.follow_num === player.clientId || spec.follow_num === parseInt(player.id)
																)
															}
														}
														
														const canSpectate = this.canSpectatePlayer(player)
														const isOnCooldown = this.isOnCooldown(player.n)
														
														return (
															<React.Fragment key={`player-${player.id || player.clientId}`}>
																<tr className={!canSpectate ? 'nospec-player' : ''}>
																	<td style={{ padding: '3px 6px' }}>
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
																				{/* Show different indicators for different reasons */}
																				{!canSpectate && (player.t === '3' || player.follow_num !== -1) && (
																					<span className="spectator-indicator"> (Spectator)</span>
																				)}
																				{!canSpectate && player.t !== '3' && player.follow_num === -1 && (
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
																		<td style={{ padding: '3px 6px' }}>
																			<div className="player-row">
																				<div 
																					className={`player-info ${this.canSpectatePlayer(spec) ? 'link' : 'nospec-link'} ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}
																					onClick={this.canSpectatePlayer(spec) ? () => this.spectatePlayerID(spec.id) : undefined}
																					onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
																					onMouseLeave={() => this.setState({ hoveredPlayer: null })}
																				>
																					👁️ <Q3STR s={spec.n}/>
																					{spec.time > 0 && (
																						<span className="player-time"> ({this.formatTime(spec.time)})</span>
																					)}
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
											
											{/* UPDATED: GTK-aware free spectators section */}
											{this.state.hasSpectatorData && allSpectators.length > 0 && (
												(() => {
													// Find spectators who aren't following any active player OR don't have reliable data
													const freeSpectators = allSpectators.filter(spec => {
														const isGTK = this.isGTKServer()
														
														if (isGTK) {
															// For GTK: Show as free spectator if no name match OR not following anyone
															const hasReliableData = spec.dataSource === 'gtk-matched'
															if (!hasReliableData) {
																return true // No name match - show as free spectator
															}
															
															// Has reliable data - check if following any active player
															const isFollowingActivePlayer = activePlayers.some(player => 
																spec.follow_num === player.clientId || spec.follow_num === parseInt(player.id)
															)
															return !isFollowingActivePlayer
														} else {
															// For non-GTK: Normal logic
															const isFollowingActivePlayer = activePlayers.some(player => 
																spec.follow_num === player.clientId || spec.follow_num === parseInt(player.id)
															)
															return !isFollowingActivePlayer
														}
													})
													
													if (freeSpectators.length > 0) {
														return (
															<div className="free-spectators">
																<div className="header">Spectators</div>
																<table className="players-table" style={{ fontSize: '0.85rem' }}>
																	<tbody>
																		{freeSpectators.map((spec) => (
																			<tr key={`free-spec-${spec.id || spec.clientId}`}>
																				<td style={{ padding: '3px 6px' }}>
																					<div className="player-row">
																						<div 
																							className={`player-info ${this.canSpectatePlayer(spec) ? 'link' : 'nospec-link'} ${this.getPlayerStatus(spec).length > 0 ? 'has-status' : ''}`}
																							onClick={this.canSpectatePlayer(spec) ? () => this.spectatePlayerID(spec.id) : undefined}
																							onMouseEnter={() => this.setState({ hoveredPlayer: spec })}
																							onMouseLeave={() => this.setState({ hoveredPlayer: null })}
																						>
																							<Q3STR s={spec.n}/> 
																							<span className="spectating-info">
																								{spec.dataSource === 'gtk-serverstate-only' ? 
																									'(spectator unknown)' : 
																									'(spectator)'
																								}
																							</span>
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
											
											<div className="note m-t m-b" style={{ fontSize: '0.75rem', marginTop: '8px' }}>
												Click on the player name to spectate that person. Players with 🙏 have nospec enabled.
												<div style={{ marginTop: '4px', fontSize: '0.7rem', opacity: '0.8' }}>
													Showing {playersWithScores.length} players from serverstate{this.state.hasSpectatorData ? ' (enhanced with API data)' : ' (real-time data only)'}.
												</div>
											</div>
										</div>
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

export const PlayerList = connect(mapState, mapDispatch)(PlayerListBase)