import React, { useState, useEffect } from 'react'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

// Default values for each setting
const SETTING_DEFAULTS = {
    // Visual/Graphics (vid_restart required)
    brightness: 2,
    picmip: 0,
    fullbright: false,
    // Visual/Graphics (no restart)
    gamma: 1.2,  // ← Update from 1.0
    sky: false,
    triggers: false,
    clips: false,
    slick: false,
    // HUD/Interface
    drawgun: false,
    angles: false,
    lagometer: false,
    snaps: true,     // ← Update from false
    cgaz: true,      // ← Update from false
    speedinfo: true, // ← Update from false
    speedorig: false,
    inputs: true,    // ← Update from false
    obs: false,
    // Gameplay
    nodraw: false,
    thirdperson: false,
    miniview: false,
    gibs: false,     // ← Update from true
    blood: false     // ← Update from true
}

const VID_RESTART_SETTINGS = ['brightness', 'picmip', 'fullbright']

class SettingsPanelBase extends React.Component {
    constructor(props) {
        super(props)
        
        this.state = {
            isOpen: false,
            currentSettings: { ...SETTING_DEFAULTS },
            pendingSettings: { ...SETTING_DEFAULTS },
            cooldowns: {},
            vidRestartCooldown: 0,
            showConfirmDialog: false,
            confirmSettings: null,
            hasVidRestartChanges: false
        }
        
        this.sendSettingsCommand = this.sendSettingsCommand.bind(this)
        this.applySettings = this.applySettings.bind(this)
        this.resetToDefaults = this.resetToDefaults.bind(this)
        this.updateSetting = this.updateSetting.bind(this)
		this.handleCurrentSettings = this.handleCurrentSettings.bind(this)
    }
    
    updateSetting(key, value) {
        this.setState(prevState => ({
            pendingSettings: {
                ...prevState.pendingSettings,
                [key]: value
            },
            hasVidRestartChanges: VID_RESTART_SETTINGS.includes(key) || prevState.hasVidRestartChanges
        }))
    }
    
	applySettings() {
		console.log('Apply Settings clicked!')
		console.log('sendCommand prop:', this.props.sendCommand)
		
		const changedSettings = {}
		Object.keys(this.state.pendingSettings).forEach(key => {
			if (this.state.pendingSettings[key] !== this.state.currentSettings[key]) {
				changedSettings[key] = this.state.pendingSettings[key]
			}
		})

		console.log('Changed settings:', changedSettings)
		console.log('VID_RESTART_SETTINGS:', VID_RESTART_SETTINGS)
		console.log('hasVidRestart check...')

		if (Object.keys(changedSettings).length === 0) {
			console.log('No settings changed')
			return
		}
		
		const hasVidRestart = Object.keys(changedSettings).some(key => VID_RESTART_SETTINGS.includes(key))
		console.log('hasVidRestart result:', hasVidRestart)
		if (hasVidRestart) {
			this.setState({
				showConfirmDialog: true,
				confirmSettings: changedSettings
			})
		} else {
			console.log('Executing settings:', changedSettings)
			this.executeSettings(changedSettings)
		}
	}
    
	executeSettings(settings) {
		console.log('executeSettings called with:', settings) // Add this
	    // Send to websocket
	    const settingsCommand = {
		   action: 'settings_batch',
		   settings: settings,
		   timestamp: Date.now()
	    }
		console.log('Sending command:', settingsCommand) // Add this
	    this.props.sendCommand(settingsCommand)
	   
	    // Update current settings
	    this.setState(prevState => ({
			currentSettings: {
				...prevState.currentSettings,
				...settings
			},
		    hasVidRestartChanges: false,
		    showConfirmDialog: false,
		    confirmSettings: null
	    }))
	   
	    // Set cooldowns
	    const hasVidRestart = Object.keys(settings).some(key => VID_RESTART_SETTINGS.includes(key))
	    if (hasVidRestart) {
			this.setState({ vidRestartCooldown: Date.now() + 300000 }) // 5 minutes
	    }
	   
	    // Set 5s cooldown for non-vid-restart settings
	    const newCooldowns = {}
	    Object.keys(settings).forEach(key => {
		    if (!VID_RESTART_SETTINGS.includes(key)) {
				newCooldowns[key] = Date.now() + 5000
		    }
	    })
	   
	    this.setState(prevState => ({
			cooldowns: { ...prevState.cooldowns, ...newCooldowns }
	    }))
	}

