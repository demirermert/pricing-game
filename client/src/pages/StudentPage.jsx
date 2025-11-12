import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';


// Random name generation
const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Parker',
  'Quinn', 'Reese', 'Cameron', 'Dakota', 'Skylar', 'Hayden', 'Rowan', 'Sage'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore'
];

function generateRandomName() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomNum = Math.floor(Math.random() * 1000);
  return `${firstName} ${lastName} ${randomNum}`;
}

export default function StudentPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleJoinSession = event => {
    event.preventDefault();
    setErrorMessage('');
    if (!sessionCodeInput.trim()) {
      setErrorMessage('Enter a session code');
      return;
    }
    
    // If names are not provided, generate a random name
    let fullName;
    if (!firstName.trim() || !lastName.trim()) {
      fullName = generateRandomName();
    } else {
      fullName = `${firstName.trim()} ${lastName.trim()}`;
    }
    
    // Redirect to session page (server will generate unique code)
    navigate(`/session/${sessionCodeInput.toUpperCase()}`, {
      state: { studentName: fullName }
    });
  };

  const renderStudentJoin = () => (
    <div className="card" style={{ position: 'relative' }}>
      {/* Left Logo - Top Left Corner */}
      <img 
        src="/course-logo.png" 
        alt="Course Logo"
        style={{ 
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          width: '140px',
          height: 'auto',
          opacity: 0.9
        }}
      />
      
      {/* MIT Sloan Logo - Top Right Corner */}
      <img 
        src="/sloan-logo.png" 
        alt="MIT Sloan School of Management"
        style={{ 
          position: 'absolute',
          top: '1.5rem',
          right: '0.5rem',
          width: '140px',
          height: 'auto',
          opacity: 0.9
        }}
      />

      {/* Header */}
      <div style={{ 
        textAlign: 'center',
        marginTop: '4rem',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <h1 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 700,
          color: '#1f2937',
          marginBottom: '0.5rem',
          marginTop: 0
        }}>
          Welcome to 15.010
        </h1>
        <p style={{ 
          fontSize: '1rem',
          color: '#6b7280',
          margin: 0
        }}>
          Economic Analysis of Business Decisions
        </p>
      </div>

      <form onSubmit={handleJoinSession} style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div className="input-row">
            <label htmlFor="first-name">First name</label>
            <input
              id="first-name"
              type="text"
              value={firstName}
              onChange={event => setFirstName(event.target.value)}
            />
          </div>
          <div className="input-row">
            <label htmlFor="last-name">Last name</label>
            <input
              id="last-name"
              type="text"
              value={lastName}
              onChange={event => setLastName(event.target.value)}
            />
          </div>
        </div>
        <div className="input-row">
          <label htmlFor="session-code">Session code</label>
          <input
            id="session-code"
            type="text"
            value={sessionCodeInput}
            onChange={event => setSessionCodeInput(event.target.value.toUpperCase())}
            required
          />
        </div>
        <button type="submit" className="primary">
          Join session
        </button>
      </form>
      {errorMessage && <p style={{ color: '#dc2626' }}>{errorMessage}</p>}
    </div>
  );

  return (
    <div className="app-shell">
      {renderStudentJoin()}
    </div>
  );
}

