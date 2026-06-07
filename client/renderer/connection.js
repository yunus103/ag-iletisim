
const AppState = {
  connected: false,
  username: '',
  userId: '',
  currentFileId: null,
  currentFile: null,
  activeLayerId: null,
  users: [],
  files: [],
  clipboard: null,
  zoom: 1,
};

const UserColors = [
  '#6366f1','#ec4899','#22c55e','#f97316','#eab308',
  '#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f43f5e'
];

function getUserColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return UserColors[Math.abs(hash) % UserColors.length];
}

function initConnection() {

  window.api.onServerEvent(({ event, data }) => {
    handleServerEvent(event, data);
  });

  window.api.onConnectionLost((info) => {
    AppState.connected = false;
    showScreen('login');
    showLoginError('Sunucu bağlantısı koptu! (' + (info?.reason || 'bilinmeyen') + ')');
  });

  window.api.onReconnecting((info) => {
    console.log(`Yeniden bağlanma denemesi: ${info.attempt}`);
  });

  window.api.onReconnectFailed(() => {
    AppState.connected = false;
    showScreen('login');
    showLoginError('Sunucuya yeniden bağlanılamadı. Lütfen tekrar deneyin.');
  });
}

function handleServerEvent(eventName, data) {
  switch (eventName) {

    case 'file:created':
      refreshFileList();
      if (data.file) openFileById(data.file.fileId);
      break;

    case 'file:list:result':
      AppState.files = data.files || [];
      renderFileList();
      break;

    case 'file:opened':
      onFileOpened(data.file);
      break;

    case 'file:closed':
      onFileClosed(data.fileId);
      break;

    case 'file:notify':
      refreshFileList();
      break;

    case 'draw:broadcast':
      onRemoteDraw(data);
      break;

    case 'canvas:cleared':
      onRemoteClear(data);
      break;

    case 'clipboard:cut:broadcast':
      onRemoteCut(data);
      break;

    case 'clipboard:paste:broadcast':
      onRemotePaste(data);
      break;

    case 'layer:added':

      if (data.fileId === AppState.currentFileId && AppState.currentFile) {
        AppState.currentFile.layers.push(data.layer);
        createCanvasLayer(data.layer.id, AppState.currentFile.width, AppState.currentFile.height, data.layer.order);
        renderLayerList();
        updateActiveLayerDisplay();
      }
      break;

    case 'layer:removed':

      if (data.fileId === AppState.currentFileId && AppState.currentFile && data.success) {
        AppState.currentFile.layers = AppState.currentFile.layers.filter(l => l.id !== data.layerId);
        removeCanvasLayer(data.layerId);
        if (AppState.activeLayerId === data.layerId && AppState.currentFile.layers.length > 0) {
          AppState.activeLayerId = AppState.currentFile.layers[0].id;
        }
        renderLayerList();
        updateActiveLayerDisplay();
      }
      break;

    case 'layer:update':

      onLayerUpdate(data);
      break;

    case 'user:list':
      AppState.users = data.users || [];
      renderUserList();
      break;

    case 'user:joined':
    case 'user:left':
      refreshFileList();
      break;

    case 'error:server':
      console.error('[Sunucu Hatası]', data.code, data.message);
      break;

    default:
      console.log('[Bilinmeyen Olay]', eventName, data);
  }
}

async function connectToServer() {
  const host = document.getElementById('input-host').value.trim();
  const port = document.getElementById('input-port').value.trim();
  const username = document.getElementById('input-username').value.trim();

  if (!username) { showLoginError('Kullanıcı adı girin'); return; }
  if (!host) { showLoginError('Sunucu adresi girin'); return; }

  const btn = document.getElementById('btn-connect');
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-loader').style.display = 'inline';
  btn.disabled = true;
  hideLoginError();

  try {
    const result = await window.api.connect(host, port, username);
    if (result.success) {
      AppState.connected = true;
      AppState.username = username;
      AppState.userId = result.userId;
      document.getElementById('username-display').textContent = username;
      showScreen('app');
      refreshFileList();
    } else {
      showLoginError(result.reason || 'Bağlantı başarısız');
    }
  } catch (err) {
    showLoginError(String(err));
  } finally {
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loader').style.display = 'none';
    btn.disabled = false;
  }
}

async function disconnectFromServer() {
  await window.api.disconnect();
  AppState.connected = false;
  AppState.currentFileId = null;
  AppState.currentFile = null;
  showScreen('login');
}

function refreshFileList() {
  window.api.fileList();
}

function openFileById(fileId) {
  window.api.fileOpen(fileId);
}

function showScreen(name) {
  document.getElementById('login-screen').classList.toggle('active', name === 'login');
  document.getElementById('app-screen').classList.toggle('active', name === 'app');
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideLoginError() {
  document.getElementById('login-error').style.display = 'none';
}

function flashSaveStatus() {
  const el = document.getElementById('auto-save-status');
  el.textContent = '💾 Kaydedildi!';
  setTimeout(() => { el.textContent = '💾 Otomatik kaydetme aktif'; }, 2000);
}
