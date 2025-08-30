import React from 'react'
import { Q3STR } from '../../partials/Quake3'

export default function Row(props) {
    if(!props.data) {
        return null
    }
        if(!props.data.content || typeof props.data.content !== 'string') {
        return null
    }
    if(props.data.content.trim() === "") {
        return null
    }

    function onDelete() {
        props.onMessageDelete(props.data.id)
    }

    let moderation = null
    if(props.canModerate) {
        moderation = <div className="mod-wrap" onClick={onDelete} title="Delete this message"><svg className="mod-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g clipRule="evenodd" fillRule="evenodd"><path d="M16 0C7.163 0 0 7.163 0 16c0 8.836 7.163 16 16 16 8.836 0 16-7.163 16-16S24.836 0 16 0zm0 30C8.268 30 2 23.732 2 16S8.268 2 16 2s14 6.268 14 14-6.268 14-14 14z"/><path d="M22.729 21.271l-5.268-5.269 5.238-5.195a.992.992 0 000-1.414 1.018 1.018 0 00-1.428 0l-5.231 5.188-5.309-5.31a1.007 1.007 0 00-1.428 0 1.015 1.015 0 000 1.432l5.301 5.302-5.331 5.287a.994.994 0 000 1.414 1.017 1.017 0 001.429 0l5.324-5.28 5.276 5.276a1.007 1.007 0 001.428 0 1.015 1.015 0 00-.001-1.431z"/></g></svg></div>
    }

    // Handle map loading errors
	if(props.data.type === 'MAP_ERROR') {
		return (
			<div className="row -map-error">
				<div className="col timestamp">
					{props.data.time}
					{moderation}
				</div>
				<div className="col message map-error-message">
					<Q3STR s={props.data.content}/>
					<div className="map-error-help">
						The server is trying to load a missing map. This may resolve automatically.
					</div>
				</div>
			</div>
		)
	}

	// Handle map countdown messages
	if(props.data.type === 'MAP_COUNTDOWN') {
		return (
			<div className="row -map-countdown">
				<div className="col timestamp">
					{props.data.time}
					{moderation}
				</div>
				<div className="col message map-countdown-message">
					<Q3STR s={props.data.content}/>
					{props.data.countdown > 0 && (
						<div className="countdown-progress">
							<div className="progress-bar" style={{width: `${(props.data.countdown/60)*100}%`}}></div>
						</div>
					)}
				</div>
			</div>
		)
	}

    switch(props.data.type) {
        case 'SAY':
            return (
                <div className="row">
                    <div className="col timestamp">
                        {props.data.time}
                        {moderation}
                    </div>
                    <div className="col player-name"><Q3STR s={props.data.author}/>:</div>
                    <div className="col message"><Q3STR s={props.data.content}/></div>
                </div>
            )
        // case 'PRINT':
        // case 'ANNOUNCE':
        // case 'RENAME':
        // case 'CONNECTED':
        // case 'DISCONNECTED':
        // case 'ENTEREDGAME':
        // case 'JOINEDSPEC':
        default:
            return (
                <div className="row -announce">
                    <div className="col timestamp">{props.data.time}</div>
                    <div className="col message"><Q3STR s={props.data.content}/></div>
                </div>
            )
    }

    return null
}

export function RowNotify(props) {
    if(!props.data) {
        return null
    }
    
    if(props.data.content === "") {
        return null
    }

    switch(props.data.type) {
        case 'SAY':
            return (
                <div className="line-wrap">
                    <div className="player-name"><Q3STR s={props.data.author}/>:</div>
                    <div className="message"><Q3STR s={props.data.content}/></div>
                </div>
            )
        // case 'PRINT':
        // case 'ANNOUNCE':
        // case 'RENAME':
        // case 'CONNECTED':
        // case 'DISCONNECTED':
        // case 'ENTEREDGAME':
        // case 'JOINEDSPEC':
        default:
            return (
                <div className="line-wrap">
                    <div className="message"><Q3STR s={props.data.content}/></div>
                </div>
            )
    }

    return null
}