import React, { useState, useEffect } from 'react';

export function StudentView({
  sessionCode,
  sessionStatus,
  currentRound,
  roundActive,
  timer,
  priceBounds,
  onSubmitPrice,
  latestResult,
  history,
  hasSubmitted,
  personalLink,
  nextRoundCountdown,
  session,
  leaderboard,
  allRounds,
  chatMessages,
  onSendChatMessage,
  currentSocketId,
  opponentName
}) {
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    setPrice('');
    setError('');
  }, [currentRound]);

  const handleSubmit = event => {
    event.preventDefault();
    const numeric = Number(price);
    if (!Number.isFinite(numeric)) {
      setError('Enter a valid number');
      return;
    }
    if (numeric < priceBounds.min || numeric > priceBounds.max) {
      setError(`Price must be between ${priceBounds.min} and ${priceBounds.max}`);
      return;
    }
    setError('');
    onSubmitPrice(numeric);
  };

  return (
    <div className="card">
      {/* Session Complete Message */}
      {sessionStatus === 'complete' && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#dbeafe',
          borderRadius: '8px',
          borderLeft: '4px solid #3b82f6',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: '0 0 0.5rem 0', color: '#1e40af', fontSize: '1.5rem' }}>
            🎉 Session Complete!
          </h2>
          <p style={{ margin: 0, color: '#1e3a8a', fontSize: '1rem' }}>
            The instructor has ended this session. Thank you for participating!
          </p>
        </div>
      )}
      
      {/* Waiting for Game to Start */}
      {sessionStatus === 'lobby' && (
        <div style={{ marginBottom: '1.5rem' }}>
          {/* Status Banner */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            borderLeft: '4px solid #f59e0b',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#92400e', fontSize: '1.5rem' }}>
              ⏳ Waiting to Start
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#78350f', fontSize: '1rem' }}>
              Waiting for other students to join and for the instructor to start the game...
            </p>
          </div>

          {/* Game Instructions */}
          <div style={{
            padding: '2rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '2px solid #e5e7eb'
          }}>
            <h3 style={{ marginTop: 0, color: '#1f2937', fontSize: '1.25rem' }}>
              📚 How to Play
            </h3>
            
            <div style={{ color: '#374151', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              <p style={{ marginBottom: '1rem' }}>
                You are competing in a <strong>pricing game</strong> where you'll be paired with another student.{' '}
                {session?.config?.hideRoundCount ? (
                  <>The game will continue for an unknown number of rounds and then it will end.</>
                ) : session?.config?.rounds ? (
                  <>You&apos;ll play for {session.config.rounds} round{session.config.rounds > 1 ? 's' : ''}.</>
                ) : (
                  <>You&apos;ll play for multiple rounds.</>
                )}
              </p>
              
              <p style={{ marginBottom: '1rem' }}>
                In each round, you and your opponent will <strong>simultaneously set prices</strong> for similar but differentiated products. 
                You have {session?.config?.roundTime || 60} seconds per round to make your decision.
              </p>

              <p style={{ marginBottom: '1rem' }}>
                <strong>Your goal:</strong> Maximize your total profit across all rounds by choosing the optimal price. 
                The demand you receive depends on both your price and your opponent's price.
              </p>

              <p style={{ marginBottom: '1rem' }}>
                <strong>After each round,</strong> you will see your price, your opponent's price, market shares, and profits from that round. 
                Use this information to adjust your strategy for the next round!
              </p>

              <p style={{ marginBottom: '0' }}>
                <strong>How it works:</strong> Customers have different preferences for the two products. 
                Lower prices attract more customers, but you also earn less per unit sold. 
                If you price too high compared to your opponent, customers will switch to their product. 
                Find the sweet spot!
              </p>
            </div>

            {/* Market Parameters */}
            {session?.config && (
              <div style={{
                backgroundColor: '#f0f9ff',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <h4 style={{ marginTop: 0, color: '#1e40af', fontSize: '1rem' }}>
                  📊 Market Parameters
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.9rem',
                  color: '#1e3a8a'
                }}>
                  <div>
                    <strong>Market Size:</strong> {session.config.marketSize} customers
                  </div>
                  <div>
                    <strong>Reference Price:</strong> ${(10 / session.config.alpha).toFixed(2)}
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      (Monopoly price for 50% share)
                    </div>
                  </div>
                  <div>
                    <strong>Price Sensitivity (α):</strong> {session.config.alpha}
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {session.config.alpha < 1 ? 'Low sensitivity' : session.config.alpha < 2 ? 'Moderate sensitivity' : 'High sensitivity'}
                    </div>
                  </div>
                  <div>
                    <strong>Product Differentiation (σ):</strong> {session.config.sigma}
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {session.config.sigma < 3 ? 'Very similar products' : session.config.sigma < 7 ? 'Moderately differentiated' : 'Highly differentiated'}
                    </div>
                  </div>
                  {!session.config.hideRoundCount && (
                    <div>
                      <strong>Number of Rounds:</strong> {session.config.rounds}
                    </div>
                  )}
                </div>
                
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  color: '#1e3a8a'
                }}>
                  <strong>💡 Strategy Tip:</strong> Higher differentiation (σ) means customers are less likely to switch between products, 
                  allowing you to charge higher prices. Lower differentiation means price competition will be fierce!
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <header style={{ marginBottom: '1.5rem' }}>
        {/* Centralized Round and Timer Display */}
        <div style={{ 
          textAlign: 'center', 
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: 600,
            color: '#374151',
            marginBottom: (roundActive || (nextRoundCountdown !== null && nextRoundCountdown > 0)) ? '0.75rem' : 0
          }}>
            {sessionStatus === 'lobby' 
              ? 'Waiting to start...' 
              : session?.config?.hideRoundCount 
                ? `Round ${currentRound}` 
                : `Round ${currentRound} of ${session?.config?.rounds || 0}`
            }
          </div>
          {roundActive && (
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: timer <= 10 ? '#dc2626' : '#3b82f6',
              transition: 'color 0.3s ease'
            }}>
              {timer}s
            </div>
          )}
          {/* Show countdown in the same space when not in active round */}
          {nextRoundCountdown !== null && nextRoundCountdown > 0 && !roundActive && (
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#f59e0b',
              transition: 'color 0.3s ease'
            }}>
              Next Round Starts: {nextRoundCountdown}s
            </div>
          )}
        </div>
      </header>

      {/* Opponent Name Display */}
      {session?.config?.showOpponentName && opponentName && sessionStatus === 'running' && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '8px',
          borderLeft: '4px solid #3b82f6',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#1e40af', fontWeight: 600 }}>
            👥 Paired with: <span style={{ color: '#3b82f6' }}>{opponentName}</span>
          </p>
        </div>
      )}

      {/* Chat Interface */}
      {session?.config?.enableChat && (sessionStatus === 'running' || sessionStatus === 'complete') && (
        <div style={{
          marginBottom: '1.5rem',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#f9fafb',
            borderBottom: '2px solid #e5e7eb',
            fontWeight: 600,
            color: '#374151'
          }}>
            💬 Chat with your opponent
          </div>
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '1rem',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            {(!chatMessages || chatMessages.length === 0) && (
              <p style={{ margin: 0, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
                No messages yet. Start the conversation!
              </p>
            )}
            {chatMessages && chatMessages.map((msg, idx) => {
              const isOwnMessage = msg.fromSocketId === currentSocketId;
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                    maxWidth: '70%'
                  }}
                >
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: isOwnMessage ? '#3b82f6' : '#e5e7eb',
                    color: isOwnMessage ? 'white' : '#374151'
                  }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      {isOwnMessage ? 'You' : (opponentName || 'Opponent')}
                    </div>
                    <div>{msg.message}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim() && onSendChatMessage && sessionStatus === 'running') {
                onSendChatMessage(chatInput.trim());
                setChatInput('');
              }
            }}
            style={{
              padding: '0.75rem',
              backgroundColor: '#f9fafb',
              borderTop: '2px solid #e5e7eb',
              display: 'flex',
              gap: '0.5rem'
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={sessionStatus === 'complete' ? 'Chat closed (session ended)' : 'Type a message...'}
              disabled={sessionStatus !== 'running'}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                backgroundColor: sessionStatus !== 'running' ? '#f3f4f6' : 'white',
                cursor: sessionStatus !== 'running' ? 'not-allowed' : 'text'
              }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || sessionStatus !== 'running'}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: (chatInput.trim() && sessionStatus === 'running') ? '#3b82f6' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (chatInput.trim() && sessionStatus === 'running') ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {sessionStatus !== 'lobby' && sessionStatus !== 'complete' && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: '2rem',
          padding: '2rem 0'
        }}>
          {/* Modern Price Input */}
          <div style={{
            width: '100%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <label 
              htmlFor="price-input" 
              style={{ 
                display: 'block',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '1rem',
                letterSpacing: '-0.025em'
              }}
            >
              YOUR PRICE
            </label>
            
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '16px',
              padding: '1.5rem',
              border: '2px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <span style={{
                fontSize: '3rem',
                fontWeight: 700,
                color: '#6b7280',
                marginRight: '0.75rem'
              }}>$</span>
              
          <input
            id="price-input"
            type="number"
            step="0.01"
            min={priceBounds.min}
            max={priceBounds.max}
            value={price}
            onChange={event => setPrice(event.target.value)}
            disabled={!roundActive || hasSubmitted}
                placeholder="0"
                style={{
                  fontSize: '3.5rem',
                  fontWeight: 700,
                  color: '#1f2937',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: '200px',
                  textAlign: 'center',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  MozAppearance: 'textfield'
                }}
                onWheel={(e) => e.target.blur()}
              />
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
              fontSize: '0.875rem',
              color: '#6b7280',
              fontWeight: 500
            }}>
              <span>Min: ${priceBounds.min}</span>
              <span>Max: ${priceBounds.max}</span>
            </div>
            
            {error && (
              <div style={{ 
                marginTop: '1rem',
                color: '#dc2626',
                fontSize: '0.875rem',
                fontWeight: 600
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button 
            onClick={handleSubmit}
            disabled={!roundActive || hasSubmitted}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '1.25rem 2rem',
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'white',
              backgroundColor: hasSubmitted ? '#10b981' : '#3b82f6',
              border: 'none',
              borderRadius: '12px',
              cursor: roundActive && !hasSubmitted ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
            onMouseEnter={(e) => {
              if (roundActive && !hasSubmitted) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            }}
          >
            {hasSubmitted ? '✓ Submitted' : 'Submit Price'}
          </button>
        </div>
      )}

      {hasSubmitted && roundActive && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          backgroundColor: '#dbeafe', 
          borderRadius: '8px',
          borderLeft: '4px solid #3b82f6',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0, color: '#1e40af', fontWeight: 600, fontSize: '1rem' }}>
            ⏳ Waiting for other students to submit their prices...
          </p>
          <p style={{ margin: '0.5rem 0 0 0', color: '#1e3a8a', fontSize: '0.875rem' }}>
            Results will appear when everyone has submitted or time runs out
          </p>
        </div>
      )}

      {latestResult && sessionStatus !== 'complete' && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* Round Complete Badge */}
          <div style={{
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <span style={{
              display: 'inline-block',
              padding: '0.5rem 1.5rem',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              marginBottom: '0.5rem'
            }}>
              Round {latestResult.round} Complete
            </span>
            <h2 style={{ 
              fontSize: '2rem', 
              fontWeight: 700,
              margin: '0.5rem 0 0 0',
              color: '#1f2937'
            }}>
              Round Results
            </h2>
          </div>

          {/* Results Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            {/* You Card */}
            <div style={{
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              position: 'relative'
            }}>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                YOU
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Price
                </div>
                <div style={{ 
                  fontSize: '1.75rem', 
                  fontWeight: 700,
                  color: '#1f2937'
                }}>
                  ${latestResult.price.toFixed(2)}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Market Share
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#3b82f6'
                }}>
                  {((latestResult.share || 0) * 100).toFixed(1)}%
                </div>
              </div>

              <div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Profit
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>↗</span>
                  ${latestResult.profit.toFixed(0)}
                </div>
              </div>
            </div>

            {/* Opponent Card */}
            <div style={{
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              position: 'relative'
            }}>
              
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {latestResult?.opponentName || 'OPPONENT'}
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Price
                </div>
                <div style={{ 
                  fontSize: '1.75rem', 
                  fontWeight: 700,
                  color: '#1f2937'
                }}>
                  ${(latestResult.opponentPrice !== undefined && latestResult.opponentPrice !== null) ? latestResult.opponentPrice.toFixed(2) : '-'}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Market Share
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#3b82f6'
                }}>
                  {(latestResult.opponentShare !== undefined && latestResult.opponentShare !== null) ? (latestResult.opponentShare * 100).toFixed(1) + '%' : '-'}
                </div>
              </div>

              <div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Profit
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.25rem' }}>↗</span>
                  ${(latestResult.opponentProfit !== undefined && latestResult.opponentProfit !== null) ? latestResult.opponentProfit.toFixed(0) : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Summary - Only show when game is complete */}
      {sessionStatus === 'complete' && history && history.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ 
              fontSize: '1.75rem', 
              fontWeight: 700,
              margin: '0',
              color: '#1f2937'
            }}>
              🏁 Game Summary
            </h2>
          </div>

          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            {/* Your Summary Card */}
            <div style={{
              backgroundColor: history.reduce((sum, item) => sum + (item.profit || 0), 0) >= 
                              history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0) ? '#ede9fe' : 'white',
              border: history.reduce((sum, item) => sum + (item.profit || 0), 0) >= 
                     history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0) ? '3px solid #8b5cf6' : '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              paddingTop: '2.5rem',
              position: 'relative'
            }}>
              {history.reduce((sum, item) => sum + (item.profit || 0), 0) >= 
               history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0) && (
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  Winner
                </div>
              )}
              
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                YOU
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Average Price
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#1f2937'
                }}>
                  ${(history.reduce((sum, item) => sum + (item.price || 0), 0) / history.length).toFixed(2)}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Average Market Share
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#3b82f6'
                }}>
                  {(history.reduce((sum, item) => sum + ((item.share || 0) * 100), 0) / history.length).toFixed(1)}%
                </div>
              </div>

              <div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Total Profit
                </div>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 700,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>↗</span>
                  ${history.reduce((sum, item) => sum + (item.profit || 0), 0).toFixed(0)}
                </div>
              </div>
            </div>

            {/* Opponent Summary Card */}
            <div style={{
              backgroundColor: history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0) > 
                              history.reduce((sum, item) => sum + (item.profit || 0), 0) ? '#ede9fe' : 'white',
              border: history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0) > 
                     history.reduce((sum, item) => sum + (item.profit || 0), 0) ? '3px solid #8b5cf6' : '2px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.5rem',
              paddingTop: '2.5rem',
              position: 'relative'
            }}>
              {history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0) > 
               history.reduce((sum, item) => sum + (item.profit || 0), 0) && (
                <div style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  Winner
                </div>
              )}
              
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#6b7280',
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {history && history.length > 0 && history[0]?.opponentName 
                  ? history[0].opponentName.toUpperCase() 
                  : 'OPPONENT'}
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Average Price
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#1f2937'
                }}>
                  ${history.length > 0 && history[0].opponentPrice !== undefined
                    ? (history.reduce((sum, item) => sum + (item.opponentPrice || 0), 0) / history.length).toFixed(2)
                    : '-'}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Average Market Share
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  color: '#3b82f6'
                }}>
                  {history.length > 0 && history[0].opponentShare !== undefined
                    ? (history.reduce((sum, item) => sum + ((item.opponentShare || 0) * 100), 0) / history.length).toFixed(1) + '%'
                    : '-'}
                </div>
              </div>

              <div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  Total Profit
                </div>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 700,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>↗</span>
                  ${history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0).toFixed(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {history && history.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Your Price</th>
                  <th>Opp. Price</th>
                  <th>Your Share</th>
                  <th>Opp. Share</th>
                  <th>Your Profit</th>
                  <th>Opp. Profit</th>
                </tr>
              </thead>
              <tbody>
            {history.map(item => (
                  <tr key={item.round}>
                    <td>{item.round}</td>
                    <td style={{ fontWeight: 600 }}>{item.price.toFixed(2)}</td>
                    <td>{item.opponentPrice?.toFixed(2) || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{((item.share || 0) * 100).toFixed(1)}%</td>
                    <td>{item.opponentShare ? ((item.opponentShare || 0) * 100).toFixed(1) + '%' : '-'}</td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>${item.profit.toFixed(0)}</td>
                    <td style={{ color: '#6b7280' }}>${item.opponentProfit?.toFixed(0) || '-'}</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr style={{ 
                  borderTop: '3px solid #374151',
                  backgroundColor: '#f9fafb',
                  fontWeight: 700
                }}>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td style={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>
                    ${history.reduce((sum, item) => sum + (item.profit || 0), 0).toFixed(0)}
                  </td>
                  <td style={{ fontWeight: 700, color: '#6b7280', fontSize: '1.1rem' }}>
                    ${history.reduce((sum, item) => sum + (item.opponentProfit || 0), 0).toFixed(0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
