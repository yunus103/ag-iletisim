'use strict';

const fs = require('fs');
const path = require('path');
const { generateId } = require('../shared/events');

const STORAGE_DIR = path.join(__dirname, 'storage');
const AUTO_SAVE_INTERVAL = 30000; 

class FileManager {
  constructor() {

    this.files = new Map();

    this.dirtyFiles = new Set();

    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    this._loadExistingFiles();

    this.autoSaveTimer = setInterval(() => this._autoSave(), AUTO_SAVE_INTERVAL);

    console.log(`[FileManager] Başlatıldı. Mevcut dosya sayısı: ${this.files.size}`);
  }

  createFile(owner, fileName, width = 1200, height = 800) {
    const fileId = generateId();
    const now = Date.now();

    const fileData = {
      fileId,
      fileName: fileName || `Adsız_${fileId.slice(0, 4)}`,
      owner,
      width,
      height,
      shared: true,
      createdAt: now,
      modifiedAt: now,
      layers: [
        {
          id: generateId(),
          name: 'Katman 1',
          visible: true,
          opacity: 1.0,
          order: 0,
          actions: [],
        }
      ],
      editors: [], 
    };

    this.files.set(fileId, fileData);
    this._saveToDisk(fileId);

    console.log(`[FileManager] Dosya oluşturuldu: ${fileName} (${fileId}) - Sahip: ${owner}`);
    return this._getFileInfo(fileId);
  }

  getFileList() {
    const list = [];
    for (const [fileId, file] of this.files) {
      if (file.shared) {
        list.push({
          fileId: file.fileId,
          fileName: file.fileName,
          owner: file.owner,
          width: file.width,
          height: file.height,
          createdAt: file.createdAt,
          modifiedAt: file.modifiedAt,
          editorCount: file.editors.length,
          layerCount: file.layers.length,
        });
      }
    }
    return list;
  }

  openFile(fileId, username) {
    const file = this.files.get(fileId);
    if (!file) return null;

    if (!file.editors.includes(username)) {
      file.editors.push(username);
    }

    return {
      fileId: file.fileId,
      fileName: file.fileName,
      owner: file.owner,
      width: file.width,
      height: file.height,
      layers: file.layers,
      editors: file.editors,
    };
  }

  closeFile(fileId, username) {
    const file = this.files.get(fileId);
    if (!file) return;

    file.editors = file.editors.filter(e => e !== username);
    this.dirtyFiles.add(fileId);
  }

  setShared(fileId, shared) {
    const file = this.files.get(fileId);
    if (file) {
      file.shared = shared;
      this.dirtyFiles.add(fileId);
    }
  }

