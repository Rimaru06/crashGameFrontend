import React from 'react'

const LoadingSpinner = ({ message = 'Loading...', size = 'medium' }) => {
  const sizeClasses = {
    small: { spinner: '20px', font: '0.8rem' },
    medium: { spinner: '40px', font: '1rem' },
    large: { spinner: '60px', font: '1.2rem' }
  }

  const currentSize = sizeClasses[size] || sizeClasses.medium

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '15px',
      padding: '20px'
    }}>
      <div
        style={{
          width: currentSize.spinner,
          height: currentSize.spinner,
          border: '3px solid rgba(0, 212, 170, 0.3)',
          borderTop: '3px solid #00d4aa',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      <p style={{
        color: '#ccc',
        fontSize: currentSize.font,
        margin: 0
      }}>
        {message}
      </p>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LoadingSpinner
