import React from 'react'
import { Q3STR } from '../../partials/Quake3'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'
import { BOT_CONFIG } from '../../botConfig';
import twitchLogo from '../../img/twitch-logo.svg';

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

const FASTCAPS_MODES = {
    '1': 'FC Mode 1 (No weapons, No movement aids)',
    '2': 'FC Mode 2 (Weapons + Movement aids)',
    '3': 'FC Mode 3 (No weapons, Movement aids)',
    '4': 'FC Mode 4 (Weapons, No movement aids)',
    '5': 'FC Mode 5 (Swinging hook)',
    '6': 'FC Mode 6 (Quake3 hook)',
    '7': 'FC Mode 7 (Vanilla Quake3)',
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
			refreshSuccess: false,
			showTwitchDetails: false,
			spectateCooldowns: new Map() // Track spectate button cooldowns
		}
        this.spec_timeout = null
        this.refreshInterval = null
        this.cooldownTimer = null
        
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
        
        // Start cooldown timer for spectate buttons
        this.cooldownTimer = setInterval(() => {
            this.updateCooldowns()
        }, 100) // Update every 100ms for smooth countdown
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
        if (this.cooldownTimer) {
            clearInterval(this.cooldownTimer)
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
				serverName: currentServerInfo?.hostname || serverstate.hostname || 'Unknown',
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

    // Get remaining cooldown time for a player
    getSpectateCooldown(id) {
        const cooldown = this.state.spectateCooldowns.get(id)
        if (!cooldown) return 0
        
        const elapsed = Date.now() - cooldown.startTime
        const remaining = Math.max(0, cooldown.duration - elapsed)
        return Math.ceil(remaining / 1000) // Return seconds
    }

    spectatePlayerID(id) {
        if(this.props.twitchUser.role == 'guest') {
            return
        }

        // Check if this specific player is on cooldown
        if(this.state.spectateCooldowns.has(id)) {
            return
        }

        // Add this player to cooldown
        const newCooldowns = new Map(this.state.spectateCooldowns)
        newCooldowns.set(id, { startTime: Date.now(), duration: 5000 })
        this.setState({ spectateCooldowns: newCooldowns })

        // Start countdown timer if not already running
        if (!this.cooldownTimer) {
            this.cooldownTimer = setInterval(() => {
                this.setState({ spectateCooldowns: new Map(this.state.spectateCooldowns) })
            }, 1000)
        }

        // Set timeout to remove cooldown
        setTimeout(() => {
            const updatedCooldowns = new Map(this.state.spectateCooldowns)
            updatedCooldowns.delete(id)
            this.setState({ spectateCooldowns: updatedCooldowns })
            
            // Clear timer if no more cooldowns
            if (updatedCooldowns.size === 0 && this.cooldownTimer) {
                clearInterval(this.cooldownTimer)
                this.cooldownTimer = null
            }
        }, 5000)

        this.props.sendCommand({
            'action': 'spectate',
            'value': `id:${id}`
        })

        const table = document.querySelector('.players-table')
        if (table) {
            table.classList.add('loading')
            setTimeout(() => {
                if (table) {
                    table.classList.remove('loading')
                }
            }, 5000)
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

    updateCooldowns() {
        const newCooldowns = new Map()
        let hasChanges = false
        
        for (const [id, cooldown] of this.state.spectateCooldowns) {
            const elapsed = Date.now() - cooldown.startTime
            if (elapsed < cooldown.duration) {
                newCooldowns.set(id, cooldown)
            } else {
                hasChanges = true
            }
        }
        
        if (hasChanges) {
            this.setState({ spectateCooldowns: newCooldowns })
        }
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

    // Check if player has nospec Twitch setting AND is currently live
    hasNospecTwitch(player) {
        const c1 = player.c1 || ''
        // Only block spectating if they have nospec.twitch.tv/ AND are currently live
        return c1.includes('nospec.twitch.tv/') && c1.includes(',live')
    }


    // Handle Twitch link clicks
    handleTwitchClick(player, event) {
        event.stopPropagation() // Prevent spectating when clicking Twitch link
        const twitchUsername = this.getTwitchUsername(player)
        if (twitchUsername) {
            const twitchUrl = `https://www.twitch.tv/${twitchUsername}`
            window.open(twitchUrl, '_blank')
        }
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
				enrichedPlayers = serverstatePlayersNonBot.map(player => {
					// Try to match by name only (with color stripping)
					const cleanServerstateName = this.stripQuakeColors(player.n)
					
					// Find colored name from API players
					const apiPlayerData = this.state.serverInfo.players ? 
						Object.values(this.state.serverInfo.players).find(apiPlayer => {
							const cleanAPIName = this.stripQuakeColors(apiPlayer.name)
							return cleanAPIName === cleanServerstateName
						}) : null
					
					// Find spectator data from scores
					const scoreData = apiScores.find(score => {
						const cleanAPIName = this.stripQuakeColors(apiPlayerData?.name || '')
						return cleanAPIName === cleanServerstateName
					})
					
					if (apiPlayerData || scoreData) {
						return {
							...player,
							n: apiPlayerData?.name || player.n, // Use API colored name
							time: scoreData?.time || 0,
							follow_num: scoreData?.follow_num || -1,
							team: scoreData?.follow_num === -1 ? '0' : '3',
							t: player.t,
							nospec: player.nospec,
							c1: player.c1,
							clientId: scoreData?.player_num || parseInt(player.id),
							dataSource: 'gtk-matched'
						}
					} else {
						return {
							...player,
							time: 0,
							follow_num: -1,
							team: player.t || '0',
							t: player.t || '0',
							nospec: player.nospec,
							c1: player.c1,
							clientId: parseInt(player.id),
							dataSource: 'gtk-serverstate-only'
						}
					}
				})
			} else {
				// NON-GTK SERVER HANDLING
				const processedPlayerIds = new Set()
				
				// First, process serverstate players and enrich with API data
				enrichedPlayers = serverstatePlayersNonBot.map(player => {
					processedPlayerIds.add(parseInt(player.id))
					
					// Find colored name from API players
					const apiPlayerData = this.state.serverInfo.players ? 
						Object.values(this.state.serverInfo.players).find(apiPlayer => {
							// Try ID matching first
							if (apiPlayer.clientId === parseInt(player.id)) return true
							
							// Fallback to name matching
							const cleanAPIName = this.stripQuakeColors(apiPlayer.name)
							const cleanServerstateName = this.stripQuakeColors(player.n)
							return cleanAPIName === cleanServerstateName
						}) : null
					
					// Find spectator data from scores
					const scoreData = apiScores.find(score => {
						return score.player_num === parseInt(player.id)
					})
					
					
					return {
						...player,
						n: apiPlayerData?.name || player.n, // Use API colored name if available
						time: scoreData?.time || 0,
						follow_num: scoreData?.follow_num || -1,
						team: scoreData?.follow_num === -1 ? '0' : '3',
						t: player.t,
						nospec: player.nospec,
						c1: player.c1,
						clientId: parseInt(player.id),
						dataSource: apiPlayerData ? 'matched' : 'serverstate-only'
					}
				})
				
				// Add API-only players that aren't in serverstate
				const apiOnlyPlayers = apiScores
					.filter(score => !processedPlayerIds.has(score.player_num))
					.map(score => {
						// Find colored name from API players data
						const apiPlayerData = this.state.serverInfo.players ? 
							Object.values(this.state.serverInfo.players).find(apiPlayer => 
								apiPlayer.clientId === score.player_num
							) : null
						
						return {
							id: score.player_num,
							n: apiPlayerData?.name || `Player ${score.player_num}`,
							time: score.time || 0,
							follow_num: score.follow_num,
							team: score.follow_num === -1 ? '0' : '3',
							t: score.follow_num === -1 ? '0' : '3',
							nospec: false,
							c1: '',
							clientId: score.player_num,
							dataSource: 'api-only'
						}
					})
				
				enrichedPlayers = [...enrichedPlayers, ...apiOnlyPlayers]
			}
		} else {
			// No API data available, use serverstate data only
			enrichedPlayers = serverstatePlayersNonBot.map(player => ({
				...player,
				time: 0,
				follow_num: -1,
				team: player.t || '0',
				t: player.t || '0',
				nospec: player.nospec,
				c1: player.c1,
				clientId: parseInt(player.id),
				dataSource: 'serverstate-fallback'
			}))
		}
		
		return enrichedPlayers
	}
	
	// Helper function to strip Quake 3 color codes  
	stripQuakeColors(text) {
		if (!text) return ''
		return text.replace(/\^./g, '').toLowerCase().trim()
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
		
		// Check for nospec.twitch.tv - disallow spectating, only allow Twitch redirect
		if (this.hasNospecTwitch(player)) {
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
							this.parsePhysicsType(this.state.serverInfo.defrag) : 
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
						<div className="compact-header">
							<div className="header-controls">
								<button 
									className="compact-header-btn refresh-btn" 
									onClick={() => this.fetchServerData()}
									title="Refresh Player List"
								>
									Refresh
								</button>
								<button 
									className={`compact-header-btn afk-btn ${isOnAfkCooldown ? 'cooldown' : ''}`}
									onClick={this.handleAfkReset}
									disabled={isOnAfkCooldown}
									title="Reset AFK timer"
								>
									Reset AFK
								</button>
								<button 
									className={`compact-header-btn afk-btn ${isOnAfkCooldown ? 'cooldown' : ''}`}
									onClick={this.handleAfkExtend}
									disabled={isOnAfkCooldown}
									title="Extend AFK timer by 5 minutes"
								>
									+5 min
								</button>
								<button 
									className="compact-header-btn close-btn" 
									onClick={this.toggle} 
									title="Close Player List"
								>
									✕
								</button>
							</div>
						</div>
						
						<div className="twitch-explanation">
							<div 
								className="explanation-header"
								onClick={() => this.setState({ showTwitchDetails: !this.state.showTwitchDetails })}
								style={{ cursor: 'pointer', textAlign: 'center' }}
							>
								<span style={{ color: '#9146ff', fontWeight: 'bold', fontSize: '0.8rem' }}>Are you a streamer?</span> <span style={{ fontSize: '0.7rem' }}>Click for details</span>
							</div>
							{this.state.showTwitchDetails && (
								<div className="explanation-content">
									<div><strong>Regular Twitch Players:</strong></div>
									<div><strong>Format:</strong> /color1 "twitch.tv/username"</div>
									<div><strong>Behavior:</strong> Players can be spectated as usual, with their Twitch link displayed next to their nickname.</div>
									<div><strong>Click Behavior:</strong> Clicking the name initiates spectating; clicking the Twitch URL opens the stream.</div>
									
									<div style={{ marginTop: '8px' }}><strong>NoSpec Twitch Players:</strong></div>
									<div><strong>Format:</strong> /color1 "nospec-twitch.tv/username"</div>
									<div><strong>Behavior:</strong> These players cannot be spectated, likely because they're streaming and prefer not to be disrupted.</div>
									<div><strong>Click Behavior:</strong> Clicking either the name or URL opens their Twitch stream.</div>
									
									<div style={{ marginTop: '8px' }}><strong>How to Set Your Twitch:</strong></div>
									<div>Use /color1 "twitch.tv/yourusername" to display your stream link to other players.</div>
									<div>Add "nospec-" prefix if you don't want to be spectated while streaming.</div>
								</div>
							)}
						</div>
						
						{/* Compact Server Info */}
						<div className="compact-server-info">
							<div className="server-row">
								<span className="server-name"><Q3STR s={serverName}/></span>
								<button
									className={`copy-btn ${this.state.copySuccess === serverAddress ? 'copied' : ''}`}
									onClick={() => this.copyToClipboard(serverAddress)}
									title={`Copy IP: ${serverAddress}`}
								>
									📋 Copy IP
								</button>
								<button
									className="play-btn"
									onClick={() => {
										try {
											window.open(`defrag://${serverAddress}`, '_blank')
										} catch (e) {
											// Fallback: try direct navigation
											window.location.href = `defrag://${serverAddress}`
										}
									}}
									title={`Play on server: ${serverAddress}`}
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
										<path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>
									</svg>
									Play
								</button>
							</div>
							<div className="map-row">
								<span className="map-info">Map: 
									<a 
										href={`https://defrag.racing/maps/${serverMap}`}
										target="_blank"
										rel="noopener noreferrer"
										className="map-link"
										title="View map on defrag.racing"
									>
										<Q3STR s={serverMap}/>
									</a>
								</span>
								<button 
									className={`copy-btn ${this.state.copySuccess === serverMap ? 'copied' : ''}`}
									onClick={() => this.copyToClipboard(serverMap)}
									title="Copy map name"
								>
									📋
								</button>
							</div>
						</div>

						{/* Modern Single Player Table */}
						<div className="modern-players-section">
							<div style={{ flex: '1', minWidth: '220px', maxWidth: '350px' }}>
								<div className="content" style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'scroll', paddingRight: '8px' }}>
									{playersWithScores.length === 0 ? (
										<div className="no-players">No players available</div>
									) : (
										<div>
											<div className="help-section">
												<span className="help-text">
													Players <span 
														className="help-icon" 
														onMouseEnter={() => this.setState({ hoveredHelp: 'player' })}
														onMouseLeave={() => this.setState({ hoveredHelp: null })}
													>
														?
													</span>
													{this.state.hoveredHelp === 'player' && (
														<div className="help-tooltip">
															Use spectate buttons to spectate players. Players with 🙏 have nospec enabled. Data shows real-time serverstate info{this.state.hasSpectatorData ? ' enhanced with API data' : ''}.
														</div>
													)}
												</span>
											</div>
											<div className="players-list">
													{activePlayers.map((player) => {
														// UPDATED: GTK-aware spectator relationship detection
														let followingSpecs = []
														
														// Always check for spectator relationships (even without API data)
														const isGTK = this.isGTKServer()
														
														if (this.state.hasSpectatorData) {
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
														} else {
															// Fallback: Use serverstate follow_num data even without API
															followingSpecs = allSpectators.filter(spec => {
																const playerIdMatch = spec.follow_num === parseInt(player.id)
																const clientIdMatch = spec.follow_num === player.clientId
																return playerIdMatch || clientIdMatch
															})
														}
														
														const canSpectate = this.canSpectatePlayer(player)
														const isOnCooldown = this.isOnCooldown(player.n)
														
														return (
															<React.Fragment key={`player-${player.id || player.clientId}`}>
																<div className="player-item">
																	<div className="player-main-row">
																		{canSpectate && !this.hasNospecTwitch(player) && (() => {
																			const cooldownSeconds = this.getSpectateCooldown(player.id)
																			const isOnCooldown = cooldownSeconds > 0
																			
																			return (
																				<button 
																					className={`compact-spectate-btn ${isOnCooldown ? 'cooldown' : ''}`}
																					onClick={() => !isOnCooldown && this.spectatePlayerID(player.id)}
																					disabled={isOnCooldown}
																					title={isOnCooldown ? `Wait ${cooldownSeconds}s` : "Spectate this player"}
																				>
																					{isOnCooldown ? `Wait ${cooldownSeconds}s` : 'Click to spectate'}
																				</button>
																			)
																		})()}
																		<div 
																			className={`player-info ${this.getPlayerStatus(player).length > 0 ? 'has-status' : ''} ${this.getTwitchUsername(player) ? 'twitch-player' : ''}`}
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
																		</div>
																		
																		{/* Compact Twitch buttons */}
																		{this.getTwitchUsername(player) && (
																			<div className="compact-twitch-section">
																				<button 
																					className={`compact-twitch-btn ${this.isPlayerLive(player) ? 'live' : 'offline'}`}
																					onClick={(e) => this.handleTwitchClick(player, e)}
																					title={this.isPlayerLive(player) ? `Watch ${this.getTwitchUsername(player)} LIVE` : `Visit ${this.getTwitchUsername(player)}`}
																				>
																					<img src={twitchLogo} alt="Twitch" className="twitch-logo" /> {this.getTwitchUsername(player)}
																				</button>
																				{this.isPlayerLive(player) ? (
																					<span className="live-indicator">🔴 CURRENTLY LIVE</span>
																				) : (
																					<span className="offline-indicator">⚫ CURRENTLY OFFLINE</span>
																				)}
																			</div>
																		)}
																	</div>
																	
																	{/* Additional content */}
																	<div>
																		{/* Additional indicators */}
																		{!canSpectate && (player.t === '3' || player.follow_num !== -1) && (
																			<span className="spectator-indicator">(Spectator)</span>
																		)}
																		{!canSpectate && player.t !== '3' && player.follow_num === -1 && !this.hasNospecTwitch(player) && !this.getTwitchUsername(player) && (
																			<span className="nospec-indicator">(No Spectating)</span>
																		)}
																		
																		{/* Request spectate button */}
																		{!canSpectate && this.props.twitchUser.role !== 'guest' && (
																			<button 
																				className={`request-spectate-btn ${isOnCooldown ? 'cooldown' : ''}`}
																				onClick={!isOnCooldown ? () => this.requestSpectate(player.n) : undefined}
																				title={isOnCooldown ? "Please wait before requesting again" : "Politely request to spectate this player"}
																			>
																				🙏
																			</button>
																		)}
																		
																		{/* Tooltip */}
																		{this.state.hoveredPlayer === player && (
																			<div className="player-tooltip-container">
																				{this.renderPlayerTooltip(player)}
																			</div>
																		)}
																	</div>
																	
																	{/* Spectators following this player */}
																	{followingSpecs.map((spec) => (
																	<div key={`spec-${spec.id || spec.clientId}`} className="spectator-item">
																		<div className="spectator-main-row">
																			<div className="spectator-info">
																				<span className="spectator-eye">👁️</span>
																				<Q3STR s={spec.n}/>
																				{spec.time > 0 && (
																					<span className="player-time"> ({this.formatTime(spec.time)})</span>
																				)}
																				{this.getPlayerStatus(spec).length > 0 && (
																					<span className="status-indicator">!</span>
																				)}
																			</div>
																			
																			{/* Compact Twitch buttons for spectators */}
																			{this.getTwitchUsername(spec) && (
																				<div className="compact-twitch-section">
																					<button 
																						className={`compact-twitch-btn ${this.isPlayerLive(spec) ? 'live' : 'offline'}`}
																						onClick={(e) => this.handleTwitchClick(spec, e)}
																						title={this.isPlayerLive(spec) ? `Watch ${this.getTwitchUsername(spec)} LIVE` : `Visit ${this.getTwitchUsername(spec)}`}
																					>
																						<img src={twitchLogo} alt="Twitch" className="twitch-logo" /> {this.getTwitchUsername(spec)}
																					</button>
																					{this.isPlayerLive(spec) ? (
																						<span className="live-indicator">🔴 CURRENTLY LIVE</span>
																					) : (
																						<span className="offline-indicator">⚫ CURRENTLY OFFLINE</span>
																					)}
																				</div>
																			)}
																		</div>
																		
																		{/* Tooltip */}
																		{this.state.hoveredPlayer === spec && (
																			<div className="player-tooltip-container">
																				{this.renderPlayerTooltip(spec)}
																			</div>
																		)}
																	</div>
																	))}
																</div>
															</React.Fragment>
														)
													})}
											</div>
											
											{/* UPDATED: GTK-aware free spectators section */}
											{allSpectators.length > 0 && (
												(() => {
													// Find spectators who aren't following any active player OR don't have reliable data
													const freeSpectators = allSpectators.filter(spec => {
														const isGTK = this.isGTKServer()
														
														if (this.state.hasSpectatorData) {
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
														} else {
															// Fallback: Use serverstate follow_num data even without API
															const isFollowingActivePlayer = activePlayers.some(player => {
																const playerIdMatch = spec.follow_num === parseInt(player.id)
																const clientIdMatch = spec.follow_num === player.clientId
																return playerIdMatch || clientIdMatch
															})
															return !isFollowingActivePlayer
														}
													})
													
													if (freeSpectators.length > 0) {
														return (
															<div className="free-spectators">
																<div className="header">Spectators</div>
																<div className="spectators-list">
																	{freeSpectators.map((spec) => (
																		<div key={`free-spec-${spec.id || spec.clientId}`} className="spectator-item">
																			<div className="spectator-main-row">
																				<div className="spectator-info">
																					<span className="spectator-eye">👁️</span>
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
																				
																				{/* Compact Twitch buttons for free spectators */}
																				{this.getTwitchUsername(spec) && (
																					<div className="compact-twitch-section">
																						<button 
																							className={`compact-twitch-btn ${this.isPlayerLive(spec) ? 'live' : 'offline'}`}
																							onClick={(e) => this.handleTwitchClick(spec, e)}
																							title={this.isPlayerLive(spec) ? `Watch ${this.getTwitchUsername(spec)} LIVE` : `Visit ${this.getTwitchUsername(spec)}`}
																						>
																							<img src={twitchLogo} alt="Twitch" className="twitch-logo" /> {this.getTwitchUsername(spec)}
																						</button>
																						{this.isPlayerLive(spec) ? (
																							<span className="live-indicator">🔴 CURRENTLY LIVE</span>
																						) : (
																							<span className="offline-indicator">⚫ CURRENTLY OFFLINE</span>
																						)}
																					</div>
																				)}
																			</div>
																			
																			{/* Tooltip */}
																			{this.state.hoveredPlayer === spec && (
																				<div className="player-tooltip-container">
																					{this.renderPlayerTooltip(spec)}
																				</div>
																			)}
																		</div>
																	))}
																</div>
															</div>
														)
													}
													return null
												})()
											)}
											
											<div className="note m-t m-b" style={{ fontSize: '0.75rem', marginTop: '8px' }}>
												Players with 🙏 have nospec enabled.
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