	resetToDefaults() {
		this.setState({
			pendingSettings: { ...SETTING_DEFAULTS },
			hasVidRestartChanges: false
		})
	}

	sendSettingsCommand(settings) {
		this.props.sendCommand({
			action: 'settings_batch',
			settings: settings,
			timestamp: Date.now()
	    })
	}

	componentDidMount() {
		console.log('SettingsPanel componentDidMount called!');
		window.addEventListener('current-settings', this.handleCurrentSettings); // ADD THIS LINE
		this.requestSettingsWhenReady();
	}

	requestSettingsWhenReady() {
		console.log('Requesting current settings...');
		
		if (this.props.sendCommand) {
			const success = this.props.sendCommand({ action: 'get_current_settings' });
			
			if (!success) {
				console.log('WebSocket not ready, retrying in 1 second...');
				setTimeout(() => this.requestSettingsWhenReady(), 1000);
			} else {
				console.log('Successfully requested current settings');
			}
		}
	}

	componentWillUnmount() {
		window.removeEventListener('current-settings', this.handleCurrentSettings)
	}

	handleCurrentSettings(event) {
		const currentSettings = event.detail
		this.setState({
			currentSettings: { ...SETTING_DEFAULTS, ...currentSettings },
			pendingSettings: { ...SETTING_DEFAULTS, ...currentSettings }
		})
	}

	requestCurrentSettings() {
		console.log('Requesting current settings...')
		this.props.sendCommand({
			action: 'get_current_settings'
		})
	}

