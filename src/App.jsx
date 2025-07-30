import React, { useState, useEffect, useRef } from 'react'
import './App.css'

import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import LoadingSpinner from './components/LoadingSpinner.jsx'
import { connectionManager } from './utils/connectionManager.js'
import { logger } from './utils/logger.js'

// Environment-based configuration
const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 
  (import.meta.env.PROD ? 'wss://crashgamebackend-wzba.onrender.com' : 'ws://localhost:3000')

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? 'https://crashgamebackend-wzba.onrender.com/api' : 'http://localhost:3000/api')

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || (import.meta.env.PROD ? 'production' : 'development')


function App() {
  const [gameState, setGameState] = useState({
    phase: 'waiting',
    multiplier: 1.00,
    timeLeft: 0,
    currentRound: 0
  })
  
  const [playerState, setPlayerState] = useState({
    sessionId: null,
    playerName: '',
    balance: 1000,
    currentBet: null,
    hasActiveBet: false
  })
  
  const [betAmount, setBetAmount] = useState(10)
  const [selectedCrypto, setSelectedCrypto] = useState('bitcoin')
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [showNameModal, setShowNameModal] = useState(true)
  const [messages, setMessages] = useState([])
  const [isPlacingBet, setIsPlacingBet] = useState(false)
  const [isCashingOut, setIsCashingOut] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [networkStatus, setNetworkStatus] = useState('online')
  
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const cryptocurrencies = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA' }
  ]

  const addMessage = (msg) => {
    const timestamp = new Date().toLocaleTimeString()
    const fullMessage = `[${timestamp}] ${msg}`
    setMessages(prev => [...prev.slice(-50), fullMessage])
    logger.info('Game Message', { message: msg })
  }

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    logger.info('Attempting WebSocket connection', { url: WEBSOCKET_URL })
    
    try {
      wsRef.current = new WebSocket(WEBSOCKET_URL)
    } catch (error) {
      logger.error('Failed to create WebSocket', { error: error.message })
      setConnectionStatus('disconnected')
      scheduleReconnect()
      return
    }

    wsRef.current.onopen = () => {
      logger.info('WebSocket connected successfully')
      setConnectionStatus('connected')
      setIsInitialLoading(false)
      connectionManager.resetReconnectAttempts()
      addMessage('🟢 Connected to game server')
      
      if (playerState.playerName) {
        wsRef.current.send(JSON.stringify({
          type: 'set_player_name',
          data: { playerName: playerState.playerName }
        }))
      }
    }

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleWebSocketMessage(message)
      } catch (error) {
        logger.error('Error parsing WebSocket message', { error: error.message, data: event.data })
        addMessage('❌ Error parsing message')
      }
    }

    wsRef.current.onclose = (event) => {
      logger.warn('WebSocket disconnected', { code: event.code, reason: event.reason })
      setConnectionStatus('disconnected')
      addMessage('🔴 Disconnected from server')
      scheduleReconnect()
    }

    wsRef.current.onerror = (error) => {
      logger.error('WebSocket error', { error })
      setConnectionStatus('disconnected')
      addMessage('❌ Connection error')
    }
  }

  const scheduleReconnect = () => {
    if (!connectionManager.shouldReconnect()) {
      logger.error('Max reconnection attempts reached')
      addMessage('❌ Unable to reconnect. Please refresh the page.')
      return
    }

    const delay = connectionManager.getReconnectDelay()
    connectionManager.incrementReconnectAttempts()
    
    logger.info('Scheduling reconnect', { 
      attempt: connectionManager.reconnectAttempts, 
      delay 
    })

    clearTimeout(reconnectTimeoutRef.current)
    reconnectTimeoutRef.current = setTimeout(() => {
      if (networkStatus === 'online') {
        addMessage(`🔄 Reconnecting... (Attempt ${connectionManager.reconnectAttempts})`)
        connectWebSocket()
      }
    }, delay)
  }

  const handleWebSocketMessage = (message) => {
    console.log('Received message:', message)
    
    switch (message.type) {
      case 'connected':
        setPlayerState(prev => ({
          ...prev,
          sessionId: message.data.sessionId,
          balance: message.data.balance
        }))
        if (message.data.gameState) {
          updateGameState(message.data.gameState)
        }
        addMessage(`✅ Session started: ${message.data.sessionId.slice(-6)}`)
        break
        
      case 'player_name_set':
        setPlayerState(prev => ({
          ...prev,
          playerName: message.data.playerName,
          balance: message.data.balance
        }))
        setShowNameModal(false)
        addMessage(`👤 Name set: ${message.data.playerName}`)
        break
        
      case 'game_state_update':
        updateGameState(message.data)
        // Additional safety check: if we're in a new round and player still has an active bet,
        // it means the bet was likely lost in the previous round
        if (message.data.phase === 'waiting' && playerState.hasActiveBet) {
          setPlayerState(prev => ({
            ...prev,
            currentBet: null,
            hasActiveBet: false
          }))
          addMessage('🔄 Bet state reset for new round')
        }
        break
        
      case 'bet_placed':
        setPlayerState(prev => ({
          ...prev,
          balance: message.data.newBalance,
          currentBet: message.data.bet,
          hasActiveBet: true
        }))
        setIsPlacingBet(false) // Reset loading state
        addMessage(`💰 Bet placed: $${message.data.bet.usdAmount}`)
        break
        
      case 'bet_won':
        setPlayerState(prev => ({
          ...prev,
          balance: message.data.newBalance,
          currentBet: null,
          hasActiveBet: false
        }))
        setIsPlacingBet(false) // Reset loading state
        setIsCashingOut(false) // Reset loading state
        addMessage(`🎉 Bet won! New balance: $${message.data.newBalance}`)
        break
        
      case 'bet_lost':
        setPlayerState(prev => ({
          ...prev,
          currentBet: null,
          hasActiveBet: false
        }))
        setIsPlacingBet(false) // Reset loading state
        setIsCashingOut(false) // Reset loading state
        addMessage(`😞 Bet lost`)
        break
        
      case 'cash_out_success':
        setPlayerState(prev => ({
          ...prev,
          balance: message.data.newBalance,
          currentBet: null,
          hasActiveBet: false
        }))
        setIsCashingOut(false) // Reset loading state
        addMessage(`💸 Cashed out! Win: $${message.data.winAmount.toFixed(2)}`)
        break
        
      case 'error':
        console.error('Game error:', message.message)
        setIsPlacingBet(false) // Reset loading state on error
        setIsCashingOut(false) // Reset loading state on error
        addMessage(`❌ Error: ${message.message}`)
        break
    }
  }

  const updateGameState = (data) => {
    const newState = {
      phase: data.phase || data.status || 'waiting',
      multiplier: data.multiplier || 1.00,
      timeLeft: data.timeLeft || 0,
      currentRound: data.currentRound || data.roundNumber || 0
    }
    
    setGameState(prev => {
      // Check for round change (new round started)
      if (prev.currentRound !== newState.currentRound && newState.currentRound > 0) {
        // Reset player bet state for new round
        setPlayerState(prevPlayer => ({
          ...prevPlayer,
          currentBet: null,
          hasActiveBet: false
        }))
        setIsPlacingBet(false)
        setIsCashingOut(false)
        addMessage(`🔄 New round ${newState.currentRound} ready for betting!`)
      }
      
      // Check for phase changes
      if (prev.phase !== newState.phase) {
        if (newState.phase === 'waiting') {
          // Reset betting states when new round starts
          setIsPlacingBet(false)
          setIsCashingOut(false)
          // Reset player bet state for new round
          setPlayerState(prevPlayer => ({
            ...prevPlayer,
            currentBet: null,
            hasActiveBet: false
          }))
          addMessage(`⏱️ New round starting in ${newState.timeLeft}s`)
        } else if (newState.phase === 'playing') {
          addMessage(`🚀 Round ${newState.currentRound} started!`)
        } else if (newState.phase === 'crashed') {
          // Reset states when round crashes
          setIsPlacingBet(false)
          setIsCashingOut(false)
          addMessage(`💥 Crashed at ${newState.multiplier.toFixed(2)}x`)
        }
      }
      return newState
    })
  }

  useEffect(() => {
    // Initialize logging
    logger.info('Application starting', { 
      version: APP_VERSION, 
      environment: ENVIRONMENT,
      websocketUrl: WEBSOCKET_URL 
    })

    connectWebSocket()
    
    // Network status monitoring
    const removeNetworkListener = connectionManager.addListener((event) => {
      setNetworkStatus(event)
      if (event === 'online') {
        addMessage('🌐 Network connection restored')
        if (connectionStatus === 'disconnected') {
          connectWebSocket()
        }
      } else {
        addMessage('🌐 Network connection lost')
      }
    })
    
    // Periodic check for stuck bet states
    const stuckStateCheck = setInterval(() => {
      // If player has an active bet but game is waiting for too long, reset the bet state
      if (playerState.hasActiveBet && gameState.phase === 'waiting' && gameState.timeLeft <= 0) {
        logger.warn('Detected stuck bet state, resetting')
        setPlayerState(prev => ({
          ...prev,
          currentBet: null,
          hasActiveBet: false
        }))
        setIsPlacingBet(false)
        setIsCashingOut(false)
        addMessage('🔄 Auto-reset stuck bet state')
      }
    }, 5000) // Check every 5 seconds
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      clearInterval(stuckStateCheck)
      clearTimeout(reconnectTimeoutRef.current)
      removeNetworkListener()
    }
  }, [playerState.hasActiveBet, gameState.phase, gameState.timeLeft])

  const setPlayerName = (name) => {
    if (!name.trim()) return
    
    setPlayerState(prev => ({ ...prev, playerName: name.trim() }))
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'set_player_name',
        data: { playerName: name.trim() }
      }))
    }
  }

  const placeBet = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addMessage('❌ Not connected to server')
      return
    }
    
    if (playerState.hasActiveBet) {
      addMessage('❌ You already have an active bet')
      return
    }
    
    if (isPlacingBet) {
      addMessage('❌ Bet already being placed...')
      return
    }
    
    if (betAmount <= 0 || betAmount > playerState.balance) {
      addMessage('❌ Invalid bet amount')
      return
    }
    
    if (gameState.phase !== 'waiting') {
      addMessage('❌ Betting phase has ended')
      return
    }
    
    // Set loading state
    setIsPlacingBet(true)
    addMessage(`🎯 Placing bet of $${betAmount}...`)
    
    // Safety timeout to reset loading state
    setTimeout(() => {
      setIsPlacingBet(false)
    }, 10000) // 10 second timeout
    
    wsRef.current.send(JSON.stringify({
      type: 'place_bet',
      data: {
        usdAmount: betAmount,
        cryptocurrency: selectedCrypto
      }
    }))
  }

  const cashOut = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addMessage('❌ Not connected to server')
      return
    }
    
    if (!playerState.hasActiveBet) {
      addMessage('❌ No active bet to cash out')
      return
    }
    
    if (isCashingOut) {
      addMessage('❌ Cash out already in progress...')
      return
    }
    
    if (gameState.phase !== 'playing') {
      addMessage('❌ Game is not active')
      return
    }
    
    // Set loading state
    setIsCashingOut(true)
    addMessage(`💸 Cashing out at ${gameState.multiplier.toFixed(2)}x...`)
    
    // Safety timeout to reset loading state
    setTimeout(() => {
      setIsCashingOut(false)
    }, 10000) // 10 second timeout
    
    wsRef.current.send(JSON.stringify({
      type: 'cash_out',
      data: {}
    }))
  }

  const getMultiplierClass = () => {
    if (gameState.phase === 'crashed') return 'crashed'
    if (gameState.phase === 'playing') return 'growing'
    return ''
  }

  const getGameStatusText = () => {
    switch (gameState.phase) {
      case 'waiting':
        return gameState.timeLeft > 0 ? `Next round in ${gameState.timeLeft}s` : 'Waiting for round...'
      case 'playing':
        return 'Game in progress!'
      case 'crashed':
        return 'Crashed!'
      default:
        return 'Loading...'
    }
  }

  const canPlaceBet = () => {
    const canBet = gameState.phase === 'waiting' && 
           !playerState.hasActiveBet && 
           !isPlacingBet &&
           betAmount > 0 && 
           betAmount <= playerState.balance &&
           connectionStatus === 'connected'
    
    // Debug logging
    if (!canBet) {
      console.log('Cannot place bet:', {
        phase: gameState.phase,
        hasActiveBet: playerState.hasActiveBet,
        isPlacingBet: isPlacingBet,
        betAmount: betAmount,
        balance: playerState.balance,
        connected: connectionStatus === 'connected'
      })
    }
    
    return canBet
  }

  const canCashOut = () => {
    return gameState.phase === 'playing' && 
           playerState.hasActiveBet &&
           !isCashingOut &&
           connectionStatus === 'connected'
  }

  const resetBetState = () => {
    setPlayerState(prev => ({
      ...prev,
      currentBet: null,
      hasActiveBet: false
    }))
    setIsPlacingBet(false)
    setIsCashingOut(false)
    addMessage('🔄 Bet state manually reset')
  }

  return (
    <div className="app">
      {/* Show loading spinner during initial connection */}
      {isInitialLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <LoadingSpinner message="Connecting to game server..." size="large" />
        </div>
      )}

      {/* Connection Status */}
      <div className={`connection-status ${connectionStatus}`}>
        {connectionStatus === 'connected' && '🟢 Connected'}
        {connectionStatus === 'connecting' && '🟡 Connecting...'}
        {connectionStatus === 'disconnected' && '🔴 Disconnected'}
        {networkStatus === 'offline' && ' (No Internet)'}
      </div>

      {/* Version Info (Development Only) */}
      {!import.meta.env.PROD && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          padding: '5px 10px',
          background: 'rgba(0, 0, 0, 0.5)',
          color: '#ccc',
          fontSize: '0.7rem',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          v{APP_VERSION} ({ENVIRONMENT})
        </div>
      )}

      {/* Name Input Modal */}
      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Enter Your Name</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Your name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    setPlayerName(e.target.value)
                  }
                }}
                autoFocus
              />
            </div>
            <button 
              className="btn btn-primary"
              onClick={(e) => {
                const input = e.target.parentElement.querySelector('input')
                setPlayerName(input.value)
              }}
              style={{ marginTop: '15px', width: '100%' }}
            >
              Start Playing
            </button>
          </div>
        </div>
      )}

      <div className="game-container">
        {/* Header */}
        <div className="header">
          <h1>🚀 Crypto Crash</h1>
          <div className="player-info">
            <div>Welcome, {playerState.playerName || 'Player'}</div>
            <div className="balance">💰 ${playerState.balance.toFixed(2)}</div>
          </div>
        </div>

        {/* Game Area */}
        <div className="game-area">
          {/* Chart Container */}
          <div className="chart-container">
            <div className={`game-status ${gameState.phase}`}>
              {getGameStatusText()}
            </div>
            
            <div className={`multiplier-display ${getMultiplierClass()}`}>
              {gameState.multiplier.toFixed(2)}x
            </div>
            
            {playerState.currentBet && (
              <div className="active-bet-info">
                <div>Active Bet: ${playerState.currentBet.usdAmount}</div>
                <div>Crypto: {playerState.currentBet.cryptocurrency}</div>
                <div>Potential Win: ${(playerState.currentBet.usdAmount * gameState.multiplier).toFixed(2)}</div>
              </div>
            )}
          </div>

          {/* Control Panel */}
          <div className="control-panel">
            <div className="crypto-selector">
              <h3>Select Cryptocurrency</h3>
              <div className="crypto-options">
                {cryptocurrencies.map(crypto => (
                  <div
                    key={crypto.id}
                    className={`crypto-option ${selectedCrypto === crypto.id ? 'selected' : ''} ${(isPlacingBet || playerState.hasActiveBet) ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isPlacingBet && !playerState.hasActiveBet) {
                        setSelectedCrypto(crypto.id)
                      }
                    }}
                  >
                    <div>{crypto.symbol}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{crypto.name}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bet-controls">
              <div className="input-group">
                <label>Bet Amount ($)</label>
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  min="1"
                  max={playerState.balance}
                  step="0.01"
                  disabled={isPlacingBet || playerState.hasActiveBet}
                />
              </div>

              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={placeBet}
                  disabled={!canPlaceBet()}
                >
                  {isPlacingBet ? '⏳ Placing Bet...' : 'Place Bet'}
                </button>
                
                <button
                  className="btn btn-danger"
                  onClick={cashOut}
                  disabled={!canCashOut()}
                >
                  {isCashingOut ? '⏳ Cashing Out...' : 'Cash Out'}
                </button>
                
                {/* Reset button - only show if bet state seems stuck */}
                {(playerState.hasActiveBet && gameState.phase === 'waiting') && (
                  <button
                    className="btn btn-warning"
                    onClick={resetBetState}
                    style={{ fontSize: '0.8rem', marginTop: '5px' }}
                  >
                    🔄 Reset Bet State
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages Panel */}
        <div className="messages-panel">
          <h3>Game Messages</h3>
          <div className="messages-list">
            {messages.map((msg, index) => (
              <div key={index} className="message">{msg}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
