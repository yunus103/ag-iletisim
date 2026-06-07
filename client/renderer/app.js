
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initCanvas();
  initConnection();
  const connectBtn = document.getElementById('btn-connect');
  const hostInput = document.getElementById('input-host');
  const portInput = document.getElementById('input-port');
  const usernameInput = document.getElementById('input-username');
  connectBtn.addEventListener('click', connectToServer);
  const onEnterKey = (e) => {
    if (e.key === 'Enter') {
      connectToServer();
    }
  };
  hostInput.addEventListener('keypress', onEnterKey);
  portInput.addEventListener('keypress', onEnterKey);
  usernameInput.addEventListener('keypress', onEnterKey);
  usernameInput.focus();
});