	render() {
	   const svgSettings = <svg className="settingspanel-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" title="Toggle Settings Panel"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>
	   const svgClose = <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>

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
					   
						{/* Visual/Graphics Settings */}
						<div className="settings-section">
							<div className="section-title">Visual & Graphics</div>
							<div className="settings-grid">
								<div className="setting-item">
									<div className="setting-label">Brightness (1-5)</div>
									<div className="setting-control">
										<input 
											type="range" 
											min="1" 
											max="5" 
											value={this.state.pendingSettings.brightness}
											onChange={(e) => this.updateSetting('brightness', parseInt(e.target.value))}
											className="range-input"
										/>
										<span>{this.state.pendingSettings.brightness}</span>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Texture Quality (0-6)</div>
									<div className="setting-control">
										<input 
											type="range" 
											min="0" 
											max="6" 
											value={this.state.pendingSettings.picmip}
											onChange={(e) => this.updateSetting('picmip', parseInt(e.target.value))}
											className="range-input"
										/>
										<span>{this.state.pendingSettings.picmip}</span>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Fullbright (0-1)</div>
									<div className="setting-control">
										<input 
											type="range" 
											min="0" 
											max="1" 
											value={this.state.pendingSettings.fullbright}
											onChange={(e) => this.updateSetting('fullbright', parseInt(e.target.value))}
											className="range-input"
										/>
										<span>{this.state.pendingSettings.fullbright}</span>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Gamma (1.0-1.6)</div>
									<div className="setting-control">
										<input 
											type="range" 
											min="1.0" 
											max="1.6" 
											step="0.1"
											value={this.state.pendingSettings.gamma}
											onChange={(e) => this.updateSetting('gamma', parseFloat(e.target.value))}
											className="range-input"
										/>
										<span>{this.state.pendingSettings.gamma}</span>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Sky Rendering</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.sky ? 'active' : ''}`}
											onClick={() => this.updateSetting('sky', !this.state.pendingSettings.sky)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Show Triggers</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.triggers ? 'active' : ''}`}
											onClick={() => this.updateSetting('triggers', !this.state.pendingSettings.triggers)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Show Clips</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.clips ? 'active' : ''}`}
											onClick={() => this.updateSetting('clips', !this.state.pendingSettings.clips)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Highlight Slick Surfaces</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.slick ? 'active' : ''}`}
											onClick={() => this.updateSetting('slick', !this.state.pendingSettings.slick)}
										>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* HUD/Interface Settings */}
						<div className="settings-section">
							<div className="section-title">HUD & Interface</div>
							<div className="settings-grid">
								<div className="setting-item">
									<div className="setting-label">Draw Gun</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.drawgun ? 'active' : ''}`}
											onClick={() => this.updateSetting('drawgun', !this.state.pendingSettings.drawgun)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Weapon Angles</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.angles ? 'active' : ''}`}
											onClick={() => this.updateSetting('angles', !this.state.pendingSettings.angles)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Lagometer</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.lagometer ? 'active' : ''}`}
											onClick={() => this.updateSetting('lagometer', !this.state.pendingSettings.lagometer)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Snaps HUD</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.snaps ? 'active' : ''}`}
											onClick={() => this.updateSetting('snaps', !this.state.pendingSettings.snaps)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">CGaz HUD</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.cgaz ? 'active' : ''}`}
											onClick={() => this.updateSetting('cgaz', !this.state.pendingSettings.cgaz)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Speed Info (CHS)</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.speedinfo ? 'active' : ''}`}
											onClick={() => this.updateSetting('speedinfo', !this.state.pendingSettings.speedinfo)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Speed HUD Element</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.speedorig ? 'active' : ''}`}
											onClick={() => this.updateSetting('speedorig', !this.state.pendingSettings.speedorig)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">WASD Inputs</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.inputs ? 'active' : ''}`}
											onClick={() => this.updateSetting('inputs', !this.state.pendingSettings.inputs)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">OverBounces Indicator</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.obs ? 'active' : ''}`}
											onClick={() => this.updateSetting('obs', !this.state.pendingSettings.obs)}
										>
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* Gameplay Settings */}
						<div className="settings-section">
							<div className="section-title">Gameplay</div>
							<div className="settings-grid">
								<div className="setting-item">
									<div className="setting-label">Players Visibility</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.nodraw ? 'active' : ''}`}
											onClick={() => this.updateSetting('nodraw', !this.state.pendingSettings.nodraw)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Third Person View</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.thirdperson ? 'active' : ''}`}
											onClick={() => this.updateSetting('thirdperson', !this.state.pendingSettings.thirdperson)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Miniview Window</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.miniview ? 'active' : ''}`}
											onClick={() => this.updateSetting('miniview', !this.state.pendingSettings.miniview)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Gibs After Kill</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.gibs ? 'active' : ''}`}
											onClick={() => this.updateSetting('gibs', !this.state.pendingSettings.gibs)}
										>
										</div>
									</div>
								</div>
								
								<div className="setting-item">
									<div className="setting-label">Blood After Kill</div>
									<div className="setting-control">
										<div 
											className={`toggle-switch ${this.state.pendingSettings.blood ? 'active' : ''}`}
											onClick={() => this.updateSetting('blood', !this.state.pendingSettings.blood)}
										>
										</div>
									</div>
								</div>
							</div>
						</div>
					   
					   <div className="settings-actions">
						   <button className="btn btn-primary" onClick={this.applySettings}>
							   Apply Settings
						   </button>
						   <button className="btn btn-secondary" onClick={this.resetToDefaults}>
							   Reset to Defaults
						   </button>
					   </div>

					   {/* Confirmation Dialog */}
					   {this.state.showConfirmDialog && (
						   <div className="confirmation-overlay">
							   <div className="confirmation-dialog">
								   <h3>Restart Required</h3>
								   <p>Some settings require a video restart. Do you want to continue?</p>
								   <div className="confirmation-buttons">
									   <button 
										   className="btn btn-primary" 
										   onClick={() => this.executeSettings(this.state.confirmSettings)}
									   >
										   Yes, Apply Settings
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