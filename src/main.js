import './styles/base.css';
import './styles/sidebar.css';
import './styles/components.css';
import './styles/theme.css';

import { initNavigation, navigate, applyFilter, clearFilter, renderAll } from './navigation.js';
import { initAuth, doSignIn, doSignOut, toggleTheme } from './services/auth.js';
import { classify, exportOverrides } from './pages/review.js';
import { classifyFromProcv, setProcvFilter, setProcvSearch, exportProcvCSV } from './pages/procv.js';
import { undoFromClientes, setClientesFilter, setClientesSearch } from './pages/clientes.js';
import { setRankView } from './pages/ranking.js';
import { saveGoals } from './pages/goals-page.js';
import { loadFile, processAll } from './pages/import-page.js';
import { clearState } from './core/storage.js';
import { toggleAccordion } from './utils/ui.js';

// Expose functions called from inline HTML handlers
window.navigate          = navigate;
window.applyFilter       = applyFilter;
window.clearFilter       = clearFilter;
window.doSignIn          = doSignIn;
window.doSignOut         = doSignOut;
window.toggleTheme       = toggleTheme;
window.classify          = classify;
window.classifyFromProcv = classifyFromProcv;
window.setProcvFilter    = setProcvFilter;
window.setProcvSearch    = setProcvSearch;
window.exportProcvCSV    = exportProcvCSV;
window.exportOverrides   = exportOverrides;
window.undoFromClientes  = undoFromClientes;
window.setClientesFilter = setClientesFilter;
window.setClientesSearch = setClientesSearch;
window.setRankView       = setRankView;
window.saveGoals         = saveGoals;
window.loadFile          = loadFile;
window.processAll        = processAll;
window.clearState        = clearState;
window.toggleAccordion   = toggleAccordion;

initNavigation();
initAuth();
