import React, { useState, useEffect, useRef } from 'react'
import './App.css'

const WEBSOCKET_URL = 'wss://crashgamebackend-wzba.onrender.com'


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
  
  const wsRef = useRef(null)

  const cryptocurrencies = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA' }
  ]

  const addMessage = (msg) => {
    const timestamp = new Date().toLocaleTimeString()
    setMessages(prev => [...prev.slice(-50), `[${timestamp}] ${msg}`])
  }

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    wsRef.current = new WebSocket(WEBSOCKET_URL)

    wsRef.current.onopen = () => {
      console.log('WebSocket connected')
      setConnectionStatus('connected')
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
        console.error('Error parsing WebSocket message:', error)
        addMessage('❌ Error parsing message')
      }
    }

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected')
      setConnectionStatus('disconnected')
      addMessage('🔴 Disconnected from server')
      
      setTimeout(() => {
        addMessage('🔄 Attempting to reconnect...')
        connectWebSocket()
      }, 3000)
    }

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('disconnected')
      addMessage('❌ Connection error')
    }
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
        break
        
      case 'bet_placed':
        setPlayerState(prev => ({
          ...prev,
          balance: message.data.newBalance,
          currentBet: message.data.bet,
          hasActiveBet: true
        }))
        addMessage(`💰 Bet placed: $${message.data.bet.usdAmount}`)
        break
        
      case 'bet_won':
        setPlayerState(prev => ({
          ...prev,
          balance: message.data.newBalance,
          currentBet: null,
          hasActiveBet: false
        }))
        addMessage(`🎉 Bet won! New balance: $${message.data.newBalance}`)
        break
        
      case 'bet_lost':
        setPlayerState(prev => ({
          ...prev,
          currentBet: null,
          hasActiveBet: false
        }))
        addMessage(`😞 Bet lost`)
        break
        
      case 'cash_out_success':
        setPlayerState(prev => ({
          ...prev,
          balance: message.data.newBalance,
          currentBet: null,
          hasActiveBet: false
        }))
        addMessage(`💸 Cashed out! Win: $${message.data.winAmount.toFixed(2)}`)
        break
        
      case 'error':
        console.error('Game error:', message.message)
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
      if (prev.phase !== newState.phase) {
        if (newState.phase === 'waiting') {
          addMessage(`⏱️ New round starting in ${newState.timeLeft}s`)
        } else if (newState.phase === 'playing') {
          addMessage(`🚀 Round ${newState.currentRound} started!`)
        } else if (newState.phase === 'crashed') {
          addMessage(`💥 Crashed at ${newState.multiplier.toFixed(2)}x`)
        }
      }
      return newState
    })
  }

  useEffect(() => {
    connectWebSocket()
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

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
    
    if (betAmount <= 0 || betAmount > playerState.balance) {
      addMessage('❌ Invalid bet amount')
      return
    }
    
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
    return gameState.phase === 'waiting' && 
           !playerState.hasActiveBet && 
           betAmount > 0 && 
           betAmount <= playerState.balance &&
           connectionStatus === 'connected'
  }

  const canCashOut = () => {
    return gameState.phase === 'playing' && 
           playerState.hasActiveBet &&
           connectionStatus === 'connected'
  }

  return (
    <div className="app">
      {/* Connection Status */}
      <div className={`connection-status ${connectionStatus}`}>
        {connectionStatus === 'connected' && '🟢 Connected'}
        {connectionStatus === 'connecting' && '🟡 Connecting...'}
        {connectionStatus === 'disconnected' && '🔴 Disconnected'}
      </div>

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
                    className={`crypto-option ${selectedCrypto === crypto.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCrypto(crypto.id)}
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
                />
              </div>

              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={placeBet}
                  disabled={!canPlaceBet()}
                >
                  Place Bet
                </button>
                
                <button
                  className="btn btn-danger"
                  onClick={cashOut}
                  disabled={!canCashOut()}
                >
                  Cash Out
                </button>
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
