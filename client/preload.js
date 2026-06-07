'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  connect: (host, port, username) =>
    ipcRenderer.invoke('connect', { host, port, username }),

  disconnect: () =>
    ipcRenderer.invoke('disconnect'),

  getConnectionStatus: () =>
    ipcRenderer.invoke('get-connection-status'),

  fileCreate: (fileName, width, height) =>
    ipcRenderer.invoke('file-create', { fileName, width, height }),

  fileList: () =>
    ipcRenderer.invoke('file-list'),

  fileOpen: (fileId) =>
    ipcRenderer.invoke('file-open', { fileId }),

  fileClose: (fileId) =>
    ipcRenderer.invoke('file-close', { fileId }),

  drawAction: (fileId, layerId, action) =>
    ipcRenderer.invoke('draw-action', { fileId, layerId, action }),

  canvasClear: (fileId, layerId) =>
    ipcRenderer.invoke('canvas-clear', { fileId, layerId }),

  cut: (fileId, layerId, selection) =>
    ipcRenderer.invoke('cut', { fileId, layerId, selection }),

  paste: (fileId, layerId, pasteData, position) =>
    ipcRenderer.invoke('paste', { fileId, layerId, pasteData, position }),

  layerAdd: (fileId, name) =>
    ipcRenderer.invoke('layer-add', { fileId, name }),

  layerRemove: (fileId, layerId) =>
    ipcRenderer.invoke('layer-remove', { fileId, layerId }),

  layerRename: (fileId, layerId, name) =>
    ipcRenderer.invoke('layer-rename', { fileId, layerId, name }),

  layerVisibility: (fileId, layerId, visible) =>
    ipcRenderer.invoke('layer-visibility', { fileId, layerId, visible }),

  layerOpacity: (fileId, layerId, opacity) =>
    ipcRenderer.invoke('layer-opacity', { fileId, layerId, opacity }),

  onServerEvent: (callback) => {
    ipcRenderer.on('server-event', (event, payload) => callback(payload));
  },

  onConnectionLost: (callback) => {
    ipcRenderer.on('connection-lost', (event, data) => callback(data));
  },

  onReconnecting: (callback) => {
    ipcRenderer.on('reconnecting', (event, data) => callback(data));
  },

  onReconnectFailed: (callback) => {
    ipcRenderer.on('reconnect-failed', () => callback());
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('server-event');
    ipcRenderer.removeAllListeners('connection-lost');
    ipcRenderer.removeAllListeners('reconnecting');
    ipcRenderer.removeAllListeners('reconnect-failed');
  }
});
