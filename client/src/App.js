import React, { useState } from 'react';
import './App.css';
import HostPanel from './components/HostPanel';
import PlayerPanel from './components/PlayerPanel';

function App() {
  const [isHost, setIsHost] = useState(null);

  return (
    <div className="App">
      <div className="container">
        <h1>🎭 Раздатчик карт - Мафия</h1>
        
        {isHost === null && (
          <div className="mode-selection">
            <h2>Выберите режим:</h2>
            <div className="mode-buttons">
              <button onClick={() => setIsHost(true)} className="btn btn-primary">
                Я ведущий
              </button>
              <button onClick={() => setIsHost(false)} className="btn btn-secondary">
                Я игрок
              </button>
            </div>
          </div>
        )}

        {isHost === true && (
          <div>
            <button onClick={() => setIsHost(null)} className="btn btn-back">
              ← Назад
            </button>
            <HostPanel />
          </div>
        )}

        {isHost === false && (
          <div>
            <button onClick={() => setIsHost(null)} className="btn btn-back">
              ← Назад
            </button>
            <PlayerPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

