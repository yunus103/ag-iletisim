'use strict';

const { generateId } = require('../shared/events');

class SessionManager {
  constructor() {

    this.sessions = new Map();

    this.usernameMap = new Map();
  }

  registerUser(socketId, username) {

    if (this.usernameMap.has(username)) {
      return { success: false, reason: 'Kullanıcı adı zaten kullanılıyor' };
    }

    if (!username || username.trim().length === 0) {
      return { success: false, reason: 'Kullanıcı adı boş olamaz' };
    }

    if (username.length > 30) {
      return { success: false, reason: 'Kullanıcı adı en fazla 30 karakter olabilir' };
    }

    if (username.length < 4) {
      return { success: false, reason: 'Kullanıcı adı en az 4 karakter olmalıdır.' };
    }

    const userId = generateId();
    const session = {
      userId,
      username: username.trim(),
      socketId,
      connectedAt: Date.now(),
      openFiles: new Set(), 
    };

    this.sessions.set(socketId, session);
    this.usernameMap.set(username, socketId);

    console.log(`[Session] Kullanıcı bağlandı: ${username} (${userId})`);
    return { success: true, userId };
  }

  removeUser(socketId) {
    const session = this.sessions.get(socketId);
    if (!session) return null;

    this.usernameMap.delete(session.username);
    this.sessions.delete(socketId);

    console.log(`[Session] Kullanıcı ayrıldı: ${session.username}`);
    return session;
  }

  getSession(socketId) {
    return this.sessions.get(socketId) || null;
  }

  getSocketIdByUsername(username) {
    return this.usernameMap.get(username) || null;
  }

  openFile(socketId, fileId) {
    const session = this.sessions.get(socketId);
    if (session) {
      session.openFiles.add(fileId);
    }
  }

  closeFile(socketId, fileId) {
    const session = this.sessions.get(socketId);
    if (session) {
      session.openFiles.delete(fileId);
    }
  }

  getUserList() {
    const users = [];
    for (const session of this.sessions.values()) {
      users.push({
        userId: session.userId,
        username: session.username,
      });
    }
    return users;
  }

  get count() {
    return this.sessions.size;
  }
}

module.exports = SessionManager;
