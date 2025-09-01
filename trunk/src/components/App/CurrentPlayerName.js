import React from 'react'
import { Q3STR } from '../../partials/Quake3'
import { mapDispatch, mapState } from './State'
import { connect } from 'react-redux'

export function CurrentPlayerNameLoader(props) {
    return (
        <div>Loading...</div>
    )
}

function CurrentPlayerNameBase(props) {
    // Add safety checks
    if (!props.serverstate || !props.serverstate.current_player) {
        return (
            <div className="curr-player-wrap">
                Loading...
            </div>
        )
    }
    
    return (
        <div className="curr-player-wrap">
            {props.serverstate.current_player.n}
        </div>
    )
}

export const CurrentPlayerName = connect(mapState, mapDispatch)(CurrentPlayerNameBase)