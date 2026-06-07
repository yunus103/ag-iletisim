'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { io } = require('socket.io-client');
const { EventType } = require('../shared/events');

let mainWindow = null;
let socket = null;
let isConnected = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'MultiUserPaint',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0a0a1a',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    disconnectFromServer();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function connectToServer(host, port, username) {
  return new Promise((resolve, reject) => {

    if (socket) {
      socket.disconnect();
      socket = null;
    }

    socket = io(`http://${host}:${port}`, {
      autoConnect: false,             
      reconnection: true,             
      reconnectionAttempts: 10,       
      reconnectionDelay: 1000,        
      reconnectionDelayMax: 5000,     
      timeout: 10000,                 
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log(`[Socket.IO] Bağlandı: ${host}:${port} (id: ${socket.id})`);

      socket.emit(EventType.USER_CONNECT, { username });
    });

    socket.on(EventType.USER_CONNECTED, (data) => {
      isConnected = true;
      resolve({ success: true, ...data });
    });

    socket.on(EventType.USER_REJECTED, (data) => {
      resolve({ success: false, reason: data.reason });
      socket.disconnect();
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket.IO] Bağlantı hatası:', err.message);
      if (!isConnected) {
        reject(err.message);
      }
    });

    socket.on('connect_timeout', () => {
      console.error('[Socket.IO] Bağlantı zaman aşımı');
      if (!isConnected) {
        reject('Bağlantı zaman aşımına uğradı');
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Bağlantı koptu: ${reason}`);
      isConnected = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('connection-lost', { reason });
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket.IO] Yeniden bağlanma denemesi: ${attempt}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reconnecting', { attempt });
      }
    });

    socket.on('reconnect', (attempt) => {
      console.log(`[Socket.IO] Yeniden bağlandı (deneme: ${attempt})`);

      socket.emit(EventType.USER_CONNECT, { username });
    });

    socket.on('reconnect_failed', () => {
      console.error('[Socket.IO] Tüm yeniden bağlanma denemeleri başarısız');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reconnect-failed');
      }
    });

    const serverEvents = [
      EventType.USER_CONNECTED,
      EventType.USER_REJECTED,
      EventType.USER_LIST,
      EventType.USER_JOINED,
      EventType.USER_LEFT,
      EventType.FILE_CREATED,
      EventType.FILE_LIST_RESULT,
      EventType.FILE_OPENED,
      EventType.FILE_CLOSED,
      EventType.FILE_SHARED,
      EventType.FILE_NOTIFY,
      EventType.FILE_DELETED,
      EventType.DRAW_BROADCAST,
      EventType.CANVAS_SYNC,
      EventType.CANVAS_CLEARED,
      EventType.CLIPBOARD_CUT_BROADCAST,
      EventType.CLIPBOARD_PASTE_BROADCAST,
      EventType.LAYER_ADDED,
      EventType.LAYER_REMOVED,
      EventType.LAYER_UPDATE,
      EventType.ERROR_SERVER,
    ];

    for (const eventName of serverEvents) {
      socket.on(eventName, (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server-event', { event: eventName, data });
        }
      });
    }

    socket.connect();
  });
}

function disconnectFromServer() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  isConnected = false;
}

function emitToServer(eventName, data = {}) {
  if (socket && socket.connected) {
    socket.emit(eventName, data);
  }
}

ipcMain.handle('connect', async (event, { host, port, username }) => {
  try {
    const result = await connectToServer(host, parseInt(port), username);
    return result;
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('disconnect', async () => {
  disconnectFromServer();
  return { success: true };
});

ipcMain.handle('file-create', async (event, { fileName, width, height }) => {
  emitToServer(EventType.FILE_CREATE, { fileName, width, height });
});

ipcMain.handle('file-list', async () => {
  emitToServer(EventType.FILE_LIST);
});

ipcMain.handle('file-open', async (event, { fileId }) => {
  emitToServer(EventType.FILE_OPEN, { fileId });
});

ipcMain.handle('file-close', async (event, { fileId }) => {
  emitToServer(EventType.FILE_CLOSE, { fileId });
});

ipcMain.handle('draw-action', async (event, { fileId, layerId, action }) => {
  emitToServer(EventType.DRAW_ACTION, { fileId, layerId, action });
});

ipcMain.handle('canvas-clear', async (event, { fileId, layerId }) => {
  emitToServer(EventType.CANVAS_CLEAR, { fileId, layerId });
});

ipcMain.handle('cut', async (event, { fileId, layerId, selection }) => {
  emitToServer(EventType.CLIPBOARD_CUT, { fileId, layerId, selection });
});

ipcMain.handle('paste', async (event, { fileId, layerId, pasteData, position }) => {
  emitToServer(EventType.CLIPBOARD_PASTE, { fileId, layerId, pasteData, position });
});

ipcMain.handle('layer-add', async (event, { fileId, name }) => {
  emitToServer(EventType.LAYER_ADD, { fileId, name });
});

ipcMain.handle('layer-remove', async (event, { fileId, layerId }) => {
  emitToServer(EventType.LAYER_REMOVE, { fileId, layerId });
});

ipcMain.handle('layer-rename', async (event, { fileId, layerId, name }) => {
  emitToServer(EventType.LAYER_RENAME, { fileId, layerId, name });
});

ipcMain.handle('layer-visibility', async (event, { fileId, layerId, visible }) => {
  emitToServer(EventType.LAYER_VISIBILITY, { fileId, layerId, visible });
});

ipcMain.handle('layer-opacity', async (event, { fileId, layerId, opacity }) => {
  emitToServer(EventType.LAYER_OPACITY, { fileId, layerId, opacity });
});

ipcMain.handle('get-connection-status', async () => {
  return { connected: isConnected };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  disconnectFromServer();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
