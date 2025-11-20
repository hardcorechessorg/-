import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import SERVER_URL from '../config';
import './HostPanel.css';

const socket = io(SERVER_URL);

function HostPanel() {
  const [roomId, setRoomId] = useState(null);
  const [hostId, setHostId] = useState(null);
  const [settings, setSettings] = useState({
    mafia: 2,
    don: 1,
    commissar: 1,
    doctor: 1,
    killer: 0,
    citizen: 3
  });
  const [players, setPlayers] = useState([]);
  const [rolesDistributed, setRolesDistributed] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    socket.on('room-created', (data) => {
      setRoomId(data.roomId);
      setHostId(data.hostId);
      setSuccess(`Комната создана! ID: ${data.roomId}`);
      setError(null);
    });

    socket.on('player-joined', (data) => {
      setPlayers(data.players);
      setSuccess(`Игрок ${data.player.playerName} присоединился!`);
      setError(null);
    });

    socket.on('player-left', (data) => {
      setPlayers(data.players);
    });

    socket.on('roles-distributed', (data) => {
      setPlayers(data.players);
      setRolesDistributed(true);
      setSuccess('Роли успешно розданы!');
      setError(null);
    });

    socket.on('room-info', (data) => {
      setPlayers(data.players);
      setRolesDistributed(data.rolesDistributed);
    });

    socket.on('error', (data) => {
      setError(data.message);
      setSuccess(null);
    });

    return () => {
      socket.off('room-created');
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('roles-distributed');
      socket.off('room-info');
      socket.off('error');
    };
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    socket.emit('create-room', settings);
  };

  const handleSettingChange = (role, value) => {
    const numValue = parseInt(value) || 0;
    setSettings(prev => ({
      ...prev,
      [role]: numValue < 0 ? 0 : numValue
    }));
  };

  const handleDistributeRoles = () => {
    if (!roomId) return;
    setError(null);
    setSuccess(null);
    socket.emit('distribute-roles', { roomId });
  };

  const handleRefreshInfo = () => {
    if (!roomId) return;
    socket.emit('get-room-info', { roomId });
  };

  const getTotalRoles = () => {
    return settings.mafia + settings.don + settings.commissar + 
           settings.doctor + settings.killer + settings.citizen;
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

  const getRoleClass = (role) => {
    return `player-role role-${role}`;
  };

  return (
    <div className="host-panel">
      {!roomId ? (
        <div>
          <h2>Создание комнаты</h2>
          <p className="description">
            Настройте количество ролей для игры. После создания комнаты вы получите ID комнаты,
            который игроки смогут использовать для входа.
          </p>
          
          <form onSubmit={handleCreateRoom}>
            <div className="roles-grid">
              <div className="role-input">
                <label>Мафия</label>
                <input
                  type="number"
                  min="0"
                  value={settings.mafia}
                  onChange={(e) => handleSettingChange('mafia', e.target.value)}
                />
              </div>
              
              <div className="role-input">
                <label>Дон Мафии</label>
                <input
                  type="number"
                  min="0"
                  value={settings.don}
                  onChange={(e) => handleSettingChange('don', e.target.value)}
                />
              </div>
              
              <div className="role-input">
                <label>Комиссар</label>
                <input
                  type="number"
                  min="0"
                  value={settings.commissar}
                  onChange={(e) => handleSettingChange('commissar', e.target.value)}
                />
              </div>
              
              <div className="role-input">
                <label>Доктор</label>
                <input
                  type="number"
                  min="0"
                  value={settings.doctor}
                  onChange={(e) => handleSettingChange('doctor', e.target.value)}
                />
              </div>
              
              <div className="role-input">
                <label>Киллер</label>
                <input
                  type="number"
                  min="0"
                  value={settings.killer}
                  onChange={(e) => handleSettingChange('killer', e.target.value)}
                />
              </div>
              
              <div className="role-input">
                <label>Мирный житель</label>
                <input
                  type="number"
                  min="0"
                  value={settings.citizen}
                  onChange={(e) => handleSettingChange('citizen', e.target.value)}
                />
              </div>
            </div>

            <div className="total-roles">
              <strong>Всего ролей: {getTotalRoles()}</strong>
            </div>

            <button type="submit" className="btn btn-primary btn-large">
              Создать комнату
            </button>
          </form>
        </div>
      ) : (
        <div>
          <div className="room-id-display">
            <h3>ID Комнаты</h3>
            <div className="room-id">{roomId}</div>
            <p>Поделитесь этим ID с игроками</p>
          </div>

          <div className="players-section">
            <div className="section-header">
              <h2>Игроки в комнате ({players.length}/{getTotalRoles()})</h2>
              <button onClick={handleRefreshInfo} className="btn btn-secondary">
                Обновить
              </button>
            </div>

            {error && <div className="status-message status-error">{error}</div>}
            {success && <div className="status-message status-success">{success}</div>}

            {players.length === 0 ? (
              <div className="empty-state">
                <p>Игроки еще не присоединились. Ожидание игроков...</p>
              </div>
            ) : (
              <div className="players-list">
                {players.map((player, index) => (
                  <div key={player.socketId || index} className="player-item">
                    <div>
                      <span className="player-name">{player.playerName}</span>
                      {player.role && (
                        <div>
                          <span className={getRoleClass(player.role)}>
                            {getRoleLabel(player.role)}
                          </span>
                        </div>
                      )}
                    </div>
                    {!player.role && (
                      <span className="waiting-badge">Ожидает роли...</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!rolesDistributed && players.length > 0 && (
              <div className="distribute-section">
                <button
                  onClick={handleDistributeRoles}
                  disabled={players.length !== getTotalRoles()}
                  className="btn btn-primary btn-large"
                >
                  Раздать роли
                </button>
                {players.length !== getTotalRoles() && (
                  <p className="help-text">
                    Необходимо, чтобы количество игроков ({players.length}) 
                    совпадало с количеством ролей ({getTotalRoles()})
                  </p>
                )}
              </div>
            )}

            {rolesDistributed && (
              <div className="status-message status-success">
                ✅ Все роли розданы! Игроки видят свои роли.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HostPanel;

