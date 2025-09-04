import React from 'react'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

// Default values for each setting
const SETTING_DEFAULTS = {
    // Visual/Graphics (vid_restart required)
    brightness: 2,
    picmip: 0,
    fullbright: false,  // Changed to boolean for toggle
    // Visual/Graphics (no restart)
    gamma: 1.2,
    sky: true,
    triggers: false,
    clips: false,
    slick: false,
    // HUD/Interface
    drawgun: false,
    angles: false,
    lagometer: false,
    snaps: true,
    cgaz: true,
    speedinfo: true,
    speedorig: false,
    inputs: true,
    obs: false,
    // Gameplay
    nodraw: false,
    thirdperson: false,
    miniview: false,
    gibs: false,
    blood: false
}

const VID_RESTART_SETTINGS = ['brightness', 'picmip', 'fullbright']

class SettingsPanelBase extends React.Component {
    constructor(props) {
        super(props)
        
		this.state = {
			currentSettings: { ...SETTING_DEFAULTS },
			pendingVidRestartSettings: { ...SETTING_DEFAULTS }, // Only for vid_restart settings
			cooldowns: {},
			vidRestartCooldown: 0,
			showConfirmDialog: false,
			confirmSettings: null,
			showEmergencyDialog: false,
			vidRestartLocked: true, // Lock video settings behind emergency dialog
			hoveredTooltip: null, // For custom tooltips
			countdownDisplays: {} // NEW: For real-time countdown display
		}
        
        this.applyVidRestartSettings = this.applyVidRestartSettings.bind(this)
        this.resetVidRestartToDefaults = this.resetVidRestartToDefaults.bind(this)
        this.updateInstantSetting = this.updateInstantSetting.bind(this)
        this.updateVidRestartSetting = this.updateVidRestartSetting.bind(this)
        this.handleCurrentSettings = this.handleCurrentSettings.bind(this)
        this.executeSettings = this.executeSettings.bind(this)
        this.requestSettingsWhenReady = this.requestSettingsWhenReady.bind(this)
        this.isOnCooldown = this.isOnCooldown.bind(this)
        this.getCooldownRemaining = this.getCooldownRemaining.bind(this)
        this.getVidRestartCooldownRemaining = this.getVidRestartCooldownRemaining.bind(this)
        this.handleEmergencyConfirm = this.handleEmergencyConfirm.bind(this)
        this.handleEmergencyCancel = this.handleEmergencyCancel.bind(this)
        this.showTooltip = this.showTooltip.bind(this)
        this.hideTooltip = this.hideTooltip.bind(this)
        this.updateCountdownDisplay = this.updateCountdownDisplay.bind(this) // NEW
    }
    
    showTooltip(text, event) {
        this.setState({
            hoveredTooltip: {
                text: text,
                x: event.clientX,
                y: event.clientY
            }
        })
    }
    
    hideTooltip() {
        this.setState({ hoveredTooltip: null })
    }
    
    // NEW: Method to update countdown display in real-time
    updateCountdownDisplay() {
        const now = Date.now()
        const newCountdownDisplays = {}
        let hasChanges = false
        
        // Update individual setting countdowns
        Object.keys(this.state.cooldowns).forEach(key => {
            const endTime = this.state.cooldowns[key]
            if (endTime && now < endTime) {
                const remaining = Math.ceil((endTime - now) / 1000)
                newCountdownDisplays[key] = remaining
                hasChanges = true
            }
        })
        
        // Update vid restart countdown
        if (this.state.vidRestartCooldown && now < this.state.vidRestartCooldown) {
            const remaining = Math.ceil((this.state.vidRestartCooldown - now) / 1000)
            newCountdownDisplays.vidRestart = remaining
            hasChanges = true
        }
        
        if (hasChanges || Object.keys(this.state.countdownDisplays).length > 0) {
            this.setState({ countdownDisplays: newCountdownDisplays })
        }
    }
    
	updateVidRestartSetting(key, value) {
		console.log('updateVidRestartSetting called:', key, value, 'locked:', this.state.vidRestartLocked)
		
		// Check if emergency dialog needs to be shown
		if (this.state.vidRestartLocked) {
			console.log('Showing emergency dialog')
			this.setState({ showEmergencyDialog: true })
			return
		}
		
		console.log('Updating video restart setting:', key, value)
		this.setState(prevState => ({
			pendingVidRestartSettings: {
				...prevState.pendingVidRestartSettings,
				[key]: value
			}
		}))
	}

