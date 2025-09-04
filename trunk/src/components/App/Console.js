import React from 'react'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

import Row from './Rows'
import { NotifyLines } from './NotifyLines'
import { CurrentPlayerName } from './CurrentPlayerName'
import { PlayerList } from './PlayerList'
import { ServerBrowser } from './ServerBrowser'
import { SettingsPanel } from './SettingsPanel'
import { unix2time } from '../../util/DateTime'
import Message from '../../partials/StatusMessages'

class ConsoleBase extends React.Component {
    constructor(props) {
        super(props)

        // websocket server
        this.ws = null
        this.ws_reconn_interval = null
        
        this.state = {
            // format {type: 'info|success|warning|error', 'message': '<string>'}
            status_message: null,
            messages: [],
            messages_notif: [],
            scrolledUp: false,
            newMessages: 0,
            fontSize: 'normal' // 'small', 'normal', 'large'
        }

        // Viewer tracking
        this.recentViewers = new Map() // Map of username -> {username, lastSeen, interactions}
        this.viewerTrackingInterval = null

        // input element ref
        this.inputEl = React.createRef()
        this.scrollerEl = React.createRef()

        this.toggleConsole = this.toggleConsole.bind(this)
        this.onKeyPress = this.onKeyPress.bind(this)
        this.submitMessage = this.submitMessage.bind(this)
        this.sendCommand = this.sendCommand.bind(this)
        this.onSubmit = this.onSubmit.bind(this)

        this.initWebsocket = this.initWebsocket.bind(this)
        this.onConsoleMessage = this.onConsoleMessage.bind(this)
        this.onConnect = this.onConnect.bind(this)
        this.onDisconnect = this.onDisconnect.bind(this)
        this.onError = this.onError.bind(this)
        this.appendMessage = this.appendMessage.bind(this)
        this.handleScroll = this.handleScroll.bind(this)

        this.fetchMessages = this.fetchMessages.bind(this)
        this.onMessageDelete = this.onMessageDelete.bind(this)
        this.sendWS = this.sendWS.bind(this)
        
        // Font size methods
        this.increaseFontSize = this.increaseFontSize.bind(this)
        this.decreaseFontSize = this.decreaseFontSize.bind(this)
        this.sendTranslationRequest = this.sendTranslationRequest.bind(this)

        // Viewer list methods
        this.trackViewer = this.trackViewer.bind(this)
        this.sendViewerList = this.sendViewerList.bind(this)
        this.getRecentViewers = this.getRecentViewers.bind(this)
        this.splitViewerList = this.splitViewerList.bind(this)
        this.cleanOldViewers = this.cleanOldViewers.bind(this)

        // NEW: Settings logging method
        this.logSettingsChange = this.logSettingsChange.bind(this)
    }

    // Viewer tracking methods
    trackViewer(username, interactionType = 'chat') {
        if (!username || username === 'Guest' || username.startsWith('Guest_')) {
            return
        }

        const now = Date.now()
        const existing = this.recentViewers.get(username) || {
            username: username,
            firstSeen: now,
            lastSeen: now,
            interactions: 0
        }

        existing.lastSeen = now
        existing.interactions += 1

        this.recentViewers.set(username, existing)
        
        console.log(`Tracked viewer: ${username} (${interactionType}) - Total interactions: ${existing.interactions}`)
    }

    cleanOldViewers() {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
        let cleanedCount = 0
        
        for (const [username, viewer] of this.recentViewers.entries()) {
            if (viewer.lastSeen < tenMinutesAgo) {
                this.recentViewers.delete(username)
                cleanedCount++
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`Cleaned ${cleanedCount} old viewers from tracking`)
        }
    }

    getRecentViewers() {
        // Get tracked viewers (sorted by most recent activity)
        const trackedViewers = Array.from(this.recentViewers.values())
            .sort((a, b) => b.lastSeen - a.lastSeen)
            .map(v => v.username)

        // Add users from recent chat messages (last 30 messages)
        const chatViewers = []
        this.state.messages.slice(-30).forEach(msg => {
            if (msg.author && 
                !msg.author.startsWith('Guest_') && 
                msg.author !== 'Guest' &&
                !trackedViewers.includes(msg.author) &&
                !chatViewers.includes(msg.author)) {
                chatViewers.push(msg.author)
            }
        })

        // Combine tracked viewers (priority) with chat viewers
        const allViewers = [...trackedViewers, ...chatViewers]

        // Add current user if logged in and not already included
        if (this.props.twitchUser.name && 
            !this.props.twitchUser.name.startsWith('Guest_') &&
            !allViewers.includes(this.props.twitchUser.name)) {
            allViewers.unshift(this.props.twitchUser.name) // Add at beginning
        }

        // Return first 20 viewers to prevent spam
        return allViewers.slice(0, 20)
    }

