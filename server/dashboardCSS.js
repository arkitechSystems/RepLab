// Shared CSS for admin and trainer dashboards
// Changes here apply to both dashboards

export const DASHBOARD_CSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      background: #000; color: #fff; padding: 32px; min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    body::before {
      content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 28px 28px;
    }
    .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
    .logo span { color: #ef4444; }
    .header { margin-bottom: 28px; }
    .header h1 { font-size: 28px; font-weight: 800; color: #fff; }
    .header h2 { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.5); margin-top: 4px; }
    .header p { color: rgba(255,255,255,0.4); margin-top: 4px; font-size: 13px; }
    .breadcrumb { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 20px; }
    .breadcrumb a { color: #ef4444; text-decoration: none; font-weight: 600; }
    .breadcrumb a:hover { text-decoration: underline; }
    .glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
    .stats { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat { flex: 1; min-width: 140px; padding: 20px; }
    .stat .value { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #ef4444, #f97316); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .stat .label { font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-wrap table { min-width: 600px; }
    .table-wrap th { position: sticky; top: 0; z-index: 1; }
    table { width: 100%; border-collapse: collapse; }
    th { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); text-align: left; padding: 12px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
    td { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 13px; color: rgba(255,255,255,0.8); }
    tr:hover td { background: rgba(255,255,255,0.03); }
    .btn {
      background: linear-gradient(135deg, #DC2626, #EF4444, #F97316);
      background-size: 200% 200%; animation: gradShift 3s ease infinite;
      color: #fff; border: none; padding: 10px 20px; border-radius: 10px;
      font-size: 13px; font-weight: 700; cursor: pointer; margin-bottom: 24px;
      margin-right: 8px; text-decoration: none; display: inline-block;
      box-shadow: 0 4px 20px rgba(239,68,68,0.3); transition: box-shadow 0.2s, transform 0.2s;
    }
    .btn:hover { box-shadow: 0 6px 30px rgba(239,68,68,0.45); transform: translateY(-1px); }
    @keyframes gradShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
    .btn-ghost {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.7); padding: 10px 20px; border-radius: 10px;
      font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 24px;
      margin-right: 8px; text-decoration: none; display: inline-block; transition: all 0.2s;
    }
    .btn-ghost:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { padding: 28px; text-decoration: none; color: #fff; transition: all 0.3s; display: block; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 2px 12px rgba(0,0,0,0.3), 0 0 8px rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.05); }
    .card:hover { border-color: rgba(255,255,255,0.25); transform: translateY(-2px); background: rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(255,255,255,0.06), 0 0 1px rgba(255,255,255,0.2); }
    .card .card-icon { font-size: 32px; margin-bottom: 14px; }
    .card .card-title { font-size: 18px; font-weight: 700; }
    .card .card-desc { font-size: 13px; color: rgba(255,255,255,0.4); margin-top: 8px; line-height: 1.6; }
    h3 { color: #fff; }
    .delete-btn { background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.3); padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
    .delete-btn:hover { color: #ef4444; background: rgba(239,68,68,0.15); }
    label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-weight: 600; }
    input[type="text"], input[type="password"], input[type="email"] {
      width: 100%; padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.06); color: #fff; font-size: 15px; font-family: inherit;
      outline: none; transition: border-color 0.2s;
    }
    input:focus { border-color: rgba(239,68,68,0.6); box-shadow: 0 0 0 2px rgba(239,68,68,0.15); }
    .field { margin-bottom: 16px; }
    .error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #f87171; margin-bottom: 16px; text-align: center; }

    /* Sidebar */
    .sidebar {
      position: fixed; top: 49px; left: 0; bottom: 0; width: 200px; z-index: 50;
      background: rgba(10,10,10,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border-right: 1px solid rgba(255,255,255,0.06);
      overflow-y: auto; padding: 8px 0; transition: width 0.2s, transform 0.2s;
    }
    .sidebar.collapsed { width: 40px; overflow: hidden; }
    .sidebar.collapsed .sidebar-section, .sidebar.collapsed .sidebar-links, .sidebar.collapsed a:not(.sidebar-toggle button) { display: none; }
    .sidebar.collapsed .sidebar-toggle { justify-content: center; }
    .sidebar-toggle {
      display: flex; align-items: center; justify-content: flex-end; padding: 4px 12px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 4px;
    }
    .sidebar-toggle button {
      background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; padding: 6px;
      border-radius: 6px; transition: all 0.15s; display: flex; align-items: center; justify-content: center;
    }
    .sidebar-toggle button:hover { color: #fff; background: rgba(255,255,255,0.08); }
    .sidebar a {
      display: block; padding: 8px 20px; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.4);
      text-decoration: none; transition: all 0.15s; border-left: 2px solid transparent; white-space: nowrap;
    }
    .sidebar a:hover { color: #fff; background: rgba(255,255,255,0.05); border-left-color: rgba(239,68,68,0.4); }
    .sidebar a.active { color: #ef4444; background: rgba(239,68,68,0.08); border-left-color: #ef4444; font-weight: 700; }
    .sidebar-section {
      font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.2);
      padding: 12px 20px 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center;
      justify-content: space-between; user-select: none; transition: color 0.15s;
    }
    .sidebar-section:hover { color: rgba(255,255,255,0.4); }
    .sidebar-section .chevron { transition: transform 0.2s; }
    .sidebar-section.collapsed-section .chevron { transform: rotate(-90deg); }
    .sidebar-links { overflow: hidden; transition: max-height 0.25s ease; max-height: 500px; }
    .sidebar-links.hidden { max-height: 0; }
    .main-with-sidebar { margin-left: 200px; transition: margin-left 0.2s; }
    .main-with-sidebar.expanded { margin-left: 40px; }

    /* Scrollbar */
    html { overflow-y: scroll; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 5px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.35); }

    @media (max-width: 768px) {
      .sidebar { width: 0; overflow: hidden; border-right: none; }
      .main-with-sidebar { margin-left: 0 !important; }
    }
    @media print {
      .sidebar { display: none; }
      .main-with-sidebar { margin-left: 0; }
      .btn, .btn-ghost, .breadcrumb, .delete-btn { display: none; }
      body { padding: 16px; background: #fff; color: #111; }
      body::before { display: none; }
      .glass { background: #fff; border: 1px solid #ddd; backdrop-filter: none; }
      .stat .value { -webkit-text-fill-color: #111; background: none; }
      .stat .label { color: #888; }
      th { background: #111; color: #fff; }
      td { color: #333; border-top-color: #eee; }
      tr:hover td { background: transparent; }
      .card { border: 1px solid #ddd; }
      .card .card-desc { color: #666; }
    }
`;

// Shared sidebar toggle + section collapse JS
export const SIDEBAR_JS = `
function toggleSidebar() {
  const sb = document.getElementById('dashboard-sidebar');
  const main = document.querySelector('.main-with-sidebar');
  const icon = document.getElementById('sidebar-toggle-icon');
  const collapsed = sb.classList.toggle('collapsed');
  main.classList.toggle('expanded', collapsed);
  icon.style.transform = collapsed ? 'rotate(180deg)' : '';
  try { localStorage.setItem('dashboard_sidebar', collapsed ? 'collapsed' : 'open'); } catch {}
}
function toggleSection(name) {
  const links = document.getElementById('section-' + name);
  const section = links.previousElementSibling;
  links.classList.toggle('hidden');
  section.classList.toggle('collapsed-section');
  try {
    const state = JSON.parse(localStorage.getItem('dashboard_sections') || '{}');
    state[name] = links.classList.contains('hidden');
    localStorage.setItem('dashboard_sections', JSON.stringify(state));
  } catch {}
}
try {
  if (localStorage.getItem('dashboard_sidebar') === 'collapsed') {
    document.getElementById('dashboard-sidebar').classList.add('collapsed');
    document.querySelector('.main-with-sidebar').classList.add('expanded');
    var ic = document.getElementById('sidebar-toggle-icon');
    if (ic) ic.style.transform = 'rotate(180deg)';
  }
  const sections = JSON.parse(localStorage.getItem('dashboard_sections') || '{}');
  for (const [name, hidden] of Object.entries(sections)) {
    if (hidden) {
      const el = document.getElementById('section-' + name);
      if (el) { el.classList.add('hidden'); el.previousElementSibling.classList.add('collapsed-section'); }
    }
  }
} catch {}
`;
