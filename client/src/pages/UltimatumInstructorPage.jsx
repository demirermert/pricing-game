import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { socket } from '../socket';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || '').trim();

function buildApiUrl(path) {
  if (!API_BASE_URL) {
    return `/api${path}`;
  }
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${normalizedBase}${path}`;
}

const DEFAULT_CONFIG = {
  rounds: 1,
  proposeTime: 10,
  respondTime: 10,
  totalAmount: 20,
  minOffer: 0,
  maxOffer: 20
};

export default function UltimatumInstructorPage() {
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [instructorConfig, setInstructorConfig] = useState(DEFAULT_CONFIG);
  const [errorMessage, setErrorMessage] = useState('');

  const instructorName = 'Instructor'; // Default single instructor name

  const handleCreateSession = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    try {
      const payload = {
        instructorName: instructorName,
        sessionName: sessionName.trim() || `${instructorName}'s Ultimatum Game`,
        gameType: 'ultimatum',
        config: {
          rounds: 1, // Always 1 round
          proposeTime: Number(instructorConfig.proposeTime),
          respondTime: Number(instructorConfig.respondTime),
          totalAmount: Number(instructorConfig.totalAmount),
          minOffer: Number(instructorConfig.minOffer),
          maxOffer: Number(instructorConfig.maxOffer)
        }
      };
      
      const response = await fetch(buildApiUrl('/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Failed to create session');
      }
      
      const data = await response.json();
      
      // Join as instructor via socket
      socket.emit('joinSession', {
        sessionCode: data.code,
        playerName: instructorName,
        role: 'instructor'
      });
      
      // Wait for join confirmation, then navigate
      socket.once('joinedSession', () => {
        navigate(`/ult/manage/${data.code}`);
      });
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="app-shell">
      <div className="card">
        <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Ultimatum Game - Instructor Dashboard</h1>
            <p style={{ color: '#6b7280' }}>Manage your game sessions</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/ult" style={{ textDecoration: 'none' }}>
              <button style={{ fontSize: '0.875rem' }}>Student View</button>
            </Link>
            <Link to="/instructor" style={{ textDecoration: 'none' }}>
              <button style={{ fontSize: '0.875rem' }}>Pricing Game</button>
            </Link>
          </div>
        </header>

        {/* Create New Session Section */}
        <section style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Create New Ultimatum Game Session</h2>
            <button 
              className="primary"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Hide Form' : 'New Game'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateSession} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
              <div className="input-row">
                <label htmlFor="session-name">Session Name</label>
                <input
                  id="session-name"
                  type="text"
                  value={sessionName}
                  onChange={event => setSessionName(event.target.value)}
                  placeholder={`e.g., "MBA Section A" or "Spring 2025"`}
                />
              </div>

              <div className="input-row">
                <label>Proposing Time (seconds)</label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={instructorConfig.proposeTime}
                  onChange={event => setInstructorConfig(cfg => ({ ...cfg, proposeTime: event.target.value }))}
                />
              </div>

              <div className="input-row">
                <label>Responding Time (seconds)</label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={instructorConfig.respondTime}
                  onChange={event => setInstructorConfig(cfg => ({ ...cfg, respondTime: event.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
                <div className="input-row">
                  <label>Total Amount ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={instructorConfig.totalAmount}
                    onChange={event => setInstructorConfig(cfg => ({ ...cfg, totalAmount: event.target.value }))}
                  />
                </div>
                <div className="input-row">
                  <label>Min Offer ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={instructorConfig.minOffer}
                    onChange={event => setInstructorConfig(cfg => ({ ...cfg, minOffer: event.target.value }))}
                  />
                </div>
                <div className="input-row">
                  <label>Max Offer ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={instructorConfig.maxOffer}
                    onChange={event => setInstructorConfig(cfg => ({ ...cfg, maxOffer: event.target.value }))}
                  />
                </div>
              </div>

              <div style={{
                padding: '1rem',
                backgroundColor: '#e0f2fe',
                borderRadius: '6px',
                borderLeft: '4px solid #0284c7',
                fontSize: '0.875rem',
                color: '#0c4a6e',
                marginTop: '0.5rem'
              }}>
                <strong>ℹ️ How it works:</strong> Students will be paired. Player 1 (Proposer) offers an amount to Player 2 (Responder).
                If accepted, P1 gets (Total - Offer) and P2 gets Offer. If rejected, both get $0.
              </div>

              <button type="submit" className="primary">
                Create Session
              </button>
              {errorMessage && <p style={{ color: '#dc2626' }}>{errorMessage}</p>}
            </form>
          )}
        </section>

        {/* Info Section */}
        <section>
          <div style={{
            padding: '2rem',
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h2 style={{ marginTop: 0, color: '#1f2937' }}>🤝 Ultimatum Game</h2>
            <p style={{ color: '#6b7280', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto 1rem auto' }}>
              The Ultimatum Game is a classic economic experiment where two players decide how to divide a sum of money.
              One player proposes a split, and the other can accept or reject it. If rejected, neither player gets anything.
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginTop: '1.5rem',
              textAlign: 'left'
            }}>
              <div style={{ padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👤</div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Player 1 (Proposer)</strong>
                <small style={{ color: '#6b7280' }}>Makes an offer on how to split the money</small>
              </div>
              <div style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👤</div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Player 2 (Responder)</strong>
                <small style={{ color: '#6b7280' }}>Accepts or rejects the offer</small>
              </div>
              <div style={{ padding: '1rem', backgroundColor: '#dcfce7', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>If Accepted</strong>
                <small style={{ color: '#6b7280' }}>Both players receive their shares</small>
              </div>
              <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>❌</div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>If Rejected</strong>
                <small style={{ color: '#6b7280' }}>Both players receive nothing</small>
              </div>
            </div>
            <p style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              backgroundColor: '#f9fafb', 
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: '#6b7280'
            }}>
              <strong>Tip:</strong> After creating a session, you'll get a 4-letter code to share with students.
              They can join at <code style={{ 
                backgroundColor: '#e5e7eb', 
                padding: '0.125rem 0.375rem', 
                borderRadius: '3px',
                fontFamily: 'monospace'
              }}>/ult</code>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
