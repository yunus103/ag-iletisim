'use strict';

const http = require('http');
const { Server } = require('socket.io');
const { EventType } = require('../shared/events');
const SessionManager = require('./sessionManager');
const FileManager = require('./fileManager');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

class PaintServer {
  constructor() {
    this.sessionManager = new SessionManager();
    this.fileManager = new FileManager();

    this.httpServer = http.createServer();

    this.io = new Server(this.httpServer, {
      cors: {
        origin: '*',                
        methods: ['GET', 'POST']
      },
      pingInterval: 15000,          
      pingTimeout: 10000,           
      maxHttpBufferSize: 5e6,       
      connectTimeout: 10000,        
      transports: ['websocket', 'polling']  
    });

    this.io.on('connection', (socket) => {
      this._handleConnection(socket);
    });
  }

  start() {
    this.httpServer.listen(PORT, HOST, () => {
      console.log('============================================');
      console.log('  MultiUserPaint Socket.IO Sunucu (v2)');
      console.log(`  Dinleniyor: ${HOST}:${PORT}`);
      console.log('  Protokol: Socket.IO (WebSocket + Polling)');
      console.log('  Heartbeat: Otomatik (ping/pong)');
      console.log('============================================');
    });

    this.httpServer.on('error', (err) => {
      console.error('[Sunucu] Hata:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`[Sunucu] Port ${PORT} zaten kullanılıyor!`);
        process.exit(1);
      }
    });

    process.on('SIGINT', () => this._shutdown());
    process.on('SIGTERM', () => this._shutdown());
  }

  _handleConnection(socket) {
    const remoteAddr = socket.handshake.address;
    console.log(`[Bağlantı] Yeni WebSocket bağlantısı: ${remoteAddr} (${socket.id})`);

    socket.on(EventType.USER_CONNECT, (data) => {
      this._onConnect(socket, data);
    });

    socket.on(EventType.FILE_CREATE, (data) => {
      this._onFileCreate(socket, data);
    });
    socket.on(EventType.FILE_LIST, () => {
      this._onFileListReq(socket);
    });
    socket.on(EventType.FILE_OPEN, (data) => {
      this._onFileOpen(socket, data);
    });
    socket.on(EventType.FILE_CLOSE, (data) => {
      this._onFileClose(socket, data);
    });
    socket.on(EventType.FILE_SHARE, (data) => {
      this._onFileShare(socket, data);
    });
    socket.on(EventType.FILE_DELETE, (data) => {
      this._onFileDelete(socket, data);
    });

    socket.on(EventType.DRAW_ACTION, (data) => {
      this._onDrawAction(socket, data);
    });
    socket.on(EventType.CANVAS_CLEAR, (data) => {
      this._onCanvasClear(socket, data);
    });

    socket.on(EventType.CLIPBOARD_CUT, (data) => {
      this._onCut(socket, data);
    });
    socket.on(EventType.CLIPBOARD_PASTE, (data) => {
      this._onPaste(socket, data);
    });

    socket.on(EventType.LAYER_ADD, (data) => {
      this._onLayerAdd(socket, data);
    });
    socket.on(EventType.LAYER_REMOVE, (data) => {
      this._onLayerRemove(socket, data);
    });
    socket.on(EventType.LAYER_RENAME, (data) => {
      this._onLayerRename(socket, data);
    });
    socket.on(EventType.LAYER_VISIBILITY, (data) => {
      this._onLayerVisibility(socket, data);
    });
    socket.on(EventType.LAYER_OPACITY, (data) => {
      this._onLayerOpacity(socket, data);
    });
    socket.on(EventType.LAYER_REORDER, (data) => {
      this._onLayerReorder(socket, data);
    });

    socket.on('disconnect', (reason) => {
      this._handleDisconnect(socket, reason);
    });
  }

  _onConnect(socket, data) {
    try {
      const { username } = data;
      const result = this.sessionManager.registerUser(socket.id, username);

      if (result.success) {

        socket.join('lobby');

        socket.emit(EventType.USER_CONNECTED, {
          userId: result.userId,
          username: username,
          message: 'Bağlantı başarılı'
        });

        socket.to('lobby').emit(EventType.USER_JOINED, {
          userId: result.userId,
          username: username
        });

        this._broadcastUserList();
      } else {
        socket.emit(EventType.USER_REJECTED, {
          reason: result.reason
        });
      }
    } catch (err) {
      console.error('[Sunucu] user:connect hatası:', err.message);
      socket.emit(EventType.ERROR_SERVER, { code: 'INTERNAL_ERROR', message: 'Sunucu hatası' });
    }
  }

