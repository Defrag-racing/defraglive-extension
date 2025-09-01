import React from 'react'
import Authentication from '../../util/Authentication/Authentication'

import { Console } from './Console'

import '../../sass/App.scss'

export default class App extends React.Component {
    constructor(props) {
        super(props)
        this.Authentication = new Authentication()

        //if the extension is running on twitch or dev rig, set the shorthand here. otherwise, set to null. 
        this.twitch = window.Twitch ? window.Twitch.ext : null

        this.state = {
            finishedLoading: false,
            isVisible: true,
            theme: 'light',
            arePlayerControlsVisible: false,

            twitchUser: {
                'id': null,
                'opaque_id': null,
                'name': 'Guest',
                'avatar': false,
                'role': 'viewer',
                'is_mod': false,
            },
        }

        this.getTwitchUser = this.getTwitchUser.bind(this)
    }

    contextUpdate(context, delta) {
        if(delta.includes('theme')) {
            this.setState(() => {
                return { theme: context.theme }
            })
        } else if(delta.includes('arePlayerControlsVisible')) {
            this.setState(() => {
                return { arePlayerControlsVisible: context.arePlayerControlsVisible }
            })
        }
    }

    visibilityChanged(isVisible) {
        this.setState(() => {
            return { isVisible }
        })
    }

    // auth obj = {channelId, clientId, token, userId}
    getTwitchUser(auth) {
        let twitchUser = this.state.twitchUser
        twitchUser.opaque_id = this.Authentication.getOpaqueId()

        if(this.Authentication.isLoggedIn()) {
            if(this.Authentication.hasSharedId()) {
                fetch(`https://api.twitch.tv/helix/users?id=${this.Authentication.getUserId()}`, {
                headers: {
                    'Client-ID': auth.clientId,
                    'Authorization': `Extension ${auth.helixToken}`,
                    // 'Accept': 'application/vnd.twitchtv.v5+json',
                }
                })
                .then(response => response.json())
                .then(data => {
                    twitchUser.id = this.Authentication.getUserId()

                    twitchUser.name = `User_${twitchUser.opaque_id.substring(1, 6)}`
                    if(data.data) {
                        if(data.data.length > 0) {
                            let user = data.data[0]
                            twitchUser.name = user.display_name
                            twitchUser.avatar = user.profile_image_url
                        }
                    }

                    twitchUser.role = this.Authentication.getRole()
                    twitchUser.is_mod = this.Authentication.isModerator()

                    this.setState({twitchUser})
                })
            } else {
                twitchUser.id = auth.userId
                twitchUser.name = `User_${twitchUser.opaque_id.substring(1, 6)}`
                twitchUser.role = this.Authentication.getRole()
                twitchUser.is_mod = this.Authentication.isModerator()
                this.setState({twitchUser})
            }

            return
        }

        twitchUser.role = 'guest'
        twitchUser.is_mod = false
        twitchUser.name = `Guest_${twitchUser.opaque_id.substring(1, 6)}`
        this.setState({twitchUser})
    }

    // ------

    componentDidMount(){
        if(this.twitch){
            this.twitch.onAuthorized((auth) => {
                this.Authentication.setToken(auth.token, auth.userId)
                
                if(!this.state.finishedLoading) {
                    // if the component hasn't finished loading (as in we've not set up after getting a token)
                    // let's set it up now.
                    this.getTwitchUser(auth)

                    // now we've done the setup for the component 
                    // let's set the state to true to force a rerender with the correct data.
                    this.setState(() => {
                        return { finishedLoading: true }
                    })
                }
            })

            this.twitch.onVisibilityChanged((isVisible, _c) => {
                this.visibilityChanged(isVisible)
            })

            this.twitch.onContext((context, delta) => {
                this.contextUpdate(context, delta)
            })
        }
    }

render(){
    if(this.state.finishedLoading && this.state.isVisible) {
        return (
            <div className={`app-wrap isMobile-${this.props.isMobile} theme-${this.state.theme} console-${this.props.appstate.isConsoleOpen ? 'opened' : 'closed'} notify-${this.props.appstate.isNotifyOpen ? 'opened' : 'closed'} playerlist-${this.props.appstate.isPlayerlistOpen ? 'opened' : 'closed'} serverbrowser-${this.props.appstate.isServerBrowserOpen ? 'opened' : 'closed'} settingspanel-${this.props.appstate.isSettingsPanelOpen ? 'opened' : 'closed'} controls-${this.state.arePlayerControlsVisible ? 'visible' : 'hidden'}`}>
                <Console twitchUser={this.state.twitchUser}/>
            </div>
        )
    } else {
        return (
            <div className="app-wrap"></div>
        )
    }
}
}