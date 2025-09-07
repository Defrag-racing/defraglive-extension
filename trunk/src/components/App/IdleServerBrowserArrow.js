import React from 'react'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

class IdleServerBrowserArrowBase extends React.Component {
    constructor(props) {
        super(props)
        
        this.state = {
            showArrow: false,
            pulseCount: 0,
            isInitialized: false // Track if we've done initial checks
        }
        
        this.checkIdleCondition = this.checkIdleCondition.bind(this)
        this.startArrowAnimation = this.startArrowAnimation.bind(this)
        this.stopArrowAnimation = this.stopArrowAnimation.bind(this)
    }
    
    componentDidMount() {
        // Wait a bit for initial data to load before starting checks
        setTimeout(() => {
            this.setState({ isInitialized: true })
            this.checkIdleCondition()
            // Check idle condition every 5 seconds after initialization
            this.idleCheckInterval = setInterval(this.checkIdleCondition, 5000)
        }, 2000) // Wait 2 seconds for serverstate to load
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
        
        // Don't check until initialized to prevent flash on loading
        if (!this.state.isInitialized) {
            return
        }
        
        // Don't show arrow if any panel is open
        if (appstate.isConsoleOpen || 
            appstate.isPlayerlistOpen || 
            appstate.isServerBrowserOpen || 
            appstate.isNotifyOpen ||
            appstate.isSettingsPanelOpen) {
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
        
        // Check if bot is in standby mode (no real server connection)
        // When in standby, the extension may show stale server data
        // So we also check for very low player counts or empty player data as indicators of standby
        const isStandbyMode = playerCount === 0 || !serverstate.current_player || serverstate.hostname === 'Unknown Server'
        
        // Show arrow if: on ST1 OR looks like standby mode (empty server, no players, etc.)
        const shouldShow = isOnST1 || isStandbyMode
        
        if (shouldShow && !this.state.showArrow) {
            this.startArrowAnimation()
        } else if (!shouldShow && this.state.showArrow) {
            this.stopArrowAnimation()
        }
    }
    
    startArrowAnimation() {
        this.setState({ showArrow: true })
    }
    
    stopArrowAnimation() {
        this.setState({ showArrow: false })
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
            </div>
        )
    }
}

export const IdleServerBrowserArrow = connect(mapState, mapDispatch)(IdleServerBrowserArrowBase)