import React from 'react'
import { Q3STR } from '../../partials/Quake3'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

export function CurrentPlayerNameLoader(props) {
    return (
        <div>Loading...</div>
    )
}

class CurrentPlayerNameBase extends React.Component {
    constructor(props) {
        super(props)
        
        this.state = {
            apiPlayerData: null,
            serverInfo: null
        }
        
        this.fetchServerData = this.fetchServerData.bind(this)
        this.stripQuakeColors = this.stripQuakeColors.bind(this)
        this.isGTKServer = this.isGTKServer.bind(this)
    }
    
    componentDidMount() {
        this.fetchServerData()
    }
    
    componentDidUpdate(prevProps) {
        // Refetch when current player changes or serverstate changes
        if (prevProps.serverstate !== this.props.serverstate ||
            prevProps.serverstate?.current_player?.n !== this.props.serverstate?.current_player?.n) {
            this.fetchServerData()
        }
    }
    
    // Helper function to strip Quake 3 color codes
    stripQuakeColors(text) {
        if (!text) return ''
        return text.replace(/\^./g, '').toLowerCase().trim()
    }
    
    // Check if current server is GTK (unreliable ID matching)
    isGTKServer() {
        const serverIP = this.props.serverstate?.ip
        return serverIP?.includes('83.243.73.220')
    }
    
    async fetchServerData() {
        // Need serverstate first
        if (!this.props.serverstate?.ip || !this.props.serverstate?.current_player?.n) {
            return
        }
        
        try {
            const serversResponse = await fetch('https://defrag.racing/servers/json')
            const serversData = await serversResponse.json()
            const currentServerInfo = serversData.active?.[this.props.serverstate.ip] || {}
            
            if (currentServerInfo.players) {
                const currentPlayerName = this.props.serverstate.current_player.n
                const cleanCurrentPlayerName = this.stripQuakeColors(currentPlayerName)
                const isGTK = this.isGTKServer()
                
                // Find matching player in API data
                let matchedPlayer = null
                
                if (isGTK) {
                    // For GTK servers: Only use name matching with color stripping
                    matchedPlayer = Object.values(currentServerInfo.players).find(player => {
                        const cleanAPIName = this.stripQuakeColors(player.name)
                        return cleanAPIName === cleanCurrentPlayerName
                    })
                } else {
                    // For non-GTK servers: Try ID matching first, then name matching
                    const currentPlayerId = this.props.serverstate.current_player.id || this.props.serverstate.current_player_id
                    
                    matchedPlayer = Object.values(currentServerInfo.players).find(player => {
                        // Try ID matching first
                        if (currentPlayerId && (player.clientId === parseInt(currentPlayerId) || player.clientId === currentPlayerId)) {
                            return true
                        }
                        
                        // Fallback to name matching
                        const cleanAPIName = this.stripQuakeColors(player.name)
                        return cleanAPIName === cleanCurrentPlayerName
                    })
                }
                
                this.setState({
                    apiPlayerData: matchedPlayer,
                    serverInfo: currentServerInfo
                })
            }
            
        } catch (error) {
            console.error('[CurrentPlayerName] Error fetching server data:', error)
        }
    }
    
    render() {
        // Add safety checks
        if (!this.props.serverstate || !this.props.serverstate.current_player) {
            // Check if we're actually loading vs just no player to spectate
            if (!this.props.serverstate) {
                return (
                    <div className="curr-player-wrap">
                        Loading...
                    </div>
                )
            } else {
                // We have serverstate but no current player (standby mode)
                return (
                    <div className="curr-player-wrap">
                        {/* Show nothing or a standby message */}
                    </div>
                )
            }
        }
        
        // Determine which name to display
        let displayName = this.props.serverstate.current_player.n // Fallback to serverstate
        
        if (this.state.apiPlayerData && this.state.apiPlayerData.name) {
            // Use colored name from API if available
            displayName = this.state.apiPlayerData.name
        }
        
        return (
            <div className="curr-player-wrap">
                <span className="enhanced-nickname">
                    <Q3STR s={displayName}/>
                </span>
            </div>
        )
    }
}

export const CurrentPlayerName = connect(mapState, mapDispatch)(CurrentPlayerNameBase)