  _handleDisconnect(socket, reason) {
    const session = this.sessionManager.getSession(socket.id);
    if (session) {
      console.log(`[Bağlantı] Bağlantı koptu: ${session.username} (sebep: ${reason})`);

      for (const fileId of session.openFiles) {
        this.fileManager.closeFile(fileId, session.username);

      }

      socket.to('lobby').emit(EventType.USER_LEFT, {
        userId: session.userId,
        username: session.username
      });

      this.sessionManager.removeUser(socket.id);
      this._broadcastUserList();
    }
  }

  _onFileCreate(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return this._sendError(socket, 'SESSION_NOT_FOUND', 'Oturum bulunamadı');

      const { fileName, width, height } = data;
      const fileInfo = this.fileManager.createFile(
        session.username,
        fileName,
        width || 1200,
        height || 800
      );

      socket.emit(EventType.FILE_CREATED, { file: fileInfo });

      socket.to('lobby').emit(EventType.FILE_NOTIFY, {
        action: 'created',
        file: fileInfo,
        by: session.username
      });
    } catch (err) {
      console.error('[Sunucu] file:create hatası:', err.message);
      socket.emit(EventType.ERROR_SERVER, { code: 'INTERNAL_ERROR', message: 'Sunucu hatası' });
    }
  }

  _onFileListReq(socket) {
    try {
      const files = this.fileManager.getFileList();
      socket.emit(EventType.FILE_LIST_RESULT, { files });
    } catch (err) {
      console.error('[Sunucu] file:list hatası:', err.message);
      socket.emit(EventType.ERROR_SERVER, { code: 'INTERNAL_ERROR', message: 'Sunucu hatası' });
    }
  }

  _onFileOpen(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return this._sendError(socket, 'SESSION_NOT_FOUND', 'Oturum bulunamadı');

      const { fileId } = data;
      const fileData = this.fileManager.openFile(fileId, session.username);

      if (fileData) {
        this.sessionManager.openFile(socket.id, fileId);

        socket.join(`file:${fileId}`);

        socket.emit(EventType.FILE_OPENED, { file: fileData });

        socket.to(`file:${fileId}`).emit(EventType.USER_JOINED, {
          username: session.username,
          fileId: fileId
        });
      } else {
        this._sendError(socket, 'FILE_NOT_FOUND', 'Dosya bulunamadı');
      }
    } catch (err) {
      console.error('[Sunucu] file:open hatası:', err.message);
      socket.emit(EventType.ERROR_SERVER, { code: 'INTERNAL_ERROR', message: 'Sunucu hatası' });
    }
  }

  _onFileClose(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId } = data;
      this.fileManager.closeFile(fileId, session.username);
      this.sessionManager.closeFile(socket.id, fileId);

      socket.leave(`file:${fileId}`);

      socket.emit(EventType.FILE_CLOSED, { fileId });

      socket.to(`file:${fileId}`).emit(EventType.USER_LEFT, {
        username: session.username,
        fileId: fileId
      });
    } catch (err) {
      console.error('[Sunucu] file:close hatası:', err.message);
    }
  }

  _onFileShare(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId, shared } = data;
      this.fileManager.setShared(fileId, shared !== false);
      socket.emit(EventType.FILE_SHARED, { fileId, shared });

      socket.to('lobby').emit(EventType.FILE_NOTIFY, {
        action: shared ? 'shared' : 'unshared',
        file: this.fileManager.getFileInfo(fileId),
        by: session.username
      });
    } catch (err) {
      console.error('[Sunucu] file:share hatası:', err.message);
    }
  }

  _onFileDelete(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId } = data;
      const success = this.fileManager.deleteFile(fileId);
      socket.emit(EventType.FILE_DELETED, { fileId, success });

      if (success) {

        this.io.to('lobby').emit(EventType.FILE_NOTIFY, {
          action: 'deleted',
          fileId,
          by: session.username
        });
      }
    } catch (err) {
      console.error('[Sunucu] file:delete hatası:', err.message);
    }
  }

  _onDrawAction(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId, layerId, action } = data;

      this.fileManager.addDrawAction(fileId, layerId, {
        ...action,
        userId: session.userId,
        username: session.username,
        timestamp: Date.now()
      });

      socket.to(`file:${fileId}`).emit(EventType.DRAW_BROADCAST, {
        fileId,
        layerId,
        action: {
          ...action,
          username: session.username
        }
      });
    } catch (err) {
      console.error('[Sunucu] draw:action hatası:', err.message);
    }
  }

  _onCanvasClear(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId, layerId } = data;
      this.fileManager.clearCanvas(fileId, layerId);

      socket.to(`file:${fileId}`).emit(EventType.CANVAS_CLEARED, {
        fileId,
        layerId,
        by: session.username
      });
    } catch (err) {
      console.error('[Sunucu] canvas:clear hatası:', err.message);
    }
  }

  _onCut(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId, layerId, selection } = data;

      socket.to(`file:${fileId}`).emit(EventType.CLIPBOARD_CUT_BROADCAST, {
        fileId,
        layerId,
        selection,
        by: session.username
      });
    } catch (err) {
      console.error('[Sunucu] clipboard:cut hatası:', err.message);
    }
  }

  _onPaste(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId, layerId, pasteData, position } = data;

      if (pasteData && pasteData.actions) {
        for (const action of pasteData.actions) {
          this.fileManager.addDrawAction(fileId, layerId, {
            ...action,
            userId: session.userId,
            timestamp: Date.now()
          });
        }
      }

      socket.to(`file:${fileId}`).emit(EventType.CLIPBOARD_PASTE_BROADCAST, {
        fileId,
        layerId,
        pasteData,
        position,
        by: session.username
      });
    } catch (err) {
      console.error('[Sunucu] clipboard:paste hatası:', err.message);
    }
  }

  _onLayerAdd(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId, name } = data;
      const layer = this.fileManager.addLayer(fileId, name);

      if (layer) {
        socket.emit(EventType.LAYER_ADDED, { fileId, layer });
        socket.to(`file:${fileId}`).emit(EventType.LAYER_UPDATE, {
          fileId,
          action: 'add',
          layer,
          by: session.username
        });
      }
    } catch (err) {
      console.error('[Sunucu] layer:add hatası:', err.message);
    }
  }

  _onLayerRemove(socket, data) {
    try {
      const session = this.sessionManager.getSession(socket.id);
      if (!session) return;

      const { fileId, layerId } = data;
      const success = this.fileManager.removeLayer(fileId, layerId);

      socket.emit(EventType.LAYER_REMOVED, { fileId, layerId, success });
      if (success) {
        socket.to(`file:${fileId}`).emit(EventType.LAYER_UPDATE, {
          fileId,
          action: 'remove',
          layerId,
          by: session.username
        });
      }
    } catch (err) {
      console.error('[Sunucu] layer:remove hatası:', err.message);
    }
  }

  _onLayerRename(socket, data) {
    try {
      const { fileId, layerId, name } = data;
      this.fileManager.renameLayer(fileId, layerId, name);
      socket.to(`file:${fileId}`).emit(EventType.LAYER_UPDATE, {
        fileId, action: 'rename', layerId, name
      });
    } catch (err) {
      console.error('[Sunucu] layer:rename hatası:', err.message);
    }
  }

  _onLayerVisibility(socket, data) {
    try {
      const { fileId, layerId, visible } = data;
      this.fileManager.setLayerVisibility(fileId, layerId, visible);
      socket.to(`file:${fileId}`).emit(EventType.LAYER_UPDATE, {
        fileId, action: 'visibility', layerId, visible
      });
    } catch (err) {
      console.error('[Sunucu] layer:visibility hatası:', err.message);
    }
  }

  _onLayerOpacity(socket, data) {
    try {
      const { fileId, layerId, opacity } = data;
      this.fileManager.setLayerOpacity(fileId, layerId, opacity);
      socket.to(`file:${fileId}`).emit(EventType.LAYER_UPDATE, {
        fileId, action: 'opacity', layerId, opacity
      });
    } catch (err) {
      console.error('[Sunucu] layer:opacity hatası:', err.message);
    }
  }

  _onLayerReorder(socket, data) {
    try {
      const { fileId, layerIds } = data;
      this.fileManager.reorderLayers(fileId, layerIds);
      socket.to(`file:${fileId}`).emit(EventType.LAYER_UPDATE, {
        fileId, action: 'reorder', layerIds
      });
    } catch (err) {
      console.error('[Sunucu] layer:reorder hatası:', err.message);
    }
  }

  _sendError(socket, code, message) {
    socket.emit(EventType.ERROR_SERVER, { code, message });
  }

  _broadcastUserList() {
    const users = this.sessionManager.getUserList();
    this.io.to('lobby').emit(EventType.USER_LIST, { users });
  }

  _shutdown() {
    console.log('\n[Sunucu] Kapatılıyor...');
    this.fileManager.shutdown();

    this.io.emit(EventType.ERROR_SERVER, {
      code: 'SERVER_SHUTDOWN',
      message: 'Sunucu kapatılıyor.'
    });

    this.io.close(() => {
      console.log('[Sunucu] Socket.IO kapatıldı.');
      this.httpServer.close(() => {
        console.log('[Sunucu] HTTP sunucusu kapatıldı.');
        process.exit(0);
      });
    });
  }
}

const server = new PaintServer();
server.start();
