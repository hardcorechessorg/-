const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
// Настройка CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ["https://hardcorechessorg.github.io", "http://localhost:3000"];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Хранилище комнат: { roomId: { hostId, settings: {...}, players: [...] } }
const rooms = new Map();

// Типы ролей
const ROLE_TYPES = {
  MAFIA: 'mafia',
  DON: 'don',
  COMMISSAR: 'commissar',
  DOCTOR: 'doctor',
  KILLER: 'killer',
  CITIZEN: 'citizen'
};

// Функция для генерации случайного ID комнаты (6 символов)
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Функция для раздачи ролей
function distributeRoles(settings, playerCount) {
  const roles = [];
  
  // Собираем все роли по настройкам
  for (let i = 0; i < settings.mafia; i++) roles.push(ROLE_TYPES.MAFIA);
  for (let i = 0; i < settings.don; i++) roles.push(ROLE_TYPES.DON);
  for (let i = 0; i < settings.commissar; i++) roles.push(ROLE_TYPES.COMMISSAR);
  for (let i = 0; i < settings.doctor; i++) roles.push(ROLE_TYPES.DOCTOR);
  for (let i = 0; i < settings.killer; i++) roles.push(ROLE_TYPES.KILLER);
  for (let i = 0; i < settings.citizen; i++) roles.push(ROLE_TYPES.CITIZEN);
  
  // Перемешиваем роли
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  
  // Берем только нужное количество ролей (по количеству игроков)
  return roles.slice(0, playerCount);
}

io.on('connection', (socket) => {
  console.log('Пользователь подключен:', socket.id);

  // Создание комнаты ведущим
  socket.on('create-room', (settings) => {
    const roomId = generateRoomId();
    const hostId = socket.id;
    
    const room = {
      roomId,
      hostId,
      settings: {
        mafia: settings.mafia || 0,
        don: settings.don || 0,
        commissar: settings.commissar || 0,
        doctor: settings.doctor || 0,
        killer: settings.killer || 0,
        citizen: settings.citizen || 0
      },
      players: [],
      rolesDistributed: false
    };
    
    rooms.set(roomId, room);
    socket.join(roomId);
    
    socket.emit('room-created', { roomId, hostId });
    console.log(`Комната ${roomId} создана ведущим ${hostId}`);
  });

  // Вход игрока в комнату
  socket.on('join-room', (data) => {
    const { roomId, playerName } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    
    // Проверяем, не вошел ли уже этот игрок
    const existingPlayer = room.players.find(p => p.socketId === socket.id);
    if (existingPlayer) {
      socket.emit('error', { message: 'Вы уже в этой комнате' });
      return;
    }
    
    // Добавляем игрока
    const player = {
      socketId: socket.id,
      playerName: playerName || `Игрок ${room.players.length + 1}`,
      role: null
    };
    
    room.players.push(player);
    socket.join(roomId);
    
    // Уведомляем всех в комнате о новом игроке
    io.to(roomId).emit('player-joined', {
      player: {
        playerName: player.playerName,
        socketId: socket.id
      },
      players: room.players.map(p => ({
        playerName: p.playerName,
        socketId: p.socketId,
        hasRole: p.role !== null
      }))
    });
    
    console.log(`Игрок ${playerName} присоединился к комнате ${roomId}`);
  });

  // Раздача ролей (только ведущий)
  socket.on('distribute-roles', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Только ведущий может раздавать роли' });
      return;
    }
    
    if (room.rolesDistributed) {
      socket.emit('error', { message: 'Роли уже розданы' });
      return;
    }
    
    const totalRoles = room.settings.mafia + room.settings.don + 
                      room.settings.commissar + room.settings.doctor + 
                      room.settings.killer + room.settings.citizen;
    
    if (room.players.length > totalRoles) {
      socket.emit('error', { message: `Слишком много игроков. Максимум: ${totalRoles}` });
      return;
    }
    
    if (room.players.length < totalRoles) {
      socket.emit('error', { message: `Недостаточно игроков. Необходимо: ${totalRoles}` });
      return;
    }
    
    // Раздаем роли
    const roles = distributeRoles(room.settings, room.players.length);
    
    room.players.forEach((player, index) => {
      player.role = roles[index];
      
      // Отправляем роль каждому игроку лично
      io.to(player.socketId).emit('role-assigned', {
        role: player.role,
        playerName: player.playerName
      });
    });
    
    room.rolesDistributed = true;
    
    // Отправляем ведущему информацию о всех игроках и их ролях
    io.to(room.hostId).emit('roles-distributed', {
      players: room.players.map(p => ({
        playerName: p.playerName,
        socketId: p.socketId,
        role: p.role
      }))
    });
    
    // Уведомляем всех в комнате, что роли розданы
    io.to(roomId).emit('all-roles-distributed', {
      playerCount: room.players.length
    });
    
    console.log(`Роли розданы в комнате ${roomId}`);
  });

  // Получение информации о комнате (для ведущего)
  socket.on('get-room-info', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      return;
    }
    
    if (room.hostId === socket.id) {
      socket.emit('room-info', {
        roomId: room.roomId,
        settings: room.settings,
        players: room.players.map(p => ({
          playerName: p.playerName,
          socketId: p.socketId,
          role: p.role
        })),
        rolesDistributed: room.rolesDistributed
      });
    }
  });

  // Отключение пользователя
  socket.on('disconnect', () => {
    console.log('Пользователь отключен:', socket.id);
    
    // Удаляем игрока из всех комнат
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('player-left', {
          socketId: socket.id,
          players: room.players.map(p => ({
            playerName: p.playerName,
            socketId: p.socketId,
            hasRole: p.role !== null
          }))
        });
      }
      
      // Если ведущий вышел, удаляем комнату
      if (room.hostId === socket.id) {
        io.to(roomId).emit('room-closed', { message: 'Ведущий покинул комнату' });
        rooms.delete(roomId);
        console.log(`Комната ${roomId} удалена`);
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

