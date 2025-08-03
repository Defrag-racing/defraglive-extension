import React from 'react'
import { Q3STR } from '../../partials/Quake3'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

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

export function PlayerListLoader(props) {
    return (
        <div style={{'color': 'red'}}>Loading...</div>
    )
}

class PlayerListBase extends React.Component {
    constructor(props) {
        super(props)

        this.state = {}

        this.spec_timeout = null

        this.toggle = this.toggle.bind(this)
        this.spectatePlayerID = this.spectatePlayerID.bind(this)
        this.spectateNext = this.spectateNext.bind(this)
    }

    componentDidMount() {
        this.props.getServerstate()
    }

    toggle() {
        this.props.getServerstate()
        this.props.togglePlayerlist()
    }

    spectatePlayerID(id) {
        if(this.props.twitchUser.role == 'guest') {
            return
        }

        if(this.spec_timeout != null) {
            return
        }

        this.spec_timeout = setTimeout(() => {
            document.querySelector('.players-table').classList.remove('loading')
            this.spec_timeout = null
        }, 5000)

        this.props.sendCommand({
            'action': 'spectate',
            'value': `id:${id}`
        })

        document.querySelector('.players-table').classList.add('loading')
    }

    spectateNext() {
        this.props.sendCommand({
            'action': 'spectate',
            'value': 'next'
        })
    }
    
    render() {
        const svgPlayers = <svg className="playerlist-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 .4C4.697.4.399 4.698.399 10A9.6 9.6 0 0 0 10 19.601c5.301 0 9.6-4.298 9.6-9.601 0-5.302-4.299-9.6-9.6-9.6zm.896 3.466c.936 0 1.211.543 1.211 1.164 0 .775-.62 1.492-1.679 1.492-.886 0-1.308-.445-1.282-1.182 0-.621.519-1.474 1.75-1.474zM8.498 15.75c-.64 0-1.107-.389-.66-2.094l.733-3.025c.127-.484.148-.678 0-.678-.191 0-1.022.334-1.512.664l-.319-.523c1.555-1.299 3.343-2.061 4.108-2.061.64 0 .746.756.427 1.92l-.84 3.18c-.149.562-.085.756.064.756.192 0 .82-.232 1.438-.719l.362.486c-1.513 1.512-3.162 2.094-3.801 2.094z"/></svg>
        const svgClose = <svg className="playerlist-svg opened" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg>
        const maxHeight = `${document.querySelector('.app-wrap').clientHeight - 220}px`
        
        return (
            <div className={`playerlist-wrap playerlist-${this.props.appstate.isPlayerlistOpen ? 'opened' : 'closed'}`}>
                <div className="playerlist-button" onClick={this.toggle}>
                    {this.props.appstate.isPlayerlistOpen ? svgClose : svgPlayers}
                </div>

                <div className="playerlist-content-wrap">
                    <div className="playerlist-content" style={{maxHeight}}>
                        <div className="header-top">
                            <div className="h1">Server Info</div>
                            <div className="close" onClick={this.toggle}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg></div>
                        </div>
                        <div className="section">
                            <div className="content">
                                <div className="">IP: <a href="https://defrag.racing/servers" target="_blank">123.123.22.22:27960</a></div>
                                <div className="">Map: <a href={`https://defrag.racing/maps/${this.props.serverstate.mapname}`} target="_blank">{this.props.serverstate.mapname}</a></div>
                                <div className="">Type: <span className="sv-type">{SV_TYPE[this.props.serverstate.defrag_gametype]}</span></div>
                                <div className="">Physics: <span className="sv-physics">{PHYSICS[this.props.serverstate.df_promode]}</span></div>
                            </div>
                        </div>
                        <div className="section">
                            <div className="header">Players</div>
                            <div className="content">
                                <table className="players-table">
                                    {/* <thead>
                                        <tr>
                                            <td>Nickname</td>
                                        </tr>
                                    </thead> */}
                                    <tbody>
                                        {Object.values(this.props.serverstate.players).map((val, idx) => {
                                            if(val.t != '0') return

                                            // Players
                                            return (
                                                <tr key={val.id}>
                                                    <td><div className="link" onClick={() => this.spectatePlayerID(val.id)}>{val.n}</div></td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                                <div className="note m-t m-b">Click on the player name to spectate that person</div>

                                <div className="header">Spectators</div>
                                <table className="players-table">
                                    {/* <thead>
                                        <tr>
                                            <td>Nickname</td>
                                        </tr>
                                    </thead> */}
                                    <tbody>
                                        {Object.values(this.props.serverstate.players).map((val, idx) => {
                                            if(val.t == '0') return

                                            // Spectators
                                            if(val.t != '0') {
                                                return (
                                                    <tr key={val.id}>
                                                        <td>{val.n}</td>
                                                    </tr>
                                                )
                                            }
                                        })}
                                    </tbody>
                                </table>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export const PlayerList = connect(mapState, mapDispatch)(PlayerListBase)