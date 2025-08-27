import React from 'react'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

import Row from './Rows'
import { NotifyLines } from './NotifyLines'
import { CurrentPlayerName } from './CurrentPlayerName'
import { PlayerList } from './PlayerList'
import { ServerBrowser } from './ServerBrowser'
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
        }

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

        this.fetchMessages = this.fetchMessages.bind(this)
        this.onMessageDelete = this.onMessageDelete.bind(this)
    }

    componentWillUnmount(){
        document.removeEventListener('keypress', this.onKeyPress)
    }

    componentDidMount() {
        document.addEventListener('keypress', this.onKeyPress)

        this.initWebsocket()
        this.fetchMessages()
    }

    fetchMessages() {
        let date = new Date()

        // fetch('http://localhost:5000/console.json')
        fetch('https://tw.defrag.racing/console.json')
        .then((data) => {
            if(data.ok) {
                return data.json()
            }
            return []
        })
        .then((data) => {
            data.forEach((el) => {
                el.time = unix2time(el.timestamp)
            })
            
            this.setState({
                messages: data
            })
        })
        .catch(err => {})
    }

    initWebsocket() {
        if(this.ws != null) {
            this.ws.close(1000)
            this.ws = null
        }
        
        // this.ws = new WebSocket("ws://localhost:8443/ws")
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

        // if code == 1000 means the connection closed normally
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

    onConsoleMessage(ev) {
        let msg = JSON.parse(ev.data)

        if(msg.origin && msg.action !== 'ext_command') {
            return
        }

        if(msg.action === 'message') {
            msg.message.time = unix2time(msg.message.timestamp)
            this.appendMessage(msg.message)
            return
        }

        if(msg.action === 'serverstate') {
            this.props.updateServerstate(msg.message)
            return
        }

        if(msg.action === 'ext_command') {
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

                // Keep the scrollbar at the bottom
                this.scrollerEl.current.scrollTop = this.scrollerEl.current.scrollHeight - this.scrollerEl.current.clientHeight
            }
        }, 50)
    }

    appendMessage(new_msg) {
        this.state.messages.push(new_msg)
        this.setState({
            messages: this.state.messages
        }, () => {
            this.scrollerEl.current.scrollTop = this.scrollerEl.current.scrollHeight - this.scrollerEl.current.clientHeight
        })

        // Notifications
        if(this.state.messages_notif.length >= 3) {
            this.state.messages_notif.shift()
        }

        this.state.messages_notif.push(new_msg)
        this.setState({
            messages_notif: this.state.messages_notif //.slice(Math.max(this.state.messages_notif.length - 3, 1))
        })
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

        let new_msg = {
            'action': 'message',
            'origin': 'twitch',
            'message': {
                'author': me,
                'content': msg,
            },
        }

        if(msg.startsWith('!')) {
            if(!msg.startsWith('!login')) {
                new_msg['action'] = 'command'
                new_msg['command'] = msg
            }
        }

        let ok = this.sendWS(new_msg)
        if(!ok) {
            return false
        }

        this.inputEl.current.value = ''
        this.scrollerEl.current.scrollTop = this.scrollerEl.current.scrollHeight - this.scrollerEl.current.clientHeight

        return true
    }

    sendCommand(cmd) {
        let me = this.props.twitchUser.name
        let date = new Date()

        if(this.state.status_message !== null) {
            return false
        }

        let msg = cmd

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
    }

    sendWS(msg) {
        if(!this.ws) {
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
        // if(!this.props.appstate.isConsoleOpen) {
        //     if(key === 'KeyT') {
        //         console.log('say should open')
        //     }
        // }
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
        let svgClose = <svg className="say-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
        let canModerate = (this.props.twitchUser.role == 'broadcaster' || this.props.twitchUser.is_mod) ? true : false

        return (
            <>
                <div className="console-button" onClick={this.toggleConsole}>~</div>
                <div className="console-wrap">
                    <div className="console-content-wrap">
                        <div className="console-scroller" ref={this.scrollerEl}>
                            <div className="rows-wrap">
                                <div className="row-intro">
                                    <div className="title">Welcome to the Twitch ✕ Defrag  Interactive Console!</div>
                                    It allows you to chat directly with the players and other viewers. Have fun!<br/>
                                    <div className="meta">There is moderation in place. Viewer discretion is advised.<br/></div>
                                </div>
                                {this.state.messages.map((val) => {
                                    return <Row key={val.id} data={val} canModerate={canModerate} onMessageDelete={this.onMessageDelete} />
                                })}
                            </div>
                        </div>
                    </div>
                    <form action="send" className="console-input-wrap" onSubmit={this.onSubmit}>
                        <div className="close-console-button" onClick={this.toggleConsole}>{svgClose}</div>
                        <div className="input-element-wrap">
                            {statusMessage}
                            <input type="text" className="input" ref={this.inputEl}/>
                        </div>
                        <div className="submit-button-wrap">
                            <input type="submit" className="submit-button" value="Send"/>
                        </div>
                    </form>
                </div>
                <NotifyLines onSubmit={this.submitMessage} console={this.state}/>
                <PlayerList sendCommand={this.sendCommand} twitchUser={this.props.twitchUser}/>
                <ServerBrowser sendCommand={this.sendCommand} twitchUser={this.props.twitchUser}/>
                <CurrentPlayerName/>
            </>
        )
    }
}

export const Console = connect(mapState, mapDispatch)(ConsoleBase)