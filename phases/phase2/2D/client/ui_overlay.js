// client/ui_overlay.js — "No-Lobby" UI Overlay (2D)
// Minimal HTML/DOM layer for role selection and HUD.

export function createUIOverlay(onJoin) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:10px;left:10px;z-index:100;color:white;font-family:monospace;';

  const menu = document.createElement('div');
  menu.innerHTML = `
    <div style="background:rgba(0,0,0,0.8);padding:10px;border:1px solid #444;">
      <h3>MORE FIREPOWER</h3>
      <button id="join-0">JOIN TEAM BLUE</button>
      <button id="join-1">JOIN TEAM RED</button>
    </div>
  `;
  container.appendChild(menu);
  document.body.appendChild(container);

  menu.querySelector('#join-0').onclick = () => {
    menu.style.display = 'none';
    onJoin('player_' + Math.random().toString(36).substr(2, 5), 0);
  };

  menu.querySelector('#join-1').onclick = () => {
    menu.style.display = 'none';
    onJoin('player_' + Math.random().toString(36).substr(2, 5), 1);
  };

  return {
    showHUD(info) {
      // Future: display HP, Supply, etc.
    }
  };
}
