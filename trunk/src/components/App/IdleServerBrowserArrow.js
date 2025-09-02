import React from 'react'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

class IdleServerBrowserArrowBase extends React.Component {
    constructor(props) {
        super(props)
        
        this.state = {
            showArrow: false,
            pulseCount: 0
        }
        
        this.checkIdleCondition = this.checkIdleCondition.bind(this)
        this.startArrowAnimation = this.startArrowAnimation.bind(this)
        this.stopArrowAnimation = this.stopArrowAnimation.bind(this)
    }
    
    componentDidMount() {
        // Check idle condition every 5 seconds
        this.idleCheckInterval = setInterval(this.checkIdleCondition, 5000)
        // Initial check
        this.checkIdleCondition()
    }
    
    componentWillUnmount() {
        if (this.idleCheckInterval) {
            clearInterval(this.idleCheckInterval)
        }
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval)
        }
        if (this.arrowTimeout) {
            clearTimeout(this.arrowTimeout)
        }
    }
    
    componentDidUpdate(prevProps) {
        // Check if serverstate changed
        if (prevProps.serverstate !== this.props.serverstate) {
            this.checkIdleCondition()
        }
    }
    
    checkIdleCondition() {
        const { serverstate, appstate } = this.props
        
        console.log('[IDLE ARROW DEBUG]', {
            mapname: serverstate.mapname,
            playerCount: Object.keys(serverstate.players || {}).length,
            current_player_id: serverstate.current_player_id,
            bot_id: serverstate.bot_id,
            hostname: serverstate.hostname,
            ip: serverstate.ip,
            isConsoleOpen: appstate.isConsoleOpen,
            isPlayerlistOpen: appstate.isPlayerlistOpen,
            isServerBrowserOpen: appstate.isServerBrowserOpen,
            isNotifyOpen: appstate.isNotifyOpen,
            isSettingsPanelOpen: appstate.isSettingsPanelOpen,
            showArrow: this.state.showArrow
        })
        
        // Don't show arrow if any panel is open
        if (appstate.isConsoleOpen || 
            appstate.isPlayerlistOpen || 
            appstate.isServerBrowserOpen || 
            appstate.isNotifyOpen ||
            appstate.isSettingsPanelOpen) {
            console.log('[IDLE ARROW] Stopping - panel is open')
            this.stopArrowAnimation()
            return
        }
        
        // Check if we're on ST1 map (standby mode)
        const isOnST1 = serverstate.mapname === 'st1'
        
        // Check if there are very few players (bot + maybe 1 other)  
        const playerCount = Object.keys(serverstate.players || {}).length
        const isLowPlayerCount = playerCount <= 2
        
        // Check if current player is the bot (self-spectating) OR no current player
        const isSpectatingBot = serverstate.current_player_id === serverstate.bot_id || !serverstate.current_player
        
        // NEW: Check if bot is in standby mode (no real server connection)
        // When in standby, the extension may show stale server data
        // So we also check for very low player counts or empty player data as indicators of standby
        const isStandbyMode = playerCount === 0 || !serverstate.current_player || serverstate.hostname === 'Unknown Server'
        
        // Show arrow if: on ST1 OR looks like standby mode (empty server, no players, etc.)
        const shouldShow = isOnST1 || isStandbyMode
        
        console.log('[IDLE ARROW] Conditions:', {
            isOnST1,
            isLowPlayerCount,
            isSpectatingBot,
            isStandbyMode,
            shouldShow,
            currentShowArrow: this.state.showArrow
        })
        
        if (shouldShow) {
            if (!this.state.showArrow) {
                console.log('[IDLE ARROW] Starting animation')
                this.startArrowAnimation()
            }
        } else {
            console.log('[IDLE ARROW] Stopping animation')
            this.stopArrowAnimation()
        }
    }
    
    startArrowAnimation() {
        this.setState({ showArrow: true, pulseCount: 0 })
        
        // Pulse animation - 6 pulses over 12 seconds, then hide for 8 seconds
        this.pulseInterval = setInterval(() => {
            this.setState(prevState => {
                if (prevState.pulseCount >= 5) { // 6 pulses (0-5)
                    // Hide for 8 seconds
                    setTimeout(() => {
                        if (this.state.showArrow) {
                            this.setState({ pulseCount: 0 })
                        }
                    }, 8000)
                    return { pulseCount: 0, showArrow: false }
                }
                return { pulseCount: prevState.pulseCount + 1 }
            })
        }, 2000) // Pulse every 2 seconds
        
        // Re-show after 8 second break
        setTimeout(() => {
            if (this.state.showArrow === false && this.pulseInterval) {
                this.setState({ showArrow: true })
            }
        }, 20000) // 12s animation + 8s break
    }
    
    stopArrowAnimation() {
        this.setState({ showArrow: false, pulseCount: 0 })
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval)
            this.pulseInterval = null
        }
    }
    
    render() {
        if (!this.state.showArrow) {
            return null
        }
        
        return (
            <div className="idle-server-arrow-container">
                <div className="idle-arrow-message">
                    Click here to switch servers!
                </div>
                <div className="idle-arrow">
                    <svg 
                        className="arrow-svg" 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="currentColor"
                    >
                        <path d="M7.41 8.84L12 13.42l4.59-4.58L18 10.25l-6 6-6-6z"/>
                    </svg>
                </div>
            </div>
        )
    }
}

export const IdleServerBrowserArrow = connect(mapState, mapDispatch)(IdleServerBrowserArrowBase)