    splitViewerList(viewers, maxLength) {
        if (viewers.length === 0) {
            return ['No recent viewers to display.']
        }

        const chunks = []
        let currentChunk = `Recent viewers (${viewers.length}): `
        
        viewers.forEach((viewer, index) => {
            const viewerText = `^3${viewer}`
            const separator = index === viewers.length - 1 ? '' : '^7, '
            const addition = viewerText + separator
            
            // Check if adding this viewer would exceed the limit
            if (currentChunk.length + addition.length > maxLength) {
                chunks.push(currentChunk.trimEnd())
                currentChunk = `^7...continuing: ${viewerText}${separator}`
            } else {
                currentChunk += addition
            }
        })
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trimEnd())
        }
        
        return chunks
    }

    sendViewerList() {
        const viewers = this.getRecentViewers()
        
        console.log(`Sending viewer list: ${viewers.length} viewers found`)
        console.log('Viewers:', viewers)
        
        // Split into chunks that fit within Quake 3's message limits
        const maxLength = 80 // Conservative limit for color codes
        const chunks = this.splitViewerList(viewers, maxLength)
        
        // Send command to display viewer list via bridge
        const success = this.sendCommand({
            action: 'show_viewers',
            viewers: viewers,
            chunks: chunks,
            total_count: viewers.length
        })
        
        if (success) {
            console.log(`Successfully sent ${chunks.length} viewer chunks to bridge`)
            chunks.forEach((chunk, i) => console.log(`Chunk ${i + 1}: ${chunk}`))
        } else {
            console.error('Failed to send viewer list command')
        }
    }

    increaseFontSize() {
        if (this.state.fontSize === 'small') {
            this.setState({ fontSize: 'normal' })
        } else if (this.state.fontSize === 'normal') {
            this.setState({ fontSize: 'large' })
        }
    }

    decreaseFontSize() {
        if (this.state.fontSize === 'large') {
            this.setState({ fontSize: 'normal' })
        } else if (this.state.fontSize === 'normal') {
            this.setState({ fontSize: 'small' })
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keypress', this.onKeyPress)
        
        if (this.viewerTrackingInterval) {
            clearInterval(this.viewerTrackingInterval)
        }
    }

    componentDidMount() {
        document.addEventListener('keypress', this.onKeyPress)

        window.sendTranslationRequest = this.sendTranslationRequest;

        this.initWebsocket()
        this.fetchMessages()
        
        // Start viewer tracking cleanup interval
        this.viewerTrackingInterval = setInterval(() => {
            this.cleanOldViewers()
        }, 60000) // Clean old viewers every minute
        
        // Track current user immediately if logged in
        if (this.props.twitchUser.name) {
            this.trackViewer(this.props.twitchUser.name, 'extension_load')
        }
    }

    sendTranslationRequest(cacheKey, text, messageId) {
        if (!this.ws || this.ws.readyState !== 1) {
            return false;
        }

        const translationMessage = {
            'action': 'ext_command',
            'origin': 'twitch',
            'message': {
                'content': {
                    'action': 'translate_message',
                    'cache_key': cacheKey,
                    'text': text,
                    'message_id': messageId
                }
            }
        };

        try {
            this.ws.send(JSON.stringify(translationMessage));
            return true;
        } catch (error) {
            return false;
        }
    }

    fetchMessages() {
        fetch('https://tw.defrag.racing/console.json')
        .then((data) => {
            if(data.ok) {
                return data.json()
            }
            return []
        })
        .then((data) => {
            const messages = []
            data.forEach((el) => {
                // Extract the actual message from the wrapper
                if (el.action === 'message' && el.message) {
                    const message = el.message
                    if (message.timestamp) {
                        message.time = unix2time(message.timestamp)
                    }
                    messages.push(message)
                    
                    // Track viewer from historical messages
                    if (message.author) {
                        this.trackViewer(message.author, 'historical_chat')
                    }
                }
            })
            
            this.setState({
                messages: messages
            })
        })
        .catch(err => {})
    }

    initWebsocket() {
        if(this.ws != null) {
            this.ws.close(1000)
            this.ws = null
        }
        
        this.ws = new WebSocket("wss://tw.defrag.racing/ws")
        this.ws.onmessage = this.onConsoleMessage
        this.ws.onerror = this.onError
        this.ws.onopen = this.onConnect
        this.ws.onclose = this.onDisconnect

        this.setState({
            status_message: {
                'type': 'info',
                'message': 'Connecting...',
            }
        })
    }

    onConnect() {
        clearInterval(this.ws_reconn_interval)
        this.setState({status_message: null})
    }

    onDisconnect(ev) {
        clearInterval(this.ws_reconn_interval)

        if(ev.code != 1000) {
            if(!navigator.onLine) {
                this.setState({
                    status_message: {
                        'type': 'error',
                        'message': 'You are offline. Please connect to the internet and try again.',
                    }
                })
                return
            }

            if(this.ws && this.ws.readyState == 3) {
                this.setState({
                    status_message: {
                        'type': 'error',
                        'message': 'Error: Connection closed abnormally. Reconnecting...',
                    }
                }, () => {
                    this.ws_reconn_interval = setInterval(() => {
                        this.initWebsocket()
                    }, 4000)
                })
                return
            }
        } else {
            this.setState({
                status_message: {
                    'type': 'warning',
                    'message': 'Disconnected.',
                }
            }, () => {
                this.ws_reconn_interval = setInterval(() => {
                    this.initWebsocket()
                }, 4000)
            })
        }
    }

    onError(ev) {
        clearInterval(this.ws_reconn_interval)

        if(this.ws) {
            if(this.ws.readyState == 3) {
                this.setState({
                    status_message: {
                        'type': 'error',
                        'message': 'Error: Connection closed abnormally. Reconnecting...',
                    }
                }, () => {
                    this.ws_reconn_interval = setInterval(() => {
                        this.initWebsocket()
                    }, 4000)
                })
                return
            }
        }

        this.setState({
            status_message: {
                'type': 'error',
                'message': 'Error: ' + (ev.data ? ev.data : 'Unknown'),
            }
        })
    }

    // NEW: Method to format settings changes for logging
    logSettingsChange(settings, username) {
        // Create a human-readable description of the changes
        const settingNames = {
            'brightness': 'Brightness',
            'picmip': 'Texture Quality', 
            'fullbright': 'Fullbright',
            'gamma': 'Gamma',
            'sky': 'Sky Rendering',
            'triggers': 'Show Triggers',
            'clips': 'Show Clips', 
            'slick': 'Highlight Slick Surfaces',
            'drawgun': 'Draw Gun',
            'angles': 'Weapon Angles',
            'lagometer': 'Lagometer',
            'snaps': 'Snaps HUD',
            'cgaz': 'CGaz HUD',
            'speedinfo': 'Speed Info (CHS)',
            'speedorig': 'Speed HUD Element',
            'inputs': 'WASD Inputs',
            'obs': 'OverBounces Indicator',
            'nodraw': 'Players Visibility',
            'thirdperson': 'Third Person View',
            'miniview': 'Miniview Window',
            'gibs': 'Gibs After Kill',
            'blood': 'Blood After Kill'
        }

        const changes = Object.entries(settings).map(([key, value]) => {
            const displayName = settingNames[key] || key
            let displayValue = value
            
            // Format boolean values
            if (typeof value === 'boolean') {
                displayValue = value ? 'ON' : 'OFF'
            }
            
            return `${displayName}: ${displayValue}`
        }).join(', ')

        // Create the log message
        const logMessage = {
            id: Date.now() + Math.random(), // Unique ID
            type: 'SETTINGS_CHANGE',
            author: null, // No specific author for system messages
            content: `${username} changed settings: ${changes}`,
            timestamp: Date.now() / 1000,
            time: unix2time(Date.now() / 1000),
            isSettingsLog: true // Flag to style it differently if needed
        }

        // Add to console messages
        this.appendMessage(logMessage)

        // Also log to browser console for debugging
        console.log(`[SETTINGS CHANGE] ${username} changed:`, settings)
    }

	onConsoleMessage(ev) {
		let msg = JSON.parse(ev.data)

		if(msg.origin && msg.action !== 'ext_command') {
			return
		}

		if(msg.action === 'translation_result') {
			const { cache_key, translation } = msg;
			
			window.dispatchEvent(new CustomEvent('websocket-translation', { 
				detail: { cacheKey: cache_key, translation: translation } 
			}));
			return;
		}

		// Enhanced settings_applied handler with logging
		if(msg.action === 'settings_applied') {
			// Extract settings and username from the message
			const settings = msg.settings || {}
			// TRY MULTIPLE SOURCES FOR USERNAME:
			const username = msg.username || msg.user || msg.user_name || 
							this.props.twitchUser.name || 'Unknown User'
			
			// Track viewer who changed settings
			this.trackViewer(username, 'settings_change')
			
			// Log the settings change to console
			this.logSettingsChange(settings, username)
			
			// Broadcast current settings to all connected viewers
			// This will update the UI for everyone when someone changes settings
			return
		}

		if(msg.action === 'current_settings') {
			// Receive current settings from server and update SettingsPanel
			window.dispatchEvent(new CustomEvent('current-settings', { 
				detail: msg.settings 
			}));
			return
		}

		if(msg.action === 'message') {
			msg.message.time = unix2time(msg.message.timestamp)
			this.appendMessage(msg.message)
			return
		}

		// Add this new handler for map loading errors
		if(msg.action === 'map_load_error') {
			msg.message.time = unix2time(msg.message.timestamp)
			msg.message.isMapError = true
			this.appendMessage(msg.message)
			return
		}

		// Add this new handler for map countdown messages
		if(msg.action === 'map_countdown') {
			msg.message.time = unix2time(msg.message.timestamp)
			msg.message.isMapCountdown = true
			this.appendMessage(msg.message)
			return
		}

		if(msg.action === 'serverstate') {
			this.props.updateServerstate(msg.message)
			return
		}

		if(msg.action === 'ext_command') {
			// Track viewer activity from extension commands
			if(msg.message && msg.message.author) {
				this.trackViewer(msg.message.author, 'ext_command')
			}
			
			if(msg.message.content.action === 'delete_message') {
				let id = msg.message.content.id

				for(let i = 0; i < this.state.messages.length; i++) {
					if(this.state.messages[i].id == id) {
						this.state.messages.splice(i, 1)
						break
					}
				}

				this.setState({
					messages: this.state.messages
				})
			}
		}
	}

    toggleConsole(e) {
        this.props.toggleConsole()

        setTimeout(() => {
            if(this.props.appstate.isConsoleOpen) {
                // Focus on the input
                this.inputEl.current.focus()

                // Keep the scrollbar at the bottom if not scrolled up
                if (this.scrollerEl.current && !this.state.scrolledUp) {
                    this.scrollerEl.current.scrollTop = this.scrollerEl.current.scrollHeight - this.scrollerEl.current.clientHeight
                }
            }
        }, 50)
    }

    appendMessage(new_msg) {
        new_msg.timestamp = new_msg.timestamp || (new Date().getTime() / 1000)
        new_msg.time = new_msg.time || unix2time(new_msg.timestamp)
        
        if(new_msg.type === 'SAY' && !new_msg.author) {
            new_msg.author = this.props.serverstate.current_player.n
        }

        // Track viewer from chat messages
        if (new_msg.author && new_msg.type === 'SAY') {
            this.trackViewer(new_msg.author, 'chat_message')
        }

        this.setState(prevState => {
            const updatedMessages = [...prevState.messages, new_msg]
            const updatedNotif = new_msg.type === 'SAY' ? [...prevState.messages_notif, new_msg] : prevState.messages_notif
            if (prevState.scrolledUp) {
                return {
                    messages: updatedMessages,
                    messages_notif: updatedNotif,
                    newMessages: prevState.newMessages + 1
                }
            }
            return {
                messages: updatedMessages,
                messages_notif: updatedNotif.length > 3 ? updatedNotif.slice(-3) : updatedNotif
            }
        }, () => {
            if (this.scrollerEl.current && !this.state.scrolledUp) {
                this.scrollerEl.current.scrollTop = this.scrollerEl.current.scrollHeight
            }
        })
    }

    handleScroll() {
        if (!this.scrollerEl.current) return
        const { scrollTop, scrollHeight, clientHeight } = this.scrollerEl.current
        const isScrolledUp = scrollHeight > clientHeight && scrollTop + clientHeight < scrollHeight - 10
        this.setState(prevState => ({
            scrolledUp: isScrolledUp,
            newMessages: isScrolledUp ? prevState.newMessages : 0
        }))
    }

    submitMessage(e, inputEl) {
        let me = this.props.twitchUser.name
        let msg = inputEl ? inputEl.value.trim() : this.inputEl.current.value.trim()
        let date = new Date()

        if(this.state.status_message !== null) {
            return false
        }

        if(msg === '') {
            this.setState({
                status_message: {
                    'type': 'warning',
                    'message': 'Your message cannot be blank',
                }
            }, () => {
                setTimeout(() => {
                    this.setState({status_message: null})
                }, 2000);
            })
            return false
        }

        if(/[^A-Za-z0-9\|!@#$\^&*\(\)_\-=\+\[\]{}\<\>\.,\?'": ]+/.test(msg)) {
            this.setState({
                status_message: {
                    'type': 'warning',
                    'message': 'Please use only alphanumeric characters',
                }
            }, () => {
                setTimeout(() => {
                    this.setState({status_message: null})
                }, 2000);
            })
            return false
        }

        // Track viewer activity from chat
        this.trackViewer(me, 'chat_submit')

        let new_msg = {
            'action': 'message',
            'origin': 'twitch',
            'message': {
                'author': me,
                'content': msg,
            },
        }

        // Handle ingame commands (starting with !)
        if(msg.startsWith('!')) {
            // Check for semicolon (always blocked)
            if(msg.includes(';')) {
                this.setState({
                    status_message: {
                        'type': 'warning',
                        'message': 'Semicolons are not allowed in commands',
                    }
                }, () => {
                    setTimeout(() => {
                        this.setState({status_message: null})
                    }, 2000);
                })
                return false
            }
            
            // Check for "show" as a separate word
            const words = msg.toLowerCase().split(' ');
            if(words.includes('show')) {
                this.setState({
                    status_message: {
                        'type': 'warning',
                        'message': 'Commands with "show" are not allowed',
                    }
                }, () => {
                    setTimeout(() => {
                        this.setState({status_message: null})
                    }, 2000);
                })
                return false
            }
            
            // Only allow !top commands (with or without parameters)
            if(msg.startsWith('!top')) {
                // Send the command without username prefix
                new_msg.message.content = msg;
                new_msg.message.author = null;
                
                // Send the command
                let ok = this.sendWS(new_msg)
                if(!ok) {
                    return false
                }
            } else {
                // Block any other ! commands
                this.setState({
                    status_message: {
                        'type': 'warning',
                        'message': 'Only !top commands are allowed',
                    }
                }, () => {
                    setTimeout(() => {
                        this.setState({status_message: null})
                    }, 2000);
                })
                return false
            }

        } else {
            // Handle regular chat messages
            // Regular messages get sent with the author name as usual
            let ok = this.sendWS(new_msg)
            if(!ok) {
                return false
            }
        }

        if (inputEl) inputEl.value = ''
        else this.inputEl.current.value = ''
        if (this.scrollerEl.current && !this.state.scrolledUp) {
            this.scrollerEl.current.scrollTop = this.scrollerEl.current.scrollHeight
        }

        return true
    }

    sendCommand(cmd) {
        let me = this.props.twitchUser.name
        let date = new Date()

        if(this.state.status_message !== null) {
            return false
        }

        let msg = cmd

        // Track viewer activity from commands
        this.trackViewer(me, 'send_command')

        let new_msg = {
            'action': 'ext_command',
            'origin': 'twitch',
            'message': {
                'author': me,
                'content': msg,
            },
        }

		let ok = this.sendWS(new_msg)
		if(!ok) {
			return false
		}

		return true
	}

	sendWS(msg) {
		
		if(!this.ws) {
			console.log('No WebSocket connection')
			return false
		}

		let states = ['connecting', 'open', 'closing', 'closed']
		if(this.ws.readyState !== 1) {
			this.setState({
				status_message: {
					'type': 'error',
					'message': `The connection is ${states[this.ws.readyState]}. Reconnecting...`,
				}
			}, () => {
				this.ws_reconn_interval = setInterval(() => {
					this.initWebsocket()
				}, 4000)
			})
			return false
		}

		this.ws.send(JSON.stringify(msg))
		return true
	}

    onSubmit(e) {
        e.preventDefault()

        if(!this.props.appstate.isConsoleOpen) {
            return
        }

        this.submitMessage()
        return
    }

    onKeyPress(e) {
        // '~' [key] = 'Backquote' [code]
        let key = e.code

        if(key === 'Backquote') {
            e.preventDefault()
            this.toggleConsole()
            return
        }

        // Send a new console message (if the input element is focused)
        if(this.props.appstate.isConsoleOpen) {
            if(key === 'Enter' || key === 'NumpadEnter') {
                e.preventDefault()
                this.onSubmit(e)
                return
            }
        }
        return true
    }

    onMessageDelete(id) {
        if(!id) return

        let ok = this.sendCommand({
            'action': 'delete_message',
            'id': id,
        })
        if(!ok) {
            return false
        }

        return true
    }

render() {
    let statusMessage = this.state.status_message !== null ? <Message type={this.state.status_message.type} message={this.state.status_message.message}/> : null
    let svgClose = <svg className="say-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" title="Close Console"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
    let canModerate = (this.props.twitchUser.role == 'broadcaster' || this.props.twitchUser.is_mod) ? true : false

    // Get current viewer count for display
    const currentViewerCount = this.recentViewers.size
    const totalTrackedViewers = this.getRecentViewers().length

    return (
			<>
				<div className="console-button" onClick={this.toggleConsole}>~</div>
				<div className={`console-wrap console-${this.props.appstate.isConsoleOpen ? 'opened' : 'closed'} font-${this.state.fontSize}`}>
					<div className="console-content-wrap">
						<div className="console-scroller" ref={this.scrollerEl} onScroll={this.handleScroll}>
							<div className="rows-wrap">
								<div className="row-intro">
									<div className="title">Welcome to the Twitch × Defrag Interactive Console!</div>
									It allows you to chat directly with the players and other viewers. Have fun!<br/>
									<div className="meta">There is moderation in place. Viewer discretion is advised.<br/></div>
								</div>
								{this.state.messages.map((val) => {
									return <Row key={val.id} data={val} canModerate={canModerate} onMessageDelete={this.onMessageDelete} />
								})}
								{this.state.newMessages > 0 && (
									<div className="new-message-popup">
										New messages ({this.state.newMessages}) - Scroll down to view
									</div>
								)}
							</div>
						</div>
					</div>
					<form action="send" className="console-input-wrap" onSubmit={this.onSubmit}>
						<div className="close-console-button" onClick={this.toggleConsole} title="Close Console">{svgClose}</div>
						<div className="input-element-wrap">
							{statusMessage}
							<input type="text" className="input" ref={this.inputEl} title="Type your message here" />
						</div>
						
						{/* Font size controls between input and send button */}
						<div className="font-size-controls-input">
							{this.state.fontSize !== 'small' && (
								<button 
									type="button"
									className="font-size-btn decrease" 
									onClick={this.decreaseFontSize}
									title="Decrease font size"
								>
									A⁻
								</button>
							)}
							{this.state.fontSize !== 'large' && (
								<button 
									type="button"
									className="font-size-btn increase" 
									onClick={this.increaseFontSize}
									title="Increase font size"
								>
									A⁺
								</button>
							)}
						</div>
						
						{/* Viewer list button */}
						<div className="viewer-controls">
							<button 
								type="button"
								className="viewer-list-btn" 
								onClick={this.sendViewerList}
								title={`Show recent Twitch viewers in game (${totalTrackedViewers} found)`}
								disabled={this.props.twitchUser.role === 'guest'}
							>
								👥 Show Viewers
							</button>
							{currentViewerCount > 0 && (
								<span className="viewer-count-badge" title={`${currentViewerCount} actively tracked viewers`}>
									{currentViewerCount}
								</span>
							)}
						</div>
						
						<div className="submit-button-wrap">
							<input type="submit" className="submit-button" value="Send" title="Send Message" />
						</div>
					</form>
				</div>
				<NotifyLines onSubmit={this.submitMessage} console={this.state}/>
				<PlayerList sendCommand={this.sendCommand} twitchUser={this.props.twitchUser}/>
				<ServerBrowser sendCommand={this.sendCommand} twitchUser={this.props.twitchUser}/>
				<SettingsPanel sendCommand={this.sendCommand} twitchUser={this.props.twitchUser}/>
				<CurrentPlayerName/>
			</>
		)
	}
}
export const Console = connect(mapState, mapDispatch)(ConsoleBase)