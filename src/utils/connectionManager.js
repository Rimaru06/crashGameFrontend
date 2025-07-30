// Connection management utilities for production
export class ConnectionManager {
  constructor() {
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 1000
    this.maxReconnectDelay = 30000
    this.isOnline = navigator.onLine
    this.listeners = new Set()
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
  }

  handleOnline() {
    this.isOnline = true
    this.notifyListeners('online')
  }

  handleOffline() {
    this.isOnline = false
    this.notifyListeners('offline')
  }

  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in connection listener:', error)
      }
    })
  }

  getReconnectDelay() {
    // Exponential backoff with jitter
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    )
    return delay + Math.random() * 1000 // Add jitter
  }

  shouldReconnect() {
    return this.isOnline && this.reconnectAttempts < this.maxReconnectAttempts
  }

  incrementReconnectAttempts() {
    this.reconnectAttempts++
  }

  resetReconnectAttempts() {
    this.reconnectAttempts = 0
  }

  getConnectionInfo() {
    return {
      isOnline: this.isOnline,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      nextReconnectDelay: this.getReconnectDelay()
    }
  }
}

export const connectionManager = new ConnectionManager()
