let _pendingAction = null;

export function showConfirm(title, desc, confirmLabel, onConfirm) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-desc').textContent    = desc;
  document.getElementById('confirm-ok-btn').textContent  = confirmLabel;
  _pendingAction = onConfirm;
  document.getElementById('confirm-overlay').classList.add('open');
}

export function closeConfirm() {
  _pendingAction = null;
  document.getElementById('confirm-overlay').classList.remove('open');
}

export function doConfirm() {
  const action = _pendingAction;
  closeConfirm();
  if (action) action();
}
