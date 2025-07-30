// Production-ready logging utility
class Logger {
  constructor() {
    this.isDevelopment = !import.meta.env.PROD
    this.logLevel = import.meta.env.VITE_LOG_LEVEL || (this.isDevelopment ? 'debug' : 'error')
    this.logs = []
    this.maxLogs = 1000
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      url: window.location.href,
      userAgent: navigator.userAgent
    }

    // Store log
    this.logs.push(logEntry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // Console output in development
    if (this.isDevelopment) {
      const consoleMethod = console[level] || console.log
      consoleMethod(`[${timestamp}] ${message}`, data || '')
    }

    // Send critical errors to external service in production
    if (!this.isDevelopment && (level === 'error' || level === 'critical')) {
      this.sendToExternalService(logEntry)
    }
  }

  debug(message, data) {
    if (this.shouldLog('debug')) {
      this.log('debug', message, data)
    }
  }

  info(message, data) {
    if (this.shouldLog('info')) {
      this.log('info', message, data)
    }
  }

  warn(message, data) {
    if (this.shouldLog('warn')) {
      this.log('warn', message, data)
    }
  }

  error(message, data) {
    if (this.shouldLog('error')) {
      this.log('error', message, data)
    }
  }

  critical(message, data) {
    this.log('critical', message, data)
  }

  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error', 'critical']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  sendToExternalService(logEntry) {
    // In production, you would send this to a service like Sentry, LogRocket, etc.
    try {
      // Example: send to backend logging endpoint
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntry)
      }).catch(err => {
        console.error('Failed to send log to external service:', err)
      })
    } catch (error) {
      console.error('Error in sendToExternalService:', error)
    }
  }

  getLogs() {
    return this.logs
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2)
  }

  clearLogs() {
    this.logs = []
  }
}

export const logger = new Logger()

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('Global JavaScript Error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack
  })
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled Promise Rejection', {
    reason: event.reason,
    promise: event.promise
  })
})
