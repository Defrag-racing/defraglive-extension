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
    return (
        <div className="curr-player-wrap">
            {props.serverstate.current_player.n}
        </div>
    )
}

export const CurrentPlayerName = connect(mapState, mapDispatch)(CurrentPlayerNameBase)