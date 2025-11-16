import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || '').trim();

function buildApiUrl(path) {
  if (!API_BASE_URL) {
    return `/api${path}`;
  }
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${normalizedBase}${path}`;
}

export function InstructorDashboard({
  instructorName,
  session,
  canStart,
  startDisabledReason,
  onStart,
  onEndSession,
  leaderboard,
  latestRound,
  allRounds,
  errorMessage,
  onDismissError,
  timer,
  roundActive,
  nextRoundCountdown
}) {
  const navigate = useNavigate();
  const [showEndConfirm, setShowEndConfirm] = React.useState(false);
  const [hoveredPoint, setHoveredPoint] = React.useState(null);
  const [hoveredPlayerPoint, setHoveredPlayerPoint] = React.useState(null);
  const [hoveredPair, setHoveredPair] = React.useState(null);
  
  // Filter out instructors from player list - show students and AI players
  const players = (session?.players || []).filter(player => player.role === 'student' || player.role === 'ai');
  
  const handleDownloadData = () => {
    if (!session?.code) return;
    const url = buildApiUrl(`/session/${session.code}/export`);
    window.open(url, '_blank');
  };
  
  const handleEndSessionClick = () => {
    setShowEndConfirm(true);
  };
  
  const handleConfirmEnd = () => {
    setShowEndConfirm(false);
    onEndSession();
  };
  
  const handleBackToSessions = () => {
    // Navigate back to the instructor's profile page
    const instructorPath = `/instructor/${instructorName.toLowerCase()}`;
    navigate(instructorPath);
  };

  // Calculate average price and SD per round from all rounds data
  const calculateRoundStats = () => {
    if (!allRounds || allRounds.length === 0) return [];
    
    // Calculate avg and SD for each round
    return allRounds.map(roundSummary => {
      const prices = [];
      roundSummary.results.forEach(result => {
        // Handle both live game format (result.playerA/playerB) and database format (flat result)
        if (result.playerA && result.playerB) {
          prices.push(result.playerA.price);
          prices.push(result.playerB.price);
        } else if (result.price !== undefined) {
          // Database format - just has price directly
          prices.push(result.price);
        }
      });
      
      if (prices.length === 0) return { round: roundSummary.round, avg: 0, sd: 0 };
      
      const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
      const sd = Math.sqrt(variance);
      
      return { round: roundSummary.round, avg, sd };
    });
  };

  // Calculate total profit by pair across all rounds
  const calculatePairProfits = () => {
    if (!allRounds || allRounds.length === 0) return [];
    
    const pairProfits = new Map();
    const processedPairs = new Set(); // Track which pairs we've processed per round
    
    allRounds.forEach(roundSummary => {
      processedPairs.clear(); // Reset for each round
      
      roundSummary.results.forEach(result => {
        // Handle both live game format (result.playerA/playerB) and database format (flat result)
        if (result.playerA && result.playerB) {
          // Live game format
          const pairId = result.pairId;
          const totalPairProfit = result.playerA.profit + result.playerB.profit;
          
          if (!pairProfits.has(pairId)) {
            pairProfits.set(pairId, {
              pairId,
              playerA: result.playerA.name,
              playerB: result.playerB.name,
              totalProfit: 0,
              priceHistoryA: [],
              priceHistoryB: []
            });
          }
          
          const pairData = pairProfits.get(pairId);
          pairData.totalProfit += totalPairProfit;
          pairData.priceHistoryA.push(result.playerA.price);
          pairData.priceHistoryB.push(result.playerB.price);
        } else if (result.playerName && result.opponentName) {
          // Database format - create a consistent pair key (sorted names)
          const pairKey = [result.playerName, result.opponentName].sort().join('|');
          
          // Only process each pair once per round (since database has both perspectives)
          if (processedPairs.has(pairKey)) {
            return; // Skip, we already processed this pair in this round
          }
          processedPairs.add(pairKey);
          
          if (!pairProfits.has(pairKey)) {
            pairProfits.set(pairKey, {
              pairId: pairKey,
              playerA: result.playerName,
              playerB: result.opponentName,
              totalProfit: 0,
              priceHistoryA: [],
              priceHistoryB: []
            });
          }
          
          // Add both players' profits and prices for this round
          const opponentResult = roundSummary.results.find(r => 
            r.playerName === result.opponentName && r.opponentName === result.playerName
          );
          
          const totalPairProfitThisRound = result.profit + (opponentResult ? opponentResult.profit : 0);
          const pairData = pairProfits.get(pairKey);
          pairData.totalProfit += totalPairProfitThisRound;
          pairData.priceHistoryA.push(result.price);
          pairData.priceHistoryB.push(result.opponentPrice);
        }
      });
    });
    
    return Array.from(pairProfits.values()).sort((a, b) => b.totalProfit - a.totalProfit);
  };

  // Calculate individual player profits by pair
  const calculateIndividualProfits = () => {
    if (!allRounds || allRounds.length === 0) return [];
    
    const playerProfits = new Map();
    
    allRounds.forEach(roundSummary => {
      roundSummary.results.forEach(result => {
        if (result.playerA && result.playerB) {
          // Live game format
          if (!playerProfits.has(result.playerA.name)) {
            playerProfits.set(result.playerA.name, { name: result.playerA.name, profit: 0 });
          }
          if (!playerProfits.has(result.playerB.name)) {
            playerProfits.set(result.playerB.name, { name: result.playerB.name, profit: 0 });
          }
          playerProfits.get(result.playerA.name).profit += result.playerA.profit;
          playerProfits.get(result.playerB.name).profit += result.playerB.profit;
        } else if (result.playerName) {
          // Database format
          if (!playerProfits.has(result.playerName)) {
            playerProfits.set(result.playerName, { name: result.playerName, profit: 0 });
          }
          playerProfits.get(result.playerName).profit += result.profit;
        }
      });
    });
    
    // Group by pairs based on pairProfits
    const individualByPair = [];
    pairProfits.forEach((pair, index) => {
      const playerAProfit = playerProfits.get(pair.playerA);
      const playerBProfit = playerProfits.get(pair.playerB);
      
      if (playerAProfit && playerBProfit) {
        individualByPair.push({
          pairIndex: index + 1,
          playerA: pair.playerA,
          playerB: pair.playerB,
          profitA: playerAProfit.profit,
          profitB: playerBProfit.profit
        });
      }
    });
    
    return individualByPair;
  };

  const roundStats = calculateRoundStats();
  const pairProfits = calculatePairProfits();
  const individualProfits = calculateIndividualProfits();
  
  return (
    <div className="card">
      {/* Header */}
      <header style={{ marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>Instructor: {instructorName}</h2>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
              Session: <strong>{session?.sessionName || session?.code}</strong> ({session?.code})
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="status-tag">{session?.status?.toUpperCase()}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            <button 
              onClick={handleBackToSessions}
              style={{ 
                padding: '0.5rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}
            >
              ← Back to Sessions
            </button>
            {session?.status === 'running' || session?.status === 'complete' ? (
              <button onClick={handleDownloadData} style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}>
                📥 Download CSV
              </button>
            ) : null}
            {session?.status !== 'complete' && (
              <button 
                onClick={handleEndSessionClick}
                style={{ 
                  padding: '0.5rem 1rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                End Session
              </button>
            )}
            {canStart ? (
              <button className="primary" onClick={onStart} style={{ whiteSpace: 'nowrap' }}>
                🎮 Start Game
              </button>
            ) : (
              startDisabledReason ? (
                <span style={{ color: '#dc2626', fontWeight: 500, fontSize: '0.875rem' }}>
                  {startDisabledReason}
                </span>
              ) : null
            )}
          </div>
        </div>
        
        {/* Centralized Round and Timer Display */}
        <div style={{ 
          textAlign: 'center', 
          padding: '1.5rem',
          backgroundColor: nextRoundCountdown > 0 ? '#fef3c7' : '#f9fafb',
          borderRadius: '8px',
          marginTop: '1rem',
          border: nextRoundCountdown > 0 ? '3px solid #f59e0b' : 'none',
          boxShadow: nextRoundCountdown > 0 ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: 600,
            color: nextRoundCountdown > 0 ? '#92400e' : '#374151',
            marginBottom: (roundActive || nextRoundCountdown > 0) ? '0.75rem' : 0,
            textTransform: nextRoundCountdown > 0 ? 'uppercase' : 'none'
          }}>
            {nextRoundCountdown > 0 ? 'Next Round Starting In' : `Round ${session?.currentRound || 0} of ${session?.config?.rounds || 0}`}
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
          {nextRoundCountdown !== null && nextRoundCountdown > 0 && (
            <div style={{
              fontSize: '4rem',
              fontWeight: 700,
              color: '#f59e0b',
              lineHeight: 1
            }}>
              {nextRoundCountdown}s
            </div>
          )}
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>{errorMessage}</span>
            {onDismissError && (
              <button
                onClick={onDismissError}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#991b1b',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Dashboard Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Left Column - Students List */}
        <div>
          <h3 style={{ margin: '0 0 1rem 0' }}>Students ({players.length})</h3>
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb'
          }}>
            {players.length === 0 ? (
              <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', margin: 0 }}>
                No students have joined yet.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f3f4f6', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>#</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #d1d5db' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #d1d5db' }}>Pair</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => (
                    <tr key={player.socketId} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                      <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>{index + 1}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>
                        {player.name}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: player.connected ? '#d1fae5' : '#fee2e2',
                          color: player.connected ? '#065f46' : '#991b1b'
                        }}>
                          {player.connected ? '🟢 Online' : '🔴 Offline'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', borderBottom: '1px solid #e5e7eb' }}>
                        {player.pairId || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column - Top 10 Leaderboard */}
        <div>
          <h3 style={{ margin: '0 0 1rem 0' }}>🏆 Top 10 Leaderboard</h3>
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: '#f9fafb'
          }}>
            {leaderboard && leaderboard.length > 0 ? (
              <div>
                {leaderboard.slice(0, 10).map((player, index) => (
                  <div
                    key={player.socketId}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: index < 9 ? '1px solid #e5e7eb' : 'none',
                      backgroundColor: index === 0 ? '#fef3c7' : index === 1 ? '#e0e7ff' : index === 2 ? '#fed7aa' : 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        fontSize: index < 3 ? '1.5rem' : '1rem',
                        fontWeight: 700,
                        color: index === 0 ? '#f59e0b' : index === 1 ? '#6366f1' : index === 2 ? '#f97316' : '#6b7280',
                        minWidth: '2rem'
                      }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{player.name}</span>
                    </div>
                    <span style={{
                      fontWeight: 700,
                      color: '#10b981',
                      fontSize: '1rem'
                    }}>
                      ${player.totalProfit.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', margin: 0 }}>
                No data yet. Start the game!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Price Chart - Average Price Across Rounds */}
      {session?.config?.rounds && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>📊 Average Price Across Rounds</h3>
          <div style={{
            padding: '2rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}>
            <svg width="100%" height="350" viewBox="0 0 1000 350" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
              {/* Y-axis */}
              <line x1="80" y1="30" x2="80" y2="280" stroke="#d1d5db" strokeWidth="2" />
              {/* X-axis */}
              <line x1="80" y1="280" x2="950" y2="280" stroke="#d1d5db" strokeWidth="2" />
              
              {/* Y-axis labels */}
              {(() => {
                const maxPrice = session?.config?.priceBounds?.max || 100;
                const minPrice = session?.config?.priceBounds?.min || 0;
                const yLabels = [];
                const numLabels = 6;
                for (let i = 0; i <= numLabels; i++) {
                  const value = minPrice + (maxPrice - minPrice) * (i / numLabels);
                  const y = 280 - (i / numLabels) * 250;
                  yLabels.push(
                    <g key={`ylabel-${i}`}>
                      <line x1="75" y1={y} x2="80" y2={y} stroke="#9ca3af" strokeWidth="1" />
                      <line x1="80" y1={y} x2="950" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
                      <text x="70" y={y + 5} textAnchor="end" fill="#6b7280" fontSize="14" fontWeight="500">
                        {value.toFixed(0)}
                      </text>
                    </g>
                  );
                }
                return yLabels;
              })()}
              
              {/* X-axis labels for all rounds */}
              {(() => {
                const totalRounds = session.config.rounds;
                const xLabels = [];
                const chartWidth = 870; // 950 - 80
                for (let i = 1; i <= totalRounds; i++) {
                  const x = 80 + (i - 1) * (chartWidth / (totalRounds - 1 || 1));
                  xLabels.push(
                    <g key={`xlabel-${i}`}>
                      <line x1={x} y1="280" x2={x} y2="285" stroke="#9ca3af" strokeWidth="1" />
                      <text x={x} y="300" textAnchor="middle" fill="#6b7280" fontSize="13" fontWeight="500">
                        {i}
                      </text>
                    </g>
                  );
                }
                return xLabels;
              })()}
              
              {/* Data points and lines */}
              {roundStats.map((stat, index) => {
                const totalRounds = session.config.rounds;
                const chartWidth = 870;
                const x = 80 + (stat.round - 1) * (chartWidth / (totalRounds - 1 || 1));
                const maxPrice = session?.config?.priceBounds?.max || 100;
                const minPrice = session?.config?.priceBounds?.min || 0;
                const priceRange = maxPrice - minPrice;
                
                const yCenter = 280 - ((stat.avg - minPrice) / priceRange) * 250;
                const yTop = 280 - ((stat.avg + stat.sd - minPrice) / priceRange) * 250;
                const yBottom = 280 - ((stat.avg - stat.sd - minPrice) / priceRange) * 250;
                
                // Clamp values to chart bounds
                const clampedYTop = Math.max(30, Math.min(280, yTop));
                const clampedYBottom = Math.max(30, Math.min(280, yBottom));
                const clampedYCenter = Math.max(30, Math.min(280, yCenter));
                
                return (
                  <g key={stat.round}>
                    {/* Error bar */}
                    <line
                      x1={x}
                      y1={clampedYTop}
                      x2={x}
                      y2={clampedYBottom}
                      stroke="#94a3b8"
                      strokeWidth="3"
                    />
                    {/* Top cap */}
                    <line
                      x1={x - 6}
                      y1={clampedYTop}
                      x2={x + 6}
                      y2={clampedYTop}
                      stroke="#94a3b8"
                      strokeWidth="3"
                    />
                    {/* Bottom cap */}
                    <line
                      x1={x - 6}
                      y1={clampedYBottom}
                      x2={x + 6}
                      y2={clampedYBottom}
                      stroke="#94a3b8"
                      strokeWidth="3"
                    />
                    {/* Line to next point */}
                    {index < roundStats.length - 1 && roundStats[index + 1].round === stat.round + 1 && (
                      (() => {
                        const nextStat = roundStats[index + 1];
                        const nextX = 80 + (nextStat.round - 1) * (chartWidth / (totalRounds - 1 || 1));
                        const nextYCenter = 280 - ((nextStat.avg - minPrice) / priceRange) * 250;
                        const clampedNextYCenter = Math.max(30, Math.min(280, nextYCenter));
                        return (
                          <line
                            x1={x}
                            y1={clampedYCenter}
                            x2={nextX}
                            y2={clampedNextYCenter}
                            stroke="#3b82f6"
                            strokeWidth="3"
                          />
                        );
                      })()
                    )}
                    {/* Data point */}
                    <circle
                      cx={x}
                      cy={clampedYCenter}
                      r="6"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPoint(stat.round)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                    
                    {/* Tooltip */}
                    {hoveredPoint === stat.round && (
                      <g>
                        <rect
                          x={x - 60}
                          y={clampedYCenter - 45}
                          width="120"
                          height="35"
                          fill="rgba(0, 0, 0, 0.85)"
                          rx="4"
                          ry="4"
                        />
                        <text
                          x={x}
                          y={clampedYCenter - 30}
                          textAnchor="middle"
                          fill="white"
                          fontSize="11"
                          fontWeight="600"
                        >
                          Round {stat.round}
                        </text>
                        <text
                          x={x}
                          y={clampedYCenter - 15}
                          textAnchor="middle"
                          fill="white"
                          fontSize="13"
                          fontWeight="700"
                        >
                          ${stat.avg.toFixed(2)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              
              {/* Axis labels */}
              <text x="500" y="330" textAnchor="middle" fill="#374151" fontSize="16" fontWeight="600">
                Round
              </text>
              <text x="30" y="155" textAnchor="middle" fill="#374151" fontSize="16" fontWeight="600" transform="rotate(-90 30 155)">
                Price
              </text>
            </svg>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', marginTop: '1rem', marginBottom: 0 }}>
              Blue line shows average price, gray bars show standard deviation (±1 SD)
            </p>
          </div>
        </div>
      )}

      {/* Pair Profit Table */}
      {pairProfits.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>💰 Total Profit by Pair</h3>
          <div style={{
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white',
            overflow: 'visible',
            position: 'relative'
          }}>
            <table className="table" style={{ overflow: 'visible' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>Rank</th>
                  <th style={{ textAlign: 'center' }}>Pair</th>
                  <th>Player A</th>
                  <th>Player B</th>
                  <th style={{ textAlign: 'right' }}>Total Profit</th>
                </tr>
              </thead>
              <tbody>
                {pairProfits.map((pair, index) => {
                  const colors = ['#fef3c7', '#e0e7ff', '#fed7aa', 'white'];
                  const rankColors = ['#f59e0b', '#6366f1', '#f97316', '#6b7280'];
                  const backgroundColor = index < 3 ? colors[index] : colors[3];
                  const rankColor = index < 3 ? rankColors[index] : rankColors[3];
                  const isHovered = hoveredPair === pair.pairId;
                  
                  return (
                    <tr 
                      key={pair.pairId}
                      style={{ 
                        backgroundColor,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = index < 3 ? backgroundColor : '#f9fafb';
                        e.currentTarget.style.transform = 'scale(1.01)';
                        setHoveredPair(pair.pairId);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = backgroundColor;
                        e.currentTarget.style.transform = 'scale(1)';
                        setHoveredPair(null);
                      }}
                    >
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.2rem', color: rankColor }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '1rem' }}>
                        Pair {index + 1}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        👤 {pair.playerA}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        👤 {pair.playerB}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: '#10b981', position: 'relative' }}>
                        ${pair.totalProfit.toFixed(2)}
                        
                        {/* Price History Tooltip */}
                        {isHovered && pair.priceHistoryA && pair.priceHistoryA.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: '0',
                            marginTop: '0.5rem',
                            backgroundColor: 'white',
                            border: '2px solid #3b82f6',
                            borderRadius: '8px',
                            padding: '1rem',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                            zIndex: 1000,
                            minWidth: '400px'
                          }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
                              💰 Price History
                            </div>
                            
                            {/* Table format */}
                            <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.85rem'
                            }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f3f4f6' }}>
                                  <th style={{ 
                                    padding: '0.5rem',
                                    textAlign: 'left',
                                    fontWeight: 600,
                                    color: '#374151',
                                    borderBottom: '2px solid #d1d5db'
                                  }}>
                                    Player
                                  </th>
                                  {pair.priceHistoryA.map((_, i) => (
                                    <th key={i} style={{
                                      padding: '0.5rem',
                                      textAlign: 'center',
                                      fontWeight: 600,
                                      color: '#374151',
                                      borderBottom: '2px solid #d1d5db'
                                    }}>
                                      R{i+1}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {/* Player A Row */}
                                <tr style={{ backgroundColor: '#dbeafe' }}>
                                  <td style={{
                                    padding: '0.5rem',
                                    fontWeight: 600,
                                    color: '#1e40af',
                                    borderBottom: '1px solid #d1d5db'
                                  }}>
                                    {pair.playerA}
                                  </td>
                                  {pair.priceHistoryA.map((price, i) => (
                                    <td key={i} style={{
                                      padding: '0.5rem',
                                      textAlign: 'center',
                                      fontWeight: 600,
                                      color: '#1f2937',
                                      borderBottom: '1px solid #d1d5db'
                                    }}>
                                      ${price.toFixed(1)}
                                    </td>
                                  ))}
                                </tr>
                                {/* Player B Row */}
                                <tr style={{ backgroundColor: '#fef3c7' }}>
                                  <td style={{
                                    padding: '0.5rem',
                                    fontWeight: 600,
                                    color: '#92400e'
                                  }}>
                                    {pair.playerB}
                                  </td>
                                  {pair.priceHistoryB.map((price, i) => (
                                    <td key={i} style={{
                                      padding: '0.5rem',
                                      textAlign: 'center',
                                      fontWeight: 600,
                                      color: '#1f2937'
                                    }}>
                                      ${price.toFixed(1)}
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual Player Profits by Pair - Only show for completed games */}
      {session?.status === 'complete' && individualProfits.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>👥 Individual Player Profits by Pair</h3>
          <div style={{
            padding: '2rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}>
            <svg width="100%" height="400" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid meet">
              {/* Y-axis */}
              <line x1="80" y1="30" x2="80" y2="330" stroke="#d1d5db" strokeWidth="2" />
              {/* X-axis */}
              <line x1="80" y1="330" x2="950" y2="330" stroke="#d1d5db" strokeWidth="2" />
              
              {/* Y-axis labels (Profit) */}
              {(() => {
                const allProfits = individualProfits.flatMap(p => [p.profitA, p.profitB]);
                const maxProfit = Math.max(...allProfits, 0);
                const minProfit = Math.min(...allProfits, 0);
                const profitRange = maxProfit - minProfit || 1;
                const yLabels = [];
                const numLabels = 6;
                
                for (let i = 0; i <= numLabels; i++) {
                  const value = minProfit + (profitRange * i / numLabels);
                  const y = 330 - (i / numLabels) * 300;
                  yLabels.push(
                    <g key={`ylabel-${i}`}>
                      <line x1="75" y1={y} x2="80" y2={y} stroke="#9ca3af" strokeWidth="1" />
                      <line x1="80" y1={y} x2="950" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
                      <text x="70" y={y + 5} textAnchor="end" fill="#6b7280" fontSize="14" fontWeight="500">
                        ${value.toFixed(0)}
                      </text>
                    </g>
                  );
                }
                return yLabels;
              })()}
              
              {/* X-axis labels (Pairs) */}
              {individualProfits.map((pair, index) => {
                const numPairs = individualProfits.length;
                const chartWidth = 870;
                const spacing = chartWidth / (numPairs + 1);
                const x = 80 + spacing * (index + 1);
                
                return (
                  <g key={`xlabel-${pair.pairIndex}`}>
                    <line x1={x} y1="330" x2={x} y2="335" stroke="#9ca3af" strokeWidth="1" />
                    <text x={x} y="350" textAnchor="middle" fill="#6b7280" fontSize="13" fontWeight="600">
                      Pair {pair.pairIndex}
                    </text>
                  </g>
                );
              })}
              
              {/* Data points for each pair */}
              {individualProfits.map((pair, index) => {
                const allProfits = individualProfits.flatMap(p => [p.profitA, p.profitB]);
                const maxProfit = Math.max(...allProfits, 0);
                const minProfit = Math.min(...allProfits, 0);
                const profitRange = maxProfit - minProfit || 1;
                
                const numPairs = individualProfits.length;
                const chartWidth = 870;
                const spacing = chartWidth / (numPairs + 1);
                const x = 80 + spacing * (index + 1);
                
                const yA = 330 - ((pair.profitA - minProfit) / profitRange) * 300;
                const yB = 330 - ((pair.profitB - minProfit) / profitRange) * 300;
                
                return (
                  <g key={`points-${pair.pairIndex}`}>
                    {/* Vertical line connecting the two players */}
                    <line
                      x1={x}
                      y1={yA}
                      x2={x}
                      y2={yB}
                      stroke="#cbd5e1"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                    
                    {/* Player A point (blue) */}
                    <circle
                      cx={x}
                      cy={yA}
                      r="8"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPlayerPoint(`${pair.pairIndex}-A`)}
                      onMouseLeave={() => setHoveredPlayerPoint(null)}
                    />
                    <text
                      x={x}
                      y={yA - 15}
                      textAnchor="middle"
                      fill="#1e40af"
                      fontSize="11"
                      fontWeight="600"
                    >
                      ${pair.profitA.toFixed(0)}
                    </text>
                    
                    {/* Tooltip for Player A */}
                    {hoveredPlayerPoint === `${pair.pairIndex}-A` && (
                      <g>
                        <rect
                          x={x - 70}
                          y={yA - 60}
                          width="140"
                          height="35"
                          fill="rgba(59, 130, 246, 0.95)"
                          rx="4"
                          ry="4"
                        />
                        <text
                          x={x}
                          y={yA - 40}
                          textAnchor="middle"
                          fill="white"
                          fontSize="12"
                          fontWeight="600"
                        >
                          {pair.playerA}
                        </text>
                      </g>
                    )}
                    
                    {/* Player B point (green) */}
                    <circle
                      cx={x}
                      cy={yB}
                      r="8"
                      fill="#10b981"
                      stroke="white"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPlayerPoint(`${pair.pairIndex}-B`)}
                      onMouseLeave={() => setHoveredPlayerPoint(null)}
                    />
                    <text
                      x={x}
                      y={yB - 15}
                      textAnchor="middle"
                      fill="#059669"
                      fontSize="11"
                      fontWeight="600"
                    >
                      ${pair.profitB.toFixed(0)}
                    </text>
                    
                    {/* Tooltip for Player B */}
                    {hoveredPlayerPoint === `${pair.pairIndex}-B` && (
                      <g>
                        <rect
                          x={x - 70}
                          y={yB + 20}
                          width="140"
                          height="35"
                          fill="rgba(16, 185, 129, 0.95)"
                          rx="4"
                          ry="4"
                        />
                        <text
                          x={x}
                          y={yB + 42}
                          textAnchor="middle"
                          fill="white"
                          fontSize="12"
                          fontWeight="600"
                        >
                          {pair.playerB}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              
              {/* Legend */}
              <g transform="translate(800, 370)">
                <circle cx="10" cy="0" r="6" fill="#3b82f6" stroke="white" strokeWidth="2" />
                <text x="20" y="5" fill="#374151" fontSize="12" fontWeight="500">Player A</text>
                
                <circle cx="100" cy="0" r="6" fill="#10b981" stroke="white" strokeWidth="2" />
                <text x="110" y="5" fill="#374151" fontSize="12" fontWeight="500">Player B</text>
              </g>
              
              {/* Axis labels */}
              <text x="40" y="180" textAnchor="middle" fill="#6b7280" fontSize="14" fontWeight="600" transform="rotate(-90, 40, 180)">
                Profit ($)
              </text>
              <text x="515" y="385" textAnchor="middle" fill="#6b7280" fontSize="14" fontWeight="600">
                Pairs
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowEndConfirm(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '500px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: '#dc2626' }}>⚠️ End Session?</h2>
            <p style={{ fontSize: '1rem', marginBottom: '1rem' }}>
              Are you sure you want to end this session?
            </p>
            {session?.status === 'running' && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#fef3c7',
                borderLeft: '4px solid #f59e0b',
                marginBottom: '1.5rem',
                borderRadius: '4px'
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>
                  ⚠️ WARNING: The game is still in progress!
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                  Ending now will stop the current round and mark the session as complete.
                  All students will be notified that the session has ended.
                </p>
              </div>
            )}
            {session?.status === 'lobby' && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                The session hasn't started yet. Students will see that it has been ended.
              </p>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#e5e7eb',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEnd}
                style={{
                  padding: '0.5rem 1.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