  deleteFile(fileId) {
    const file = this.files.get(fileId);
    if (!file) return false;

    this.files.delete(fileId);
    this.dirtyFiles.delete(fileId);

    const filePath = path.join(STORAGE_DIR, `${fileId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.log(`[FileManager] Dosya silindi: ${file.fileName} (${fileId})`);
    return true;
  }

  addDrawAction(fileId, layerId, action) {
    const file = this.files.get(fileId);
    if (!file) return false;

    const layer = file.layers.find(l => l.id === layerId);
    if (!layer) return false;

    layer.actions.push(action);
    file.modifiedAt = Date.now();
    this.dirtyFiles.add(fileId);
    return true;
  }

  clearCanvas(fileId, layerId = null) {
    const file = this.files.get(fileId);
    if (!file) return false;

    if (layerId) {
      const layer = file.layers.find(l => l.id === layerId);
      if (layer) layer.actions = [];
    } else {
      file.layers.forEach(l => l.actions = []);
    }

    file.modifiedAt = Date.now();
    this.dirtyFiles.add(fileId);
    return true;
  }

  addLayer(fileId, name) {
    const file = this.files.get(fileId);
    if (!file) return null;

    const layer = {
      id: generateId(),
      name: name || `Katman ${file.layers.length + 1}`,
      visible: true,
      opacity: 1.0,
      order: file.layers.length,
      actions: [],
    };

    file.layers.push(layer);
    file.modifiedAt = Date.now();
    this.dirtyFiles.add(fileId);

    console.log(`[FileManager] Katman eklendi: ${layer.name} -> ${file.fileName}`);
    return layer;
  }

  removeLayer(fileId, layerId) {
    const file = this.files.get(fileId);
    if (!file || file.layers.length <= 1) return false; 

    file.layers = file.layers.filter(l => l.id !== layerId);

    file.layers.forEach((l, i) => l.order = i);
    file.modifiedAt = Date.now();
    this.dirtyFiles.add(fileId);
    return true;
  }

  renameLayer(fileId, layerId, newName) {
    const file = this.files.get(fileId);
    if (!file) return false;

    const layer = file.layers.find(l => l.id === layerId);
    if (!layer) return false;

    layer.name = newName;
    this.dirtyFiles.add(fileId);
    return true;
  }

  setLayerVisibility(fileId, layerId, visible) {
    const file = this.files.get(fileId);
    if (!file) return false;

    const layer = file.layers.find(l => l.id === layerId);
    if (!layer) return false;

    layer.visible = visible;
    this.dirtyFiles.add(fileId);
    return true;
  }

  setLayerOpacity(fileId, layerId, opacity) {
    const file = this.files.get(fileId);
    if (!file) return false;

    const layer = file.layers.find(l => l.id === layerId);
    if (!layer) return false;

    layer.opacity = Math.max(0, Math.min(1, opacity));
    this.dirtyFiles.add(fileId);
    return true;
  }

  reorderLayers(fileId, layerIds) {
    const file = this.files.get(fileId);
    if (!file) return false;

    const reordered = [];
    for (const id of layerIds) {
      const layer = file.layers.find(l => l.id === id);
      if (layer) reordered.push(layer);
    }

    if (reordered.length === file.layers.length) {
      reordered.forEach((l, i) => l.order = i);
      file.layers = reordered;
      this.dirtyFiles.add(fileId);
      return true;
    }
    return false;
  }

  getFileInfo(fileId) {
    return this._getFileInfo(fileId);
  }

  _getFileInfo(fileId) {
    const file = this.files.get(fileId);
    if (!file) return null;
    return {
      fileId: file.fileId,
      fileName: file.fileName,
      owner: file.owner,
      width: file.width,
      height: file.height,
      shared: file.shared,
      createdAt: file.createdAt,
      modifiedAt: file.modifiedAt,
      layerCount: file.layers.length,
      editorCount: file.editors.length,
    };
  }

  _saveToDisk(fileId) {
    const file = this.files.get(fileId);
    if (!file) return;

    const filePath = path.join(STORAGE_DIR, `${fileId}.json`);
    const dataToSave = { ...file };
    delete dataToSave.editors; 

    try {
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (err) {
      console.error(`[FileManager] Kaydetme hatası (${fileId}):`, err.message);
    }
  }

  _autoSave() {
    if (this.dirtyFiles.size === 0) return;

    console.log(`[FileManager] Otomatik kaydetme: ${this.dirtyFiles.size} dosya`);
    for (const fileId of this.dirtyFiles) {
      this._saveToDisk(fileId);
    }
    this.dirtyFiles.clear();
  }

  _loadExistingFiles() {
    if (!fs.existsSync(STORAGE_DIR)) return;

    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith('.json'));
    for (const fileName of files) {
      try {
        const filePath = path.join(STORAGE_DIR, fileName);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.editors = []; 
        this.files.set(data.fileId, data);
      } catch (err) {
        console.error(`[FileManager] Dosya yükleme hatası (${fileName}):`, err.message);
      }
    }
  }

  shutdown() {
    clearInterval(this.autoSaveTimer);
    this._autoSave(); 
    console.log('[FileManager] Kapatıldı.');
  }
}

module.exports = FileManager;
