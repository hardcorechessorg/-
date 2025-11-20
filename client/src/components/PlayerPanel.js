import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import SERVER_URL from '../config';
import './PlayerPanel.css';

const socket = io(SERVER_URL);

function PlayerPanel() {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joined, setJoined] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [playersCount, setPlayersCount] = useState(0);

  useEffect(() => {
    socket.on('player-joined', (data) => {
      setPlayersCount(data.players.length);
      setSuccess(`Вы успешно присоединились к комнате!`);
      setError(null);
    });

    socket.on('role-assigned', (data) => {
      setMyRole(data.role);
      setSuccess(`Ваша роль: ${getRoleLabel(data.role)}`);
      setError(null);
    });

    socket.on('all-roles-distributed', (data) => {
      setSuccess(`Все роли розданы! В комнате ${data.playerCount} игроков.`);
    });

    socket.on('room-closed', (data) => {
      setError(data.message);
      setJoined(false);
      setMyRole(null);
    });

    socket.on('error', (data) => {
      setError(data.message);
      setSuccess(null);
    });

    return () => {
      socket.off('player-joined');
      socket.off('role-assigned');
      socket.off('all-roles-distributed');
      socket.off('room-closed');
      socket.off('error');
    };
  }, []);

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomId.trim()) {
      setError('Введите ID комнаты');
      return;
    }
    if (!playerName.trim()) {
      setError('Введите ваше имя');
      return;
    }
    
    setError(null);
    setSuccess(null);
    socket.emit('join-room', {
      roomId: roomId.trim().toUpperCase(),
      playerName: playerName.trim()
    });
    setJoined(true);
  };

  const getRoleLabel = (role) => {
    const labels = {
      mafia: 'Мафия',
      don: 'Дон Мафии',
      commissar: 'Комиссар',
      doctor: 'Доктор',
      killer: 'Киллер',
      citizen: 'Мирный житель'
    };
    return labels[role] || role;
  };

  const getRoleDescription = (role) => {
    const descriptions = {
      mafia: 'Вы в команде мафии. Ваша цель - избавиться от мирных жителей.',
      don: 'Вы Дон Мафии. Вы знаете всех мафиози и можете защищаться ночью.',
      commissar: 'Вы Комиссар. Проверяйте игроков ночью, чтобы найти мафию.',
      doctor: 'Вы Доктор. Вы можете лечить игроков ночью.',
      killer: 'Вы Киллер. У вас есть особые способности.',
      citizen: 'Вы мирный житель. Найдите мафию и проголосуйте против неё.'
    };
    return descriptions[role] || '';
  };

  if (!joined) {
    return (
      <div className="player-panel">
        <h2>Вход в комнату</h2>
        <p className="description">
          Введите ID комнаты, который вам дал ведущий, и ваше имя для входа в игру.
        </p>

        <form onSubmit={handleJoinRoom}>
          <div className="form-group">
            <label>ID Комнаты</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Введите ID комнаты"
              maxLength="6"
            />
          </div>

          <div className="form-group">
            <label>Ваше имя</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Введите ваше имя"
              maxLength="20"
            />
          </div>

          {error && <div className="status-message status-error">{error}</div>}
          {success && <div className="status-message status-success">{success}</div>}

          <button type="submit" className="btn btn-primary btn-large">
            Войти в комнату
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="player-panel">
      <h2>Вы в комнате</h2>
      
      {error && <div className="status-message status-error">{error}</div>}
      {success && <div className="status-message status-success">{success}</div>}

      <div className="room-info">
        <p><strong>Комната:</strong> {roomId}</p>
        <p><strong>Ваше имя:</strong> {playerName}</p>
        <p><strong>Игроков в комнате:</strong> {playersCount}</p>
      </div>

      {!myRole ? (
        <div className="waiting-role">
          <div className="loading-spinner"></div>
          <h3>Ожидание раздачи ролей...</h3>
          <p>Ведущий скоро раздаст роли. Пожалуйста, подождите.</p>
        </div>
      ) : (
        <div className="my-role">
          <h3>Ваша роль</h3>
          <div className="role-name">{getRoleLabel(myRole)}</div>
          <p className="role-description">{getRoleDescription(myRole)}</p>
        </div>
      )}
    </div>
  );
}

export default PlayerPanel;

