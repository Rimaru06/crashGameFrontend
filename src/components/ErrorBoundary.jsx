import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('Error Boundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })

    // Log to external service in production
    if (import.meta.env.PROD) {
      // Here you could send to error reporting service like Sentry
      this.logErrorToService(error, errorInfo)
    }
  }

  logErrorToService = (error, errorInfo) => {
    // Implement error logging to external service
    console.log('Logging error to external service:', {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          background: 'linear-gradient(135deg, #0f0f23, #16213e)',
          color: 'white',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '40px',
            borderRadius: '15px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            <h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>
              🚨 Something went wrong
            </h1>
            <p style={{ marginBottom: '20px', color: '#ccc' }}>
              The application encountered an unexpected error. Our team has been notified.
            </p>
            
            {!import.meta.env.PROD && this.state.error && (
              <details style={{ 
                marginBottom: '20px', 
                textAlign: 'left',
                background: 'rgba(255, 0, 0, 0.1)',
                padding: '10px',
                borderRadius: '5px',
                fontSize: '0.8rem'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
                  Error Details (Development)
                </summary>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  color: '#ff9999'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(45deg, #00d4aa, #00b894)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔄 Reload Page
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(45deg, #6c5ce7, #5a67d8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🏠 Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
