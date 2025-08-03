import React from "react"
import ReactDOM from "react-dom"
import App from "./components/App/App"
import { Provider, connect } from "react-redux"
import { appStore, mapDispatch, mapState } from './components/App/State'

const AppWithState = connect(mapState, mapDispatch)(App)

ReactDOM.render(
    <Provider store={appStore}>
        <AppWithState isMobile={true}/>
    </Provider>,
    document.getElementById("root")
)