import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { socket } from '../socket.js';
import { StudentView } from '../components/StudentView.jsx';
import { InstructorDashboard } from '../components/InstructorDashboard.jsx';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || '').trim();

function buildApiUrl(path) {
  if (!API_BASE_URL) {
    return `/api${path}`;
  }
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${normalizedBase}${path}`;
}

export default function SessionPage() {
  const { sessionCode, studentId: studentCodeFromUrl } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isManagePage = location.pathname.startsWith('/manage/');
  const navigationState = location?.state;
  
  // Check if we should auto-join (and thus show loading immediately)
  const shouldAutoJoinInstructor = isManagePage && (
    navigationState?.instructorName || 
    localStorage.getItem(`instructor_${sessionCode}`)
  );
  const shouldAutoJoinStudent = !isManagePage && (
    (studentCodeFromUrl && localStorage.getItem(`student_${sessionCode}_${studentCodeFromUrl}`)) ||
    navigationState?.studentName
  );
  const shouldAutoJoin = shouldAutoJoinInstructor || shouldAutoJoinStudent;
  
  const [session, setSession] = useState(null);
  const [joinInfo, setJoinInfo] = useState(null);
  const [isCompletedSession, setIsCompletedSession] = useState(false);
  const [roundInfo, setRoundInfo] = useState(null);
  const [timer, setTimer] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [leaderboardData, setLeaderboardData] = useState(new Map());
  const [latestRoundSummary, setLatestRoundSummary] = useState(null);
  const [allRoundSummaries, setAllRoundSummaries] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [isJoining, setIsJoining] = useState(shouldAutoJoin); // Start as true if auto-joining
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [nextRoundCountdown, setNextRoundCountdown] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [opponentName, setOpponentName] = useState(null);

  useEffect(() => {
    const handleJoinedSession = async payload => {
      setJoinInfo(payload);
      setUserRole(payload.role);
      
      // Only clear history/results if this is a NEW join (status is lobby)
      // For rejoins during active games, keep the existing state
      if (payload.status === 'lobby') {
        setRoundInfo(null);
        setHistory([]);
        setLatestResult(null);
        setLeaderboardData(new Map());
        setLatestRoundSummary(null);
        setAllRoundSummaries([]);
      }
      
      // If session is complete and we're an instructor, load historical data from database
      if (payload.status === 'complete' && payload.role === 'instructor') {
        console.log('[SessionPage] Detected completed session, fetching historical data...');
        try {
          const url = buildApiUrl(`/session/${sessionCode}`);
          console.log('[SessionPage] Fetching from:', url);
          const response = await fetch(url);
          console.log('[SessionPage] Response status:', response.status);
          if (response.ok) {
            const sessionData = await response.json();
            console.log('[SessionPage] Fetched session data:', sessionData);
            setIsCompletedSession(true);
            
            // Reconstruct allRoundSummaries from the fetched data
            if (sessionData.rounds && sessionData.rounds.length > 0) {
              const reconstructedSummaries = sessionData.rounds.map(round => ({
                round: round.round,
                results: round.results
              }));
              console.log('[SessionPage] Reconstructed summaries:', reconstructedSummaries.length);
              setAllRoundSummaries(reconstructedSummaries);
              setLatestRoundSummary(reconstructedSummaries[reconstructedSummaries.length - 1] || null);
              
              // Reconstruct leaderboard data
              const leaderboardMap = new Map();
              sessionData.rounds.forEach(round => {
                round.results.forEach(result => {
                  const existing = leaderboardMap.get(result.playerName) || { 
                    name: result.playerName,
                    totalProfit: 0 
                  };
                  existing.totalProfit += result.profit;
                  leaderboardMap.set(result.playerName, existing);
                });
              });
              console.log('[SessionPage] Reconstructed leaderboard:', leaderboardMap.size, 'players');
              setLeaderboardData(leaderboardMap);
            }
          }
        } catch (err) {
          console.error('[SessionPage] Failed to fetch completed session data:', err);
        }
      }
      
      setErrorMessage('');
      setIsJoining(false);
      
      // Update userName state with the confirmed name from server
      if (payload.playerName) {
        setUserName(payload.playerName);
      }
      
      // Store student name in localStorage for auto-rejoin on refresh
      if (payload.role === 'student' && payload.studentCode && payload.playerName) {
        const storageKey = `student_${sessionCode}_${payload.studentCode}`;
        const storageData = {
          name: payload.playerName,
          timestamp: Date.now() // Store when they joined
        };
        localStorage.setItem(storageKey, JSON.stringify(storageData));
      }
      
      // Store instructor name in localStorage for auto-rejoin on refresh
      if (payload.role === 'instructor' && payload.playerName) {
        const instructorStorageKey = `instructor_${sessionCode}`;
        localStorage.setItem(instructorStorageKey, payload.playerName);
      }
      
      // If student just joined and got a new code, redirect to personal URL
      if (payload.studentCode && !studentCodeFromUrl && payload.role === 'student') {
        navigate(`/session/${sessionCode}/${payload.studentCode}`, { replace: true });
      }
    };
    
    const handleSessionUpdate = payload => {
      setSession(payload);
    };
    
    const handleRoundStarted = payload => {
      setRoundInfo(payload);
      setRoundActive(true);
      // If payload includes hasSubmitted (when rejoining), use it; otherwise default to false
      setHasSubmitted(payload.hasSubmitted || false);
      setTimer(payload.roundTime);
      setNextRoundCountdown(null); // Clear countdown when new round starts
      
      // Store the round start time for client-side fallback timer
      sessionStorage.setItem('roundStartTime', Date.now().toString());
      sessionStorage.setItem('roundDuration', payload.roundTime.toString());
    };
    
    const handleRoundResults = payload => {
      setLatestResult(payload);
      setHistory(payload.history || []);
      setHasSubmitted(true);
      setRoundActive(false);
      
      // Clear round timer from session storage
      sessionStorage.removeItem('roundStartTime');
      sessionStorage.removeItem('roundDuration');
    };
    
    const handleTimerUpdate = payload => {
      setTimer(payload.remaining);
      // Update last server time
      sessionStorage.setItem('lastServerTime', Date.now().toString());
      sessionStorage.setItem('lastServerTimer', payload.remaining.toString());
    };
    
    const handleNextRoundCountdown = payload => {
      setNextRoundCountdown(payload.countdown);
      setRoundActive(false);
      setTimer(0);
    };
    
    const handleRoundSummary = payload => {
      setLatestRoundSummary(payload);
      setAllRoundSummaries(prev => [...prev, payload]);
      setLeaderboardData(prev => {
        const next = new Map(prev);
        payload.results.forEach(result => {
          [result.playerA, result.playerB].forEach(entry => {
            const current = next.get(entry.socketId) || {
              socketId: entry.socketId,
              name: entry.name || entry.socketId,
              totalProfit: 0
            };
            current.name = entry.name || current.name;
            current.totalProfit += entry.profit;
            next.set(entry.socketId, current);
          });
        });
        return next;
      });
    };
    
    const handleSessionComplete = payload => {
      setRoundActive(false);
      setLatestRoundSummary(payload.rounds[payload.rounds.length - 1] || null);
      
      // Solution #1: Clear localStorage when session ends
      if (studentCodeFromUrl && sessionCode) {
        const storageKey = `student_${sessionCode}_${studentCodeFromUrl}`;
        localStorage.removeItem(storageKey);
        console.log('Session completed - cleared stored session data');
      }
    };
    
    const handleError = async (message) => {
      console.log('[SessionPage] Error received:', message);
      
      // If session not found in memory, try fetching from database (completed sessions)
      // But only if we're not currently joining for the first time (which might be a timing issue)
      if ((message.includes('Session not found') || message.includes('has ended')) && hasAttemptedJoin) {
        try {
          const response = await fetch(buildApiUrl(`/session/${sessionCode}`));
          if (response.ok) {
            const sessionData = await response.json();
            
            // Only mark as completed if it's actually complete
            if (sessionData.status === 'complete') {
              console.log('[SessionPage] Session is complete, entering read-only mode');
              setIsCompletedSession(true);
              setSession({
                code: sessionData.code,
                sessionName: sessionData.sessionName,
                instructorName: sessionData.instructorName,
                status: sessionData.status,
                config: sessionData.config,
                currentRound: sessionData.config.rounds,
                players: sessionData.players || []
              });
              
              // Reconstruct allRoundSummaries from the fetched data
              if (sessionData.rounds && sessionData.rounds.length > 0) {
                const reconstructedSummaries = sessionData.rounds.map(round => ({
                  round: round.round,
                  results: round.results
                }));
                setAllRoundSummaries(reconstructedSummaries);
                setLatestRoundSummary(reconstructedSummaries[reconstructedSummaries.length - 1] || null);
                
                // Reconstruct leaderboard data
                const leaderboardMap = new Map();
                sessionData.rounds.forEach(round => {
                  round.results.forEach(result => {
                    const existing = leaderboardMap.get(result.playerName) || { 
                      name: result.playerName,
                      totalProfit: 0 
                    };
                    existing.totalProfit += result.profit;
                    leaderboardMap.set(result.playerName, existing);
                  });
                });
                setLeaderboardData(leaderboardMap);
              }
              
              setJoinInfo({ role: 'instructor', code: sessionData.code });
              setUserRole('instructor');
              setIsJoining(false);
              setHasAttemptedJoin(true);
              return;
            } else {
              // Session exists but is not complete - this might be a timing issue
              console.log('[SessionPage] Session exists but not complete, retrying join...');
              // Wait a moment and retry
              setTimeout(() => {
                if (isManagePage && userName) {
                  socket.emit('joinSession', {
                    sessionCode,
                    playerName: userName,
                    role: 'instructor'
                  });
                }
              }, 500);
              return;
            }
          }
        } catch (err) {
          console.error('[SessionPage] Failed to fetch completed session:', err);
        }
      }
      setErrorMessage(message);
      setIsJoining(false);
    };

    const handleChatMessage = (payload) => {
      setChatMessages(prev => [...prev, payload]);
    };

    const handleOpponentInfo = (payload) => {
      setOpponentName(payload.opponentName);
    };

    socket.on('joinedSession', handleJoinedSession);
    socket.on('sessionUpdate', handleSessionUpdate);
    socket.on('roundStarted', handleRoundStarted);
    socket.on('timerUpdate', handleTimerUpdate);
    socket.on('roundResults', handleRoundResults);
    socket.on('roundSummary', handleRoundSummary);
    socket.on('nextRoundCountdown', handleNextRoundCountdown);
    socket.on('sessionComplete', handleSessionComplete);
    socket.on('errorMessage', handleError);
    socket.on('chatMessage', handleChatMessage);
    socket.on('opponentInfo', handleOpponentInfo);

    return () => {
      socket.off('joinedSession', handleJoinedSession);
      socket.off('sessionUpdate', handleSessionUpdate);
      socket.off('roundStarted', handleRoundStarted);
      socket.off('timerUpdate', handleTimerUpdate);
      socket.off('roundResults', handleRoundResults);
      socket.off('roundSummary', handleRoundSummary);
      socket.off('nextRoundCountdown', handleNextRoundCountdown);
      socket.off('sessionComplete', handleSessionComplete);
      socket.off('errorMessage', handleError);
      socket.off('chatMessage', handleChatMessage);
      socket.off('opponentInfo', handleOpponentInfo);
    };
  }, []);

  // Client-side fallback timer - runs every second to keep timer updated even if socket fails
  useEffect(() => {
    if (!roundActive || hasSubmitted) return;
    
    const fallbackTimer = setInterval(() => {
      const roundStartTime = parseInt(sessionStorage.getItem('roundStartTime'));
      const roundDuration = parseInt(sessionStorage.getItem('roundDuration'));
      const lastServerTime = parseInt(sessionStorage.getItem('lastServerTime'));
      const lastServerTimer = parseInt(sessionStorage.getItem('lastServerTimer'));
      
      if (roundStartTime && roundDuration) {
        // Calculate client-side remaining time
        const elapsed = (Date.now() - roundStartTime) / 1000;
        const clientRemaining = Math.max(0, Math.ceil(roundDuration - elapsed));
        
        // If we have recent server data (within 3 seconds), use it
        // Otherwise use client-side calculation
        if (lastServerTime && lastServerTimer && (Date.now() - lastServerTime) < 3000) {
          // Server data is recent, trust it
          setTimer(lastServerTimer);
        } else {
          // No recent server data, use client calculation
          setTimer(clientRemaining);
        }
        
        // If timer reaches 0, clean up
        if (clientRemaining <= 0) {
          sessionStorage.removeItem('roundStartTime');
          sessionStorage.removeItem('roundDuration');
        }
      }
    }, 1000);
    
    return () => clearInterval(fallbackTimer);
  }, [roundActive, hasSubmitted]);

  // Handle page visibility changes (mobile app switching)
  useEffect(() => {
    let wasHidden = false;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page became hidden (user switched apps)
        wasHidden = true;
        console.log('Page hidden - user switched apps');
      } else if (wasHidden) {
        // Page became visible again after being hidden
        console.log('Page visible again - checking connection...');
        
        // Check if socket is disconnected
        if (!socket.connected) {
          console.log('Socket disconnected - reconnecting...');
          socket.connect();
        }
        
        // If we have joinInfo (were in a session), force a rejoin to refresh state
        if (joinInfo && sessionCode) {
          console.log('Refreshing session state...');
          
          // Wait a moment for socket to reconnect, then rejoin
          setTimeout(() => {
            if (joinInfo.role === 'student' && studentCodeFromUrl) {
              socket.emit('joinSession', {
                sessionCode,
                playerName: joinInfo.playerName,
                studentCode: studentCodeFromUrl,
                role: 'student'
              });
            } else if (joinInfo.role === 'instructor') {
              socket.emit('joinSession', {
                sessionCode,
                playerName: joinInfo.playerName,
                role: 'instructor'
              });
            }
          }, 500); // Give socket 500ms to reconnect
        }
        
        wasHidden = false;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [joinInfo, sessionCode, studentCodeFromUrl]);

  // Auto-join if coming from instructor or student page, or if student code in URL
  useEffect(() => {
    if (hasAttemptedJoin || joinInfo) return;
    
    // If on /manage/ route, it's an instructor
    if (isManagePage) {
      const state = navigationState;
      // Try navigation state first, then check localStorage
      const instructorStorageKey = `instructor_${sessionCode}`;
      const storedInstructorName = localStorage.getItem(instructorStorageKey);
      const instructorName = state?.instructorName || storedInstructorName;
      
      if (instructorName) {
        setUserName(instructorName);
        setIsJoining(true);
        setHasAttemptedJoin(true);
        socket.emit('joinSession', {
          sessionCode,
          playerName: instructorName,
          role: 'instructor'
        });
      }
    } else if (studentCodeFromUrl) {
      // If student code is in URL, this is a personal link
      // Try to get stored name from localStorage
      const storageKey = `student_${sessionCode}_${studentCodeFromUrl}`;
      const storedData = localStorage.getItem(storageKey);
      
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          const EIGHT_MINUTES = 8 * 60 * 1000; // 8 minutes in milliseconds
          const age = Date.now() - parsed.timestamp;
          
          // Only auto-rejoin if data is less than 8 minutes old
          if (age < EIGHT_MINUTES) {
            // Auto-rejoin with stored name
            setUserName(parsed.name);
            setIsJoining(true);
            setHasAttemptedJoin(true);
            socket.emit('joinSession', {
              sessionCode,
              playerName: parsed.name,
              studentCode: studentCodeFromUrl,
              role: 'student'
            });
          } else {
            // Data is too old, clear it
            console.log('Session data expired (>8 minutes), clearing...');
            localStorage.removeItem(storageKey);
          }
        } catch (err) {
          // Invalid JSON format (old data format), clear it
          console.log('Invalid stored data format, clearing...');
          localStorage.removeItem(storageKey);
        }
      }
      // If no stored name, user will need to enter it in the form below
    } else {
      // On /session/ route without student code, check for navigation state
      const state = navigationState;
      if (state?.studentName) {
        setUserName(state.studentName);
        setIsJoining(true);
        setHasAttemptedJoin(true);
        socket.emit('joinSession', {
          sessionCode,
          playerName: state.studentName,
          role: 'student'
        });
      }
    }
  }, [sessionCode, studentCodeFromUrl, hasAttemptedJoin, joinInfo, isManagePage, navigationState]);

  const leaderboard = useMemo(() => {
    return Array.from(leaderboardData.values())
      .sort((a, b) => b.totalProfit - a.totalProfit);
  }, [leaderboardData]);

  const handleStartSession = () => {
    if (!sessionCode) return;
    setErrorMessage('');
    socket.emit('startSession', { sessionCode });
  };

  const handleEndSession = () => {
    if (!sessionCode) return;
    setErrorMessage('');
    socket.emit('endSession', { sessionCode });
  };

  const handleSubmitPrice = price => {
    if (!sessionCode) return;
    socket.emit('submitPrice', { sessionCode, price });
    setHasSubmitted(true); // Immediately show "waiting for others" message
  };

  const priceBounds = useMemo(() => {
    if (session?.config?.priceBounds) return session.config.priceBounds;
    return { min: 0, max: 100 };
  }, [session?.config?.priceBounds]);

  const handleJoinAsStudent = (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      setErrorMessage('Please enter your name');
      return;
    }
    setIsJoining(true);
    setHasAttemptedJoin(true);
    socket.emit('joinSession', {
      sessionCode,
      playerName: userName,
      studentCode: studentCodeFromUrl || undefined,
      role: 'student'
    });
  };

  const handleJoinAsInstructor = (e) => {
    e.preventDefault();
    if (!userName.trim()) {
      setErrorMessage('Please enter your name');
      return;
    }
    setIsJoining(true);
    socket.emit('joinSession', {
      sessionCode,
      playerName: userName,
      role: 'instructor'
    });
  };

  // If not joined yet, show join form or loading
  if (!joinInfo) {
    // If on /manage/ route, show instructor join form or loading
    if (isManagePage) {
      // Show loading screen if already attempting to join
      if (isJoining) {
        return (
          <div className="app-shell">
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ 
                fontSize: '3rem',
                marginBottom: '1rem',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                🎮
              </div>
              <h2 style={{ color: '#6b7280', marginBottom: '0.5rem' }}>Loading Session...</h2>
              <p style={{ color: '#9ca3af' }}>Please wait a moment</p>
            </div>
          </div>
        );
      }
      
      return (
        <div className="app-shell">
          <div className="card">
            <h2>Manage Session: {sessionCode}</h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Enter your instructor name to access the dashboard</p>
            <form onSubmit={handleJoinAsInstructor} style={{ display: 'grid', gap: '1rem', maxWidth: '400px' }}>
              <div className="input-row">
                <label htmlFor="name">Instructor Name</label>
                <input
                  id="name"
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your instructor name"
                  required
                  disabled={isJoining}
                />
              </div>
              <button type="submit" className="primary" disabled={isJoining}>
                {isJoining ? 'Accessing...' : 'Access Dashboard'}
              </button>
            </form>
            {errorMessage && <p style={{ color: '#dc2626', marginTop: '1rem' }}>{errorMessage}</p>}
            <div style={{ marginTop: '1.5rem' }}>
              <button onClick={() => navigate('/instructor')}>Back to Instructor Portal</button>
            </div>
          </div>
        </div>
      );
    }
    
    // Otherwise show student join form or loading if auto-rejoining
    // Show loading screen if already attempting to join (auto-rejoin)
    if (isJoining) {
      return (
        <div className="app-shell">
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ 
              fontSize: '3rem',
              marginBottom: '1rem',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              🎮
            </div>
            <h2 style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
              {studentCodeFromUrl ? 'Rejoining Session...' : 'Joining Session...'}
            </h2>
            <p style={{ color: '#9ca3af' }}>Please wait a moment</p>
          </div>
        </div>
      );
    }
    
    // Show join form only if not auto-rejoining
    return (
      <div className="app-shell">
        <div className="card">
          <h2>Join Session: {sessionCode}</h2>
          {studentCodeFromUrl && (
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Welcome back! Enter your name to rejoin your game.
            </p>
          )}
          <form onSubmit={handleJoinAsStudent} style={{ display: 'grid', gap: '1rem', maxWidth: '400px' }}>
            <div className="input-row">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={studentCodeFromUrl ? "Enter your full name (e.g., John Smith)" : "Enter your name"}
                required
                disabled={isJoining}
              />
              {studentCodeFromUrl && (
                <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Must match the name you used when you first joined
                </small>
              )}
            </div>
            <button type="submit" className="primary" disabled={isJoining}>
              {isJoining ? 'Joining...' : (studentCodeFromUrl ? 'Rejoin Game' : 'Join as Student')}
            </button>
          </form>
          {errorMessage && <p style={{ color: '#dc2626', marginTop: '1rem' }}>{errorMessage}</p>}
          <div style={{ marginTop: '1.5rem' }}>
            <button onClick={() => navigate('/')}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  // Handle sending chat messages
  const handleSendChatMessage = (message) => {
    socket.emit('chatMessage', { sessionCode, message });
  };

  // If joined as instructor
  if (userRole === 'instructor') {
    const studentCount = session?.players?.filter(player => player.role === 'student').length || 0;
    const canStart = session?.status === 'lobby' && studentCount >= 1;
    let startDisabledReason = '';
    if (session?.status === 'lobby' && studentCount < 1) {
      startDisabledReason = 'Need at least one student to start';
    } else if (session && session.status !== 'lobby') {
      startDisabledReason = 'Game already in progress';
    }

    return (
      <div className="app-shell">
        {isCompletedSession && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#dbeafe',
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0, color: '#1e40af', fontWeight: 600 }}>
              📋 Viewing archived session (read-only mode)
            </p>
          </div>
        )}
        <InstructorDashboard
          instructorName={userName || session?.instructorName}
          session={session}
          canStart={canStart && !isCompletedSession}
          startDisabledReason={startDisabledReason}
          onStart={handleStartSession}
          onEndSession={handleEndSession}
          leaderboard={leaderboard}
          latestRound={latestRoundSummary}
          allRounds={allRoundSummaries}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage('')}
          timer={timer}
          roundActive={roundActive}
          nextRoundCountdown={nextRoundCountdown}
        />
      </div>
    );
  }

  // If joined as student
  const personalLink = joinInfo?.playerLink || (studentCodeFromUrl ? `/session/${sessionCode}/${studentCodeFromUrl}` : null);
  
  return (
    <div className="app-shell">
      <StudentView
        sessionCode={sessionCode}
        sessionStatus={session?.status}
        currentRound={roundInfo?.round || session?.currentRound || 0}
        roundActive={roundActive}
        timer={timer}
        priceBounds={priceBounds}
        onSubmitPrice={handleSubmitPrice}
        latestResult={latestResult}
        history={history}
        hasSubmitted={hasSubmitted}
        personalLink={personalLink}
        nextRoundCountdown={nextRoundCountdown}
        session={session}
        leaderboard={leaderboard}
        allRounds={allRoundSummaries}
        chatMessages={chatMessages}
        onSendChatMessage={handleSendChatMessage}
        currentSocketId={socket.id}
        opponentName={opponentName}
      />
    </div>
  );
}

