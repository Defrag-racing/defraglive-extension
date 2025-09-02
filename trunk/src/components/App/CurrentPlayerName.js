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
        // Check if we're actually loading vs just no player to spectate
        if (!props.serverstate) {
            return (
                <div className="curr-player-wrap">
                    Loading...
                </div>
            )
        } else {
            // We have serverstate but no current player (standby mode)
            return (
                <div className="curr-player-wrap">
                    {/* Show nothing or a standby message */}
                </div>
            )
        }
    }
    
    return (
        <div className="curr-player-wrap">
            <Q3STR s={props.serverstate.current_player.n}/>
        </div>
    )
}

export const CurrentPlayerName = connect(mapState, mapDispatch)(CurrentPlayerNameBase)