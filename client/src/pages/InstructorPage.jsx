import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || '').trim();

function buildApiUrl(path) {
  if (!API_BASE_URL) {
    return `/api${path}`;
  }
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${normalizedBase}${path}`;
}

const INSTRUCTORS = [
  { name: 'Mert', color: '#3b82f6' },
  { name: 'Ellen', color: '#10b981' },
  { name: 'Charles', color: '#f59e0b' },
  { name: 'Ben', color: '#8b5cf6' }
];

export default function InstructorPage() {
  const navigate = useNavigate();
  const [instructorStats, setInstructorStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstructorStats();
  }, []);

  const fetchInstructorStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/sessions'));
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const allSessions = await response.json();
      
      // Calculate stats for each instructor
      const stats = {};
      INSTRUCTORS.forEach(instructor => {
        const instructorSessions = allSessions.filter(
          session => session.instructorName.toLowerCase() === instructor.name.toLowerCase()
        );
        stats[instructor.name] = {
          total: instructorSessions.length,
          recent: instructorSessions.slice(0, 3) // Get 3 most recent
        };
      });
      
      setInstructorStats(stats);
    } catch (err) {
      console.error('Failed to fetch instructor stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstructorClick = (instructorName) => {
    navigate(`/instructor/${instructorName.toLowerCase()}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderInstructorSelection = () => (
    <div className="card">
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Instructor Portal</h1>
          <p style={{ color: '#6b7280' }}>Select your profile to manage sessions</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/history" style={{ textDecoration: 'none' }}>
            <button style={{ fontSize: '0.875rem' }}>All History</button>
          </Link>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button style={{ fontSize: '0.875rem' }}>Student</button>
          </Link>
        </div>
      </header>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading...</p>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem' 
        }}>
          {INSTRUCTORS.map((instructor) => {
            const stats = instructorStats[instructor.name] || { total: 0, recent: [] };
            return (
              <div
                key={instructor.name}
                onClick={() => handleInstructorClick(instructor.name)}
                style={{
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: 'white'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = instructor.color;
                  e.currentTarget.style.boxShadow = `0 4px 6px -1px ${instructor.color}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: instructor.color }}>
                    {instructor.name}
                  </h2>
                  <span 
                    style={{ 
                      backgroundColor: instructor.color,
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                  >
                    {stats.total} sessions
                  </span>
                </div>
                
                {stats.recent && stats.recent.length > 0 ? (
                  <div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 600 }}>
                      Recent Sessions:
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {stats.recent.map((session) => (
                        <li 
                          key={session.code}
                          style={{ 
                            fontSize: '0.875rem', 
                            padding: '0.5rem', 
                            backgroundColor: '#f9fafb',
                            marginBottom: '0.5rem',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <strong>{session.sessionName || session.code}</strong>
                            <br />
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {formatDate(session.createdAt)}
                            </span>
                          </div>
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'white',
                            backgroundColor: session.status === 'complete' ? '#10b981' : session.status === 'running' ? '#3b82f6' : '#f59e0b'
                          }}>
                            {session.status.toUpperCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
                    No sessions yet
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      {renderInstructorSelection()}
    </div>
  );
}