	handleEmergencyConfirm() {
		console.log('Emergency confirmed - unlocking video restart settings')
		this.setState({ 
			showEmergencyDialog: false,
			vidRestartLocked: false
		})
	}

	handleEmergencyCancel() {
		console.log('Emergency cancelled')
		this.setState({ showEmergencyDialog: false })
	}
    
    updateInstantSetting(key, value) {
        const now = Date.now()
        if (this.state.cooldowns[key] && now < this.state.cooldowns[key]) {
            return
        }
        
        // Apply instantly
        const settings = { [key]: value }
        this.executeSettings(settings, false)
        
        // Update local state with cooldown - CHANGED TO 5 SECONDS
        this.setState(prevState => ({
            currentSettings: {
                ...prevState.currentSettings,
                [key]: value
            },
            cooldowns: {
                ...prevState.cooldowns,
                [key]: now + 5000 // CHANGED: 5 second cooldown instead of 15
            }
        }))
    }
    
    applyVidRestartSettings() {
        const now = Date.now()
        if (this.state.vidRestartCooldown && now < this.state.vidRestartCooldown) {
            return
        }
        
        // Get only changed vid_restart settings
        const changedSettings = {}
        VID_RESTART_SETTINGS.forEach(key => {
            if (this.state.pendingVidRestartSettings[key] !== this.state.currentSettings[key]) {
                changedSettings[key] = this.state.pendingVidRestartSettings[key]
            }
        })
        
        if (Object.keys(changedSettings).length === 0) {
            return
        }
        
        this.setState({
            showConfirmDialog: true,
            confirmSettings: changedSettings
        })
    }
    
    executeSettings(settings, isVidRestart = false) {
        const settingsCommand = {
            action: 'settings_batch',
            settings: settings,
            timestamp: Date.now(),
			username: this.props.twitchUser.name,
			user_id: this.props.twitchUser.id,
			opaque_id: this.props.twitchUser.opaque_id
		}
		
		this.props.sendCommand(settingsCommand)
		
		if (isVidRestart) {
			this.setState(prevState => ({
				currentSettings: {
					...prevState.currentSettings,
					...settings
				},
				vidRestartCooldown: Date.now() + 300000, // 5 minutes
				showConfirmDialog: false,
				confirmSettings: null
			}))
		}
	}
    
    resetVidRestartToDefaults() {
        if (this.state.vidRestartLocked) {
            this.setState({ showEmergencyDialog: true })
            return
        }
        
        const defaultVidSettings = {}
        VID_RESTART_SETTINGS.forEach(key => {
            defaultVidSettings[key] = SETTING_DEFAULTS[key]
        })
        
        this.setState(prevState => ({
            pendingVidRestartSettings: {
                ...prevState.pendingVidRestartSettings,
                ...defaultVidSettings
            }
        }))
    }
    
    componentDidMount() {
        window.addEventListener('current-settings', this.handleCurrentSettings)
        this.requestSettingsWhenReady()
        
        // UPDATED: More frequent countdown updates for smoother display
        this.cooldownInterval = setInterval(() => {
            this.updateCountdownDisplay()
            
            // Clean up expired cooldowns
            const now = Date.now()
            const newCooldowns = { ...this.state.cooldowns }
            let changed = false
            
            Object.keys(newCooldowns).forEach(key => {
                if (newCooldowns[key] && now >= newCooldowns[key]) {
                    delete newCooldowns[key]
                    changed = true
                }
            })
            
            if (changed) {
                this.setState({ cooldowns: newCooldowns })
            }
            
            if (this.state.vidRestartCooldown && now >= this.state.vidRestartCooldown) {
                this.setState({ vidRestartCooldown: 0 })
            }
        }, 100) // Update every 100ms for smoother countdown display
    }
    
    componentWillUnmount() {
        window.removeEventListener('current-settings', this.handleCurrentSettings)
        if (this.cooldownInterval) {
            clearInterval(this.cooldownInterval)
        }
    }
    
    handleCurrentSettings(event) {
        const currentSettings = event.detail
        this.setState({
            currentSettings: { ...SETTING_DEFAULTS, ...currentSettings },
            pendingVidRestartSettings: { ...SETTING_DEFAULTS, ...currentSettings }
        })
    }
    
