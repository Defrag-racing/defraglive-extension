import React from 'react'

// Catches any render/lifecycle crash that would otherwise unmount the whole
// overlay, shows the error on screen and auto-recovers.

const overlayStyle = {
    position: 'fixed',
    bottom: '8px',
    left: '8px',
    maxWidth: '85%',
    maxHeight: '45%',
    overflow: 'auto',
    background: 'rgba(0,0,0,0.88)',
    color: '#ff6b6b',
    font: '11px/1.4 monospace',
    padding: '8px 10px',
    zIndex: 999999,
    whiteSpace: 'pre-wrap',
    borderRadius: '4px',
    border: '1px solid #ff6b6b',
    pointerEvents: 'none',
}

// On-screen box only outside the released state (hosted test / local dev),
// so viewers of the public release never see debug output. Errors are still
// logged to the console in every state.
function isReleasedState() {
    try {
        return new URLSearchParams(window.location.search).get('state') === 'released'
    } catch (e) {
        return true
    }
}

export function debugLog(msg) {
    try {
        const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`
        console.error('[EXT-DEBUG]', line)
        if (isReleasedState()) return
        let el = document.getElementById('ext-debug-log')
        if (!el) {
            el = document.createElement('div')
            el.id = 'ext-debug-log'
            Object.assign(el.style, overlayStyle)
            document.body.appendChild(el)
        }
        el.textContent += line + '\n'
    } catch (e) { /* never break the app from the debugger itself */ }
}

export function installGlobalErrorHooks() {
    window.addEventListener('error', (e) => {
        debugLog(`window.onerror: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`)
    })
    window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason
        debugLog(`unhandledrejection: ${String(r && (r.stack || r.message || r)).slice(0, 600)}`)
    })
}

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, resetKey: 0 }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, info) {
        debugLog(
            `REACT CRASH: ${String(error && (error.stack || error.message || error)).slice(0, 800)}\n` +
            `component stack:${String(info && info.componentStack).slice(0, 600)}`
        )
        // auto-recover: remount the subtree after a short pause
        clearTimeout(this._recoverTimer)
        this._recoverTimer = setTimeout(() => {
            this.setState(s => ({ hasError: false, resetKey: s.resetKey + 1 }))
            debugLog('recovered: remounting UI')
        }, 4000)
    }

    componentWillUnmount() {
        clearTimeout(this._recoverTimer)
    }

    render() {
        if (this.state.hasError) {
            return null // debugLog overlay stays visible outside the React tree
        }
        return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>
    }
}
