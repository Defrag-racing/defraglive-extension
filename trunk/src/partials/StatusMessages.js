import React from 'react'

export default class Message extends React.Component {
    constructor(props) {
        super(props)

        this.timeout = null

        this.state = {
            hide: false,
        }
    }

    // componentDidMount() {
    //     if(this.props.type !== 'error') {
    //         this.timeout = setTimeout(() => {
    //             this.setState({ hide: true })
    //         }, 3000)
    //     }
    // }

    // componentWillReceiveProps(newProps) {
    //     if(newProps.type !== 'error') {
    //         clearTimeout(this.timeout)
    //         this.timeout = setTimeout(() => {
    //             this.setState({ hide: true })
    //         }, 3000)
    //     }
    // }

    render() {
        return (
            <div className={`msg-wrap msg-${this.props.type}${this.state.hide ? ' -hide' : ''}`}>
                <div className="msg-message">
                <div className="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M63.562 53.463l.018-.011-29-47-.018.01A2.985 2.985 0 0032 5a2.993 2.993 0 00-2.509 1.362l-.017-.01-29 47 .017.01A2.987 2.987 0 000 55a3 3 0 003 3l.027-.003v.03h58v-.03A2.998 2.998 0 0064 55c0-.564-.165-1.086-.438-1.537zM32 52a4 4 0 110-8 4 4 0 010 8zm4-15a4 4 0 01-8 0V22a4 4 0 018 0v15z"/></svg></div>
                    {this.props.message}
                </div>
            </div>
        )
    }
}