    requestSettingsWhenReady() {
        if (this.props.sendCommand) {
            const success = this.props.sendCommand({ action: 'get_current_settings' })
            
            if (!success) {
                setTimeout(() => this.requestSettingsWhenReady(), 1000)
            }
        }
    }
    
    isOnCooldown(key) {
        const now = Date.now()
        return this.state.cooldowns[key] && now < this.state.cooldowns[key]
    }
    
    getCooldownRemaining(key) {
        // Use the real-time countdown display instead of calculating
        return this.state.countdownDisplays[key] || 0
    }
    
    getVidRestartCooldownRemaining() {
        // Use the real-time countdown display instead of calculating
        return this.state.countdownDisplays.vidRestart || 0
    }

    render() {
        const svgSettings = <svg className="settingspanel-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" title="Toggle Settings Panel"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>
		const svgClose = <svg className="settingspanel-svg opened" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" title="Close Settings Panel"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
        
        const vidRestartCooldown = this.getVidRestartCooldownRemaining()
        const hasVidRestartChanges = VID_RESTART_SETTINGS.some(key => 
            this.state.pendingVidRestartSettings[key] !== this.state.currentSettings[key]
        )

        return (
            <div className={`settingspanel-wrap settingspanel-${this.props.appstate.isSettingsPanelOpen ? 'opened' : 'closed'}`}>
                <div className="settingspanel-button" onClick={this.props.toggleSettingsPanel}>
                    {this.props.appstate.isSettingsPanelOpen ? svgClose : svgSettings}
                </div>
                <div className="settingspanel-content-wrap">
                    <div className="settingspanel-content">
                        <div className="header-top">
                            <div className="h1">Settings Panel</div>
                            <div className="close" onClick={this.props.toggleSettingsPanel}>
                                {svgClose}
                            </div>
                        </div>

                        {/* Visual Settings - Instant Apply */}
                        <div className="settings-section">
                            <div className="section-title">Visual Settings (Instant - 5s cooldown)</div>
                            <div className="settings-grid">
								<div className="setting-item gamma-buttons">
									<div 
                                        className="setting-label" 
                                        onMouseEnter={(e) => this.showTooltip("Adjusts overall screen brightness and contrast. Higher values make dark areas brighter without affecting bright areas as much.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
                                        Gamma Correction
                                    </div>
									<div className="setting-control">
										<div className="gamma-button-group">
											{[0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6].map(value => (
												<button
													key={value}
													className={`gamma-btn ${this.state.currentSettings.gamma === value ? 'active' : ''} ${this.isOnCooldown('gamma') ? 'disabled' : ''}`}
													onClick={() => !this.isOnCooldown('gamma') && this.updateInstantSetting('gamma', value)}
													disabled={this.isOnCooldown('gamma')}
													onMouseEnter={(e) => this.showTooltip("Adjusts overall screen brightness and contrast. Higher values make dark areas brighter without affecting bright areas as much.", e)}
													onMouseLeave={this.hideTooltip}
												>
													{value}
												</button>
											))}
										</div>
										{this.isOnCooldown('gamma') && (
											<span style={{ marginLeft: '8px', fontSize: '0.8em', opacity: 0.7 }}>
												{this.getCooldownRemaining('gamma')}s
											</span>
										)}
									</div>
								</div>
                                
                                <div className="setting-item">
                                    <div 
                                        className="setting-label"
                                        onMouseEnter={(e) => this.showTooltip("Toggles sky rendering on/off. Disabling can improve performance and reduce visual distractions during runs.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
                                        Show Sky
                                    </div>
                                    <div className="setting-control">
                                        <div 
                                            className={`toggle-switch ${this.state.currentSettings.sky ? 'active' : ''} ${this.isOnCooldown('sky') ? 'disabled' : ''}`}
                                            onClick={() => !this.isOnCooldown('sky') && this.updateInstantSetting('sky', !this.state.currentSettings.sky)}
                                            style={{ opacity: this.isOnCooldown('sky') ? 0.5 : 1 }}
                                            onMouseEnter={(e) => this.showTooltip("Toggles sky rendering on/off. Disabling can improve performance and reduce visual distractions during runs.", e)}
                                            onMouseLeave={this.hideTooltip}
                                        >
                                        </div>
                                        {this.isOnCooldown('sky') && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.8em', opacity: 0.7 }}>
                                                {this.getCooldownRemaining('sky')}s
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <div 
                                        className="setting-label"
                                        onMouseEnter={(e) => this.showTooltip("Makes invisible trigger zones visible as colored outlines. Useful for learning map mechanics and jump triggers.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
                                        Show Trigger Brushes
                                    </div>
                                    <div className="setting-control">
                                        <div 
                                            className={`toggle-switch ${this.state.currentSettings.triggers ? 'active' : ''} ${this.isOnCooldown('triggers') ? 'disabled' : ''}`}
                                            onClick={() => !this.isOnCooldown('triggers') && this.updateInstantSetting('triggers', !this.state.currentSettings.triggers)}
                                            style={{ opacity: this.isOnCooldown('triggers') ? 0.5 : 1 }}
                                            onMouseEnter={(e) => this.showTooltip("Makes invisible trigger zones visible as colored outlines. Useful for learning map mechanics and jump triggers.", e)}
                                            onMouseLeave={this.hideTooltip}
                                        >
                                        </div>
                                        {this.isOnCooldown('triggers') && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.8em', opacity: 0.7 }}>
                                                {this.getCooldownRemaining('triggers')}s
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <div 
                                        className="setting-label"
                                        onMouseEnter={(e) => this.showTooltip("Shows invisible collision boundaries that block player movement. Helps understand map geometry and collision.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
                                        Show Clip Brushes
                                    </div>
                                    <div className="setting-control">
                                        <div 
                                            className={`toggle-switch ${this.state.currentSettings.clips ? 'active' : ''} ${this.isOnCooldown('clips') ? 'disabled' : ''}`}
                                            onClick={() => !this.isOnCooldown('clips') && this.updateInstantSetting('clips', !this.state.currentSettings.clips)}
                                            style={{ opacity: this.isOnCooldown('clips') ? 0.5 : 1 }}
                                            onMouseEnter={(e) => this.showTooltip("Shows invisible collision boundaries that block player movement. Helps understand map geometry and collision.", e)}
                                            onMouseLeave={this.hideTooltip}
                                        >
                                        </div>
                                        {this.isOnCooldown('clips') && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.8em', opacity: 0.7 }}>
                                                {this.getCooldownRemaining('clips')}s
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="setting-item">
                                    <div 
                                        className="setting-label"
                                        onMouseEnter={(e) => this.showTooltip("Highlights surfaces with special friction properties (ice-like or slippery areas) for better visibility.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
                                        Highlight Slick Surfaces
                                    </div>
                                    <div className="setting-control">
                                        <div 
                                            className={`toggle-switch ${this.state.currentSettings.slick ? 'active' : ''} ${this.isOnCooldown('slick') ? 'disabled' : ''}`}
                                            onClick={() => !this.isOnCooldown('slick') && this.updateInstantSetting('slick', !this.state.currentSettings.slick)}
                                            style={{ opacity: this.isOnCooldown('slick') ? 0.5 : 1 }}
                                            onMouseEnter={(e) => this.showTooltip("Highlights surfaces with special friction properties (ice-like or slippery areas) for better visibility.", e)}
                                            onMouseLeave={this.hideTooltip}
                                        >
                                        </div>
                                        {this.isOnCooldown('slick') && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.8em', opacity: 0.7 }}>
                                                {this.getCooldownRemaining('slick')}s
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* HUD/Interface Settings */}
                        <div className="settings-section">
                            <div className="section-title">HUD & Interface (Instant - 5s cooldown)</div>
                            <div className="settings-grid">
                                {[
                                    { key: 'drawgun', label: 'Weapon Movement', tooltip: 'Controls weapon bobbing/swaying animation. When disabled, weapon stays stationary for steadier aim and cleaner view.' },
                                    { key: 'angles', label: 'Weapon Angle Display', tooltip: 'Shows current weapon angles/pitch information on screen. Useful for advanced movement techniques.' },
                                    { key: 'lagometer', label: 'Connection Meter', tooltip: 'Displays network performance graph showing lag spikes and connection quality.' },
                                    { key: 'snaps', label: 'Snaps Strafe HUD', tooltip: 'Shows strafe synchronization and timing information. Helps analyze and improve strafe jumping technique.' },
                                    { key: 'cgaz', label: 'CGaz Strafe HUD', tooltip: 'Displays optimal strafe angles and acceleration zones. Essential tool for improving movement efficiency.' },
                                    { key: 'speedinfo', label: 'Speedometer via Info (CHS)', tooltip: 'Shows current speed, max speed, and other movement statistics using the CHS info system.' },
                                    { key: 'speedorig', label: 'Original Speedometer via HUD', tooltip: 'Displays speed using the original Defrag HUD element. Alternative to CHS speed info.' },
                                    { key: 'inputs', label: 'Input Display (WASD)', tooltip: 'Shows currently pressed movement keys (WASD, mouse buttons). Useful for analyzing movement patterns.' },
                                    { key: 'obs', label: 'OverBounces Indicator', tooltip: 'Displays overbounce detection and count. Helps track advanced movement techniques.' }
                                ].map(({ key, label, tooltip }) => (
                                    <div className="setting-item" key={key}>
                                        <div 
                                            className="setting-label"
                                            onMouseEnter={(e) => this.showTooltip(tooltip, e)}
                                            onMouseLeave={this.hideTooltip}
                                        >
                                            {label}
                                        </div>
                                        <div className="setting-control">
                                            <div 
                                                className={`toggle-switch ${this.state.currentSettings[key] ? 'active' : ''} ${this.isOnCooldown(key) ? 'disabled' : ''}`}
                                                onClick={() => !this.isOnCooldown(key) && this.updateInstantSetting(key, !this.state.currentSettings[key])}
                                                style={{ opacity: this.isOnCooldown(key) ? 0.5 : 1 }}
                                                onMouseEnter={(e) => this.showTooltip(tooltip, e)}
                                                onMouseLeave={this.hideTooltip}
                                            >
                                            </div>
                                            {this.isOnCooldown(key) && (
                                                <span style={{ marginLeft: '8px', fontSize: '0.8em', opacity: 0.7 }}>
                                                    {this.getCooldownRemaining(key)}s
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Gameplay Settings */}
                        <div className="settings-section">
                            <div className="section-title">Gameplay (Instant - 5s cooldown)</div>
                            <div className="settings-grid">
                                {[
                                    { key: 'nodraw', label: 'Hide Other Players', tooltip: 'Makes other players invisible to reduce visual distractions during runs. Toggle between visible and hidden.' },
                                    { key: 'thirdperson', label: 'Third Person View', tooltip: 'Switches between first-person and third-person camera perspective.' },
                                    { key: 'miniview', label: 'Miniview Window', tooltip: 'Displays a small third-person view of yourself in a corner window. Useful for seeing your character\'s movement from external perspective.' },
                                    { key: 'gibs', label: 'Gibs After Kill', tooltip: 'Shows gore effects when players are killed. Purely cosmetic setting.' },
                                    { key: 'blood', label: 'Blood Effects', tooltip: 'Enables blood particle effects when taking damage. Cosmetic setting that doesn\'t affect gameplay.' }
                                ].map(({ key, label, tooltip }) => (
                                    <div className="setting-item" key={key}>
                                        <div 
                                            className="setting-label"
                                            onMouseEnter={(e) => this.showTooltip(tooltip, e)}
                                            onMouseLeave={this.hideTooltip}
                                        >
                                            {label}
                                        </div>
                                        <div className="setting-control">
                                            <div 
                                                className={`toggle-switch ${this.state.currentSettings[key] ? 'active' : ''} ${this.isOnCooldown(key) ? 'disabled' : ''}`}
                                                onClick={() => !this.isOnCooldown(key) && this.updateInstantSetting(key, !this.state.currentSettings[key])}
                                                style={{ opacity: this.isOnCooldown(key) ? 0.5 : 1 }}
                                                onMouseEnter={(e) => this.showTooltip(tooltip, e)}
                                                onMouseLeave={this.hideTooltip}
                                            >
                                            </div>
                                            {this.isOnCooldown(key) && (
                                                <span style={{ marginLeft: '8px', fontSize: '0.8em', opacity: 0.7 }}>
                                                    {this.getCooldownRemaining(key)}s
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

						{/* Emergency Video Settings Section - AT BOTTOM */}
						<div 
							className={`settings-section vid-restart-section ${this.state.vidRestartLocked ? 'locked-section' : ''}`}
							style={{ 
								cursor: this.state.vidRestartLocked ? 'pointer' : 'default',
								position: 'relative'
							}}
						>
							{this.state.vidRestartLocked && (
								<div 
									className="emergency-unlock-overlay"
									onClick={() => this.setState({ showEmergencyDialog: true })}
									style={{
										position: 'absolute',
										top: 0,
										left: 0,
										right: 0,
										bottom: 0,
										zIndex: 5,
										backgroundColor: 'rgba(255, 152, 0, 0.05)',
										cursor: 'pointer'
									}}
								/>
							)}
							<div className="section-title">Emergency Video Settings (Requires Restart - 5min cooldown)</div>
							
							<div style={{ 
								background: 'rgba(255, 193, 7, 0.1)', 
								border: '1px solid #ff9800',
								borderRadius: '5px',
								padding: '10px',
								marginBottom: '15px',
								fontSize: '0.85rem',
								lineHeight: '1.4'
							}}>
								<strong>WARNING:</strong> These settings require video restart and should only be used as emergency measures when maps have unwatchable textures or extreme lighting that gamma correction cannot fix.
								
								{this.state.vidRestartLocked && (
									<div style={{ marginTop: '10px', color: '#ff6b6b', fontWeight: 'bold' }}>
										🔒 LOCKED: Click anywhere in this section to unlock emergency mode
									</div>
								)}
								
								{!this.state.vidRestartLocked && (
									<div style={{ marginTop: '10px', color: '#4CAF50', fontWeight: 'bold' }}>
										✅ UNLOCKED: Emergency mode active - you can now modify these settings
									</div>
								)}
							</div>
							
							{/* Apply and Reset buttons */}
							<div className="settings-actions" style={{ marginBottom: '15px' }}>
								<button 
									className={`btn btn-primary ${vidRestartCooldown > 0 || !hasVidRestartChanges || this.state.vidRestartLocked ? 'disabled' : ''}`}
									onClick={this.applyVidRestartSettings}
									disabled={vidRestartCooldown > 0 || !hasVidRestartChanges || this.state.vidRestartLocked}
									style={{ marginRight: '10px' }}
								>
									{vidRestartCooldown > 0 ? `Apply (${vidRestartCooldown}s)` : hasVidRestartChanges ? 'Apply Changes' : 'No Changes'}
								</button>
								<button 
									className={`btn btn-secondary ${this.state.vidRestartLocked ? 'disabled' : ''}`}
									onClick={this.resetVidRestartToDefaults}
									disabled={this.state.vidRestartLocked}
								>
									Reset to Defaults
								</button>
							</div>
							
							<div className="settings-grid">
								<div className="setting-item">
									<div 
                                        className="setting-label"
                                        onMouseEnter={(e) => this.showTooltip("Controls how bright the map lighting appears. Higher values make dark areas more visible but may wash out colors.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
										Map Brightness (1-5)
									</div>
									<div className="setting-control">
										<input 
											type="range" 
											min="1" 
											max="5" 
											value={this.state.pendingVidRestartSettings.brightness}
											onChange={(e) => this.updateVidRestartSetting('brightness', parseInt(e.target.value))}
											className={`range-input ${this.state.vidRestartLocked ? 'disabled' : ''}`}
											disabled={this.state.vidRestartLocked}
											onMouseEnter={(e) => this.showTooltip("Controls how bright the map lighting appears. Higher values make dark areas more visible but may wash out colors.", e)}
											onMouseLeave={this.hideTooltip}
										/>
										<span>{this.state.pendingVidRestartSettings.brightness}</span>
									</div>
								</div>
								
								<div className="setting-item">
									<div 
                                        className="setting-label"
                                        onMouseEnter={(e) => this.showTooltip("Controls texture resolution quality. 0 = highest detail, 6 = lowest detail. Lower values improve visual quality but use more memory.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
										Texture Detail (0-6)
									</div>
									<div className="setting-control">
										<input 
											type="range" 
											min="0" 
											max="6" 
											value={this.state.pendingVidRestartSettings.picmip}
											onChange={(e) => this.updateVidRestartSetting('picmip', parseInt(e.target.value))}
											className={`range-input ${this.state.vidRestartLocked ? 'disabled' : ''}`}
											disabled={this.state.vidRestartLocked}
											onMouseEnter={(e) => this.showTooltip("Controls texture resolution quality. 0 = highest detail, 6 = lowest detail. Lower values improve visual quality but use more memory.", e)}
											onMouseLeave={this.hideTooltip}
										/>
										<span>{this.state.pendingVidRestartSettings.picmip}</span>
									</div>
								</div>
								
								<div className="setting-item">
									<div 
                                        className="setting-label"
                                        onMouseEnter={(e) => this.showTooltip("Removes all shadows and lighting effects, making everything evenly lit. Useful for competitive play but removes visual atmosphere.", e)}
                                        onMouseLeave={this.hideTooltip}
                                    >
										Fullbright Mode
									</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingVidRestartSettings.fullbright ? 'active' : ''} ${this.state.vidRestartLocked ? 'disabled' : ''}`}
											onClick={() => this.updateVidRestartSetting('fullbright', !this.state.pendingVidRestartSettings.fullbright)}
											onMouseEnter={(e) => this.showTooltip("Removes all shadows and lighting effects, making everything evenly lit. Useful for competitive play but removes visual atmosphere.", e)}
											onMouseLeave={this.hideTooltip}
										>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Custom Tooltip */}
						{this.state.hoveredTooltip && (
							<div 
								className="custom-tooltip"
								style={{
									position: 'fixed',
									left: this.state.hoveredTooltip.x + 10,
									top: this.state.hoveredTooltip.y + 10,
									background: 'rgba(0, 0, 0, 0.9)',
									color: 'white',
									padding: '8px 12px',
									borderRadius: '4px',
									fontSize: '0.8rem',
									maxWidth: '200px',
									wordWrap: 'break-word',
									zIndex: 10000,
									pointerEvents: 'none',
									boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
								}}
							>
								{this.state.hoveredTooltip.text}
							</div>
						)}

						{/* Emergency Dialog */}
						{this.state.showEmergencyDialog && (
							<div className="confirmation-overlay">
								<div className="confirmation-dialog">
									<h3>🚨 Emergency Video Settings Warning</h3>
									<p><strong>THIS FEATURE IS ONLY FOR EMERGENCY USE</strong></p>
									<p>These settings should only be modified when:</p>
									<ul>
										<li>Map has textures that make the stream unwatchable</li>
										<li>Map is too dark or bright and gamma correction cannot help</li>
										<li>Extreme visual issues that affect viewer experience</li>
									</ul>
									<p><strong>Do you want to proceed with modifying these emergency settings?</strong></p>
									<div className="confirmation-buttons">
										<button 
											className="btn btn-primary" 
											onClick={this.handleEmergencyConfirm}
										>
											Yes, Continue
										</button>
										<button 
											className="btn btn-secondary" 
											onClick={this.handleEmergencyCancel}
										>
											No, Cancel
										</button>
									</div>
								</div>
							</div>
						)}

                        {/* Confirmation Dialog */}
                        {this.state.showConfirmDialog && (
                            <div className="confirmation-overlay">
                                <div className="confirmation-dialog">
                                    <h3>Video Restart Required</h3>
                                    <p>The following settings require a video restart:</p>
                                    <ul>
                                        {Object.keys(this.state.confirmSettings).map(key => (
                                            <li key={key}>
                                                {key === 'brightness' && `Map Brightness: ${this.state.confirmSettings[key]}`}
                                                {key === 'picmip' && `Texture Detail: ${this.state.confirmSettings[key]}`}
                                                {key === 'fullbright' && `Fullbright Mode: ${this.state.confirmSettings[key] ? 'On' : 'Off'}`}
                                            </li>
                                        ))}
                                    </ul>
                                    <p>This will restart the video system. Continue?</p>
                                    <div className="confirmation-buttons">
                                        <button 
                                            className="btn btn-primary" 
                                            onClick={() => this.executeSettings(this.state.confirmSettings, true)}
                                        >
                                            Yes, Apply & Restart
                                        </button>
                                        <button 
                                            className="btn btn-secondary" 
                                            onClick={() => this.setState({ showConfirmDialog: false, confirmSettings: null })}
                                        >
                                            Cancel
                                        </button>
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

export const SettingsPanel = connect(mapState, mapDispatch)(SettingsPanelBase)