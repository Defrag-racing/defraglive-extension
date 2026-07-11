import React from "react"
import ReactDOM from "react-dom"
import App from "./components/App/App"
import { Provider, connect } from "react-redux"
import { appStore, mapDispatch, mapState } from './components/App/State'
import { ErrorBoundary, installGlobalErrorHooks, debugLog } from './components/ErrorBoundary'

const AppWithState = connect(mapState, mapDispatch)(App)

installGlobalErrorHooks()
debugLog('extension 0.0.33 loaded (mobile)')

ReactDOM.render(
    <Provider store={appStore}>
        <ErrorBoundary>
            <AppWithState isMobile={true}/>
        </ErrorBoundary>
    </Provider>,
    document.getElementById("root")
)