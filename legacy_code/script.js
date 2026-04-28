/* ══════════════════════════════════════════════════════════
   ASTRON FRESHSTOP — Operations Hub V18
   script.js — All application logic
   
   CODEPEN SETUP:
   - Paste this into the JS panel
   - In Settings → JS → Add External Scripts:
     https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js
   
   STRUCTURE GUIDE:
   This file is organised in sections. When adding new features,
   place code in the appropriate section or create a new one.
   
   Sections:
   ├── State & Config ............. Global variables, HUB_BASE_URL
   ├── Navigation ................. showView(), showStoreView(), showSub()
   ├── Notice Board ............... loadNotices(), renderNotices(), postNotice()
   ├── Store Operations ........... populateOpsGrid(), store-specific functions
   ├── F.Planner V1 ............... Fuel planner modal (template literal)
   ├── P.Planner V1 ............... Payment planner modal (template literal)
   ├── Assessment System .......... Multi-type assessment engine
   │   ├── Type Definitions ....... ASSESSMENT_TYPES config object
   │   ├── Storage ................ csaLoad(), csaSave()
   │   ├── WhatsApp ............... sendCSAWhatsApp()
   │   ├── Form Generation ........ openCSAForm(), getCSAFormHTML(), getCSAFormScript()
   │   ├── Dashboard Rendering .... csaFiltered(), csaRender(), csaKPI(), charts, table
   │   ├── Report Modal ........... csaOpenReport(), csaPrint()
   │   ├── Demo / Clear ........... csaLoadDemo(), csaClearData()
   │   ├── Remediation ............ openCSARemed(), remedRender()
   │   ├── Tab Switching .......... csaShowTab(), csaUpdateBadges()
   │   ├── Roster ................. rosterAdd(), rosterRender(), rosterEdit()
   │   └── Frequency Tracker ...... freqCalc(), freqRender()
   ├── URL Auto-Open .............. Reads ?form=&type= params
   └── Init ....................... DOMContentLoaded, loadNotices()
   ══════════════════════════════════════════════════════════ */

// ── State ──
let currentStore = '';

// ═══ OPTIONAL: Override the auto-detected URL for WhatsApp links ═══
const HUB_BASE_URL = '';
const NOTICE_KEY = 'astron_notices';
let notices = [];

const DEFAULT_NOTICES = [
    {id:'n1',title:'Shift Handover Sync',body:'Night shift handover completed. Verify pump variance report before 08:00.\n\nAll managers must ensure the pump variance is within tolerance before signing off. If variance exceeds 50L, escalate immediately to the Operations Team.',time:'2 hours ago',priority:'Normal',icon:'fas fa-sync-alt',createdAt:new Date(Date.now()-7200000).toISOString(),author:'Operations Team',documents:[]},
    {id:'n2',title:'Urgent: Freezer Temperature Alert',body:'Freshstop freezer 2 exceeded threshold at Hillcrest. Log corrective action and call maintenance immediately.\n\nMaintenance contact: JAG Monitoring — 031 555 1234\nPlease refer to the attached Cold Chain SOP for correct procedure.',time:'35 minutes ago',priority:'High',icon:'fas fa-bell',createdAt:new Date(Date.now()-2100000).toISOString(),author:'K. Maharaj',documents:[{name:'Cold Chain SOP.pdf',url:'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx',type:'pdf'},{name:'Temperature Log Template',url:'https://docs.google.com/spreadsheets/d/12WC_ex1pXH_JWInspuAWtUEAAa-dIiKQA8aTxKdstMM/edit',type:'xlsx'}]},
    {id:'n3',title:'Training Reminder',body:'Cashup refresher training opens at 14:00 in the team documents folder.\n\nAll site managers must ensure at least 2 CSAs from each shift attend. Attendance register attached — please print and complete.',time:'Yesterday',priority:'Low',icon:'fas fa-bullhorn',createdAt:new Date(Date.now()-86400000).toISOString(),author:'S. Pillay',documents:[{name:'Cashup Training Attendance Register',url:'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx',type:'docx'}]},
];

// ── Date ──
function updateDate() {
    const d = new Date();
    const opts = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
    document.getElementById('topbar-date').textContent = d.toLocaleDateString('en-ZA', opts);
}
updateDate();

// ── View routing ──
const views = ['home', 'store', 'owner'];
const navMap = { home: 'nav-home', owner: 'nav-owner' };
const titleMap = { home: "Manager's Notice Board", store: 'Store Operations', owner: 'Operations Team Hub' };

function showView(name) {
    views.forEach(v => {
        document.getElementById('view-' + v).classList.remove('active');
    });
    document.getElementById('view-' + name).classList.add('active');
    document.getElementById('topbar-title').textContent = titleMap[name] || name;

    // Clear active nav
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (navMap[name]) document.getElementById(navMap[name]).classList.add('active');

    // Sync notice list when switching to owner view
    if (name === 'owner') { loadNotices().then(() => renderNoticeListTeam()); csaLoad(); dcLoad(); showOpsTab('notices'); }
    if (name === 'home') loadNotices();
}

const storeNames = {
    hillcrest: 'Hillcrest',
    hammersdale: 'Hammersdale',
    gillits: 'Gillits',
    catoridge: 'Cato Ridge'
};

function showStoreView(store) {
    currentStore = store;
    showView('store');
    const label = storeNames[store] || store;
    document.getElementById('store-view-title').textContent = label + ' Operations';
    document.getElementById('topbar-title').textContent = label + ' Operations';

    // Set active sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById('nav-' + store);
    if (navEl) navEl.classList.add('active');

    showOpsMain();
    populateOpsGrid(store);
}

function showOpsMain() {
    document.getElementById('ops-main').classList.remove('hidden');
    ['sub-repairs', 'sub-team', 'sub-fuel', 'sub-financial'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
}

// ── Ops Hub Section Navigation ──
function showOpsTab(tab) {
    var tabs = ['notices','assessments','dailychecklist','training','teamcontrols'];
    tabs.forEach(function(t) {
        var el = document.getElementById('ops-sec-' + t);
        var btn = document.getElementById('opstab-btn-' + t);
        if (el) el.style.display = t === tab ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'dailychecklist') { dcRenderToday(); dcRenderHistory(); dcUpdateBadge(); }
}

function showSub(id) {
    document.getElementById('ops-main').classList.add('hidden');
    ['sub-repairs', 'sub-team', 'sub-fuel', 'sub-financial'].forEach(sid => {
        document.getElementById(sid).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

// ── Ops Grid ──
function populateOpsGrid(store) {
    const grid = document.getElementById('ops-grid');
    const base = [
        { id: 'routines', icon: 'fas fa-clipboard-check', title: 'Routines & Audits', desc: 'Daily operational audits', action: 'openRoutinesAudits()' },
        { id: 'repairs', icon: 'fas fa-wrench', title: 'Repairs & Maintenance', desc: 'Equipment maintenance', action: "showSub('sub-repairs')" },
        { id: 'team', icon: 'fas fa-users', title: 'The Team', desc: 'Staff management', action: "showSub('sub-team')" },
        { id: 'time', icon: 'fas fa-clock', title: 'Time Management', desc: 'Schedule & roster', action: 'openTimeManagement()' },
        { id: 'fuel', icon: 'fas fa-gas-pump', title: 'Fuel Management', desc: 'Fuel planning & inventory', action: "showSub('sub-fuel')" },
        { id: 'email', icon: 'fas fa-envelope', title: 'Email', desc: 'Communication', action: 'openEmail()' },
        { id: 'cashup', icon: 'fas fa-cash-register', title: 'Cashup Routine', desc: 'Daily cash reconciliation', action: 'openCashupRoutine()' },
        { id: 'admin', icon: 'fas fa-cogs', title: 'Admin Controls Sheet', desc: 'Financial controls & payments', action: "showSub('sub-financial')" },
    ];

    if (store === 'hillcrest') {
        base.push({ id: 'shrinkage', icon: 'fas fa-chart-line', title: 'Shrinkage', desc: 'Loss analysis', action: 'openShrinkage()' });
        base.push({ id: 'infinity', icon: 'fas fa-infinity', title: 'Infinity Rewards', desc: 'Loyalty system', action: 'openInfinity()' });
    }

    // Gillits and Cato Ridge use the standard base tile set — add store-specific extras here as links become available

    grid.innerHTML = base.map(op => `
        <div class="ops-tile" onclick="${op.action}">
            <i class="${op.icon}"></i>
            <h4>${op.title}</h4>
            <p>${op.desc}</p>
        </div>
    `).join('');
}

// ── Notice Board (persistent) ──
async function loadNotices() {
    try {
        if (window.storage) {
            const r = await window.storage.get(NOTICE_KEY, true);
            notices = r ? JSON.parse(r.value) : JSON.parse(JSON.stringify(DEFAULT_NOTICES));
        } else {
            const raw = localStorage.getItem(NOTICE_KEY);
            notices = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_NOTICES));
        }
    } catch(e) {
        notices = JSON.parse(JSON.stringify(DEFAULT_NOTICES));
    }
    renderNotices();
}

async function saveNotices() {
    const j = JSON.stringify(notices);
    try {
        if (window.storage) await window.storage.set(NOTICE_KEY, j, true);
        else localStorage.setItem(NOTICE_KEY, j);
    } catch(e) {}
}

function renderNotices() {
    const el = document.getElementById('notice-list');
    if (el) el.innerHTML = buildNoticeHTML(false);
}

function renderNoticeListTeam() {
    const el = document.getElementById('notice-list-team');
    if (el) el.innerHTML = buildNoticeHTML(true);
}

function buildNoticeHTML(del) {
    if (!notices.length) return '<div style="padding:1.5rem;text-align:center;color:var(--t3);font-size:.85rem">No notices yet.</div>';
    const bc = { High: 'badge-high bh', Normal: 'badge-normal bn', Low: 'badge-low bl' };
    return notices.map((n, i) => {
        const docCount = (n.documents && n.documents.length) || 0;
        const docIndicator = docCount ? `<div class="n-docs-indicator"><i class="fas fa-paperclip"></i>${docCount} attachment${docCount > 1 ? 's' : ''}</div>` : '';
        const timeStr = n.time || formatTimeAgo(n.createdAt);
        return `<div class="notice-item" onclick="openNoticeDetail(${i})">
            <div class="notice-icon"><i class="${n.icon || 'fas fa-bullhorn'}"></i></div>
            <div class="notice-body">
                <h4>${n.title}</h4>
                <p>${truncate(n.body, 120)}</p>
                ${docIndicator}
            </div>
            <div class="notice-meta">
                <span class="notice-time">${timeStr}</span>
                <span class="badge ${bc[n.priority] || 'badge-normal bn'}">${n.priority}</span>
                ${del ? `<button onclick="event.stopPropagation();deleteNotice(${i})" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:.75rem" title="Delete"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function truncate(s, len) {
    if (!s) return '';
    const first = s.split('\n')[0];
    return first.length > len ? first.substring(0, len) + '…' : first;
}

function formatTimeAgo(iso) {
    if (!iso) return '';
    const d = new Date(iso), now = new Date(), diff = now - d, mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' min' + (mins > 1 ? 's' : '') + ' ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function openNoticeDetail(i) {
    const n = notices[i]; if (!n) return;
    const bc = { High: 'bh', Normal: 'bn', Low: 'bl' };
    const timeStr = n.time || formatTimeAgo(n.createdAt);
    const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const iconMap = { pdf: 'fas fa-file-pdf', xlsx: 'fas fa-file-excel', xls: 'fas fa-file-excel', docx: 'fas fa-file-word', doc: 'fas fa-file-word', pptx: 'fas fa-file-powerpoint', link: 'fas fa-external-link-alt' };
    const typeLabel = { pdf: 'PDF Document', xlsx: 'Spreadsheet', xls: 'Spreadsheet', docx: 'Word Document', doc: 'Word Document', pptx: 'Presentation', link: 'External Link' };
    let docsHTML = '';
    if (n.documents && n.documents.length) {
        docsHTML = `<div class="nd-docs"><div class="nd-docs-title"><i class="fas fa-paperclip" style="margin-right:.3rem"></i>Attached Documents (${n.documents.length})</div>${n.documents.map(d => {
            const icon = iconMap[d.type] || 'fas fa-file';
            const tl = typeLabel[d.type] || 'Document';
            return `<a href="${d.url}" target="_blank" class="nd-doc" onclick="event.stopPropagation()"><i class="${icon}"></i><div class="nd-doc-info"><div class="nd-doc-name">${d.name}</div><div class="nd-doc-type">${tl}</div></div><i class="fas fa-external-link-alt" style="color:var(--t3);font-size:.75rem"></i></a>`;
        }).join('')}</div>`;
    }
    document.getElementById('nd-body').innerHTML = `
        <div class="nd-priority ${bc[n.priority] || 'bn'}">${n.priority} Priority</div>
        <div class="nd-title">${n.title}</div>
        <div class="nd-meta">
            <span><i class="fas fa-clock" style="margin-right:.25rem"></i>${timeStr}</span>
            ${n.author ? `<span><i class="fas fa-user" style="margin-right:.25rem"></i>${n.author}</span>` : ''}
            ${dateStr ? `<span>${dateStr}</span>` : ''}
        </div>
        <div class="nd-content">${n.body}</div>
        ${docsHTML}`;
    document.getElementById('nd-bd').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeNoticeDetail() {
    document.getElementById('nd-bd').classList.remove('open');
    document.body.style.overflow = '';
}

document.getElementById('nd-bd').addEventListener('click', function(e) {
    if (e.target === this) closeNoticeDetail();
});

function printNotice() {
    const body = document.getElementById('nd-body').innerHTML;
    const win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Astron Freshstop — Notice</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#1e293b;max-width:700px;margin:0 auto;font-size:14px;line-height:1.6}h1{font-size:1.1rem;margin-bottom:.25rem}.nd-priority{display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;margin-bottom:12px}.bh{background:#fee2e2;color:#dc2626}.bn{background:#fff7ed;color:#f97316}.bl{background:#dcfce7;color:#16a34a}.nd-title{font-size:18px;font-weight:700;margin-bottom:8px}.nd-meta{font-size:12px;color:#64748b;margin-bottom:16px}.nd-content{white-space:pre-line;margin-bottom:20px}.nd-docs-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}.nd-doc{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;text-decoration:none;color:#1e293b;font-size:13px}.nd-doc-name{font-weight:600}.nd-doc-type{font-size:11px;color:#94a3b8}@media print{a{color:#1e293b}}</style></head><body><div style="border-bottom:2px solid #f97316;padding-bottom:8px;margin-bottom:16px;font-size:12px;color:#64748b;font-weight:600">ASTRON FRESHSTOP — NOTICE</div>' + body + '<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Printed ' + new Date().toLocaleDateString('en-ZA') + '</div></body></html>');
    win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
}

function deleteNotice(i) {
    notices.splice(i, 1);
    saveNotices();
    renderNotices();
    renderNoticeListTeam();
}

function toggleNoticeForm() {
    document.getElementById('nf-wrap').classList.toggle('hidden');
}

let noticeDocRows = 0;
function addDocRow() {
    noticeDocRows++;
    const id = 'doc-row-' + noticeDocRows;
    const row = document.createElement('div');
    row.className = 'nf-doc-row'; row.id = id;
    row.innerHTML = `<input class="nf-input" placeholder="Document name" data-role="doc-name"><input class="nf-input" placeholder="Paste URL (OneDrive, Google Drive, etc.)" data-role="doc-url"><select class="nf-input" style="max-width:100px" data-role="doc-type"><option value="pdf">PDF</option><option value="docx">Word</option><option value="xlsx">Excel</option><option value="pptx">PowerPoint</option><option value="link">Link</option></select><button class="btn-rm-doc" onclick="document.getElementById('${id}').remove()"><i class="fas fa-times"></i></button>`;
    document.getElementById('doc-list').appendChild(row);
}

function postNotice() {
    const title = document.getElementById('f-title').value.trim();
    const body = document.getElementById('f-body').value.trim();
    const priority = document.getElementById('f-priority').value;
    const author = document.getElementById('f-author').value.trim() || 'Operations Team';
    if (!title || !body) return alert('Please fill in both title and details.');
    const documents = [];
    document.querySelectorAll('.nf-doc-row').forEach(row => {
        const name = row.querySelector('[data-role="doc-name"]').value.trim();
        const url = row.querySelector('[data-role="doc-url"]').value.trim();
        const type = row.querySelector('[data-role="doc-type"]').value;
        if (name && url) documents.push({ name, url, type });
    });
    notices.unshift({ id: 'n' + Date.now(), title, body, priority, icon: 'fas fa-bullhorn', createdAt: new Date().toISOString(), author, documents });
    saveNotices();
    renderNotices();
    renderNoticeListTeam();
    document.getElementById('f-title').value = '';
    document.getElementById('f-body').value = '';
    document.getElementById('f-author').value = '';
    document.getElementById('doc-list').innerHTML = '';
    document.getElementById('nf-wrap').classList.add('hidden');
}

// ── External Links ──
function openTemplateVault() {
    window.open('https://onedrive.live.com/?id=%2Fpersonal%2Fb85cebe941b27ea9%2FDocuments%2FASTRON%202026%2FTEMPLATE&viewid=398989c0%2Db182%2D4d5d%2Daa3f%2D8ae909d28221&view=0', '_blank');
}
function openIncidentReporting() {
    window.open('https://onedrive.live.com/?id=%2Fpersonal%2Fb85cebe941b27ea9%2FDocuments%2FASTRON%202026%2FINCIDENT%20REPORTING&viewid=398989c0%2Db182%2D4d5d%2Daa3f%2D8ae909d28221&view=0', '_blank');
}
function openConferenceCalls() {
    window.open('https://onedrive.live.com/?id=%2Fpersonal%2Fb85cebe941b27ea9%2FDocuments%2FASTRON%202026%2FCONFERENCE%20CALL%20NOTES&viewid=398989c0%2Db182%2D4d5d%2Daa3f%2D8ae909d28221&view=0', '_blank');
}
function openRoutinesAudits() {
    const urls = {
        hillcrest: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7BFF8C0F9C-F98F-46A5-B66A-17ABFB3B4DCF%7D&file=Daily_Store_Checksheet_3x_Daily_TRUE_Replacement.docx&action=default&mobileredirect=true',
        hammersdale: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7BC57490C2-8B6D-42FF-B1ED-F6F7B0E2305A%7D&file=Daily_Store_Checksheet_3x_Daily_TRUE_Replacement.docx&action=default&mobileredirect=true'
    };
    if (urls[currentStore]) window.open(urls[currentStore], '_blank');
}
function openTimeManagement() { window.open('https://outlook.live.com/calendar/', '_blank'); }
function openEmail() { window.open('https://mail.yahoo.com/n/inbox/priority?.src=ym&reason=myc&listFilter=PRIORITY', '_blank'); }
function openShrinkage() {
    if (currentStore === 'hillcrest') window.open('https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7B16DCB9ED-7194-4E16-B751-FAB8F3452564%7D&file=SHRINKAGE%20HILLCREST.xlsx&action=default&mobileredirect=true', '_blank');
    else alert('Shrinkage tracking not available for this store');
}
function openInfinity() {
    if (currentStore === 'hillcrest') window.open('https://www.infinityrewards.co.za/#nothing', '_blank');
}
function openCashupRoutine() {
    const urls = {
        hillcrest: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7BCCA64080-F08D-4326-99C8-0EF05F1AC111%7D&file=Cash-Up%20Hillcrest.xls&action=default&mobileredirect=true',
        hammersdale: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7B6F9428B0-E27C-43FD-AE80-44862EB9746F%7D&file=Cash-Up%20Hammersdale.xls&action=default&mobileredirect=true'
    };
    if (urls[currentStore]) window.open(urls[currentStore], '_blank');
}
function openTeamDocuments() {
    const urls = {
        hillcrest: 'https://onedrive.live.com/?id=%2Fpersonal%2Fb85cebe941b27ea9%2FDocuments%2FASTRON%202026%2FHILLCREST%2FTHE%20TEAM%2FTEAM%20DOCUMENTS%2FTEAM%20MEMBERS&viewid=398989c0%2Db182%2D4d5d%2Daa3f%2D8ae909d28221&view=0',
        hammersdale: 'https://onedrive.live.com/?id=%2Fpersonal%2Fb85cebe941b27ea9%2FDocuments%2FASTRON%202026%2FHAMMERSDALE%2FTHE%20TEAM%2FTEAM%20DOCUMENTS%2FTEAM%20MEMBERS&viewid=398989c0%2Db182%2D4d5d%2Daa3f%2D8ae909d28221&view=0'
    };
    if (urls[currentStore]) window.open(urls[currentStore], '_blank');
}
function openTeamRegister() {
    const urls = {
        hillcrest: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7B7A767279-63BB-42C9-ADBE-F27030F2A5E5%7D&file=REGISTER.xlsx&action=default&mobileredirect=true',
        hammersdale: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7B469D1764-2CF6-436E-B8E4-B9CC4499E7F0%7D&file=REGISTER.xlsx&action=default&mobileredirect=true'
    };
    if (urls[currentStore]) window.open(urls[currentStore], '_blank');
}
function openFuelPlan() {
    if (currentStore === 'hillcrest') {
        openFuelPlannerModal();
    } else if (currentStore === 'hammersdale') {
        window.open('https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7BD40D8AED-285B-4138-BC0B-48EBE7BBBB08%7D&file=FUEL%20PLANNER.xlsx&action=default&mobileredirect=true', '_blank');
    }
}

function openFuelPlannerModal() {
    const backdrop = document.getElementById('fp-modal-backdrop');
    const body = document.getElementById('fp-modal-body');
    // Only inject once
    if (!body.dataset.loaded) {
        body.dataset.loaded = '1';
        body.innerHTML = getFuelPlannerHTML();
        // Run the planner script in context
        const script = document.createElement('script');
        script.textContent = getFuelPlannerScript();
        body.appendChild(script);
    }
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeFuelPlanner() {
    document.getElementById('fp-modal-backdrop').classList.remove('open');
    document.body.style.overflow = '';
}

// Close on backdrop click
document.getElementById('fp-modal-backdrop').addEventListener('click', function(e) {
    if (e.target === this) closeFuelPlanner();
});

function getFuelPlannerHTML() {
    return `
<style>
*{box-sizing:border-box}
#fp-wrap{font-family:Arial,sans-serif;color:#2C2C2A;font-size:13px}
#fp-wrap .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px;background:#fff;border:0.5px solid #D3D1C7;border-radius:12px;padding:1rem 1.25rem}
#fp-wrap .hdr-title{font-size:16px;font-weight:500}
#fp-wrap .hdr-sub{font-size:12px;color:#5F5E5A}
#fp-wrap .tab-bar{display:flex;gap:2px;border-bottom:1px solid #D3D1C7;margin-bottom:1rem;background:#fff;padding:.5rem 1rem 0;border-radius:12px 12px 0 0}
#fp-wrap .tab{padding:7px 14px;font-size:13px;cursor:pointer;border:none;background:none;color:#5F5E5A;border-bottom:2px solid transparent;margin-bottom:-1px}
#fp-wrap .tab.active{color:#2C2C2A;border-bottom-color:#2C2C2A;font-weight:500}
#fp-wrap .tab:hover:not(.active){color:#2C2C2A}
#fp-wrap .page{background:#fff;border:0.5px solid #D3D1C7;border-radius:0 0 12px 12px;padding:1rem;display:none}
#fp-wrap .page.active{display:block}
#fp-wrap .dsl-c{color:#185FA5}#fp-wrap .ulp-c{color:#3B6D11}
#fp-wrap .card{background:#fff;border:0.5px solid #D3D1C7;border-radius:12px;padding:1rem;margin-bottom:.75rem}
#fp-wrap .tbl-wrap{overflow-x:auto}
#fp-wrap table.main{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}
#fp-wrap table.main th{padding:7px 6px;font-weight:500;font-size:11px;color:#5F5E5A;text-align:center;white-space:nowrap;line-height:1.3;border-bottom:1px solid #888780}
#fp-wrap table.main th.left{text-align:left}
#fp-wrap table.main td{padding:4px 5px;border-bottom:0.5px solid #D3D1C7;text-align:center;vertical-align:middle}
#fp-wrap table.main td.left{text-align:left;font-weight:500}
#fp-wrap table.main tr:hover td{background:#F1EFE8}
#fp-wrap table.main tr.orow td{background:#EAF3DE}
#fp-wrap table.main tr.oconf td{background:#C0DD97}
#fp-wrap table.main tr.wknd td{background:#F1EFE8}
#fp-wrap input.cell{width:100%;border:none;background:transparent;text-align:center;font-size:12px;color:#2C2C2A;padding:2px 0}
#fp-wrap input.cell:focus{outline:1px solid #378ADD;border-radius:3px;background:#E6F1FB}
#fp-wrap input.cell.dsl{color:#185FA5}
#fp-wrap input.cell.ulp{color:#3B6D11}
#fp-wrap .badge{display:inline-block;padding:2px 7px;border-radius:8px;font-size:10px;font-weight:500}
#fp-wrap .bc{background:#C0DD97;color:#27500A}
#fp-wrap .bo{background:#EAF3DE;color:#3B6D11}
#fp-wrap .btn{padding:7px 14px;border-radius:8px;border:0.5px solid #B4B2A9;background:#fff;color:#2C2C2A;font-size:12px;cursor:pointer;font-weight:500}
#fp-wrap .btn:hover{background:#F1EFE8}
#fp-wrap .btn.pri{background:#185FA5;color:#fff;border-color:#185FA5}
#fp-wrap .btn.pri:hover{background:#0C447C}
#fp-wrap .btn.sm{padding:4px 10px;font-size:11px}
#fp-wrap .btn.del{color:#A32D2D;border-color:#F7C1C1}
#fp-wrap .fg{display:flex;flex-direction:column;gap:4px}
#fp-wrap .fg label{font-size:11px;color:#5F5E5A}
#fp-wrap .fg input,#fp-wrap .fg select{padding:6px 8px;border:0.5px solid #B4B2A9;border-radius:8px;background:#fff;color:#2C2C2A;font-size:12px;width:100%}
#fp-wrap .fg input:focus,#fp-wrap .fg select:focus{outline:none;border-color:#378ADD}
#fp-wrap .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#fp-wrap .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
#fp-wrap .sec{font-size:13px;font-weight:500;margin-bottom:.75rem}
#fp-wrap .pgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
#fp-wrap .pbox{border:0.5px solid #D3D1C7;border-radius:8px;padding:8px 10px}
#fp-wrap .prow{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:3px}
#fp-wrap .psep{border:none;border-top:0.5px solid #D3D1C7;margin:7px 0}
#fp-wrap .gbox{border:0.5px solid #D3D1C7;border-radius:8px;padding:10px 12px;margin-bottom:10px}
#fp-wrap .tanks{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:1rem}
#fp-wrap .tcard{background:#fff;border:0.5px solid #D3D1C7;border-radius:12px;padding:.75rem;display:flex;flex-direction:column;align-items:center;gap:5px}
#fp-wrap .tlabel{font-size:11px;font-weight:500;text-align:center}
#fp-wrap .tsub{font-size:10px;color:#5F5E5A;text-align:center}
#fp-wrap select#fp-selMonth{padding:6px 10px;border:0.5px solid #B4B2A9;border-radius:8px;background:#fff;color:#2C2C2A;font-size:12px}
</style>

<div id="fp-wrap">
<div class="hdr">
  <div>
<div class="hdr-title">F.Planner V1 — Hillcrest</div>
<div class="hdr-sub">Account: 0322605 &nbsp;|&nbsp; Astron: 0860 300 860 &nbsp;|&nbsp; Unitrans: 0810 314 215</div>
  </div>
  <div style="display:flex;gap:8px;align-items:center">
<select id="fp-selMonth">
  <option value="2026-01">January 2026</option>
  <option value="2026-02">February 2026</option>
  <option value="2026-03">March 2026</option>
  <option value="2026-04" selected>April 2026</option>
  <option value="2026-05">May 2026</option>
  <option value="2026-06">June 2026</option>
  <option value="2026-07">July 2026</option>
  <option value="2026-08">August 2026</option>
  <option value="2026-09">September 2026</option>
  <option value="2026-10">October 2026</option>
  <option value="2026-11">November 2026</option>
  <option value="2026-12">December 2026</option>
</select>
<button class="btn sm pri" id="fp-btnNewOrder">+ New order</button>
  </div>
</div>

<div class="tab-bar">
  <button class="tab active" id="fp-t-planner">Monthly planner</button>
  <button class="tab" id="fp-t-atg">ATG underground stock</button>
  <button class="tab" id="fp-t-orders">Orders</button>
  <button class="tab" id="fp-t-pricing">Pricing &amp; margins</button>
  <button class="tab" id="fp-t-nextmonth">Next month start</button>
</div>

<div class="page active" id="fp-tab-planner"></div>
<div class="page" id="fp-tab-atg"></div>
<div class="page" id="fp-tab-orders"></div>
<div class="page" id="fp-tab-pricing"></div>
<div class="page" id="fp-tab-nextmonth"></div>
<div class="page" id="fp-tab-order"></div>
</div>`;
}

function getFuelPlannerScript() {
    return `
(function(){
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MNTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const SK='fplanner_v1_hillcrest';
let db={};let curM='2026-04';let editIdx=null;
function gdom(id){return document.getElementById(id);}
function fmtR(n){return 'R '+Number(n).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});}
function daysIn(m){const[y,mo]=m.split('-').map(Number);return new Date(y,mo,0).getDate();}
function dow(m,d){const[y,mo]=m.split('-').map(Number);return new Date(y,mo-1,d).getDay();}
function ensureMonth(m){
  if(!db.caps)db.caps={d1:30000,d2:30000,u1:25000,u2:25000};
  if(!db[m])db[m]={days:{},orders:[],pricing:{},nextStart:{dsl:'',ulp:''},cap:{d1:db.caps.d1,d2:db.caps.d2,u1:db.caps.u1,u2:db.caps.u2},atg:{d1:0,d2:0,u1:0,u2:0}};
  const n=daysIn(m);
  for(let d=1;d<=n;d++){if(!db[m].days[d])db[m].days[d]={df:'',uf:'',da:'',ua:'',by:''};}
}
function loadDB(){(async function(){try{if(window.storage){const r=await window.storage.get(SK);if(r)db=JSON.parse(r.value);}else{const s=localStorage.getItem(SK);if(s)db=JSON.parse(s);}}catch(e){}ensureMonth(curM);init();})();}
function saveDB(){(async function(){try{const j=JSON.stringify(db);if(window.storage)await window.storage.set(SK,j);else localStorage.setItem(SK,j);}catch(e){}})();}
function orderForDay(d){return(db[curM].orders||[]).find(o=>parseInt(o.day)===d)||null;}
function drawGauge(canvasId,vol,cap,isDsl){
  const canvas=gdom(canvasId);if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,R=Math.min(W,H)/2-6;
  const pct=Math.min(1,Math.max(0,vol/Math.max(cap,1)));
  const low=pct<0.2;const sa=Math.PI*0.75,sw=Math.PI*1.5;
  ctx.clearRect(0,0,W,H);
  ctx.beginPath();ctx.arc(cx,cy,R,sa,sa+sw);ctx.lineWidth=14;ctx.strokeStyle='#DBEAFE';ctx.lineCap='round';ctx.stroke();
  if(pct>0){ctx.beginPath();ctx.arc(cx,cy,R,sa,sa+sw*pct);ctx.lineWidth=14;ctx.strokeStyle=low?'#E24B4A':(isDsl?'#378ADD':'#639922');ctx.lineCap='round';ctx.stroke();}
  const la=sa+sw*pct;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+R*Math.cos(la),cy+R*Math.sin(la));ctx.lineWidth=2;ctx.strokeStyle=low?'#E24B4A':'#444441';ctx.stroke();
  ctx.fillStyle=low?'#E24B4A':'#2C2C2A';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText(Math.round(pct*100)+'%',cx,cy+5);
  ctx.fillStyle='#5F5E5A';ctx.font='9px Arial';ctx.fillText(vol.toLocaleString('en-ZA')+'L',cx,cy+18);
}
function drawAllGauges(){
  const atg=db[curM].atg||{d1:0,d2:0,u1:0,u2:0};const cap=db[curM].cap||{d1:30000,d2:30000,u1:25000,u2:25000};
  drawGauge('fp-g-d1',atg.d1,cap.d1,true);drawGauge('fp-g-d2',atg.d2,cap.d2,true);drawGauge('fp-g-u1',atg.u1,cap.u1,false);drawGauge('fp-g-u2',atg.u2,cap.u2,false);
}
function gaugesHTML(){
  const cap=db[curM].cap||{d1:30000,d2:30000,u1:25000,u2:25000};
  const items=[{id:'fp-g-d1',label:'DSL Tank 1',cap:cap.d1,c:'#185FA5'},{id:'fp-g-d2',label:'DSL Tank 2',cap:cap.d2,c:'#185FA5'},{id:'fp-g-u1',label:'ULP Tank 1',cap:cap.u1,c:'#3B6D11'},{id:'fp-g-u2',label:'ULP Tank 2',cap:cap.u2,c:'#3B6D11'}];
  return'<div class="tanks">'+items.map(t=>'<div class="tcard"><div class="tlabel" style="color:'+t.c+'">'+t.label+'</div><canvas id="'+t.id+'" width="110" height="110"></canvas><div class="tsub">Cap: '+Number(t.cap).toLocaleString('en-ZA')+'L</div></div>').join('')+'</div>';
}
function renderPlanner(){
  const BL='border-left:2px solid #888780';const BR='border-right:2px solid #888780';
  const n=daysIn(curM);let rows='';
  for(let d=1;d<=n;d++){
const day=db[curM].days[d];const dw=dow(curM,d);const wk=dw===0||dw===6;const ord=orderForDay(d);
let rc=wk?'wknd':'';if(ord)rc=ord.confirmed?'oconf':'orow';
const dv=ord&&ord.dv?Number(ord.dv).toLocaleString('en-ZA'):'';const uv=ord&&ord.uv?Number(ord.uv).toLocaleString('en-ZA'):'';
const ref=ord&&ord.ref?'<span style="font-size:10px;color:#854F0B">'+ord.ref+'</span>':'';
const sb=ord?(ord.confirmed?'<span class="badge bc">Confirmed</span>':'<span class="badge bo">Ordered</span>'):'';
const by=ord&&ord.by?ord.by:(day.by||'');
rows+='<tr class="'+rc+'"><td class="left" style="width:58px;white-space:nowrap">'+DAYS[dw]+' '+d+'</td><td style="width:60px;'+BL+'"><input class="cell dsl" value="'+(day.df||'')+'" data-m="'+curM+'" data-d="'+d+'" data-f="df"></td><td style="width:60px;'+BR+'"><input class="cell ulp" value="'+(day.uf||'')+'" data-m="'+curM+'" data-d="'+d+'" data-f="uf"></td><td style="width:66px;'+BL+'"><input class="cell dsl" value="'+(day.da||'')+'" data-m="'+curM+'" data-d="'+d+'" data-f="da"></td><td style="width:66px;'+BR+'"><input class="cell ulp" value="'+(day.ua||'')+'" data-m="'+curM+'" data-d="'+d+'" data-f="ua"></td><td style="width:68px;'+BL+';color:#185FA5">'+dv+'</td><td style="width:68px;color:#3B6D11">'+uv+'</td><td style="width:90px">'+ref+'</td><td style="width:85px;'+BR+'">'+sb+'</td><td style="width:78px"><input class="cell" style="font-size:11px" value="'+(by||'')+'" data-m="'+curM+'" data-d="'+d+'" data-f="by"></td></tr>';
  }
  gdom('fp-tab-planner').innerHTML=gaugesHTML()+'<div class="card" style="padding:0"><div class="tbl-wrap"><table class="main"><thead><tr><th class="left" rowspan="2" style="width:58px;vertical-align:bottom;padding-bottom:7px;border-right:2px solid #888780">Day</th><th colspan="2" style="color:#185FA5;border-bottom:0.5px solid #B5D4F4;'+BL+';'+BR+'">Forecast (kL)</th><th colspan="2" style="color:#185FA5;border-bottom:0.5px solid #B5D4F4;'+BL+';'+BR+'">Actual sales (L)</th><th colspan="4" style="border-bottom:0.5px solid #888780;'+BL+';'+BR+'">Orders</th><th rowspan="2" style="width:78px;vertical-align:bottom;padding-bottom:7px">Ordered by</th></tr><tr><th style="width:60px;color:#185FA5;'+BL+'">DSL</th><th style="width:60px;color:#3B6D11;'+BR+'">ULP</th><th style="width:66px;color:#185FA5;'+BL+'">DSL</th><th style="width:66px;color:#3B6D11;'+BR+'">ULP</th><th style="width:68px;color:#185FA5;font-size:10px;'+BL+'">DSL vol (L)</th><th style="width:68px;color:#3B6D11;font-size:10px">ULP vol (L)</th><th style="width:90px;font-size:10px">Ref no.</th><th style="width:85px;font-size:10px;'+BR+'">Status</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  setTimeout(drawAllGauges,40);
}
function renderATG(){
  const atg=db[curM].atg||{d1:0,d2:0,u1:0,u2:0};const cap=db[curM].cap||{d1:30000,d2:30000,u1:25000,u2:25000};
  gdom('fp-tab-atg').innerHTML='<div class="g2"><div class="card"><div class="sec" style="color:#185FA5">Diesel underground stock</div><div class="g2"><div class="fg"><label>DSL Tank 1 capacity (L)</label><input id="fp-cap-d1" type="number" value="'+cap.d1+'"></div><div class="fg"><label>DSL Tank 2 capacity (L)</label><input id="fp-cap-d2" type="number" value="'+cap.d2+'"></div><div class="fg"><label>DSL Tank 1 — current vol (L)</label><input id="fp-atg-d1" type="number" value="'+(atg.d1||'')+'"></div><div class="fg"><label>DSL Tank 2 — current vol (L)</label><input id="fp-atg-d2" type="number" value="'+(atg.d2||'')+'"></div></div></div><div class="card"><div class="sec" style="color:#3B6D11">ULP underground stock</div><div class="g2"><div class="fg"><label>ULP Tank 1 capacity (L)</label><input id="fp-cap-u1" type="number" value="'+cap.u1+'"></div><div class="fg"><label>ULP Tank 2 capacity (L)</label><input id="fp-cap-u2" type="number" value="'+cap.u2+'"></div><div class="fg"><label>ULP Tank 1 — current vol (L)</label><input id="fp-atg-u1" type="number" value="'+(atg.u1||'')+'"></div><div class="fg"><label>ULP Tank 2 — current vol (L)</label><input id="fp-atg-u2" type="number" value="'+(atg.u2||'')+'"></div></div></div></div><div style="margin-top:.5rem"><button class="btn pri" id="fp-btnSaveATG">Save ATG readings</button></div><div style="font-size:11px;color:#5F5E5A;margin-top:.5rem">Values saved here update the gauges on the monthly planner.</div>';
  gdom('fp-btnSaveATG').addEventListener('click',function(){
db[curM].cap={d1:parseFloat(gdom('fp-cap-d1').value)||30000,d2:parseFloat(gdom('fp-cap-d2').value)||30000,u1:parseFloat(gdom('fp-cap-u1').value)||25000,u2:parseFloat(gdom('fp-cap-u2').value)||25000};
db.caps={d1:db[curM].cap.d1,d2:db[curM].cap.d2,u1:db[curM].cap.u1,u2:db[curM].cap.u2};
db[curM].atg={d1:parseFloat(gdom('fp-atg-d1').value)||0,d2:parseFloat(gdom('fp-atg-d2').value)||0,u1:parseFloat(gdom('fp-atg-u1').value)||0,u2:parseFloat(gdom('fp-atg-u2').value)||0};
saveDB();alert('ATG readings saved.');
  });
}
function renderOrders(){
  const orders=db[curM].orders||[];
  gdom('fp-tab-orders').innerHTML='<div style="display:flex;justify-content:flex-end;margin-bottom:.75rem"><button class="btn pri" id="fp-btnAddOrder">+ Place new order</button></div><div class="card" style="padding:0"><div class="tbl-wrap">'+(orders.length===0?'<div style="padding:2rem;text-align:center;color:#5F5E5A">No orders placed this month</div>':'<table class="main"><thead><tr><th class="left" style="width:110px">Ref no.</th><th style="width:65px">Day</th><th style="width:80px">DSL vol (L)</th><th style="width:80px">ULP vol (L)</th><th style="width:90px">DSL invoice</th><th style="width:90px">ULP invoice</th><th style="width:90px">Ordered by</th><th style="width:80px">Status</th><th style="width:130px">Actions</th></tr></thead><tbody>'+orders.map((o,i)=>'<tr class="'+(o.confirmed?'oconf':'orow')+'"><td class="left" style="font-size:11px;color:#854F0B">'+(o.ref||'—')+'</td><td>'+DAYS[dow(curM,parseInt(o.day))]+' '+o.day+'</td><td style="color:#185FA5">'+(o.dv?Number(o.dv).toLocaleString('en-ZA'):'—')+'</td><td style="color:#3B6D11">'+(o.uv?Number(o.uv).toLocaleString('en-ZA'):'—')+'</td><td>'+(o.di?fmtR(o.di):'—')+'</td><td>'+(o.ui?fmtR(o.ui):'—')+'</td><td>'+(o.by||'—')+'</td><td><span class="badge '+(o.confirmed?'bc':'bo')+'">'+(o.confirmed?'Confirmed':'Ordered')+'</span></td><td><div style="display:flex;gap:4px"><button class="btn sm" data-edit="'+i+'">Edit</button><button class="btn sm" data-confirm="'+i+'">'+(o.confirmed?'Unconfirm':'Confirm')+'</button><button class="btn sm del" data-del="'+i+'">Del</button></div></td></tr>').join('')+'</tbody></table>')+'</div></div>';
  gdom('fp-btnAddOrder').addEventListener('click',function(){editIdx=null;showOrderForm();});
  gdom('fp-tab-orders').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',function(){editIdx=parseInt(this.dataset.edit);showOrderForm();}));
  gdom('fp-tab-orders').querySelectorAll('[data-confirm]').forEach(b=>b.addEventListener('click',function(){const i=parseInt(this.dataset.confirm);db[curM].orders[i].confirmed=!db[curM].orders[i].confirmed;saveDB();renderOrders();renderPlanner();}));
  gdom('fp-tab-orders').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',function(){if(!confirm('Delete this order?'))return;db[curM].orders.splice(parseInt(this.dataset.del),1);saveDB();renderOrders();renderPlanner();}));
}
function showOrderForm(){
  showTab('order');const n=daysIn(curM);const isEdit=editIdx!==null;const o=isEdit?db[curM].orders[editIdx]:{};
  let dayOpts='';for(let d=1;d<=n;d++){const dw=dow(curM,d);dayOpts+='<option value="'+d+'" '+(parseInt(o.day)===d?'selected':'')+'>'+DAYS[dw]+' '+d+'</option>';}
  gdom('fp-tab-order').innerHTML='<div class="card"><div class="sec">'+(isEdit?'Edit order':'Place new order')+'</div><div class="g3" style="margin-bottom:12px"><div class="fg"><label>Delivery day</label><select id="fp-o-day">'+dayOpts+'</select></div><div class="fg"><label>Order reference no.</label><input id="fp-o-ref" value="'+(o.ref||'')+'"></div><div class="fg"><label>Ordered by</label><input id="fp-o-by" value="'+(o.by||'')+'"></div></div><div class="gbox" style="border-color:#B5D4F4"><div style="font-size:11px;font-weight:500;color:#185FA5;margin-bottom:8px">Diesel (DSL)</div><div class="g2"><div class="fg"><label>Volume ordered (L)</label><input id="fp-o-dv" type="number" value="'+(o.dv||'')+'"></div><div class="fg"><label>Invoice value (R) — post delivery</label><input id="fp-o-di" type="number" value="'+(o.di||'')+'"></div></div></div><div class="gbox" style="border-color:#C0DD97"><div style="font-size:11px;font-weight:500;color:#3B6D11;margin-bottom:8px">Petrol ULP</div><div class="g2"><div class="fg"><label>Volume ordered (L)</label><input id="fp-o-uv" type="number" value="'+(o.uv||'')+'"></div><div class="fg"><label>Invoice value (R) — post delivery</label><input id="fp-o-ui" type="number" value="'+(o.ui||'')+'"></div></div></div><div class="g2" style="margin-bottom:12px"><div class="fg"><label>Notes / adjustments</label><input id="fp-o-notes" value="'+(o.notes||'')+'"></div><div class="fg"><label>Confirmed?</label><select id="fp-o-conf"><option value="0" '+(!o.confirmed?'selected':'')+'>No — pending</option><option value="1" '+(o.confirmed?'selected':'')+'>Yes — confirmed</option></select></div></div><div style="display:flex;gap:8px"><button class="btn pri" id="fp-btnSaveOrder">'+(isEdit?'Save changes':'Save order')+'</button><button class="btn" id="fp-btnCancelOrder">Cancel</button>'+(isEdit?'<button class="btn del" id="fp-btnDelOrder">Delete order</button>':'')+'</div></div>';
  gdom('fp-btnSaveOrder').addEventListener('click',function(){
const day=gdom('fp-o-day').value;const dv=parseFloat(gdom('fp-o-dv').value)||0;const uv=parseFloat(gdom('fp-o-uv').value)||0;
if(!dv&&!uv){alert('Enter a volume for at least one grade.');return;}
const order={day,ref:gdom('fp-o-ref').value.trim(),by:gdom('fp-o-by').value.trim(),dv,uv,di:parseFloat(gdom('fp-o-di').value)||0,ui:parseFloat(gdom('fp-o-ui').value)||0,notes:gdom('fp-o-notes').value.trim(),confirmed:gdom('fp-o-conf').value==='1'};
if(!db[curM].orders)db[curM].orders=[];
if(isEdit){db[curM].orders[editIdx]=order;}else{const ex=(db[curM].orders||[]).findIndex(o=>parseInt(o.day)===parseInt(day));if(ex>-1){if(!confirm('An order exists for this day. Replace it?'))return;db[curM].orders[ex]=order;}else db[curM].orders.push(order);}
editIdx=null;saveDB();showTab('planner');renderPlanner();
  });
  gdom('fp-btnCancelOrder').addEventListener('click',function(){showTab('orders');renderOrders();});
  if(isEdit){gdom('fp-btnDelOrder').addEventListener('click',function(){if(!confirm('Delete this order?'))return;db[curM].orders.splice(editIdx,1);editIdx=null;saveDB();showTab('orders');renderOrders();renderPlanner();});}
}
function renderPricing(){
  const p=db[curM].pricing||{};
  function fi(id,f){return'<input id="'+id+'" type="number" step="0.01" value="'+(p[f]||'')+'" style="width:80px;padding:4px 6px;border:0.5px solid #B4B2A9;border-radius:8px;background:#fff;color:#2C2C2A;font-size:12px">';}
  function mg(c,r){const cv=parseFloat(p[c]||0),rv=parseFloat(p[r]||0);return cv&&rv?(rv-cv).toFixed(2):'—';}
  gdom('fp-tab-pricing').innerHTML='<div class="pgrid"><div class="pbox"><div style="font-size:11px;font-weight:500;margin-bottom:4px">Cost price (R/L)</div><hr class="psep"><div class="prow"><span style="color:#5F5E5A">Old DSL</span>'+fi('fp-p-ocd','ocd')+'</div><div class="prow"><span style="color:#5F5E5A">Old ULP</span>'+fi('fp-p-ocu','ocu')+'</div><hr class="psep"><div class="prow"><span style="color:#5F5E5A">New DSL</span>'+fi('fp-p-ncd','ncd')+'</div><div class="prow"><span style="color:#5F5E5A">New ULP</span>'+fi('fp-p-ncu','ncu')+'</div></div><div class="pbox"><div style="font-size:11px;font-weight:500;margin-bottom:4px">Retail price (R/L)</div><hr class="psep"><div class="prow"><span style="color:#5F5E5A">Old DSL</span>'+fi('fp-p-ord','ord')+'</div><div class="prow"><span style="color:#5F5E5A">Old ULP</span>'+fi('fp-p-oru','oru')+'</div><hr class="psep"><div class="prow"><span style="color:#5F5E5A">New DSL</span>'+fi('fp-p-nrd','nrd')+'</div><div class="prow"><span style="color:#5F5E5A">New ULP</span>'+fi('fp-p-nru','nru')+'</div></div><div class="pbox"><div style="font-size:11px;font-weight:500;margin-bottom:4px">Margin (R/L)</div><hr class="psep"><div class="prow"><span style="color:#5F5E5A">Old DSL</span><strong>'+mg('ocd','ord')+'</strong></div><div class="prow"><span style="color:#5F5E5A">Old ULP</span><strong>'+mg('ocu','oru')+'</strong></div><hr class="psep"><div class="prow"><span style="color:#5F5E5A">New DSL</span><strong>'+mg('ncd','nrd')+'</strong></div><div class="prow"><span style="color:#5F5E5A">New ULP</span><strong>'+mg('ncu','nru')+'</strong></div></div></div><div style="margin-top:.75rem"><button class="btn pri" id="fp-btnSaveP">Save pricing</button></div><div style="font-size:11px;color:#5F5E5A;margin-top:.5rem">Margins calculated automatically on save.</div>';
  gdom('fp-btnSaveP').addEventListener('click',function(){['ocd','ocu','ncd','ncu','ord','oru','nrd','nru'].forEach(f=>{db[curM].pricing[f]=parseFloat(gdom('fp-p-'+f).value)||'';});saveDB();renderPricing();});
}
function renderNextMonth(){
  const ns=db[curM].nextStart||{dsl:'',ulp:''};const[y,mo]=curM.split('-').map(Number);
  const nextLabel=MNTHS[mo===12?0:mo]+' '+(mo===12?y+1:y);
  const n=daysIn(curM);const prev=[n-3,n-2,n-1,n].filter(d=>d>0);
  const rows=prev.map(d=>{const dw=dow(curM,d);const day=db[curM].days[d]||{};return'<tr><td class="left">'+DAYS[dw]+' '+d+'</td><td class="dsl-c">'+(day.df||'—')+'</td><td class="ulp-c">'+(day.uf||'—')+'</td><td class="dsl-c">'+(day.da||'—')+'</td><td class="ulp-c">'+(day.ua||'—')+'</td></tr>';}).join('');
  gdom('fp-tab-nextmonth').innerHTML='<div class="card"><div class="sec">End-of-month figures — for '+nextLabel+' opening</div><div class="tbl-wrap"><table class="main"><thead><tr><th class="left">Day</th><th>DSL forecast (kL)</th><th>ULP forecast (kL)</th><th>DSL actual (L)</th><th>ULP actual (L)</th></tr></thead><tbody>'+rows+'</tbody></table></div></div><div class="card"><div class="sec">Opening stock for '+nextLabel+'</div><div class="g2"><div class="fg"><label>Opening DSL stock (L)</label><input id="fp-ns-dsl" type="number" value="'+(ns.dsl||'')+'"></div><div class="fg"><label>Opening ULP stock (L)</label><input id="fp-ns-ulp" type="number" value="'+(ns.ulp||'')+'"></div></div><div style="margin-top:.75rem"><button class="btn pri" id="fp-btnSaveNS">Save opening stock</button></div><div style="font-size:11px;color:#5F5E5A;margin-top:.5rem">Transcribe these figures to the opening of '+nextLabel+'.</div></div>';
  gdom('fp-btnSaveNS').addEventListener('click',function(){db[curM].nextStart={dsl:parseFloat(gdom('fp-ns-dsl').value)||'',ulp:parseFloat(gdom('fp-ns-ulp').value)||''};saveDB();alert('Opening stock saved.');});
}
const TABS=['planner','atg','orders','pricing','nextmonth'];
function showTab(t){
  [...TABS,'order'].forEach(id=>{const el=gdom('fp-tab-'+id);if(el){el.classList.remove('active');el.style.display='none';}});
  const target=gdom('fp-tab-'+t);if(target){target.classList.add('active');target.style.display='block';}
  TABS.forEach(name=>{const el=gdom('fp-t-'+name);if(el)el.classList.toggle('active',name===t);});
}
function init(){
  gdom('fp-selMonth').value=curM;
  gdom('fp-selMonth').addEventListener('change',function(){curM=this.value;ensureMonth(curM);showTab('planner');renderPlanner();});
  gdom('fp-btnNewOrder').addEventListener('click',function(){editIdx=null;showOrderForm();});
  TABS.forEach(name=>{const el=gdom('fp-t-'+name);if(el)el.addEventListener('click',function(){showTab(name);if(name==='planner')renderPlanner();else if(name==='atg')renderATG();else if(name==='orders')renderOrders();else if(name==='pricing')renderPricing();else if(name==='nextmonth')renderNextMonth();});});
  gdom('fp-tab-planner').addEventListener('change',function(e){const inp=e.target;if(inp.dataset.f){const m=inp.dataset.m,d=parseInt(inp.dataset.d),f=inp.dataset.f;db[m].days[d][f]=inp.value;saveDB();}});
  renderPlanner();
}
loadDB();
})();`;
}
function openWetStocks() {
    const urls = {
        hillcrest: 'https://onedrive.live.com/?id=%2Fpersonal%2Fb85cebe941b27ea9%2FDocuments%2FASTRON%202026%2FHILLCREST%2FWET%20STOCK&viewid=398989c0%2Db182%2D4d5d%2Daa3f%2D8ae909d28221&view=0',
        hammersdale: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7B5AE748D0-41D4-4AED-91EC-7474991DF220%7D&file=WSM%20Hammersdale.xlsx&action=default&mobileredirect=true'
    };
    if (urls[currentStore]) window.open(urls[currentStore], '_blank');
}
function openPumpsNamos() {
    const urls = {
        hillcrest: 'https://1drv.ms/x/c/b85cebe941b27ea9/IQBwlramekxqT5vwbkoiRUazAaw0gwVafurVrpGcFQRpYeU?e=euUE3p',
        hammersdale: 'https://onedrive.live.com/personal/b85cebe941b27ea9/_layouts/15/Doc.aspx?sourcedoc=%7BF55D4137-48F9-4EF3-9146-E7BB0BE89E4D%7D&file=Pump%20%26%20Namos%20Sales%20Hammersdale.xlsx&action=default&mobileredirect=true'
    };
    if (urls[currentStore]) window.open(urls[currentStore], '_blank');
}
function openWetStocksLive() {
    if (currentStore === 'hillcrest') window.open('https://www.caltex.wsmlive.co.za/system/security/signin.php', '_blank');
    else alert('Wet Stocks Live is only available for Hillcrest store');
}
function openAstronFuelOrders() {
    if (currentStore === 'hillcrest') window.open('https://connect.astronenergy.co.za/astronb2b/en/ZAR/login', '_blank');
    else alert('Astron Fuel Orders is only available for Hillcrest store');
}
function openAccountPayments() { alert('Account Payments — link to be configured'); }
function openGlocellInvoices() { alert('Glocell Invoices — link to be configured'); }
function openCreditsOwing() { alert('Credits Owing — link to be configured'); }
function openSupplierStatement() { alert('Supplier Statement — link to be configured'); }
function openPaymentPlan() {
    if (currentStore === 'hillcrest') {
        openPaymentPlannerModal();
    } else {
        alert('Payment Plan — link to be configured for this store');
    }
}

function openPaymentPlannerModal() {
    const backdrop = document.getElementById('pp-modal-backdrop');
    const body = document.getElementById('pp-modal-body');
    if (!body.dataset.loaded) {
        body.dataset.loaded = '1';
        body.innerHTML = getPaymentPlannerHTML();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
        script.onload = function() {
            const appScript = document.createElement('script');
            appScript.textContent = getPaymentPlannerScript();
            body.appendChild(appScript);
        };
        body.appendChild(script);
    }
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closePaymentPlanner() {
    document.getElementById('pp-modal-backdrop').classList.remove('open');
    document.body.style.overflow = '';
}

document.getElementById('pp-modal-backdrop').addEventListener('click', function(e) {
    if (e.target === this) closePaymentPlanner();
});

function getPaymentPlannerHTML() {
    return `
<style>
#pp-wrap *{box-sizing:border-box;margin:0;padding:0}
#pp-wrap{font-family:Arial,sans-serif;color:#2C2C2A;font-size:13px;background:#F1EFE8;padding:1rem}
#pp-wrap .hdr{background:#fff;border:0.5px solid #D3D1C7;border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem}
#pp-wrap .hdr-title{font-size:16px;font-weight:500}
#pp-wrap .hdr-sub{font-size:12px;color:#5F5E5A;margin-top:2px}
#pp-wrap .alert-banner{border-radius:12px;padding:1rem 1.25rem;margin-bottom:1rem}
#pp-wrap .alert-danger{background:#FCEBEB;border:0.5px solid #E24B4A}
#pp-wrap .alert-warning{background:#FAEEDA;border:0.5px solid #EF9F27}
#pp-wrap .alert-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px}
#pp-wrap .alert-row:last-child{border-bottom:none}
#pp-wrap .tab-bar{display:flex;gap:2px;border-bottom:1px solid #D3D1C7;background:#fff;padding:.5rem 1rem 0;border-radius:12px 12px 0 0}
#pp-wrap .tab{padding:7px 14px;font-size:13px;cursor:pointer;border:none;background:none;color:#5F5E5A;border-bottom:2px solid transparent;margin-bottom:-1px}
#pp-wrap .tab.active{color:#2C2C2A;border-bottom-color:#2C2C2A;font-weight:500}
#pp-wrap .tab:hover:not(.active){color:#2C2C2A}
#pp-wrap .page{background:#fff;border:0.5px solid #D3D1C7;border-radius:0 0 12px 12px;padding:1rem;display:none}
#pp-wrap .page.active{display:block}
#pp-wrap .period-bar{display:flex;align-items:center;gap:10px;background:#F1EFE8;border-radius:10px;padding:.75rem 1rem;margin-bottom:1rem;flex-wrap:wrap}
#pp-wrap .period-bar label{font-size:12px;color:#5F5E5A;white-space:nowrap}
#pp-wrap .period-bar select{padding:6px 10px;border:0.5px solid #B4B2A9;border-radius:8px;background:#fff;color:#2C2C2A;font-size:13px}
#pp-wrap .period-label{font-size:14px;font-weight:500;color:#2C2C2A}
#pp-wrap .nav-btn{padding:5px 12px;border-radius:8px;border:0.5px solid #B4B2A9;background:#fff;color:#2C2C2A;font-size:13px;cursor:pointer}
#pp-wrap .nav-btn:hover{background:#F1EFE8}
#pp-wrap .metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:1.5rem}
#pp-wrap .metric{background:#F1EFE8;border-radius:8px;padding:1rem}
#pp-wrap .metric-label{font-size:12px;color:#5F5E5A;margin-bottom:6px}
#pp-wrap .metric-value{font-size:22px;font-weight:500}
#pp-wrap .metric-value.success{color:#3B6D11}
#pp-wrap .metric-value.danger{color:#A32D2D}
#pp-wrap .card{background:#fff;border:0.5px solid #D3D1C7;border-radius:12px;padding:1.25rem;margin-bottom:1rem}
#pp-wrap .section-title{font-size:14px;font-weight:500;margin-bottom:1rem}
#pp-wrap .fg{display:flex;flex-direction:column;gap:4px}
#pp-wrap .fg label{font-size:12px;color:#5F5E5A}
#pp-wrap .fg input,#pp-wrap .fg select{width:100%;padding:8px 10px;border:0.5px solid #B4B2A9;border-radius:8px;background:#fff;color:#2C2C2A;font-size:13px}
#pp-wrap .fg input:focus,#pp-wrap .fg select:focus{outline:none;border-color:#378ADD}
#pp-wrap .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#pp-wrap .form-full{grid-column:1/-1}
#pp-wrap .btn{padding:8px 16px;border-radius:8px;border:0.5px solid #B4B2A9;background:#fff;color:#2C2C2A;font-size:13px;cursor:pointer;font-weight:500}
#pp-wrap .btn:hover{background:#F1EFE8}
#pp-wrap .btn.primary{background:#185FA5;color:#fff;border-color:#185FA5}
#pp-wrap .btn.primary:hover{background:#0C447C}
#pp-wrap .btn.sm{padding:4px 10px;font-size:12px}
#pp-wrap .btn.danger{color:#A32D2D;border-color:#F7C1C1}
#pp-wrap .filter-bar{display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap;align-items:center}
#pp-wrap .filter-bar select,#pp-wrap .filter-bar input{padding:7px 10px;border:0.5px solid #B4B2A9;border-radius:8px;background:#fff;color:#2C2C2A;font-size:13px}
#pp-wrap .tbl-wrap{overflow-x:auto}
#pp-wrap table.inv{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}
#pp-wrap table.inv th{text-align:left;padding:8px 10px;font-weight:500;font-size:11px;color:#5F5E5A;border-bottom:0.5px solid #D3D1C7}
#pp-wrap table.inv td{padding:10px;border-bottom:0.5px solid #D3D1C7;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pp-wrap table.inv tr:last-child td{border-bottom:none}
#pp-wrap table.inv tr:hover td{background:#F1EFE8}
#pp-wrap table.rec{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}
#pp-wrap table.rec th{text-align:left;padding:8px 10px;font-weight:500;font-size:11px;color:#5F5E5A;border-bottom:0.5px solid #D3D1C7}
#pp-wrap table.rec td{padding:10px;border-bottom:0.5px solid #D3D1C7;vertical-align:middle}
#pp-wrap table.rec tr:last-child td{border-bottom:none}
#pp-wrap table.rec tr:hover td{background:#F1EFE8}
#pp-wrap .badge{display:inline-block;padding:3px 9px;border-radius:8px;font-size:11px;font-weight:500}
#pp-wrap .badge-paid{background:#EAF3DE;color:#3B6D11}
#pp-wrap .badge-unpaid{background:#FCEBEB;color:#A32D2D}
#pp-wrap .badge-pending{background:#FAEEDA;color:#854F0B}
#pp-wrap .empty{text-align:center;padding:2.5rem;color:#5F5E5A;font-size:13px}
#pp-wrap .chart-wrap{position:relative;height:180px}
#pp-wrap .dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
#pp-wrap #recFormArea .card{margin-top:.75rem}
</style>

<div id="pp-wrap">
  <div class="hdr">
<div class="hdr-title">P.Planner V1 — Hillcrest</div>
<div class="hdr-sub">Invoice &amp; payment tracker</div>
  </div>
  <div id="pp-alertArea"></div>
  <div class="tab-bar">
<button class="tab active" id="pp-t-invoices">Invoices</button>
<button class="tab"        id="pp-t-add">+ Add invoice</button>
<button class="tab"        id="pp-t-recurring">Recurring</button>
<button class="tab"        id="pp-t-dashboard">Dashboard</button>
  </div>
  <div class="page active" id="pp-tab-invoices"></div>
  <div class="page"        id="pp-tab-add"></div>
  <div class="page"        id="pp-tab-recurring"></div>
  <div class="page"        id="pp-tab-dashboard"></div>
</div>`;
}

function getPaymentPlannerScript() {
    return `
(function(){
const MNTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const INV_KEY='pplanner_v1_invoices';
const REC_KEY='pplanner_v1_recurring';
let invoices=[];let recurring=[];let ppChartInstance=null;let editingId=null;let editingRecId=null;
const now=new Date();let curYear=now.getFullYear();let curMonth=now.getMonth();

function gdom(id){return document.getElementById(id);}
function fmt(n){return 'R '+Number(n).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtDate(d){if(!d)return '—';const dt=new Date(d);return isNaN(dt)?'—':dt.toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function periodKey(){return curYear+'-'+String(curMonth+1).padStart(2,'0');}
function periodLabel(){return MNTHS[curMonth]+' '+curYear;}
function ordinal(n){const s=['th','st','nd','rd'];const v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
function daysUntil(day){const t=new Date();const target=new Date(t.getFullYear(),t.getMonth(),day);if(target<t)target.setMonth(target.getMonth()+1);return Math.ceil((target-t)/(1000*60*60*24));}
function periodInvoices(){return invoices.filter(i=>i.period===periodKey());}

function loadDB(){(async function(){try{if(window.storage){const r=await window.storage.get(INV_KEY);if(r)invoices=JSON.parse(r.value);}else{const s=localStorage.getItem(INV_KEY);if(s)invoices=JSON.parse(s);}}catch(e){}try{if(window.storage){const r=await window.storage.get(REC_KEY);if(r)recurring=JSON.parse(r.value);}else{const s=localStorage.getItem(REC_KEY);if(s)recurring=JSON.parse(s);}}catch(e){}renderAlerts();renderInvoices();})();}
function saveInvoices(){(async function(){try{const j=JSON.stringify(invoices);if(window.storage)await window.storage.set(INV_KEY,j);else localStorage.setItem(INV_KEY,j);}catch(e){}})();}
function saveRecurring(){(async function(){try{const j=JSON.stringify(recurring);if(window.storage)await window.storage.set(REC_KEY,j);else localStorage.setItem(REC_KEY,j);}catch(e){}})();}

function renderAlerts(){
  const urgent=recurring.filter(r=>daysUntil(r.dayOfMonth)<=3);
  const soon=recurring.filter(r=>{const d=daysUntil(r.dayOfMonth);return d>3&&d<=7;});
  let html='';
  if(urgent.length){html+=\`<div class="alert-banner alert-danger"><div style="font-weight:500;font-size:13px;color:#A32D2D;margin-bottom:8px">Due within 3 days</div>\${urgent.map(r=>\`<div class="alert-row"><div><span style="font-weight:500;color:#A32D2D">\${r.supplier}</span><span style="font-size:12px;color:#791F1F;margin-left:8px">due \${ordinal(r.dayOfMonth)} monthly</span></div><div style="font-size:12px;color:#A32D2D;font-weight:500">\${r.amount?fmt(r.amount):''} \${daysUntil(r.dayOfMonth)===0?'Today':daysUntil(r.dayOfMonth)+' day'+(daysUntil(r.dayOfMonth)===1?'':'s')}</div></div>\`).join('')}</div>\`;}
  if(soon.length){html+=\`<div class="alert-banner alert-warning"><div style="font-weight:500;font-size:13px;color:#854F0B;margin-bottom:8px">Due within 7 days</div>\${soon.map(r=>\`<div class="alert-row"><div><span style="font-weight:500;color:#854F0B">\${r.supplier}</span><span style="font-size:12px;color:#633806;margin-left:8px">due \${ordinal(r.dayOfMonth)} monthly</span></div><div style="font-size:12px;color:#854F0B;font-weight:500">\${r.amount?fmt(r.amount):''} \${daysUntil(r.dayOfMonth)} days</div></div>\`).join('')}</div>\`;}
  gdom('pp-alertArea').innerHTML=html;
}

function buildPeriodBar(){
  let yOpts='';for(let y=2024;y<=2032;y++){yOpts+=\`<option value="\${y}" \${y===curYear?'selected':''}>\${y}</option>\`;}
  let mOpts='';MNTHS.forEach((m,i)=>{mOpts+=\`<option value="\${i}" \${i===curMonth?'selected':''}>\${m}</option>\`;});
  return \`<div class="period-bar"><label>Period:</label><select id="pp-selYear">\${yOpts}</select><select id="pp-selMo">\${mOpts}</select><span class="period-label">\${periodLabel()}</span><button class="nav-btn" id="pp-btnPrev">&larr; Prev</button><button class="nav-btn" id="pp-btnNext">Next &rarr;</button><span style="font-size:12px;color:#5F5E5A;margin-left:4px">\${periodInvoices().length} invoice(s)</span></div>\`;
}

function attachPeriod(cb){
  gdom('pp-selYear').addEventListener('change',function(){curYear=parseInt(this.value);cb();});
  gdom('pp-selMo').addEventListener('change',function(){curMonth=parseInt(this.value);cb();});
  gdom('pp-btnPrev').addEventListener('click',function(){curMonth--;if(curMonth<0){curMonth=11;curYear--;}cb();});
  gdom('pp-btnNext').addEventListener('click',function(){curMonth++;if(curMonth>11){curMonth=0;curYear++;}cb();});
}

function showTab(t){
  ['invoices','add','recurring','dashboard'].forEach(id=>{
const el=gdom('pp-tab-'+id);el.classList.remove('active');el.style.display='none';
gdom('pp-t-'+id).classList.toggle('active',id===t);
  });
  const target=gdom('pp-tab-'+t);target.classList.add('active');target.style.display='block';
}

function renderInvoices(){
  const sf=gdom('pp-fStatus')?gdom('pp-fStatus').value:'';
  const sr=gdom('pp-fSearch')?gdom('pp-fSearch').value.toLowerCase():'';
  const rows=periodInvoices().filter(i=>{if(sf&&i.status!==sf)return false;if(sr&&!i.supplier.toLowerCase().includes(sr))return false;return true;});
  gdom('pp-tab-invoices').innerHTML=buildPeriodBar()+\`<div class="filter-bar"><input id="pp-fSearch" placeholder="Search supplier..." value="\${sr}" style="min-width:160px"><select id="pp-fStatus"><option value="">All statuses</option><option value="unpaid" \${sf==='unpaid'?'selected':''}>Unpaid</option><option value="paid" \${sf==='paid'?'selected':''}>Paid</option><option value="pending" \${sf==='pending'?'selected':''}>Pending</option></select></div><div class="card" style="padding:0"><div class="tbl-wrap">\${rows.length===0?\`<div class="empty">No invoices for \${periodLabel()} — use + Add invoice to get started</div>\`:\`<table class="inv"><thead><tr><th style="width:20%">Supplier</th><th style="width:11%">GRV date</th><th style="width:14%">Credit amount</th><th style="width:14%">Final amount</th><th style="width:10%">Status</th><th style="width:21%">Remarks</th><th style="width:10%">Actions</th></tr></thead><tbody>\${rows.map(i=>\`<tr><td title="\${i.supplier}"><strong>\${i.supplier}</strong></td><td>\${fmtDate(i.grvDate)}</td><td>\${i.creditAmount?fmt(i.creditAmount):'—'}</td><td>\${fmt(i.finalAmount)}</td><td><span class="badge badge-\${i.status}">\${i.status}</span></td><td style="font-size:11px;color:#5F5E5A" title="\${i.remarks||''}">\${i.remarks||'—'}</td><td><button class="btn sm btn-pp-edit" data-id="\${i.id}">Edit</button></td></tr>\`).join('')}</tbody></table>\`}</div></div>\`;
  attachPeriod(renderInvoices);
  gdom('pp-fSearch').addEventListener('input',renderInvoices);
  gdom('pp-fStatus').addEventListener('change',renderInvoices);
  gdom('pp-tab-invoices').querySelectorAll('.btn-pp-edit').forEach(b=>{b.addEventListener('click',function(){const inv=invoices.find(i=>i.id===this.dataset.id);if(inv&&inv.period){const[y,m]=inv.period.split('-').map(Number);curYear=y;curMonth=m-1;}editingId=this.dataset.id;showTab('add');renderAddForm();});});
}

function renderAddForm(){
  const inv=editingId?invoices.find(i=>i.id===editingId):null;const v=inv||{};
  gdom('pp-tab-add').innerHTML=buildPeriodBar()+\`<div class="card"><div class="section-title">\${editingId?'Edit invoice':'New invoice — '+periodLabel()}</div><div class="form-grid"><div class="fg form-full"><label>Supplier name *</label><input id="pp-f-supplier" value="\${v.supplier||''}" placeholder="e.g. Clover"></div><div class="fg"><label>GRV date</label><input id="pp-f-grvDate" type="date" value="\${v.grvDate||''}"></div><div class="fg"><label>Statement / credit amount (R)</label><input id="pp-f-credit" type="number" step="0.01" value="\${v.creditAmount||''}"></div><div class="fg"><label>Final amount (R) *</label><input id="pp-f-final" type="number" step="0.01" value="\${v.finalAmount||''}"></div><div class="fg"><label>Payment status</label><select id="pp-f-status"><option value="unpaid" \${(!v.status||v.status==='unpaid')?'selected':''}>Unpaid</option><option value="pending" \${v.status==='pending'?'selected':''}>Pending</option><option value="paid" \${v.status==='paid'?'selected':''}>Paid</option></select></div><div class="fg form-full"><label>Notes / remarks</label><input id="pp-f-remarks" value="\${v.remarks||''}"></div></div><div style="display:flex;gap:10px;margin-top:1.25rem"><button class="btn primary" id="pp-btnSubmit">\${editingId?'Save changes':'Add invoice'}</button><button class="btn" id="pp-btnCancel">Cancel</button>\${editingId?'<button class="btn danger" id="pp-btnDel">Delete invoice</button>':''}</div>\${editingId?\`<div style="margin-top:.75rem;font-size:12px;color:#5F5E5A">Editing: \${v.supplier}</div>\`:''}</div>\`;
  attachPeriod(renderAddForm);
  gdom('pp-btnSubmit').addEventListener('click',function(){
const supplier=gdom('pp-f-supplier').value.trim();const finalAmt=gdom('pp-f-final').value;
if(!supplier||!finalAmt){alert('Supplier name and final amount are required.');return;}
const record={id:editingId||genId(),period:editingId?(invoices.find(i=>i.id===editingId)||{}).period||periodKey():periodKey(),supplier,grvDate:gdom('pp-f-grvDate').value,creditAmount:gdom('pp-f-credit').value,finalAmount:parseFloat(finalAmt),status:gdom('pp-f-status').value,remarks:gdom('pp-f-remarks').value.trim()};
if(editingId){const idx=invoices.findIndex(i=>i.id===editingId);if(idx>-1)invoices[idx]=record;editingId=null;}else{invoices.unshift(record);}
saveInvoices();showTab('invoices');renderInvoices();
  });
  gdom('pp-btnCancel').addEventListener('click',function(){editingId=null;showTab('invoices');renderInvoices();});
  const bdel=gdom('pp-btnDel');if(bdel){bdel.addEventListener('click',function(){if(!confirm('Delete this invoice?'))return;invoices=invoices.filter(i=>i.id!==editingId);editingId=null;saveInvoices();showTab('invoices');renderInvoices();});}
}

function renderRecurring(){
  gdom('pp-tab-recurring').innerHTML=\`<div style="display:flex;justify-content:flex-end;margin-bottom:.75rem"><button class="btn primary" id="pp-btnAddRec">+ Add recurring payment</button></div><div class="card" style="padding:0"><div class="tbl-wrap">\${recurring.length===0?'<div class="empty">No recurring payments set up yet</div>':\`<table class="rec"><thead><tr><th style="width:25%">Supplier</th><th style="width:12%">Due day</th><th style="width:15%">Typical amount</th><th style="width:28%">Notes</th><th style="width:10%">Days left</th><th style="width:10%">Actions</th></tr></thead><tbody>\${recurring.map((r,i)=>{const dl=daysUntil(r.dayOfMonth);const col=dl<=3?'color:#A32D2D;font-weight:500':dl<=7?'color:#854F0B;font-weight:500':'';return\`<tr><td><strong>\${r.supplier}</strong></td><td>\${ordinal(r.dayOfMonth)}</td><td>\${r.amount?fmt(r.amount):'—'}</td><td style="font-size:11px;color:#5F5E5A">\${r.notes||'—'}</td><td style="font-size:12px;\${col}">\${dl===0?'Today':dl+' day'+(dl===1?'':'s')}</td><td><div style="display:flex;gap:4px"><button class="btn sm btn-rec-edit" data-idx="\${i}">Edit</button><button class="btn sm danger btn-rec-del" data-idx="\${i}">Del</button></div></td></tr>\`;}).join('')}</tbody></table>\`}</div></div><div id="pp-recFormArea"></div>\`;
  gdom('pp-btnAddRec').addEventListener('click',function(){editingRecId=null;showRecForm();});
  gdom('pp-tab-recurring').querySelectorAll('.btn-rec-edit').forEach(b=>b.addEventListener('click',function(){editingRecId=parseInt(this.dataset.idx);showRecForm();}));
  gdom('pp-tab-recurring').querySelectorAll('.btn-rec-del').forEach(b=>b.addEventListener('click',function(){if(!confirm('Remove this recurring payment?'))return;recurring.splice(parseInt(this.dataset.idx),1);saveRecurring();renderRecurring();renderAlerts();}));
}

function showRecForm(){
  const isEdit=editingRecId!==null;const r=isEdit?recurring[editingRecId]:{};
  gdom('pp-recFormArea').innerHTML=\`<div class="card" style="margin-top:.75rem"><div class="section-title">\${isEdit?'Edit recurring payment':'New recurring payment'}</div><div class="form-grid"><div class="fg form-full"><label>Supplier name *</label><input id="pp-r-supplier" value="\${r.supplier||''}" placeholder="e.g. JAG Monitoring"></div><div class="fg"><label>Due day of month *</label><input id="pp-r-day" type="number" min="1" max="31" value="\${r.dayOfMonth||''}" placeholder="e.g. 5"></div><div class="fg"><label>Typical amount (R)</label><input id="pp-r-amount" type="number" step="0.01" value="\${r.amount||''}"></div><div class="fg form-full"><label>Notes</label><input id="pp-r-notes" value="\${r.notes||''}" placeholder="e.g. Monthly service fee"></div></div><div style="display:flex;gap:10px;margin-top:1.25rem"><button class="btn primary" id="pp-btnSaveRec">\${isEdit?'Save changes':'Add recurring payment'}</button><button class="btn" id="pp-btnCancelRec">Cancel</button></div></div>\`;
  gdom('pp-btnSaveRec').addEventListener('click',function(){
const supplier=gdom('pp-r-supplier').value.trim();const day=parseInt(gdom('pp-r-day').value);
if(!supplier||!day||day<1||day>31){alert('Supplier and a valid day (1–31) are required.');return;}
const entry={supplier,dayOfMonth:day,amount:parseFloat(gdom('pp-r-amount').value)||0,notes:gdom('pp-r-notes').value.trim()};
if(isEdit)recurring[editingRecId]=entry;else recurring.push(entry);
editingRecId=null;saveRecurring();renderRecurring();renderAlerts();
  });
  gdom('pp-btnCancelRec').addEventListener('click',function(){gdom('pp-recFormArea').innerHTML='';});
}

function renderDashboard(){
  const pi=periodInvoices();const total=pi.reduce((s,i)=>s+Number(i.finalAmount||0),0);
  const paid=pi.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.finalAmount||0),0);
  const unpaid=pi.filter(i=>i.status==='unpaid').reduce((s,i)=>s+Number(i.finalAmount||0),0);
  const sg={paid:0,unpaid:0,pending:0};pi.forEach(i=>{sg[i.status]=(sg[i.status]||0)+1;});
  const recurringHTML=recurring.length===0?'<div class="empty" style="padding:1rem">No recurring payments set up</div>':[...recurring].sort((a,b)=>daysUntil(a.dayOfMonth)-daysUntil(b.dayOfMonth)).slice(0,6).map(r=>{const dl=daysUntil(r.dayOfMonth);const col=dl<=3?'#A32D2D':dl<=7?'#854F0B':'#5F5E5A';return\`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:0.5px solid #D3D1C7;font-size:13px"><div><div style="font-weight:500">\${r.supplier}</div><div style="font-size:11px;color:#5F5E5A">Due \${ordinal(r.dayOfMonth)} monthly</div></div><div style="text-align:right"><div style="font-size:12px;color:\${col};font-weight:500">\${dl===0?'Today':dl+' day'+(dl===1?'':'s')}</div>\${r.amount?\`<div style="font-size:11px;color:#5F5E5A">\${fmt(r.amount)}</div>\`:''}</div></div>\`;}).join('');
  gdom('pp-tab-dashboard').innerHTML=buildPeriodBar()+\`<div class="metric-grid"><div class="metric"><div class="metric-label">Invoices — \${periodLabel()}</div><div class="metric-value">\${pi.length}</div></div><div class="metric"><div class="metric-label">Total value</div><div class="metric-value" style="font-size:17px">\${fmt(total)}</div></div><div class="metric"><div class="metric-label">Paid</div><div class="metric-value success" style="font-size:17px">\${fmt(paid)}</div></div><div class="metric"><div class="metric-label">Outstanding</div><div class="metric-value danger" style="font-size:17px">\${fmt(unpaid)}</div></div><div class="metric"><div class="metric-label">Recurring set up</div><div class="metric-value">\${recurring.length}</div></div></div><div class="dash-grid"><div class="card"><div class="section-title">Status breakdown — \${periodLabel()}</div><div class="chart-wrap"><canvas id="pp-statusChart"></canvas></div><div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:#5F5E5A"><span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:#639922;display:inline-block"></span>Paid \${sg.paid}</span><span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:#E24B4A;display:inline-block"></span>Unpaid \${sg.unpaid}</span><span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:#EF9F27;display:inline-block"></span>Pending \${sg.pending}</span></div></div><div class="card"><div class="section-title">Upcoming recurring payments</div>\${recurringHTML}</div></div>\`;
  attachPeriod(renderDashboard);
  if(pi.length>0){if(ppChartInstance){ppChartInstance.destroy();ppChartInstance=null;}const ctx=gdom('pp-statusChart');if(ctx){ppChartInstance=new Chart(ctx,{type:'doughnut',data:{labels:['Paid','Unpaid','Pending'],datasets:[{data:[sg.paid,sg.unpaid,sg.pending],backgroundColor:['#639922','#E24B4A','#EF9F27'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});}}
}

gdom('pp-t-invoices').addEventListener('click',function(){showTab('invoices');renderInvoices();});
gdom('pp-t-add').addEventListener('click',function(){editingId=null;showTab('add');renderAddForm();});
gdom('pp-t-recurring').addEventListener('click',function(){showTab('recurring');renderRecurring();});
gdom('pp-t-dashboard').addEventListener('click',function(){showTab('dashboard');renderDashboard();});

loadDB();
})();`;
}
function openDeductions() { alert('Deductions — link to be configured'); }
function openBankingRecon() { alert('Banking Recon — link to be configured'); }

// ══════════════════════════════════════════
// ── CSA ASSESSMENT SYSTEM ──
// ══════════════════════════════════════════

let csaSubmissions = [];
let csaRemediations = [];
let csaRoster = [];
let csaDonutChart = null;
let csaBarChart = null;

// ── Staff Category Definitions ──
// Each person in the roster belongs to one category.
// CSAs can additionally be flagged as Supervisor (c.supervisor === true).
const STAFF_CATEGORIES = {
    'management':    { label: 'Management',    shortLabel: 'Mgmt',     color: '#dc2626', icon: 'fas fa-user-tie' },
    'csa':           { label: 'CSA',           shortLabel: 'CSA',      color: '#f97316', icon: 'fas fa-gas-pump' },
    'cashier':       { label: 'Cashier',       shortLabel: 'Cashier',  color: '#3b82f6', icon: 'fas fa-cash-register' },
    'kitchen':       { label: 'Kitchen',       shortLabel: 'Kitchen',  color: '#10b981', icon: 'fas fa-utensils' },
    'coffee':        { label: 'Coffee',        shortLabel: 'Coffee',   color: '#8b5cf6', icon: 'fas fa-coffee' },
    'merchandising': { label: 'Merchandising', shortLabel: 'Merch',    color: '#ec4899', icon: 'fas fa-shopping-basket' }
};

// ── Assessment Type Definitions ──
// eligibleCategories: which staff categories can be selected for this assessment
// supervisorOnly: if true, only CSAs flagged Supervisor show up (applies to Driveway)
// frequencyDays: how often this assessment should be conducted
// trackBy: 'individual' (per person) or 'site' (per store, for Driveway)
const ASSESSMENT_TYPES = {
    'csa_forecourt': {
        label: 'CSA Forecourt Service',
        shortLabel: 'CSA Forecourt',
        icon: 'fas fa-gas-pump',
        color: '#f97316',
        subjects: 2,
        subjectLabel: 'CSA',
        subjectSource: 'roster',
        eligibleCategories: ['csa'],
        supervisorOnly: false,
        questionCount: 15,
        passThreshold: 14,
        remediationThreshold: 2,
        frequencyDays: 30,
        trackBy: 'individual',
        questions: [
            'Waved the customer in and guided them to the most convenient pump?',
            'Welcome to Astron Energy (with a smile)',
            'Can I fill up your tank with Quartech petrol or diesel?',
            'Did the CSA confirm the amount and fuel type?',
            'Was the CSA able to explain what Quartech fuel is (if asked)?',
            'Discuss the forecourt and C-Store promotions',
            'Was the CSA able to correctly share the details of the promotions and answer the customer\'s questions?',
            'Can I check your oil, coolant, tyre pressure and clean your windscreen?',
            'Did the CSA confirm the amount and fuel type again just before dispensing fuel?',
            'Are you registered with Astron Energy Rewards?',
            'Is the CSA able to explain what the rewards program is and how to register?',
            'WhatsApp, USSD, Astron Energy App, Website, QR Code — registration methods known?',
            'How are you going to pay? Cash, Card, Ucount or Fleet card?',
            'Did the CSA use the Payment24 Terminal for this transaction?',
            'Thank you for choosing Astron Energy. Have a wonderful day (or any other parting remark)'
        ]
    },
    'store_promotions': {
        label: 'Store & Promotions',
        shortLabel: 'Store & Promos',
        icon: 'fas fa-store',
        color: '#3b82f6',
        subjects: 1,
        subjectLabel: 'Store Team Member',
        subjectSource: 'roster',
        eligibleCategories: ['management', 'cashier', 'kitchen', 'coffee', 'merchandising'],
        supervisorOnly: false,
        questionCount: 20,
        passThreshold: 19,
        remediationThreshold: 2,
        frequencyDays: 60,
        trackBy: 'individual',
        questions: [
            'Was the shop clean and free from stains and litter?',
            'Was the shop free from safety hazards?',
            'Did the store team member greet you on entry?',
            'Was the store team member wearing an approved uniform?',
            'Was the store team member\'s uniform correct, clean, and in good condition?',
            'Did the team member offer you current store specials/promotions?',
            'Were promotional materials clearly displayed in store?',
            'Were forecourt promotions communicated to the customer?',
            'Could the team member explain promotion details when asked?',
            'Were products easy to find and shelves well stocked?',
            'Was product pricing clearly visible?',
            'Was the FreshStop food section stocked and presentable?',
            'Was the transaction completed with ease and timeliness?',
            'Was the customer offered a receipt?',
            'Did the store team member thank you and offer a parting remark?',
            'Was the FreshStop hot food counter clean and well maintained?',
            'Were cold drinks and refrigerated items properly stocked and at temperature?',
            'Was the shop well lit with clear aisle navigation?',
            'Did the team member suggest add-on items or upsell at the till?',
            'Were loyalty/rewards materials visible at the shop counter?'
        ]
    },
    'driveway_appearance': {
        label: 'Driveway Appearance',
        shortLabel: 'Driveway',
        icon: 'fas fa-road',
        color: '#8b5cf6',
        subjects: 1,
        subjectLabel: 'Responsible Person',
        subjectSource: 'roster',
        eligibleCategories: ['management', 'csa'],
        supervisorOnly: true, // CSAs must be flagged Supervisor
        questionCount: 20,
        passThreshold: 19,
        remediationThreshold: 2,
        frequencyDays: 14,
        trackBy: 'site',
        questions: [
            'Is the site entrance clean, easy and clear?',
            'Is directional signage visible and in good condition?',
            'Is the forecourt free of debris and litter?',
            'Is fuel pricing signage visible and current?',
            'Is the forecourt well lit? (if applicable)',
            'Are the fuel pumps clean and in working order?',
            'Are the pump islands free of oil spills and stains?',
            'Are rubbish bins available and not overflowing?',
            'Is the canopy clean and free of damage?',
            'Are CSAs clearly visible in uniform on the forecourt?',
            'Are all visible staff dressed in correct, clean uniform?',
            'Is the customer restroom available and accessible?',
            'Is the restroom clean and stocked (paper, soap, water, dryer)?',
            'Is the overall site appearance professional and inviting?',
            'Are safety signs and fire equipment visible and accessible?',
            'Is the payment area clean and organised?',
            'Are oil and lubricant displays stocked and tidy?',
            'Is the car wash area (if applicable) clean and operational?',
            'Are parking areas and walkways clear and well maintained?',
            'Is branded signage (Astron Energy) clean, visible and undamaged?'
        ]
    }
};

// Helper: get staff eligible for a given assessment type at a given store
function getEligibleStaff(assessmentType, store) {
    var at = ASSESSMENT_TYPES[assessmentType];
    if (!at || !at.eligibleCategories) return [];
    return csaRoster.filter(function(c) {
        if (c.active === false) return false;
        if (c.store !== store) return false;
        var cat = c.category || 'csa';
        if (at.eligibleCategories.indexOf(cat) === -1) return false;
        if (at.supervisorOnly && cat === 'csa' && !c.supervisor) return false;
        return true;
    });
}

// ── Storage ──
async function csaLoad() {
    try {
        if (window.storage) {
            const r = await window.storage.get('csa_submissions', true);
            csaSubmissions = r ? JSON.parse(r.value) : [];
        } else {
            const s = localStorage.getItem('csa_submissions');
            csaSubmissions = s ? JSON.parse(s) : [];
        }
    } catch(e) { csaSubmissions = []; }
    try {
        if (window.storage) {
            const r = await window.storage.get('csa_remediations', true);
            csaRemediations = r ? JSON.parse(r.value) : [];
        } else {
            const s = localStorage.getItem('csa_remediations');
            csaRemediations = s ? JSON.parse(s) : [];
        }
    } catch(e) { csaRemediations = []; }
    try {
        if (window.storage) {
            const r = await window.storage.get('csa_roster', true);
            csaRoster = r ? JSON.parse(r.value) : [];
        } else {
            const s = localStorage.getItem('csa_roster');
            csaRoster = s ? JSON.parse(s) : [];
        }
    } catch(e) { csaRoster = []; }
    csaRender();
}

async function csaSave() {
    try {
        const j = JSON.stringify(csaSubmissions);
        if (window.storage) await window.storage.set('csa_submissions', j, true);
        else localStorage.setItem('csa_submissions', j);
    } catch(e) {}
    try {
        const j2 = JSON.stringify(csaRemediations);
        if (window.storage) await window.storage.set('csa_remediations', j2, true);
        else localStorage.setItem('csa_remediations', j2);
    } catch(e) {}
    try {
        const j3 = JSON.stringify(csaRoster);
        if (window.storage) await window.storage.set('csa_roster', j3, true);
        else localStorage.setItem('csa_roster', j3);
    } catch(e) {}
}

// ── WhatsApp ──
function getHubUrl() {
    var url = HUB_BASE_URL;
    if (!url) {
        var loc = window.location.href;
        if (loc.indexOf('http') === 0) url = loc.split('?')[0];
    }
    if (!url) return '';
    // Convert CodePen URLs to /debug/ view (no referrer check, passes URL params)
    if (url.indexOf('codepen.io') > -1 || url.indexOf('cdpn.io') > -1) {
        url = url.replace(/\/(full|fullpage|pen|details)\//i, '/debug/');
    }
    return url;
}

function sendCSAWhatsApp() {
    const store = document.getElementById('wa-site').value;
    const atype = document.getElementById('wa-type').value;
    const atDef = ASSESSMENT_TYPES[atype];
    const emoji = atype === 'csa_forecourt' ? '⛽' : atype === 'store_promotions' ? '🏪' : '🛣️';

    var baseUrl = getHubUrl();
    var msg = `📋 Assessment Required — ${store}\n\n${emoji} ${atDef.label}\n\nPlease conduct this assessment today.`;
    if (baseUrl) {
        var url = baseUrl + '?form=' + encodeURIComponent(store) + '&type=' + encodeURIComponent(atype);
        msg = `📋 Assessment Required — ${store}\n\n${emoji} ${atDef.label}\n\nPlease conduct this assessment:\n${url}\n\nTap the link above to open the form directly.`;
    }

    const preview = document.getElementById('wa-preview');
    preview.style.display = 'block';
    preview.textContent = msg;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ── CSA Form ──
function openCSAForm(store) {
    var body = document.getElementById('csa-form-body');
    var titleEl = document.querySelector('#csa-form-modal-bd .modal-header span');
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-clipboard-check"></i> Select Assessment Type';
    body.innerHTML = '<div style="padding:1.5rem 0">' +
        '<h3 style="font-size:1rem;font-weight:700;margin-bottom:.5rem;color:var(--t1)">Choose Assessment Type</h3>' +
        '<p style="font-size:.8rem;color:var(--t2);margin-bottom:1.5rem">Select the type of assessment to conduct at <strong>' + store + '</strong>.</p>' +
        '<div style="display:flex;flex-direction:column;gap:.75rem">' +
        Object.keys(ASSESSMENT_TYPES).map(function(key) {
            var t = ASSESSMENT_TYPES[key];
            var desc = key === 'csa_forecourt' ? 'Assess 2 CSAs on the 4-step forecourt service approach (15 questions, 93% pass)' :
                key === 'store_promotions' ? 'Assess 1 store team member on in-store service & promotions (20 questions, 95% pass)' :
                'Assess the overall site driveway and facilities appearance (20 questions, 95% pass)';
            return '<button onclick="openCSAFormTyped(\'' + store.replace(/'/g, "\\'") + '\',\'' + key + '\')" style="display:flex;align-items:center;gap:1rem;padding:1.15rem 1.25rem;background:#fff;border:1.5px solid var(--bdr);border-radius:10px;cursor:pointer;text-align:left;transition:all .15s;font-family:inherit" onmouseover="this.style.borderColor=\'' + t.color + '\';this.style.background=\'#fafbfc\'" onmouseout="this.style.borderColor=\'var(--bdr)\';this.style.background=\'#fff\'">' +
                '<div style="width:42px;height:42px;border-radius:10px;background:' + t.color + '15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="' + t.icon + '" style="color:' + t.color + ';font-size:1.1rem"></i></div>' +
                '<div><div style="font-size:.9rem;font-weight:700;color:var(--t1)">' + t.label + '</div><div style="font-size:.75rem;color:var(--t2);margin-top:.15rem">' + desc + '</div></div>' +
                '<i class="fas fa-chevron-right" style="margin-left:auto;color:var(--t3);font-size:.8rem"></i></button>';
        }).join('') +
        '</div></div>';
    document.getElementById('csa-form-modal-bd').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function openCSAFormTyped(store, assessmentType) {
    var body = document.getElementById('csa-form-body');
    var at = ASSESSMENT_TYPES[assessmentType];
    var titleEl = document.querySelector('#csa-form-modal-bd .modal-header span');
    if (titleEl) titleEl.innerHTML = '<i class="' + at.icon + '"></i> ' + at.label;
    body.innerHTML = getCSAFormHTML(store, assessmentType);
    var script = document.createElement('script');
    script.textContent = getCSAFormScript(store, assessmentType);
    body.appendChild(script);
}

function closeCSAForm() {
    document.getElementById('csa-form-modal-bd').classList.remove('open');
    document.body.style.overflow = '';
}

function getCSAFormHTML(store, assessmentType) {
    var at = ASSESSMENT_TYPES[assessmentType];
    var questions = at.questions;
    var qCount = at.questionCount;
    var qHTML = function(start, end, csaId) {
        return questions.slice(start, end).map(function(q, idx) {
            var num = start + idx + 1;
            return '<div class="csa-q"><span class="csa-q-num">' + num + '</span><span class="csa-q-text">' + q + '</span><div class="csa-yn"><button class="yes" onclick="csaAnswer(\'' + csaId + '\',' + (start+idx) + ',true,this)">Yes</button><button class="no" onclick="csaAnswer(\'' + csaId + '\',' + (start+idx) + ',false,this)">No</button></div></div>';
        }).join('');
    };
    var savedAssessor = '';
    try { savedAssessor = localStorage.getItem('astron_assessor') || ''; } catch(e) {}

    // Build subject fields based on type — all types now use the roster, filtered by eligible categories
    var subjectFields = '';
    var eligibleStaff = getEligibleStaff(assessmentType, store);
    var buildRosterOpts = function(placeholder) {
        var opts = '<option value="">' + placeholder + '…</option>';
        var byCategory = {};
        eligibleStaff.forEach(function(c) {
            var cat = c.category || 'csa';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(c);
        });
        var categoryOrder = ['management','csa','cashier','kitchen','coffee','merchandising'];
        categoryOrder.forEach(function(cat) {
            if (!byCategory[cat]) return;
            opts += '<optgroup label="' + STAFF_CATEGORIES[cat].label + '">';
            byCategory[cat].forEach(function(c) {
                var display = c.name + (c.supervisor ? ' ⭐' : '');
                opts += '<option value="' + c.name.replace(/"/g, '&quot;') + '">' + display + '</option>';
            });
            opts += '</optgroup>';
        });
        opts += '<option value="__new__">+ Add new staff member</option>';
        return opts;
    };
    var noStaffNote = '';
    if (!eligibleStaff.length) {
        var catList = at.eligibleCategories.map(function(k) { return STAFF_CATEGORIES[k].label; }).join(', ');
        var suffix = at.supervisorOnly ? ' (Supervisors only for CSAs)' : '';
        noStaffNote = '<div style="font-size:.72rem;color:var(--warn);margin-top:.35rem;display:flex;align-items:center;gap:.25rem"><i class="fas fa-info-circle"></i> No eligible staff at ' + store + '. Required: ' + catList + suffix + '. Add them via Staff Roster or select "+ Add new".</div>';
    }

    if (assessmentType === 'csa_forecourt') {
        var rosterOpts1 = buildRosterOpts('Select CSA');
        subjectFields = noStaffNote +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.5rem">' +
            '<div class="csa-fg"><label>CSA 1 *</label><select id="csa-sel1" class="nf-input" onchange="csaNameToggle(1)">' + rosterOpts1 + '</select><input id="csa-new1" class="nf-input" placeholder="Type new CSA name" style="display:none;margin-top:.35rem"></div>' +
            '<div class="csa-fg"><label>CSA 2 *</label><select id="csa-sel2" class="nf-input" onchange="csaNameToggle(2)">' + rosterOpts1 + '</select><input id="csa-new2" class="nf-input" placeholder="Type new CSA name" style="display:none;margin-top:.35rem"></div></div>';
    } else if (assessmentType === 'store_promotions') {
        var rosterOpts2 = buildRosterOpts('Select team member');
        subjectFields = noStaffNote +
            '<div class="csa-fg" style="margin-top:.5rem"><label>Store Team Member *</label><select id="csa-sel1" class="nf-input" onchange="csaNameToggle(1)">' + rosterOpts2 + '</select><input id="csa-new1" class="nf-input" placeholder="Type new team member name" style="display:none;margin-top:.35rem"></div>';
    } else if (assessmentType === 'driveway_appearance') {
        var rosterOpts3 = buildRosterOpts('Select responsible person');
        subjectFields = noStaffNote +
            '<div class="csa-fg" style="margin-top:.5rem"><label>Responsible Person *</label><select id="csa-sel1" class="nf-input" onchange="csaNameToggle(1)">' + rosterOpts3 + '</select><input id="csa-new1" class="nf-input" placeholder="Type new name" style="display:none;margin-top:.35rem"></div>' +
            '<div style="font-size:.68rem;color:var(--t3);margin-top:.35rem">Driveway upkeep falls to Management or CSA Supervisors. ⭐ = Supervisor</div>';
    }

    // Build step indicators
    var totalSteps = assessmentType === 'csa_forecourt' ? 4 : 3;
    var stepsHTML = '';
    for (var si = 0; si < totalSteps; si++) {
        stepsHTML += '<div class="csa-step' + (si === 0 ? ' active' : '') + '" id="csa-s' + si + '"></div>';
    }

    // Page 0: Session Details (always)
    var html = '<div class="csa-progress">' + stepsHTML + '</div>' +
        '<div class="csa-page active" id="csa-p0"><h3 style="font-size:1rem;font-weight:700;margin-bottom:.35rem;color:var(--t1)">Session Details</h3>' +
        '<div style="font-size:.75rem;color:var(--t2);margin-bottom:1.25rem;display:flex;align-items:center;gap:.35rem"><i class="' + at.icon + '" style="color:' + at.color + '"></i> ' + at.label + ' — ' + qCount + ' questions, ' + Math.round(at.passThreshold/qCount*100) + '% pass threshold</div>' +
        '<div class="csa-fg"><label>Store</label><input id="csa-store" value="' + (store || '') + '" readonly style="background:#f8fafc"></div>' +
        subjectFields +
        '<div class="csa-fg" style="margin-top:.75rem"><label>Assessor Name *</label><input id="csa-assessor" class="nf-input" placeholder="Your name" value="' + savedAssessor.replace(/"/g, '&quot;') + '"></div>' +
        '<div class="csa-fg"><label>Date</label><input id="csa-date" type="date" class="nf-input" value="' + new Date().toISOString().split('T')[0] + '"></div>' +
        '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button class="csa-btn pri" onclick="csaNext(1)">Next <i class="fas fa-arrow-right"></i></button></div></div>';

    if (assessmentType === 'csa_forecourt') {
        // Page 1: CSA 1 questions
        html += '<div class="csa-page" id="csa-p1"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem"><h3 style="font-size:1rem;font-weight:700;color:var(--t1)">CSA 1 Assessment</h3><div class="csa-score-live"><i class="fas fa-chart-bar"></i> Score: <span id="csa-score1">0</span>/' + qCount + '</div></div>' +
            qHTML(0, qCount, '1') +
            '<div style="margin-top:1rem;display:flex;justify-content:space-between"><button class="csa-btn sec" onclick="csaNext(0)"><i class="fas fa-arrow-left"></i> Back</button><button class="csa-btn pri" onclick="csaNext(2)">Next: CSA 2 <i class="fas fa-arrow-right"></i></button></div></div>';
        // Page 2: CSA 2 questions
        html += '<div class="csa-page" id="csa-p2"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem"><h3 style="font-size:1rem;font-weight:700;color:var(--t1)">CSA 2 Assessment</h3><div class="csa-score-live"><i class="fas fa-chart-bar"></i> Score: <span id="csa-score2">0</span>/' + qCount + '</div></div>' +
            qHTML(0, qCount, '2') +
            '<div style="margin-top:1rem;display:flex;justify-content:space-between"><button class="csa-btn sec" onclick="csaNext(1)"><i class="fas fa-arrow-left"></i> Back</button><button class="csa-btn pri" onclick="csaShowSummary()">Review Summary <i class="fas fa-arrow-right"></i></button></div></div>';
        // Page 3: Summary
        html += '<div class="csa-page" id="csa-p3"><h3 style="font-size:1rem;font-weight:700;margin-bottom:1.25rem;color:var(--t1)">Summary & Submit</h3><div id="csa-summary"></div><div style="display:flex;justify-content:space-between;margin-top:1rem"><button class="csa-btn sec" onclick="csaNext(2)"><i class="fas fa-arrow-left"></i> Back</button><button class="csa-btn pri" onclick="csaSubmit()"><i class="fas fa-paper-plane"></i> Submit Assessment</button></div></div>';
        html += '<div class="csa-page" id="csa-p4"></div>';
    } else {
        // Store & Promos / Driveway: single question set
        var pageTitle = assessmentType === 'store_promotions' ? 'Store & Promotions Assessment' : 'Driveway Appearance Assessment';
        html += '<div class="csa-page" id="csa-p1"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem"><h3 style="font-size:1rem;font-weight:700;color:var(--t1)">' + pageTitle + '</h3><div class="csa-score-live"><i class="fas fa-chart-bar"></i> Score: <span id="csa-score1">0</span>/' + qCount + '</div></div>' +
            qHTML(0, qCount, '1') +
            '<div style="margin-top:1rem;display:flex;justify-content:space-between"><button class="csa-btn sec" onclick="csaNext(0)"><i class="fas fa-arrow-left"></i> Back</button><button class="csa-btn pri" onclick="csaShowSummary()">Review Summary <i class="fas fa-arrow-right"></i></button></div></div>';
        // Summary page (page 2 for non-forecourt)
        html += '<div class="csa-page" id="csa-p2"><h3 style="font-size:1rem;font-weight:700;margin-bottom:1.25rem;color:var(--t1)">Summary & Submit</h3><div id="csa-summary"></div><div style="display:flex;justify-content:space-between;margin-top:1rem"><button class="csa-btn sec" onclick="csaNext(1)"><i class="fas fa-arrow-left"></i> Back</button><button class="csa-btn pri" onclick="csaSubmit()"><i class="fas fa-paper-plane"></i> Submit Assessment</button></div></div>';
        html += '<div class="csa-page" id="csa-p3"></div>';
    }
    return html;
}

function getCSAFormScript(store, assessmentType) {
    var at = ASSESSMENT_TYPES[assessmentType];
    var qCount = at.questionCount;
    var passThreshold = at.passThreshold;
    var remedThreshold = at.remediationThreshold;
    var totalPages = assessmentType === 'csa_forecourt' ? 5 : 4;

    if (assessmentType === 'csa_forecourt') {
        // ── CSA Forecourt: 2 CSAs, roster dropdown ──
        return '(function(){' +
            'var answers1={},answers2={};' +
            'var qCount=' + qCount + ',passT=' + passThreshold + ',remedT=' + remedThreshold + ';' +
            'window.csaNameToggle=function(num){' +
                'var sel=document.getElementById("csa-sel"+num);' +
                'var inp=document.getElementById("csa-new"+num);' +
                'if(sel.value==="__new__"){inp.style.display="block";inp.focus();}' +
                'else{inp.style.display="none";inp.value="";}' +
            '};' +
            'function getCsaName(num){' +
                'var sel=document.getElementById("csa-sel"+num);' +
                'if(sel.value==="__new__"){return document.getElementById("csa-new"+num).value.trim();}' +
                'return sel.value;' +
            '}' +
            'window.csaAnswer=function(csa,idx,val,btn){' +
                'var a=csa==="1"?answers1:answers2;a[idx]=val;' +
                'var row=btn.closest(".csa-yn");' +
                'row.querySelectorAll("button").forEach(function(b){b.classList.remove("sel");});' +
                'btn.classList.add("sel");' +
                'var yes=Object.values(a).filter(function(v){return v===true;}).length;' +
                'var el=document.getElementById("csa-score"+csa);if(el)el.textContent=yes;' +
            '};' +
            'window.csaNext=function(page){' +
                'if(page===1){' +
                    'var n1=getCsaName(1);var n2=getCsaName(2);' +
                    'var a=document.getElementById("csa-assessor").value.trim();' +
                    'if(!n1||!n2||!a){alert("Please select both CSAs and enter assessor name.");return;}' +
                    'if(n1===n2){alert("CSA 1 and CSA 2 must be different people.");return;}' +
                '}' +
                'if(page===2){var cnt=Object.keys(answers1).length;if(cnt<qCount){alert("Please answer all "+qCount+" questions for CSA 1.");return;}}' +
                'for(var i=0;i<' + totalPages + ';i++){' +
                    'var p=document.getElementById("csa-p"+i);if(p)p.classList.remove("active");' +
                    'var s=document.getElementById("csa-s"+i);if(s){s.classList.remove("active","done");}' +
                '}' +
                'document.getElementById("csa-p"+page).classList.add("active");' +
                'for(var j=0;j<page;j++){var sd=document.getElementById("csa-s"+j);if(sd)sd.classList.add("done");}' +
                'var sa=document.getElementById("csa-s"+page);if(sa)sa.classList.add("active");' +
                'document.getElementById("csa-form-modal-bd").scrollTop=0;' +
            '};' +
            'window.csaShowSummary=function(){' +
                'var cnt2=Object.keys(answers2).length;if(cnt2<qCount){alert("Please answer all "+qCount+" questions for CSA 2.");return;}' +
                'var y1=Object.values(answers1).filter(function(v){return v===true;}).length;' +
                'var y2=Object.values(answers2).filter(function(v){return v===true;}).length;' +
                'var n1=getCsaName(1);var n2=getCsaName(2);' +
                'var s1=Math.round(y1/qCount*100);var s2=Math.round(y2/qCount*100);' +
                'var p1=y1>=passT?"Pass":"Fail";var p2=y2>=passT?"Pass":"Fail";' +
                'var r1=(qCount-y1)>=remedT;var r2=(qCount-y2)>=remedT;' +
                'var html="<div class=\\"csa-summary-grid\\"><div class=\\"csa-summary-card\\"><h4>"+n1+"</h4><div class=\\"score-big "+(p1==="Pass"?"pass":"fail")+"\\">"+s1+"%</div><div style=\\"font-size:.85rem;font-weight:600;color:"+(p1==="Pass"?"var(--ok)":"var(--err)")+"\\">"+p1+" — "+y1+"/"+qCount+"</div>"+(r1?"<div class=\\"csa-remed-flag\\"><i class=\\"fas fa-exclamation-triangle\\"></i>Remediation Required</div>":"")+"</div><div class=\\"csa-summary-card\\"><h4>"+n2+"</h4><div class=\\"score-big "+(p2==="Pass"?"pass":"fail")+"\\">"+s2+"%</div><div style=\\"font-size:.85rem;font-weight:600;color:"+(p2==="Pass"?"var(--ok)":"var(--err)")+"\\">"+p2+" — "+y2+"/"+qCount+"</div>"+(r2?"<div class=\\"csa-remed-flag\\"><i class=\\"fas fa-exclamation-triangle\\"></i>Remediation Required</div>":"")+"</div></div>";' +
                'document.getElementById("csa-summary").innerHTML=html;' +
                'csaNext(3);' +
            '};' +
            'window.csaSubmit=function(){' +
                'var y1=Object.values(answers1).filter(function(v){return v===true;}).length;' +
                'var y2=Object.values(answers2).filter(function(v){return v===true;}).length;' +
                'var store=document.getElementById("csa-store").value;' +
                'var n1=getCsaName(1);var n2=getCsaName(2);' +
                'var assessor=document.getElementById("csa-assessor").value.trim();' +
                'var date=document.getElementById("csa-date").value;' +
                'try{localStorage.setItem("astron_assessor",assessor);}catch(e){}' +
                'var s1=Math.round(y1/qCount*100);var s2=Math.round(y2/qCount*100);' +
                'var no1=qCount-y1;var no2=qCount-y2;' +
                '[n1,n2].forEach(function(name){' +
                    'var exists=csaRoster.find(function(c){return c.name===name&&c.store===store&&c.active!==false;});' +
                    'if(!exists){csaRoster.push({id:"r-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),name:name,store:store,category:"csa",supervisor:false,active:true,addedAt:new Date().toISOString()});}' +
                '});' +
                'var rec1={id:"csa-"+Date.now()+"-1",assessmentType:"csa_forecourt",csaName:n1,store:store,date:date,score:s1,yesCount:y1,noCount:no1,totalQuestions:qCount,result:y1>=passT?"Pass":"Fail",remediationRequired:no1>=remedT,remediationCompleted:false,assessor:assessor,answers:JSON.parse(JSON.stringify(answers1)),submittedAt:new Date().toISOString()};' +
                'var rec2={id:"csa-"+Date.now()+"-2",assessmentType:"csa_forecourt",csaName:n2,store:store,date:date,score:s2,yesCount:y2,noCount:no2,totalQuestions:qCount,result:y2>=passT?"Pass":"Fail",remediationRequired:no2>=remedT,remediationCompleted:false,assessor:assessor,answers:JSON.parse(JSON.stringify(answers2)),submittedAt:new Date().toISOString()};' +
                'csaSubmissions.unshift(rec2);csaSubmissions.unshift(rec1);' +
                'csaSave();csaRender();' +
                'document.getElementById("csa-p3").classList.remove("active");' +
                'document.getElementById("csa-p4").classList.add("active");' +
                'document.getElementById("csa-p4").innerHTML="<div class=\\"csa-success\\"><i class=\\"fas fa-check-circle\\"></i><h3>Assessments Submitted</h3><p style=\\"color:var(--t2);margin-bottom:1.5rem\\">"+n1+" and "+n2+" assessed at "+store+".</p><button class=\\"csa-btn pri\\" onclick=\\"closeCSAForm()\\">Close</button></div>";' +
            '};' +
        '})();';
    } else {
        // ── Store & Promos / Driveway: single subject via roster dropdown ──
        var aType = assessmentType;
        // Default category for auto-adding new staff — first eligible, or Management for Driveway
        var defaultCategory = assessmentType === 'driveway_appearance' ? 'management' : at.eligibleCategories[0];
        return '(function(){' +
            'var answers1={};' +
            'var qCount=' + qCount + ',passT=' + passThreshold + ',remedT=' + remedThreshold + ';' +
            'var aType="' + aType + '";' +
            'var defaultCat="' + defaultCategory + '";' +
            'window.csaNameToggle=function(num){' +
                'var sel=document.getElementById("csa-sel"+num);' +
                'var inp=document.getElementById("csa-new"+num);' +
                'if(sel.value==="__new__"){inp.style.display="block";inp.focus();}' +
                'else{inp.style.display="none";inp.value="";}' +
            '};' +
            'function getSubjectName(){' +
                'var sel=document.getElementById("csa-sel1");' +
                'if(!sel)return "";' +
                'if(sel.value==="__new__"){return document.getElementById("csa-new1").value.trim();}' +
                'return sel.value;' +
            '}' +
            'window.csaAnswer=function(csa,idx,val,btn){' +
                'answers1[idx]=val;' +
                'var row=btn.closest(".csa-yn");' +
                'row.querySelectorAll("button").forEach(function(b){b.classList.remove("sel");});' +
                'btn.classList.add("sel");' +
                'var yes=Object.values(answers1).filter(function(v){return v===true;}).length;' +
                'var el=document.getElementById("csa-score1");if(el)el.textContent=yes;' +
            '};' +
            'window.csaNext=function(page){' +
                'if(page===1){' +
                    'var sn=getSubjectName();' +
                    'var a=document.getElementById("csa-assessor").value.trim();' +
                    'if(!sn){alert("Please select a staff member or add a new one.");return;}' +
                    'if(!a){alert("Please enter assessor name.");return;}' +
                '}' +
                'for(var i=0;i<4;i++){' +
                    'var p=document.getElementById("csa-p"+i);if(p)p.classList.remove("active");' +
                    'var s=document.getElementById("csa-s"+i);if(s){s.classList.remove("active","done");}' +
                '}' +
                'document.getElementById("csa-p"+page).classList.add("active");' +
                'for(var j=0;j<page;j++){var sd=document.getElementById("csa-s"+j);if(sd)sd.classList.add("done");}' +
                'var sa=document.getElementById("csa-s"+page);if(sa)sa.classList.add("active");' +
                'document.getElementById("csa-form-modal-bd").scrollTop=0;' +
            '};' +
            'window.csaShowSummary=function(){' +
                'var cnt=Object.keys(answers1).length;if(cnt<qCount){alert("Please answer all "+qCount+" questions.");return;}' +
                'var y1=Object.values(answers1).filter(function(v){return v===true;}).length;' +
                'var subjectName=getSubjectName();' +
                'var s1=Math.round(y1/qCount*100);' +
                'var p1=y1>=passT?"Pass":"Fail";' +
                'var r1=(qCount-y1)>=remedT;' +
                'var html="<div class=\\"csa-summary-grid\\"><div class=\\"csa-summary-card\\" style=\\"max-width:400px\\"><h4>"+subjectName+"</h4><div class=\\"score-big "+(p1==="Pass"?"pass":"fail")+"\\">"+s1+"%</div><div style=\\"font-size:.85rem;font-weight:600;color:"+(p1==="Pass"?"var(--ok)":"var(--err)")+"\\">"+p1+" — "+y1+"/"+qCount+"</div>"+(r1?"<div class=\\"csa-remed-flag\\"><i class=\\"fas fa-exclamation-triangle\\"></i>Remediation Required</div>":"")+"</div></div>";' +
                'document.getElementById("csa-summary").innerHTML=html;' +
                'csaNext(2);' +
            '};' +
            'window.csaSubmit=function(){' +
                'var y1=Object.values(answers1).filter(function(v){return v===true;}).length;' +
                'var store=document.getElementById("csa-store").value;' +
                'var subjectName=getSubjectName();' +
                'var assessor=document.getElementById("csa-assessor").value.trim();' +
                'var date=document.getElementById("csa-date").value;' +
                'try{localStorage.setItem("astron_assessor",assessor);}catch(e){}' +
                'var s1=Math.round(y1/qCount*100);' +
                'var no1=qCount-y1;' +
                // Auto-add new staff to roster with correct default category
                'var exists=csaRoster.find(function(c){return c.name===subjectName&&c.store===store&&c.active!==false;});' +
                'if(!exists){csaRoster.push({id:"r-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),name:subjectName,store:store,category:defaultCat,supervisor:aType==="driveway_appearance"&&defaultCat==="csa",active:true,addedAt:new Date().toISOString()});}' +
                'var rec={id:"csa-"+Date.now()+"-1",assessmentType:aType,csaName:subjectName,store:store,date:date,score:s1,yesCount:y1,noCount:no1,totalQuestions:qCount,result:y1>=passT?"Pass":"Fail",remediationRequired:no1>=remedT,remediationCompleted:false,assessor:assessor,answers:JSON.parse(JSON.stringify(answers1)),submittedAt:new Date().toISOString()};' +
                'csaSubmissions.unshift(rec);' +
                'csaSave();csaRender();' +
                'document.getElementById("csa-p2").classList.remove("active");' +
                'document.getElementById("csa-p3").classList.add("active");' +
                'document.getElementById("csa-p3").innerHTML="<div class=\\"csa-success\\"><i class=\\"fas fa-check-circle\\"></i><h3>Assessment Submitted</h3><p style=\\"color:var(--t2);margin-bottom:1.5rem\\">"+subjectName+" assessed at "+store+".</p><button class=\\"csa-btn pri\\" onclick=\\"closeCSAForm()\\">Close</button></div>";' +
            '};' +
        '})();';
    }
}

// ── CSA Dashboard Rendering ──
function csaFiltered() {
    var atype = document.getElementById('csa-f-type') ? document.getElementById('csa-f-type').value : '';
    var store = document.getElementById('csa-f-store') ? document.getElementById('csa-f-store').value : '';
    var period = document.getElementById('csa-f-period') ? document.getElementById('csa-f-period').value : 'all';
    var search = document.getElementById('csa-f-search') ? document.getElementById('csa-f-search').value.toLowerCase() : '';
    var data = csaSubmissions.slice();
    if (atype) data = data.filter(function(r) { return r.assessmentType === atype; });
    if (store) data = data.filter(function(r) { return r.store === store; });
    if (period !== 'all') {
        var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - parseInt(period));
        data = data.filter(function(r) { return new Date(r.date) >= cutoff; });
    }
    if (search) data = data.filter(function(r) { return (r.csaName || '').toLowerCase().indexOf(search) > -1; });
    return data;
}

function csaRender() {
    var d = csaFiltered();
    csaKPI(d);
    csaDonutRender(d);
    csaBarRender(d);
    csaTable(d);
    rosterRender();
    freqRender();
    remedRender();
    csaUpdateBadges();
}

function csaKPI(d) {
    var el = document.getElementById('csa-kpi');
    if (!el) return;
    var total = d.length, passed = d.filter(function(r){return r.result==='Pass';}).length, failed = d.filter(function(r){return r.result==='Fail';}).length;
    var avg = total ? Math.round(d.reduce(function(s,r){return s+Number(r.score||0);},0)/total) : 0;
    var rate = total ? Math.round(passed/total*100) : 0;
    var pendingRemed = d.filter(function(r){return r.remediationRequired && !r.remediationCompleted;}).length;
    el.innerHTML =
        '<div class="csa-kpi"><div class="kpi-l">Total Assessments</div><div class="kpi-v">' + total + '</div><div class="kpi-s">Selected period</div></div>' +
        '<div class="csa-kpi" style="border-left-color:var(--ok)"><div class="kpi-l">Passed</div><div class="kpi-v" style="color:var(--ok)">' + passed + '</div><div class="kpi-s">Pass rate ' + rate + '%</div></div>' +
        '<div class="csa-kpi" style="border-left-color:var(--err)"><div class="kpi-l">Failed</div><div class="kpi-v" style="color:var(--err)">' + failed + '</div><div class="kpi-s">' + (total ? 100-rate : 0) + '% of assessments</div></div>' +
        '<div class="csa-kpi" style="border-left-color:var(--warn)"><div class="kpi-l">Pending Remediation</div><div class="kpi-v" style="color:' + (pendingRemed ? 'var(--warn)' : 'var(--ok)') + '">' + pendingRemed + '</div><div class="kpi-s">' + (pendingRemed ? 'Action required' : 'All clear') + '</div></div>' +
        '<div class="csa-kpi" style="border-left-color:var(--pur)"><div class="kpi-l">Avg Score</div><div class="kpi-v" style="color:var(--pur)">' + avg + '%</div><div class="kpi-s">Across all assessments</div></div>';
}

function csaDonutRender(d) {
    var ctx = document.getElementById('csa-donut');
    if (!ctx) return;
    if (csaDonutChart) { csaDonutChart.destroy(); csaDonutChart = null; }
    var passed = d.filter(function(r){return r.result==='Pass';}).length;
    var failed = d.filter(function(r){return r.result==='Fail';}).length;
    if (!d.length) return;
    csaDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Pass','Fail'], datasets: [{ data: [passed, failed], backgroundColor: ['#10b981','#ef4444'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
    });
}

function csaBarRender(d) {
    var ctx = document.getElementById('csa-bar');
    if (!ctx) return;
    if (csaBarChart) { csaBarChart.destroy(); csaBarChart = null; }
    var stores = ['Hillcrest','Hammersdale','Gillits','Cato Ridge'];
    var avgs = stores.map(function(s) {
        var sd = d.filter(function(r){return r.store===s;});
        return sd.length ? Math.round(sd.reduce(function(sum,r){return sum+Number(r.score||0);},0)/sd.length) : 0;
    });
    if (!d.length) return;
    csaBarChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: stores, datasets: [{ label: 'Avg Score %', data: avgs, backgroundColor: ['#f97316','#3b82f6','#8b5cf6','#10b981'], borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }, plugins: { legend: { display: false } } }
    });
}

function csaTable(d) {
    var tb = document.getElementById('csa-tbody');
    var em = document.getElementById('csa-empty');
    if (!tb) return;
    var countEl = document.getElementById('csa-count');
    if (countEl) countEl.textContent = d.length + ' record' + (d.length !== 1 ? 's' : '');
    if (!d.length) { tb.innerHTML = ''; if (em) em.style.display = 'block'; return; }
    if (em) em.style.display = 'none';
    tb.innerHTML = d.map(function(r, i) {
        var pass = r.result === 'Pass', score = Number(r.score || 0);
        var col = score >= 80 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
        var date = r.date ? new Date(r.date).toLocaleDateString('en-ZA', {day:'2-digit', month:'short', year:'numeric'}) : '\u2014';
        var esc = function(s) { return (s||'').replace(/'/g, "\\'"); };
        var atDef = ASSESSMENT_TYPES[r.assessmentType] || ASSESSMENT_TYPES['csa_forecourt'];
        var typeBadge = '<span style="display:inline-flex;align-items:center;gap:.25rem;padding:.2rem .5rem;border-radius:6px;font-size:.6rem;font-weight:700;background:' + atDef.color + '12;color:' + atDef.color + ';white-space:nowrap"><i class="' + atDef.icon + '" style="font-size:.55rem"></i>' + atDef.shortLabel + '</span>';
        var statusCell = '<span style="font-size:.7rem;color:var(--t3)">\u2014</span>';
        var actionCell = '';
        if (r.remediationRequired) {
            if (r.remediationCompleted) {
                statusCell = '<span style="display:inline-flex;align-items:center;gap:.25rem;padding:.25rem .55rem;border-radius:10px;font-size:.65rem;font-weight:700;background:#dcfce7;color:#16a34a;text-transform:uppercase"><i class="fas fa-check-circle"></i>Remediated</span>';
            } else {
                statusCell = '<span style="display:inline-flex;align-items:center;gap:.25rem;padding:.25rem .55rem;border-radius:10px;font-size:.65rem;font-weight:700;background:#fef3c7;color:#92400e;text-transform:uppercase;animation:pulse-warn 2s infinite"><i class="fas fa-exclamation-triangle"></i>Pending</span>';
                actionCell = '<button onclick="openCSARemed(\'' + esc(r.csaName) + '\',\'' + esc(r.store) + '\',\'' + esc(r.date) + '\')" style="background:#fef3c7;color:#92400e;border:1.5px solid #fde68a;padding:.3rem .6rem;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:700;display:inline-flex;align-items:center;gap:.25rem;margin-right:.35rem"><i class="fas fa-first-aid"></i>Remediate</button>';
            }
        } else if (pass) {
            statusCell = '<span style="display:inline-flex;align-items:center;gap:.25rem;padding:.25rem .55rem;border-radius:10px;font-size:.65rem;font-weight:700;background:#f0fdf4;color:#16a34a;text-transform:uppercase"><i class="fas fa-check"></i>Clear</span>';
        }
        return '<tr>' +
            '<td style="font-weight:600;white-space:nowrap">' + (r.csaName||'\u2014') + '</td>' +
            '<td>' + typeBadge + '</td>' +
            '<td style="color:var(--t2)">' + (r.store||'\u2014') + '</td>' +
            '<td style="color:var(--t3);white-space:nowrap">' + date + '</td>' +
            '<td><span style="font-weight:700;color:' + col + '">' + score + '%</span><div style="height:4px;background:#f1f5f9;border-radius:2px;margin-top:4px;min-width:60px"><div style="height:4px;width:' + score + '%;background:' + col + ';border-radius:2px"></div></div></td>' +
            '<td><span class="pb" style="background:' + (pass?'#dcfce7':'#fee2e2') + ';color:' + (pass?'#16a34a':'#dc2626') + '">' + (r.result||'\u2014') + '</span></td>' +
            '<td>' + statusCell + '</td>' +
            '<td style="color:var(--t2);font-size:.8rem">' + (r.assessor||'\u2014') + '</td>' +
            '<td style="white-space:nowrap">' + actionCell + '<button onclick="csaOpenReport(' + i + ')" style="background:var(--acc);color:#fff;border:none;padding:.3rem .6rem;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:600;display:inline-flex;align-items:center;gap:.25rem"><i class="fas fa-file-alt"></i>View</button></td>' +
        '</tr>';
    }).join('');
}

// ── CSA Report Modal ──
function csaOpenReport(idx) {
    var d = csaFiltered();
    var r = d[idx]; if (!r) return;
    var pass = r.result === 'Pass';
    var col = Number(r.score) >= 80 ? '#10b981' : Number(r.score) >= 70 ? '#f59e0b' : '#ef4444';
    var date = r.date ? new Date(r.date).toLocaleDateString('en-ZA', {weekday:'long', day:'2-digit', month:'long', year:'numeric'}) : '';
    var atDef = ASSESSMENT_TYPES[r.assessmentType] || ASSESSMENT_TYPES['csa_forecourt'];
    var questions = atDef.questions;
    var answersHTML = '';
    if (r.answers) {
        answersHTML = '<div style="margin-top:1.25rem"><div style="font-size:.7rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.6rem">Question Responses</div>';
        questions.forEach(function(q, i) {
            var a = r.answers[i];
            var aText = a === true ? 'Yes' : a === false ? 'No' : '—';
            var aCol = a === true ? '#10b981' : a === false ? '#ef4444' : '#94a3b8';
            answersHTML += '<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid #f1f5f9;font-size:.8rem"><span style="min-width:20px;color:var(--t3);font-size:.7rem">' + (i+1) + '</span><span style="flex:1;color:var(--t1)">' + q + '</span><span style="font-weight:700;color:' + aCol + ';min-width:30px;text-align:right">' + aText + '</span></div>';
        });
        answersHTML += '</div>';
    }
    var typeBadge = '<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .6rem;border-radius:6px;font-size:.65rem;font-weight:700;background:' + atDef.color + '15;color:' + atDef.color + '"><i class="' + atDef.icon + '" style="font-size:.6rem"></i>' + atDef.label + '</span>';
    document.getElementById('csa-report-body').innerHTML =
        '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem"><div style="width:48px;height:48px;border-radius:12px;background:' + (pass?'#dcfce7':'#fee2e2') + ';display:flex;align-items:center;justify-content:center"><i class="fas fa-' + (pass?'check-circle':'times-circle') + '" style="color:' + (pass?'#16a34a':'#dc2626') + ';font-size:1.5rem"></i></div><div><div style="font-size:1.1rem;font-weight:700;color:var(--t1)">' + (r.csaName||'—') + '</div><div style="font-size:.8rem;color:var(--t3)">' + (r.store||'') + ' — ' + date + '</div><div style="margin-top:.35rem">' + typeBadge + '</div></div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;margin-bottom:1.25rem"><div style="background:#f8fafc;border:1px solid var(--bdr);border-radius:8px;padding:.875rem;text-align:center"><div style="font-size:.65rem;font-weight:600;color:var(--t3);text-transform:uppercase;margin-bottom:.25rem">Score</div><div style="font-size:1.5rem;font-weight:700;color:' + col + '">' + r.score + '%</div></div><div style="background:#f8fafc;border:1px solid var(--bdr);border-radius:8px;padding:.875rem;text-align:center"><div style="font-size:.65rem;font-weight:600;color:var(--t3);text-transform:uppercase;margin-bottom:.25rem">Result</div><div style="font-size:1rem;font-weight:700;color:' + (pass?'#16a34a':'#dc2626') + '">' + r.result + '</div></div><div style="background:#f8fafc;border:1px solid var(--bdr);border-radius:8px;padding:.875rem;text-align:center"><div style="font-size:.65rem;font-weight:600;color:var(--t3);text-transform:uppercase;margin-bottom:.25rem">Assessor</div><div style="font-size:.85rem;font-weight:600;color:var(--t1)">' + (r.assessor||'—') + '</div></div></div>' +
        answersHTML;
    document.getElementById('csa-report-bd').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function csaCloseReport() {
    document.getElementById('csa-report-bd').classList.remove('open');
    document.body.style.overflow = '';
}

function csaPrint() {
    var body = document.getElementById('csa-report-body').innerHTML;
    var win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Assessment Report</title><style>body{font-family:Arial,sans-serif;padding:2rem;color:#1e293b;max-width:700px;margin:0 auto;font-size:14px;line-height:1.6}@media print{a{color:#1e293b}}</style></head><body><div style="border-bottom:2px solid #f97316;padding-bottom:8px;margin-bottom:16px;font-size:12px;color:#64748b;font-weight:600">ASTRON FRESHSTOP — ASSESSMENT REPORT</div>' + body + '<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">Printed ' + new Date().toLocaleDateString('en-ZA') + '</div></body></html>');
    win.document.close(); win.focus(); setTimeout(function(){ win.print(); }, 400);
}

// ── CSA Demo / Clear ──
function csaLoadDemo() {
    if (csaSubmissions.length && !confirm('This will add demo records to existing data. Continue?')) return;
    var stores = ['Hillcrest','Hammersdale','Gillits','Cato Ridge'];
    var assessors = ['K. Maharaj','S. Pillay','M. Govender'];

    // Helper: create realistic answers with exactly noCount false answers
    function genAnswers(total, noCount) {
        var indices = [];
        for (var i = 0; i < total; i++) indices.push(i);
        for (var j = indices.length - 1; j > 0; j--) {
            var swap = Math.floor(Math.random() * (j + 1));
            var tmp = indices[j]; indices[j] = indices[swap]; indices[swap] = tmp;
        }
        var failed = indices.slice(0, noCount);
        var answers = {};
        for (var k = 0; k < total; k++) answers[k] = failed.indexOf(k) === -1;
        return answers;
    }

    // Demo staff per store across all 6 categories
    var demoStaff = {
        'Hillcrest': [
            {name:'Thabo M.',    category:'csa',           supervisor:true},
            {name:'Priya N.',    category:'csa',           supervisor:false},
            {name:'Sipho K.',    category:'csa',           supervisor:false},
            {name:'Clare W.',    category:'management',    supervisor:false},
            {name:'Nomsa T.',    category:'cashier',       supervisor:false},
            {name:'Rashid K.',   category:'kitchen',       supervisor:false},
            {name:'Lerato M.',   category:'coffee',        supervisor:false},
            {name:'Dumisani B.', category:'merchandising', supervisor:false}
        ],
        'Hammersdale': [
            {name:'Anele D.',    category:'csa',           supervisor:true},
            {name:'Zinhle G.',   category:'csa',           supervisor:false},
            {name:'James T.',    category:'management',    supervisor:false},
            {name:'Sarah L.',    category:'cashier',       supervisor:false},
            {name:'Peter D.',    category:'kitchen',       supervisor:false}
        ],
        'Gillits': [
            {name:'Nandi P.',    category:'csa',           supervisor:true},
            {name:'Ravi S.',     category:'csa',           supervisor:false},
            {name:'Bongi M.',    category:'management',    supervisor:false},
            {name:'Kamogelo R.', category:'coffee',        supervisor:false},
            {name:'Tumi O.',     category:'merchandising', supervisor:false}
        ],
        'Cato Ridge': [
            {name:'Mandla X.',   category:'csa',           supervisor:true},
            {name:'Lindiwe N.',  category:'csa',           supervisor:false},
            {name:'Kabelo M.',   category:'cashier',       supervisor:false},
            {name:'Gugu L.',     category:'kitchen',       supervisor:false}
        ]
    };

    Object.keys(demoStaff).forEach(function(store) {
        demoStaff[store].forEach(function(s, idx) {
            var exists = csaRoster.find(function(c) { return c.name === s.name && c.store === store && c.active !== false; });
            if (!exists) {
                csaRoster.push({
                    id: 'r-demo-' + store.substring(0,3) + '-' + idx + '-' + Date.now(),
                    name: s.name, store: store, category: s.category, supervisor: s.supervisor,
                    active: true, addedAt: new Date().toISOString()
                });
            }
        });
    });

    // CSA Forecourt — 3 cycles × 2 CSAs per store
    stores.forEach(function(store) {
        var csas = demoStaff[store].filter(function(s) { return s.category === 'csa'; });
        if (csas.length < 2) return;
        for (var cycle = 0; cycle < 3; cycle++) {
            [csas[0].name, csas[1 % csas.length].name].forEach(function(name, nIdx) {
                var yes = Math.floor(Math.random() * 6) + 10;
                var no = 15 - yes;
                var score = Math.round(yes / 15 * 100);
                var d = new Date(); d.setDate(d.getDate() - (cycle * 14) - Math.floor(Math.random() * 7));
                csaSubmissions.push({
                    id: 'demo-fc-' + store + '-' + cycle + '-' + nIdx + '-' + Date.now(),
                    assessmentType: 'csa_forecourt',
                    csaName: name, store: store,
                    date: d.toISOString().split('T')[0],
                    score: score, yesCount: yes, noCount: no, totalQuestions: 15,
                    result: yes >= 14 ? 'Pass' : 'Fail',
                    remediationRequired: no >= 2, remediationCompleted: false,
                    assessor: assessors[Math.floor(Math.random() * assessors.length)],
                    answers: genAnswers(15, no), submittedAt: d.toISOString()
                });
            });
        }
    });

    // Store & Promotions — non-CSA staff per store
    stores.forEach(function(store) {
        var eligible = demoStaff[store].filter(function(s) { return s.category !== 'csa'; });
        eligible.forEach(function(s, idx) {
            if (idx > 1) return;
            var yes2 = Math.floor(Math.random() * 5) + 16;
            var no2 = 20 - yes2;
            var score2 = Math.round(yes2 / 20 * 100);
            var d2 = new Date(); d2.setDate(d2.getDate() - Math.floor(Math.random() * 60));
            csaSubmissions.push({
                id: 'demo-sp-' + store + '-' + idx + '-' + Date.now(),
                assessmentType: 'store_promotions',
                csaName: s.name, store: store,
                date: d2.toISOString().split('T')[0],
                score: score2, yesCount: yes2, noCount: no2, totalQuestions: 20,
                result: yes2 >= 19 ? 'Pass' : 'Fail',
                remediationRequired: no2 >= 2, remediationCompleted: false,
                assessor: assessors[Math.floor(Math.random() * assessors.length)],
                answers: genAnswers(20, no2), submittedAt: d2.toISOString()
            });
        });
    });

    // Driveway Appearance — supervisor/management per store
    stores.forEach(function(store) {
        var responsible = demoStaff[store].find(function(s) { return s.category === 'management'; }) ||
                          demoStaff[store].find(function(s) { return s.category === 'csa' && s.supervisor; });
        if (!responsible) return;
        for (var cyc = 0; cyc < 2; cyc++) {
            var yes3 = Math.floor(Math.random() * 4) + 17;
            var no3 = 20 - yes3;
            var score3 = Math.round(yes3 / 20 * 100);
            var d3 = new Date(); d3.setDate(d3.getDate() - (cyc * 10) - Math.floor(Math.random() * 5));
            csaSubmissions.push({
                id: 'demo-da-' + store + '-' + cyc + '-' + Date.now(),
                assessmentType: 'driveway_appearance',
                csaName: responsible.name, store: store,
                date: d3.toISOString().split('T')[0],
                score: score3, yesCount: yes3, noCount: no3, totalQuestions: 20,
                result: yes3 >= 19 ? 'Pass' : 'Fail',
                remediationRequired: no3 >= 2, remediationCompleted: false,
                assessor: assessors[Math.floor(Math.random() * assessors.length)],
                answers: genAnswers(20, no3), submittedAt: d3.toISOString()
            });
        }
    });

    csaSave(); csaRender();
}

function csaClearData() {
    if (!confirm('Clear all CSA assessment data? This cannot be undone.')) return;
    csaSubmissions = [];
    csaRemediations = [];
    csaSave(); csaRender();
}

// ── CSA Remediation ──
function openCSARemed(csaName, store, date) {
    var body = document.getElementById('csa-remed-body');
    body.innerHTML = getCSARemedHTML(csaName, store, date);
    var script = document.createElement('script');
    script.textContent = getCSARemedScript(csaName, store, date);
    body.appendChild(script);
    document.getElementById('csa-remed-modal-bd').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCSARemed() {
    document.getElementById('csa-remed-modal-bd').classList.remove('open');
    document.body.style.overflow = '';
}

function getCSARemedHTML(csaName, store, date) {
    var dateStr = date ? new Date(date).toLocaleDateString('en-ZA', {day:'2-digit', month:'long', year:'numeric'}) : '';
    // Find the submission being remediated
    var submission = csaSubmissions.find(function(s) {
        return s.csaName === csaName && s.store === store && s.date === date && s.remediationRequired;
    });

    var failedHTML = '';
    var assessmentLabel = 'Assessment';
    var assessmentIcon = 'fas fa-clipboard-check';
    var assessmentColor = '#f97316';
    var scoreInfo = '';

    if (submission) {
        var atDef = ASSESSMENT_TYPES[submission.assessmentType] || ASSESSMENT_TYPES['csa_forecourt'];
        assessmentLabel = atDef.label;
        assessmentIcon = atDef.icon;
        assessmentColor = atDef.color;
        scoreInfo = submission.score + '% — ' + submission.yesCount + '/' + submission.totalQuestions + ' · ' + submission.noCount + ' failed';

        var failedQs = [];
        if (submission.answers) {
            Object.keys(submission.answers).forEach(function(k) {
                if (submission.answers[k] === false) {
                    var qIdx = parseInt(k, 10);
                    failedQs.push({ num: qIdx + 1, text: atDef.questions[qIdx] || '(question ' + (qIdx + 1) + ')' });
                }
            });
        }
        failedQs.sort(function(a, b) { return a.num - b.num; });

        if (failedQs.length) {
            failedHTML = '<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:.85rem 1rem;margin-bottom:.75rem">' +
                '<div style="font-size:.72rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.55rem;display:flex;align-items:center;gap:.35rem">' +
                '<i class="fas fa-exclamation-triangle"></i> Questions Failed (' + failedQs.length + ')</div>';
            failedQs.forEach(function(q) {
                failedHTML += '<div style="display:flex;gap:.5rem;padding:.4rem 0;border-top:1px solid #fee2e2;font-size:.78rem;line-height:1.45">' +
                    '<span style="min-width:24px;font-weight:700;color:#dc2626;font-size:.72rem">Q' + q.num + '</span>' +
                    '<span style="color:#7f1d1d">' + q.text + '</span></div>';
            });
            failedHTML += '</div>';
        } else {
            failedHTML = '<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:8px;padding:.75rem 1rem;margin-bottom:.75rem;font-size:.78rem;color:#92400e">' +
                '<i class="fas fa-info-circle"></i> Individual answers not available for this older record. Please list failed questions manually below.</div>';
        }
    } else {
        failedHTML = '<div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;padding:.75rem 1rem;margin-bottom:.75rem;font-size:.78rem;color:#7f1d1d">' +
            '<i class="fas fa-exclamation-circle"></i> Submission not found.</div>';
    }

    var subjectLabel = submission && submission.assessmentType === 'driveway_appearance' ? 'Responsible Person' :
                       submission && submission.assessmentType === 'store_promotions' ? 'Team Member' : 'CSA Name';

    return '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;padding:.6rem .85rem;background:' + assessmentColor + '12;border-radius:8px;font-size:.78rem">' +
        '<i class="' + assessmentIcon + '" style="color:' + assessmentColor + '"></i>' +
        '<strong style="color:var(--t1)">' + assessmentLabel + '</strong>' +
        (scoreInfo ? '<span style="color:var(--t2);margin-left:auto">' + scoreInfo + '</span>' : '') +
        '</div>' +
        '<div class="csar-section"><h4>Assessment Details</h4>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem">' +
        '<div class="csa-fg"><label>' + subjectLabel + '</label><input value="' + (csaName||'') + '" readonly style="background:#f8fafc"></div>' +
        '<div class="csa-fg"><label>Store</label><input value="' + (store||'') + '" readonly style="background:#f8fafc"></div>' +
        '<div class="csa-fg"><label>Assessment Date</label><input value="' + dateStr + '" readonly style="background:#f8fafc"></div></div></div>' +
        '<div class="csar-section"><h4>Failed Areas</h4>' +
        failedHTML +
        '<div class="csa-fg"><label>Additional notes (optional)</label><textarea class="nf-input" id="remed-failed" placeholder="Any context or observations about the failed questions…" style="min-height:70px;resize:vertical"></textarea></div></div>' +
        '<div class="csar-section"><h4>Kajabi Tool Session</h4>' +
        '<div class="csa-fg"><label>Was a Kajabi training module completed?</label><select class="nf-input" id="remed-kajabi"><option value="Yes">Yes</option><option value="No">No</option><option value="N/A">N/A</option></select></div>' +
        '<div class="csa-fg"><label>Module completed (if applicable)</label><input class="nf-input" id="remed-module" placeholder="e.g. Customer Greeting Module"></div></div>' +
        '<div class="csar-section"><h4>Post-Module Assessment</h4>' +
        '<div class="csa-fg"><label>Roleplay completed?</label><select class="nf-input" id="remed-roleplay"><option value="Yes">Yes</option><option value="No">No</option></select></div>' +
        '<div class="csa-fg"><label>Improvement areas noted</label><textarea class="nf-input" id="remed-improve" placeholder="Describe areas for improvement..." style="min-height:60px;resize:vertical"></textarea></div>' +
        '<div class="csa-fg"><label>Register updated?</label><select class="nf-input" id="remed-register"><option value="Yes">Yes</option><option value="No">No</option></select></div></div>' +
        '<div class="csar-section"><h4>Coaching Session</h4>' +
        '<div class="csa-fg"><label>Coaching session conducted?</label><select class="nf-input" id="remed-coaching"><option value="Yes">Yes</option><option value="No">No</option></select></div>' +
        '<div class="csa-fg"><label>Coaching notes</label><textarea class="nf-input" id="remed-notes" placeholder="Session notes..." style="min-height:60px;resize:vertical"></textarea></div></div>' +
        '<div class="csar-section"><h4>Regional Trainer</h4>' +
        '<div class="csa-fg"><label>Regional Trainer intervention required?</label><select class="nf-input" id="remed-regional"><option value="No">No</option><option value="Yes">Yes</option></select></div></div>' +
        '<div class="csar-section"><h4>Other Actions</h4>' +
        '<div class="csa-fg"><label>Additional notes or follow-up actions</label><textarea class="nf-input" id="remed-other" placeholder="Any other actions taken or planned..." style="min-height:60px;resize:vertical"></textarea></div></div>' +
        '<div style="display:flex;gap:.5rem;justify-content:flex-end"><button class="csa-btn sec" onclick="closeCSARemed()">Cancel</button><button class="csa-btn pri" id="remed-submit"><i class="fas fa-check"></i> Complete Remediation</button></div>';
}

function getCSARemedScript(csaName, store, date) {
    var eName = (csaName||'').replace(/'/g, "\\'");
    var eStore = (store||'').replace(/'/g, "\\'");
    var eDate = (date||'').replace(/'/g, "\\'");

    // Snapshot failed questions so remediation record contains them
    var submission = csaSubmissions.find(function(s) {
        return s.csaName === csaName && s.store === store && s.date === date && s.remediationRequired;
    });
    var failedSnapshot = [];
    var aType = submission ? (submission.assessmentType || 'csa_forecourt') : 'csa_forecourt';
    if (submission && submission.answers) {
        var atDef = ASSESSMENT_TYPES[aType] || ASSESSMENT_TYPES['csa_forecourt'];
        Object.keys(submission.answers).forEach(function(k) {
            if (submission.answers[k] === false) {
                var qIdx = parseInt(k, 10);
                failedSnapshot.push({ num: qIdx + 1, text: atDef.questions[qIdx] || '' });
            }
        });
        failedSnapshot.sort(function(a, b) { return a.num - b.num; });
    }
    var failedJSON = JSON.stringify(failedSnapshot).replace(/'/g, "\\'");

    return '(function(){' +
        'document.getElementById("remed-submit").addEventListener("click",function(){' +
            'var rec={id:"rem-"+Date.now(),' +
            'csaName:"' + eName + '",store:"' + eStore + '",date:"' + eDate + '",' +
            'assessmentType:"' + aType + '",' +
            'failedQuestions:JSON.parse(\'' + failedJSON + '\'),' +
            'failedAreasNotes:document.getElementById("remed-failed").value,' +
            'kajabi:document.getElementById("remed-kajabi").value,' +
            'module:document.getElementById("remed-module").value,' +
            'roleplay:document.getElementById("remed-roleplay").value,' +
            'improvement:document.getElementById("remed-improve").value,' +
            'register:document.getElementById("remed-register").value,' +
            'coaching:document.getElementById("remed-coaching").value,' +
            'coachingNotes:document.getElementById("remed-notes").value,' +
            'regional:document.getElementById("remed-regional").value,' +
            'otherActions:document.getElementById("remed-other").value,' +
            'completedAt:new Date().toISOString()};' +
            'csaRemediations.push(rec);' +
            'for(var i=0;i<csaSubmissions.length;i++){' +
                'if(csaSubmissions[i].csaName==="' + eName + '"&&csaSubmissions[i].store==="' + eStore + '"&&csaSubmissions[i].date==="' + eDate + '"&&csaSubmissions[i].remediationRequired){' +
                    'csaSubmissions[i].remediationCompleted=true;break;' +
                '}' +
            '}' +
            'csaSave();csaRender();closeCSARemed();' +
            'alert("Remediation completed for ' + eName + '.");' +
        '});' +
    '})();';
}

// ══════════════════════════════════════════
// ── CSA TAB SWITCHING ──
// ══════════════════════════════════════════

function csaShowTab(tab) {
    ['dashboard','roster','frequency','remediations'].forEach(function(t) {
        var panel = document.getElementById('csatab-' + t);
        var btn = document.getElementById('csatab-btn-' + t);
        if (panel) panel.classList.toggle('active', t === tab);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    // Re-render charts when switching to dashboard (canvas needs to be visible)
    if (tab === 'dashboard') {
        var d = csaFiltered();
        csaDonutRender(d);
        csaBarRender(d);
    }
}

function csaUpdateBadges() {
    var activeRoster = csaRoster.filter(function(c) { return c.active !== false; });
    var rosterBadge = document.getElementById('roster-badge');
    if (rosterBadge) {
        rosterBadge.textContent = activeRoster.length;
        rosterBadge.className = 'tab-badge ' + (activeRoster.length ? 'ok' : 'warn');
    }

    // Aggregate overdue across all three assessment types
    var overdue = 0;
    ['csa_forecourt','store_promotions','driveway_appearance'].forEach(function(atype) {
        var fd = freqCalc('', atype);
        overdue += fd.filter(function(f) { return f.status === 'overdue' || f.status === 'never'; }).length;
    });
    var freqBadge = document.getElementById('freq-badge');
    if (freqBadge) {
        freqBadge.textContent = overdue;
        freqBadge.className = 'tab-badge ' + (overdue ? '' : 'ok');
    }

    var pending = csaSubmissions.filter(function(r) { return r.remediationRequired && !r.remediationCompleted; }).length;
    var remedBadge = document.getElementById('remed-badge');
    if (remedBadge) {
        remedBadge.textContent = pending;
        remedBadge.className = 'tab-badge ' + (pending ? 'warn' : 'ok');
    }

    // Ops Hub tab badge
    var tabBadge = document.getElementById('ops-assess-badge');
    if (tabBadge) {
        if (pending > 0) {
            tabBadge.textContent = pending;
            tabBadge.style.display = 'inline-block';
        } else {
            tabBadge.style.display = 'none';
        }
    }
}

// ══════════════════════════════════════════
// ── CSA ROSTER MANAGEMENT ──
// ══════════════════════════════════════════

function rosterCategoryChange() {
    // Show/hide Supervisor checkbox when CSA is selected
    var cat = document.getElementById('roster-category').value;
    var supWrap = document.getElementById('roster-supervisor-wrap');
    if (supWrap) supWrap.style.display = cat === 'csa' ? 'flex' : 'none';
    if (cat !== 'csa') {
        var supCb = document.getElementById('roster-supervisor');
        if (supCb) supCb.checked = false;
    }
}

function rosterAdd() {
    var name = document.getElementById('roster-name').value.trim();
    var store = document.getElementById('roster-store').value;
    var catEl = document.getElementById('roster-category');
    var category = catEl ? catEl.value : 'csa';
    var supEl = document.getElementById('roster-supervisor');
    var isSupervisor = supEl && supEl.checked && category === 'csa';
    if (!name) return alert('Please enter the staff member\'s name.');
    // Duplicate check within same store + category
    var exists = csaRoster.find(function(c) { return c.name.toLowerCase() === name.toLowerCase() && c.store === store && (c.category || 'csa') === category && c.active !== false; });
    if (exists) return alert(name + ' is already in the ' + store + ' ' + STAFF_CATEGORIES[category].label + ' roster.');
    csaRoster.push({
        id: 'r-' + Date.now(),
        name: name,
        store: store,
        category: category,
        supervisor: isSupervisor,
        active: true,
        addedAt: new Date().toISOString()
    });
    csaSave();
    document.getElementById('roster-name').value = '';
    if (supEl) supEl.checked = false;
    csaRender();
}

function rosterRemove(id) {
    var c = csaRoster.find(function(r) { return r.id === id; });
    var label = c ? c.name : 'this staff member';
    if (!confirm('Remove ' + label + ' from the roster?')) return;
    csaRoster = csaRoster.filter(function(c) { return c.id !== id; });
    csaSave();
    csaRender();
}

function rosterRender() {
    var list = document.getElementById('roster-list');
    var empty = document.getElementById('roster-empty');
    var countEl = document.getElementById('roster-count');
    if (!list) return;
    var storeFilter = document.getElementById('roster-f-store') ? document.getElementById('roster-f-store').value : 'Hillcrest';
    var catFilter = document.getElementById('roster-f-category') ? document.getElementById('roster-f-category').value : '';
    // Sync add form store to match filter
    var addStore = document.getElementById('roster-store');
    if (addStore && storeFilter) addStore.value = storeFilter;
    var active = csaRoster.filter(function(c) { return c.active !== false; });
    // Default legacy records without category to 'csa'
    active.forEach(function(c) { if (!c.category) c.category = 'csa'; });
    var filtered = storeFilter ? active.filter(function(c) { return c.store === storeFilter; }) : active;
    if (catFilter) filtered = filtered.filter(function(c) { return c.category === catFilter; });
    if (countEl) countEl.textContent = filtered.length + ' staff member' + (filtered.length !== 1 ? 's' : '') + ' at ' + storeFilter + (catFilter ? ' — ' + STAFF_CATEGORIES[catFilter].label : '');
    if (!filtered.length) {
        list.innerHTML = '';
        if (empty) { empty.style.display = 'block'; empty.textContent = 'No staff at ' + storeFilter + (catFilter ? ' in the ' + STAFF_CATEGORIES[catFilter].label + ' category' : '') + '. Add team members above to start tracking.'; }
        return;
    }
    if (empty) empty.style.display = 'none';

    // Group by category within the selected store
    var categoryOrder = ['management','csa','cashier','kitchen','coffee','merchandising'];
    var html = '';
    html += '<div class="roster-store-group"><div class="roster-store-label"><i class="fas fa-store" style="color:var(--acc)"></i> ' + storeFilter + ' <span class="count">' + filtered.length + '</span></div>';

    categoryOrder.forEach(function(cat) {
        var members = filtered.filter(function(c) { return c.category === cat; });
        if (!members.length) return;
        var catDef = STAFF_CATEGORIES[cat];
        html += '<div style="margin-top:.85rem;margin-bottom:.4rem;display:flex;align-items:center;gap:.5rem">' +
            '<span style="display:inline-flex;align-items:center;gap:.35rem;padding:.25rem .65rem;border-radius:6px;font-size:.7rem;font-weight:700;background:' + catDef.color + '18;color:' + catDef.color + ';text-transform:uppercase;letter-spacing:.04em">' +
            '<i class="' + catDef.icon + '" style="font-size:.65rem"></i>' + catDef.label + '</span>' +
            '<span style="font-size:.7rem;color:var(--t3)">' + members.length + '</span></div>';

        members.forEach(function(c) {
            // Last assessed across all assessment types this person has been assessed with
            var lastAssess = csaSubmissions.filter(function(s) { return s.csaName === c.name && s.store === c.store; })
                .sort(function(a, b) { return new Date(b.date) - new Date(a.date); })[0];
            var lastInfo = lastAssess ? 'Last assessed: ' + new Date(lastAssess.date).toLocaleDateString('en-ZA', {day:'2-digit', month:'short'}) + ' — ' + lastAssess.score + '%' : 'Not yet assessed';
            var eid = c.id.replace(/'/g, "\\'");
            var superBadge = c.supervisor ? '<span style="display:inline-flex;align-items:center;gap:.2rem;padding:.1rem .4rem;border-radius:4px;font-size:.6rem;font-weight:700;background:#fef3c7;color:#92400e;margin-left:.4rem"><i class="fas fa-star" style="font-size:.55rem"></i>SUPERVISOR</span>' : '';
            html += '<div class="roster-card" id="rc-' + c.id + '">' +
                '<div style="flex:1"><div class="rc-name">' + c.name + superBadge + '</div><div class="rc-date">' + lastInfo + '</div></div>' +
                '<div style="display:flex;align-items:center;gap:.35rem">' +
                '<button class="freq-assess-btn" onclick="openCSAForm(\'' + c.store.replace(/'/g, "\\'") + '\')"><i class="fas fa-clipboard-check"></i> Assess</button>' +
                '<button onclick="rosterEdit(\'' + eid + '\')" style="background:none;border:1px solid var(--bdr);color:var(--t2);padding:.25rem .5rem;border-radius:5px;cursor:pointer;font-size:.72rem;font-weight:600;transition:all .15s" title="Edit"><i class="fas fa-pen"></i></button>' +
                '<button class="rc-remove" onclick="rosterRemove(\'' + eid + '\')" title="Remove"><i class="fas fa-times"></i></button>' +
                '</div></div>';
        });
    });
    html += '</div>';
    list.innerHTML = html;
}

var rosterEditingId = null;
function rosterEdit(id) {
    var c = csaRoster.find(function(r) { return r.id === id; });
    if (!c) return;
    rosterEditingId = id;
    var card = document.getElementById('rc-' + id);
    if (!card) return;
    var cat = c.category || 'csa';
    var catOpts = Object.keys(STAFF_CATEGORIES).map(function(k) {
        return '<option value="' + k + '"' + (cat === k ? ' selected' : '') + '>' + STAFF_CATEGORIES[k].label + '</option>';
    }).join('');
    var stores = ['Hillcrest','Hammersdale','Gillits','Cato Ridge'];
    var storeOpts = stores.map(function(s) { return '<option value="' + s + '"' + (c.store === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    card.classList.add('editing');
    card.innerHTML =
        '<div style="flex:1">' +
        '<div class="roster-edit-bar" style="border-top:none;margin-top:0;padding-top:0;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:140px"><label style="display:block;font-size:.65rem;font-weight:600;color:var(--t3);text-transform:uppercase;margin-bottom:.2rem">Name</label><input id="re-name" value="' + c.name.replace(/"/g, '&quot;') + '" style="width:100%"></div>' +
        '<div><label style="display:block;font-size:.65rem;font-weight:600;color:var(--t3);text-transform:uppercase;margin-bottom:.2rem">Store</label><select id="re-store">' + storeOpts + '</select></div>' +
        '<div><label style="display:block;font-size:.65rem;font-weight:600;color:var(--t3);text-transform:uppercase;margin-bottom:.2rem">Category</label><select id="re-category" onchange="rosterEditCatChange()">' + catOpts + '</select></div>' +
        '<div id="re-sup-wrap" style="display:' + (cat==='csa'?'flex':'none') + ';align-items:center;gap:.3rem;padding-top:1rem"><input type="checkbox" id="re-supervisor" ' + (c.supervisor?'checked':'') + ' style="width:15px;height:15px;cursor:pointer;accent-color:var(--acc)"><label for="re-supervisor" style="font-size:.75rem;font-weight:600;color:var(--t1);cursor:pointer">Supervisor</label></div>' +
        '<button onclick="rosterSaveEdit()" style="background:var(--ok);color:#fff"><i class="fas fa-check"></i> Save</button>' +
        '<button onclick="rosterCancelEdit()" style="background:#f1f5f9;color:var(--t2)">Cancel</button>' +
        '</div></div>';
}

function rosterEditCatChange() {
    var cat = document.getElementById('re-category').value;
    var wrap = document.getElementById('re-sup-wrap');
    if (wrap) wrap.style.display = cat === 'csa' ? 'flex' : 'none';
    if (cat !== 'csa') {
        var cb = document.getElementById('re-supervisor');
        if (cb) cb.checked = false;
    }
}

function rosterSaveEdit() {
    if (!rosterEditingId) return;
    var name = document.getElementById('re-name').value.trim();
    var store = document.getElementById('re-store').value;
    var category = document.getElementById('re-category').value;
    var isSupervisor = document.getElementById('re-supervisor') ? document.getElementById('re-supervisor').checked && category === 'csa' : false;
    if (!name) return alert('Name cannot be empty.');
    var c = csaRoster.find(function(r) { return r.id === rosterEditingId; });
    if (c) {
        // Update name/store in existing submissions if they changed
        if (c.name !== name || c.store !== store) {
            csaSubmissions.forEach(function(s) {
                if (s.csaName === c.name && s.store === c.store) {
                    s.csaName = name;
                    s.store = store;
                }
            });
        }
        c.name = name;
        c.store = store;
        c.category = category;
        c.supervisor = isSupervisor;
    }
    rosterEditingId = null;
    csaSave(); csaRender();
}

function rosterCancelEdit() {
    rosterEditingId = null;
    rosterRender();
}

// ══════════════════════════════════════════
// ── FREQUENCY TRACKER ──
// ══════════════════════════════════════════

// freqCalc builds tracking rows based on the selected assessment type.
// - 'individual' trackBy: one row per eligible staff member
// - 'site' trackBy: one row per store (Driveway Appearance)
function freqCalc(storeFilter, assessmentType) {
    var atype = assessmentType || 'csa_forecourt';
    var at = ASSESSMENT_TYPES[atype];
    if (!at) return [];
    var now = new Date();
    var threshold = at.frequencyDays || 30;
    var dueSoonBuffer = Math.max(3, Math.round(threshold * 0.2));

    function statusFor(daysSince) {
        if (daysSince === null) return 'never';
        if (daysSince > threshold) return 'overdue';
        if (daysSince >= threshold - dueSoonBuffer) return 'due-soon';
        return 'current';
    }

    if (at.trackBy === 'site') {
        var stores = ['Hillcrest','Hammersdale','Gillits','Cato Ridge'];
        var list = storeFilter ? [storeFilter] : stores;
        return list.map(function(s) {
            var subs = csaSubmissions.filter(function(sub) { return sub.assessmentType === atype && sub.store === s; })
                .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
            var last = subs[0] || null;
            var daysSince = last ? Math.floor((now - new Date(last.date)) / 86400000) : null;
            return {
                id: 'site-' + s, name: s + ' (Site)', store: s, category: '—', supervisor: false,
                lastDate: last ? last.date : null, lastScore: last ? last.score : null,
                daysSince: daysSince, status: statusFor(daysSince),
                threshold: threshold, trackBy: 'site'
            };
        });
    }

    var eligible = csaRoster.filter(function(c) {
        if (c.active === false) return false;
        if (storeFilter && c.store !== storeFilter) return false;
        var cat = c.category || 'csa';
        if (at.eligibleCategories.indexOf(cat) === -1) return false;
        if (at.supervisorOnly && cat === 'csa' && !c.supervisor) return false;
        return true;
    });

    return eligible.map(function(c) {
        var subs = csaSubmissions.filter(function(s) { return s.csaName === c.name && s.store === c.store && s.assessmentType === atype; })
            .sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
        var last = subs[0] || null;
        var daysSince = last ? Math.floor((now - new Date(last.date)) / 86400000) : null;
        return {
            id: c.id, name: c.name, store: c.store, category: c.category || 'csa', supervisor: !!c.supervisor,
            lastDate: last ? last.date : null, lastScore: last ? last.score : null,
            daysSince: daysSince, status: statusFor(daysSince),
            threshold: threshold, trackBy: 'individual'
        };
    });
}

function freqRender() {
    var storeFilter = document.getElementById('freq-f-store') ? document.getElementById('freq-f-store').value : '';
    var atype = document.getElementById('freq-f-type') ? document.getElementById('freq-f-type').value : 'csa_forecourt';
    var at = ASSESSMENT_TYPES[atype];
    var data = freqCalc(storeFilter, atype);
    var tbody = document.getElementById('freq-tbody');
    var empty = document.getElementById('freq-empty');
    var countEl = document.getElementById('freq-count');
    var kpiEl = document.getElementById('freq-kpi');
    var cfgEl = document.getElementById('freq-cfg-info');
    if (!tbody) return;

    if (cfgEl && at) {
        var mode = at.trackBy === 'site' ? 'Per site' : 'Per individual';
        cfgEl.innerHTML = '<i class="' + at.icon + '" style="color:' + at.color + '"></i> <strong style="color:var(--t1)">' + at.label + '</strong> · Cycle: <strong>' + at.frequencyDays + ' days</strong> · Mode: <strong>' + mode + '</strong> · <button onclick="freqEditCycle()" style="background:none;border:none;color:var(--acc);font-size:.72rem;font-weight:600;cursor:pointer;padding:0;text-decoration:underline">Change cycle</button>';
    }

    var total = data.length;
    var current = data.filter(function(f) { return f.status === 'current'; }).length;
    var dueSoon = data.filter(function(f) { return f.status === 'due-soon'; }).length;
    var overdue = data.filter(function(f) { return f.status === 'overdue' || f.status === 'never'; }).length;
    var unitLabel = at && at.trackBy === 'site' ? 'Sites' : 'Staff';
    if (kpiEl) {
        kpiEl.innerHTML =
            '<div class="freq-kpi"><div class="fk-label">Total ' + unitLabel + '</div><div class="fk-value">' + total + '</div></div>' +
            '<div class="freq-kpi"><div class="fk-label">Up to Date</div><div class="fk-value" style="color:var(--ok)">' + current + '</div></div>' +
            '<div class="freq-kpi"><div class="fk-label">Due Soon</div><div class="fk-value" style="color:' + (dueSoon ? 'var(--warn)' : 'var(--ok)') + '">' + dueSoon + '</div></div>' +
            '<div class="freq-kpi"><div class="fk-label">Overdue</div><div class="fk-value" style="color:' + (overdue ? 'var(--err)' : 'var(--ok)') + '">' + overdue + '</div></div>';
    }
    if (countEl) countEl.textContent = total + ' ' + (at && at.trackBy === 'site' ? 'site' : 'staff member') + (total !== 1 ? 's' : '') + ' tracked';

    if (!data.length) {
        tbody.innerHTML = '';
        if (empty) { empty.style.display = 'block'; empty.textContent = at.trackBy === 'site' ? 'No sites to track.' : 'No eligible staff at ' + (storeFilter || 'any store') + ' for this assessment type. Add staff via the Staff Roster tab.'; }
        return;
    }
    if (empty) empty.style.display = 'none';

    var order = {never: 0, overdue: 1, 'due-soon': 2, current: 3};
    data.sort(function(a, b) { return (order[a.status] || 99) - (order[b.status] || 99); });

    tbody.innerHTML = data.map(function(f) {
        var dateStr = f.lastDate ? new Date(f.lastDate).toLocaleDateString('en-ZA', {day:'2-digit', month:'short', year:'numeric'}) : '\u2014';
        var daysStr = f.daysSince !== null ? f.daysSince + ' day' + (f.daysSince !== 1 ? 's' : '') : '\u2014';
        var statusMap = {
            current: '<span class="freq-status current"><i class="fas fa-check-circle"></i> Up to Date</span>',
            'due-soon': '<span class="freq-status due-soon"><i class="fas fa-clock"></i> Due Soon</span>',
            overdue: '<span class="freq-status overdue"><i class="fas fa-exclamation-triangle"></i> Overdue</span>',
            never: '<span class="freq-status never"><i class="fas fa-exclamation-circle"></i> Never Assessed</span>'
        };
        var scoreStr = f.lastScore !== null ? '<span style="font-weight:700;color:' + (f.lastScore >= 80 ? 'var(--ok)' : f.lastScore >= 70 ? 'var(--warn)' : 'var(--err)') + '">' + f.lastScore + '%</span>' : '\u2014';
        var catBadge = '';
        if (f.category && f.category !== '—' && STAFF_CATEGORIES[f.category]) {
            var catDef = STAFF_CATEGORIES[f.category];
            var supMark = f.supervisor ? ' ⭐' : '';
            catBadge = '<span style="display:inline-block;padding:.15rem .4rem;border-radius:4px;font-size:.6rem;font-weight:700;background:' + catDef.color + '18;color:' + catDef.color + ';margin-left:.4rem">' + catDef.shortLabel + supMark + '</span>';
        }
        return '<tr>' +
            '<td style="font-weight:600">' + f.name + catBadge + '</td>' +
            '<td style="color:var(--t2)">' + f.store + '</td>' +
            '<td style="color:var(--t3)">' + dateStr + '</td>' +
            '<td style="color:var(--t2)">' + daysStr + '</td>' +
            '<td>' + (statusMap[f.status] || '') + '</td>' +
            '<td>' + scoreStr + '</td>' +
            '<td><button class="freq-assess-btn" onclick="openCSAFormTyped(\'' + f.store.replace(/'/g, "\\'") + '\',\'' + atype + '\')"><i class="fas fa-clipboard-check"></i> Assess</button></td>' +
        '</tr>';
    }).join('');
}

// Edit the frequency cycle for the current assessment type
function freqEditCycle() {
    var atype = document.getElementById('freq-f-type') ? document.getElementById('freq-f-type').value : 'csa_forecourt';
    var at = ASSESSMENT_TYPES[atype];
    if (!at) return;
    var input = prompt('Set assessment cycle (days) for ' + at.label + '\n\nHow often should this assessment be conducted?\nCurrent: ' + at.frequencyDays + ' days', at.frequencyDays);
    if (input === null) return;
    var days = parseInt(input, 10);
    if (isNaN(days) || days < 1 || days > 365) { alert('Please enter a number between 1 and 365.'); return; }
    at.frequencyDays = days;
    try {
        var overrides = {};
        try { var raw = localStorage.getItem('assessment_cycles'); if (raw) overrides = JSON.parse(raw); } catch(e) {}
        overrides[atype] = days;
        localStorage.setItem('assessment_cycles', JSON.stringify(overrides));
    } catch(e) {}
    freqRender();
}

// Load any saved cycle overrides on startup
(function loadCycleOverrides() {
    try {
        var raw = localStorage.getItem('assessment_cycles');
        if (!raw) return;
        var overrides = JSON.parse(raw);
        Object.keys(overrides).forEach(function(k) {
            if (ASSESSMENT_TYPES[k] && typeof overrides[k] === 'number') {
                ASSESSMENT_TYPES[k].frequencyDays = overrides[k];
            }
        });
    } catch(e) {}
})();

// ══════════════════════════════════════════
// ── REMEDIATIONS TAB ──
// ══════════════════════════════════════════

function remedRender() {
    var storeFilter = document.getElementById('remed-f-store') ? document.getElementById('remed-f-store').value : '';
    var allPending = csaSubmissions.filter(function(r) { return r.remediationRequired && !r.remediationCompleted; });
    var allCompleted = csaSubmissions.filter(function(r) { return r.remediationRequired && r.remediationCompleted; });
    var pending = storeFilter ? allPending.filter(function(r) { return r.store === storeFilter; }) : allPending;
    var completed = storeFilter ? allCompleted.filter(function(r) { return r.store === storeFilter; }) : allCompleted;
    var tbody = document.getElementById('remed-tbody');
    var empty = document.getElementById('remed-empty');
    var countEl = document.getElementById('remed-count');
    var kpiEl = document.getElementById('remed-kpi');
    if (!tbody) return;

    // KPI
    if (kpiEl) {
        var stores = ['Hillcrest','Hammersdale','Gillits','Cato Ridge'];
        var storeBreakdown = stores.map(function(s) {
            var cnt = allPending.filter(function(r) { return r.store === s; }).length;
            return cnt ? '<span style="font-size:.75rem;color:var(--t2)">' + s + ': <strong style="color:' + (cnt ? 'var(--warn)' : 'var(--ok)') + '">' + cnt + '</strong></span>' : '';
        }).filter(Boolean).join(' &nbsp;·&nbsp; ');
        kpiEl.innerHTML =
            '<div class="freq-kpi"><div class="fk-label">Pending</div><div class="fk-value" style="color:' + (pending.length ? 'var(--warn)' : 'var(--ok)') + '">' + pending.length + '</div></div>' +
            '<div class="freq-kpi"><div class="fk-label">Completed</div><div class="fk-value" style="color:var(--ok)">' + completed.length + '</div></div>' +
            '<div class="freq-kpi"><div class="fk-label">Total Flagged</div><div class="fk-value">' + (pending.length + completed.length) + '</div></div>' +
            (storeBreakdown ? '<div class="freq-kpi" style="grid-column:span 1"><div class="fk-label">By Store</div><div style="margin-top:.35rem">' + storeBreakdown + '</div></div>' : '');
    }
    if (countEl) countEl.textContent = pending.length + ' outstanding';

    if (!pending.length) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = pending.map(function(r) {
        var date = r.date ? new Date(r.date).toLocaleDateString('en-ZA', {day:'2-digit', month:'short', year:'numeric'}) : '\u2014';
        var col = Number(r.score) >= 80 ? 'var(--ok)' : Number(r.score) >= 70 ? 'var(--warn)' : 'var(--err)';
        var esc = function(s) { return (s||'').replace(/'/g, "\\'"); };
        var atDef = ASSESSMENT_TYPES[r.assessmentType] || ASSESSMENT_TYPES['csa_forecourt'];
        var typeBadge = '<span style="display:inline-flex;align-items:center;gap:.2rem;padding:.2rem .45rem;border-radius:5px;font-size:.58rem;font-weight:700;background:' + atDef.color + '12;color:' + atDef.color + ';white-space:nowrap"><i class="' + atDef.icon + '" style="font-size:.5rem"></i>' + atDef.shortLabel + '</span>';
        return '<tr>' +
            '<td style="font-weight:600">' + (r.csaName||'\u2014') + '</td>' +
            '<td>' + typeBadge + '</td>' +
            '<td style="color:var(--t2)">' + (r.store||'\u2014') + '</td>' +
            '<td style="color:var(--t3)">' + date + '</td>' +
            '<td><span style="font-weight:700;color:' + col + '">' + (r.score||0) + '%</span></td>' +
            '<td style="color:var(--t2)">' + (r.noCount||0) + ' No answers</td>' +
            '<td style="color:var(--t2);font-size:.8rem">' + (r.assessor||'\u2014') + '</td>' +
            '<td><button onclick="openCSARemed(\'' + esc(r.csaName) + '\',\'' + esc(r.store) + '\',\'' + esc(r.date) + '\')" style="background:#fef3c7;color:#92400e;border:1.5px solid #fde68a;padding:.3rem .7rem;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:700;display:inline-flex;align-items:center;gap:.25rem"><i class="fas fa-first-aid"></i> Remediate</button></td>' +
        '</tr>';
    }).join('');
}

// ══════════════════════════════════════════════════════════
// ── DAILY SITE SUPERVISOR CHECKLIST ──
// ══════════════════════════════════════════════════════════
// Completed daily by Managers / CSA Supervisors. Deadline 11:59 AM.
// Structure matches Astron's Daily Site Supervisor Checklist V5.

const DAILY_CHECKLIST_CONFIG = {
    deadlineHour: 11,
    deadlineMinute: 59,
    equipment: [
        'Retail dispensing pumps turned ON and fully functioning',
        'Payment24 Terminal is live and operational',
        'Driveway clean, well-maintained, free from litter / oil spills',
        'Forecourt well-lit (canopy lights, pole lights working)',
        'Shop and promotion signage correctly displayed',
        'Waste bins emptied, clean, not overflowing',
        'Fire extinguishers in place, unobstructed, seals intact',
        'First aid kit stocked and accessible',
        'Spill kit stocked and accessible',
        'Forecourt floor (concrete/tiles) free of cracks/trip hazards',
        'No fuel leaks under / around pumps or tanks',
        'Safety signage visible (No smoking, Turn off engines, etc.)',
        'Public restrooms clean, stocked, maintained',
        'Emergency contact numbers displayed at till'
    ],
    duties: [
        'Pump readings captured on handover sheet',
        'Cash-up / cash drop completed and signed',
        'Shift handover book signed by outgoing & incoming',
        'CCTV operational — no offline cameras',
        'Alarm / panic system tested',
        'All outgoing cash deposits logged',
        'Fuel stock sticks taken, reconciled with Infinity',
        'Fuel delivery notes filed (if delivery received)',
        'Site register (visitors/contractors) up to date',
        'Incident / near-miss register reviewed',
        'Dip readings (morning) recorded',
        'Variance report reviewed (yesterday)',
        'Next shift briefed on outstanding items'
    ],
    ppe: [
        'Reflective vests worn by all forecourt staff',
        'Safety shoes worn by all on-site staff',
        'Name badges worn and visible',
        'Uniforms clean, presentable, compliant',
        'Gloves available at pumps (disposable)',
        'Hand sanitiser available at till / pumps',
        'Eye-wash station unobstructed and functional',
        'Fire blanket in kitchen (FreshStop) — clean and accessible',
        'Kitchen staff wearing hairnets / hats where required',
        'Food-handler certificates displayed (FreshStop)',
        'Slip-resistant mats at till / FreshStop counter',
        'Cleaning chemicals labelled & stored correctly',
        'MSDS (chemical safety sheets) available on site'
    ],
    toolboxTopics: [
        'Fire safety & extinguisher use',
        'Spill response (fuel / chemical)',
        'Customer service standards',
        'Slip / trip / fall prevention',
        'Robbery & panic procedure',
        'Product knowledge (fuel grades, Quartech)',
        'FreshStop food hygiene',
        'Other'
    ]
};

let dailyChecklists = [];

// ── DC Storage ──
async function dcLoad() {
    try {
        if (window.storage) {
            const r = await window.storage.get('daily_checklists', true);
            dailyChecklists = r ? JSON.parse(r.value) : [];
        } else {
            const s = localStorage.getItem('daily_checklists');
            dailyChecklists = s ? JSON.parse(s) : [];
        }
    } catch(e) { dailyChecklists = []; }
    dcRenderToday();
    dcRenderHistory();
    dcUpdateBadge();
}

async function dcSave() {
    try {
        var j = JSON.stringify(dailyChecklists);
        if (window.storage) await window.storage.set('daily_checklists', j, true);
        else localStorage.setItem('daily_checklists', j);
    } catch(e) {}
}

// ── DC Helpers ──
function dcTodayStr() {
    var d = new Date();
    return d.toISOString().split('T')[0];
}

function dcIsLate() {
    var now = new Date();
    return now.getHours() > DAILY_CHECKLIST_CONFIG.deadlineHour ||
           (now.getHours() === DAILY_CHECKLIST_CONFIG.deadlineHour && now.getMinutes() > DAILY_CHECKLIST_CONFIG.deadlineMinute);
}

function dcGetTodayRecord(store) {
    var today = dcTodayStr();
    return dailyChecklists.find(function(r) { return r.store === store && r.date === today; });
}

// Managers + CSA Supervisors are eligible to complete the checklist
function dcEligibleManagers(store) {
    return csaRoster.filter(function(c) {
        if (c.active === false) return false;
        if (c.store !== store) return false;
        var cat = c.category || 'csa';
        if (cat === 'management') return true;
        if (cat === 'csa' && c.supervisor) return true;
        return false;
    });
}

// ── DC Today Status Grid ──
function dcRenderToday() {
    var grid = document.getElementById('dc-today-grid');
    if (!grid) return;
    var stores = ['Hillcrest','Hammersdale','Gillits','Cato Ridge'];
    var html = stores.map(function(store) {
        var rec = dcGetTodayRecord(store);
        var late = dcIsLate();
        var cardClass = 'dc-today-card';
        var statusHtml = '';
        var btn = '';
        if (rec) {
            cardClass += rec.wasLate ? ' late' : ' done';
            statusHtml = rec.wasLate
                ? '<span class="dc-today-status late"><i class="fas fa-exclamation-circle"></i> Completed Late</span>'
                : '<span class="dc-today-status done"><i class="fas fa-check-circle"></i> Completed</span>';
            var subTime = new Date(rec.submittedAt);
            var timeStr = subTime.toLocaleTimeString('en-ZA', {hour:'2-digit', minute:'2-digit'});
            statusHtml += '<span class="dc-today-meta">by ' + rec.supervisor + ' at ' + timeStr + '</span>';
            btn = '<button class="dc-today-btn view" onclick="dcOpenView(\'' + rec.id + '\')"><i class="fas fa-eye"></i> View</button>';
        } else if (late) {
            cardClass += ' missed';
            statusHtml = '<span class="dc-today-status missed"><i class="fas fa-times-circle"></i> Missed Deadline</span>';
            statusHtml += '<span class="dc-today-meta">Deadline was 11:59 AM</span>';
            btn = '<button class="dc-today-btn fill" onclick="openDC(\'' + store + '\')"><i class="fas fa-tasks"></i> Complete Now (Late)</button>';
        } else {
            statusHtml = '<span class="dc-today-status pending"><i class="fas fa-clock"></i> Pending</span>';
            var now = new Date();
            var hoursLeft = DAILY_CHECKLIST_CONFIG.deadlineHour - now.getHours();
            var minsLeft = DAILY_CHECKLIST_CONFIG.deadlineMinute - now.getMinutes();
            if (minsLeft < 0) { hoursLeft--; minsLeft += 60; }
            statusHtml += '<span class="dc-today-meta">Due in ' + hoursLeft + 'h ' + minsLeft + 'm</span>';
            btn = '<button class="dc-today-btn fill" onclick="openDC(\'' + store + '\')"><i class="fas fa-tasks"></i> Fill In</button>';
        }
        return '<div class="' + cardClass + '"><div class="dc-today-store"><i class="fas fa-store"></i>' + store + '</div>' + statusHtml + btn + '</div>';
    }).join('');
    grid.innerHTML = html;
}

// ── DC History Table ──
function dcRenderHistory() {
    var tbody = document.getElementById('dc-history-tbody');
    var empty = document.getElementById('dc-history-empty');
    var countEl = document.getElementById('dc-history-count');
    if (!tbody) return;
    var storeFilter = document.getElementById('dc-f-store') ? document.getElementById('dc-f-store').value : '';
    var data = dailyChecklists.slice();
    if (storeFilter) data = data.filter(function(r) { return r.store === storeFilter; });
    data.sort(function(a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
    if (countEl) countEl.textContent = data.length + ' record' + (data.length !== 1 ? 's' : '');
    if (!data.length) {
        tbody.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = data.slice(0, 100).map(function(r) {
        var totalItems = DAILY_CHECKLIST_CONFIG.equipment.length + DAILY_CHECKLIST_CONFIG.duties.length + DAILY_CHECKLIST_CONFIG.ppe.length;
        var yesCount = 0;
        ['equipment','duties','ppe'].forEach(function(sec) {
            Object.values(r[sec] || {}).forEach(function(v) { if (v === true) yesCount++; });
        });
        var pct = Math.round(yesCount / totalItems * 100);
        var pctColor = pct >= 90 ? 'var(--ok)' : pct >= 75 ? 'var(--warn)' : 'var(--err)';
        var lateFlag = r.wasLate ? '<span style="display:inline-block;padding:.1rem .4rem;border-radius:4px;font-size:.6rem;font-weight:700;background:#fef3c7;color:#92400e;margin-left:.35rem">LATE</span>' : '';
        var dateStr = new Date(r.date).toLocaleDateString('en-ZA', {weekday:'short', day:'2-digit', month:'short', year:'numeric'});
        return '<tr>' +
            '<td style="font-weight:600">' + dateStr + lateFlag + '</td>' +
            '<td style="color:var(--t2)">' + r.store + '</td>' +
            '<td style="color:var(--t2)">' + r.supervisor + '</td>' +
            '<td style="color:' + pctColor + ';font-weight:700">' + pct + '%</td>' +
            '<td style="color:var(--t3);font-size:.75rem">' + (r.toolboxTopic || '\u2014') + '</td>' +
            '<td><button class="dc-today-btn view" onclick="dcOpenView(\'' + r.id + '\')"><i class="fas fa-eye"></i> View</button></td>' +
        '</tr>';
    }).join('');
}

// ── DC Badge Update (today's pending count) ──
function dcUpdateBadge() {
    var stores = ['Hillcrest','Hammersdale','Gillits','Cato Ridge'];
    var today = dcTodayStr();
    var pending = 0;
    stores.forEach(function(s) {
        var rec = dailyChecklists.find(function(r) { return r.store === s && r.date === today; });
        if (!rec) pending++;
    });
    var badge = document.getElementById('ops-dc-badge');
    if (badge) {
        if (pending > 0) {
            badge.textContent = pending;
            badge.style.display = 'inline-block';
            badge.style.background = dcIsLate() ? 'var(--err)' : 'var(--warn)';
        } else {
            badge.style.display = 'none';
        }
    }
}

// ── DC Form Modal (Open / Close / Render) ──
function openDC(store) {
    var existing = dcGetTodayRecord(store);
    if (existing) {
        alert('The daily checklist for ' + store + ' has already been completed today by ' + existing.supervisor + '.');
        return;
    }
    var eligible = dcEligibleManagers(store);
    if (!eligible.length) {
        alert('No Managers or CSA Supervisors in the roster for ' + store + '.\n\nPlease add one via the Staff Roster tab first.');
        return;
    }
    var bd = document.getElementById('dc-form-modal-bd');
    if (!bd) return;
    document.getElementById('dc-form-body').innerHTML = dcBuildFormHTML(store, eligible);
    bd.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDC() {
    var bd = document.getElementById('dc-form-modal-bd');
    if (bd) bd.classList.remove('open');
    document.body.style.overflow = '';
}

function dcBuildFormHTML(store, eligible) {
    var supervisorOpts = '<option value="">Select supervisor...</option>' +
        eligible.map(function(c) {
            var role = c.category === 'management' ? 'Manager' : 'CSA Supervisor';
            return '<option value="' + c.name.replace(/"/g, '&quot;') + '">' + c.name + ' (' + role + ')</option>';
        }).join('');

    function buildItems(items, sec) {
        return items.map(function(label, i) {
            return '<div class="dc-item">' +
                '<span class="dc-item-label">' + (i+1) + '. ' + label + '</span>' +
                '<div class="dc-yn">' +
                '<button type="button" class="yes" onclick="dcToggle(this,\'' + sec + '\',' + i + ',true)">Y</button>' +
                '<button type="button" class="no" onclick="dcToggle(this,\'' + sec + '\',' + i + ',false)">N</button>' +
                '</div></div>';
        }).join('');
    }

    var topicOpts = DAILY_CHECKLIST_CONFIG.toolboxTopics.map(function(t, i) {
        return '<label class="dc-topic-opt"><input type="radio" name="dc-topic" value="' + t + '" onchange="dcTopicSelect(this)"><span>' + t + '</span></label>';
    }).join('');

    var todayDisplay = new Date().toLocaleDateString('en-ZA', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
    var nowTime = new Date().toLocaleTimeString('en-ZA', {hour:'2-digit', minute:'2-digit'});

    return '<div style="padding:1.25rem 1.5rem;background:#fff7ed;border-bottom:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">' +
        '<div><div style="font-size:.9rem;font-weight:700;color:var(--t1);margin-bottom:.15rem"><i class="fas fa-store" style="color:var(--acc);margin-right:.35rem"></i>' + store + '</div>' +
        '<div style="font-size:.75rem;color:var(--t3)">' + todayDisplay + ' · Started ' + nowTime + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:.75rem;font-size:.75rem;color:var(--t2)"><i class="fas fa-clock"></i> Deadline: <strong style="color:' + (dcIsLate()?'var(--err)':'var(--warn)') + '">11:59 AM</strong></div>' +
        '</div>' +
        '<div style="padding:1.25rem 1.5rem">' +
        '<div class="dc-section">' +
        '<div class="dc-section-title"><i class="fas fa-clipboard-check"></i> Core Checklist</div>' +
        '<div class="dc-col-grid">' +
        '<div class="dc-col"><h5>Equipment / Environment</h5>' + buildItems(DAILY_CHECKLIST_CONFIG.equipment, 'equipment') + '</div>' +
        '<div class="dc-col"><h5>Duties Before Hand-over</h5>' + buildItems(DAILY_CHECKLIST_CONFIG.duties, 'duties') + '</div>' +
        '<div class="dc-col"><h5>PPE / Safety Equipment</h5>' + buildItems(DAILY_CHECKLIST_CONFIG.ppe, 'ppe') + '</div>' +
        '</div></div>' +

        '<div class="dc-section">' +
        '<div class="dc-section-title purple"><i class="fas fa-people-group"></i> Morning Huddle</div>' +
        '<div class="dc-huddle-grid">' +
        '<div class="dc-field"><label>Toolbox Topic *</label><div class="dc-topic-grid">' + topicOpts + '</div><input type="text" id="dc-topic-other" placeholder="Specify if Other..." style="display:none;margin-top:.4rem"></div>' +
        '<div class="dc-field"><label>Key Discussion Points</label><textarea id="dc-huddle-notes" placeholder="Briefly summarise what was discussed..."></textarea></div>' +
        '</div>' +
        '<div style="margin-top:.85rem"><label style="display:block;font-size:.72rem;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Attendees (name + role)</label>' +
        '<div id="dc-attendants"><div class="dc-attendant-row"><input class="dc-att-name" placeholder="Staff name" value=""><input class="dc-att-role" placeholder="Role (e.g. CSA)" value=""><button type="button" onclick="dcRemoveAttendant(this)"><i class="fas fa-times"></i></button></div></div>' +
        '<button type="button" class="dc-add-attendant" onclick="dcAddAttendant()"><i class="fas fa-plus"></i> Add attendee</button>' +
        '</div></div>' +

        '<div class="dc-section">' +
        '<div class="dc-section-title"><i class="fas fa-user-check"></i> Sign-off</div>' +
        '<div class="dc-huddle-grid">' +
        '<div class="dc-field"><label>Supervisor *</label><select id="dc-supervisor">' + supervisorOpts + '</select></div>' +
        '<div class="dc-field"><label>Additional Comments</label><textarea id="dc-signoff-notes" placeholder="Any outstanding issues, notes for next shift, etc..."></textarea></div>' +
        '</div></div>' +

        '<div class="dc-submit-bar">' +
        '<button class="sec" onclick="closeDC()">Cancel</button>' +
        '<button class="pri" onclick="dcSubmit(\'' + store + '\')"><i class="fas fa-paper-plane"></i> Submit Checklist</button>' +
        '</div>' +
        '</div>';
}

// Form interaction helpers
var dcAnswers = { equipment: {}, duties: {}, ppe: {} };

function dcToggle(btn, section, idx, val) {
    var row = btn.closest('.dc-yn');
    row.querySelectorAll('button').forEach(function(b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
    if (!dcAnswers[section]) dcAnswers[section] = {};
    dcAnswers[section][idx] = val;
}

function dcTopicSelect(radio) {
    var otherInput = document.getElementById('dc-topic-other');
    if (radio.value === 'Other') {
        otherInput.style.display = 'block';
        otherInput.focus();
    } else {
        otherInput.style.display = 'none';
        otherInput.value = '';
    }
    document.querySelectorAll('.dc-topic-opt').forEach(function(el) { el.classList.remove('sel'); });
    radio.closest('.dc-topic-opt').classList.add('sel');
}

function dcAddAttendant() {
    var wrap = document.getElementById('dc-attendants');
    var row = document.createElement('div');
    row.className = 'dc-attendant-row';
    row.innerHTML = '<input class="dc-att-name" placeholder="Staff name"><input class="dc-att-role" placeholder="Role (e.g. CSA)"><button type="button" onclick="dcRemoveAttendant(this)"><i class="fas fa-times"></i></button>';
    wrap.appendChild(row);
}

function dcRemoveAttendant(btn) {
    var rows = document.querySelectorAll('#dc-attendants .dc-attendant-row');
    if (rows.length <= 1) { alert('At least one attendee is required.'); return; }
    btn.closest('.dc-attendant-row').remove();
}

function dcSubmit(store) {
    dcAnswers = { equipment: {}, duties: {}, ppe: {} };
    document.querySelectorAll('#dc-form-body .dc-yn button.sel').forEach(function(b) {
        var row = b.closest('.dc-item');
        var label = row.querySelector('.dc-item-label').textContent;
    });
    // Reconstruct from DOM
    ['equipment','duties','ppe'].forEach(function(sec) {
        DAILY_CHECKLIST_CONFIG[sec].forEach(function(_, i) { dcAnswers[sec][i] = null; });
    });
    document.querySelectorAll('#dc-form-body .dc-item').forEach(function(item) {
        var sel = item.querySelector('.dc-yn button.sel');
        if (!sel) return;
        var onclickAttr = sel.getAttribute('onclick') || '';
        var m = onclickAttr.match(/dcToggle\(this,'([^']+)',(\d+),(true|false)\)/);
        if (m) dcAnswers[m[1]][parseInt(m[2])] = m[3] === 'true';
    });

    // Validate all items answered
    var allSections = ['equipment','duties','ppe'];
    for (var si = 0; si < allSections.length; si++) {
        var sec = allSections[si];
        for (var ii = 0; ii < DAILY_CHECKLIST_CONFIG[sec].length; ii++) {
            if (dcAnswers[sec][ii] === null || dcAnswers[sec][ii] === undefined) {
                alert('Please complete all checklist items. Missing answer in ' + sec.toUpperCase() + ' (item ' + (ii+1) + ').');
                return;
            }
        }
    }

    // Topic
    var topicRadio = document.querySelector('input[name="dc-topic"]:checked');
    if (!topicRadio) { alert('Please select a toolbox topic.'); return; }
    var topic = topicRadio.value;
    if (topic === 'Other') {
        var otherVal = document.getElementById('dc-topic-other').value.trim();
        if (!otherVal) { alert('Please specify the toolbox topic.'); return; }
        topic = 'Other: ' + otherVal;
    }

    // Supervisor
    var supervisor = document.getElementById('dc-supervisor').value;
    if (!supervisor) { alert('Please select the supervisor.'); return; }

    // Attendees
    var attendees = [];
    document.querySelectorAll('#dc-attendants .dc-attendant-row').forEach(function(row) {
        var n = row.querySelector('.dc-att-name').value.trim();
        var r = row.querySelector('.dc-att-role').value.trim();
        if (n) attendees.push({ name: n, role: r });
    });
    if (!attendees.length) { alert('Please add at least one attendee.'); return; }

    var huddleNotes = document.getElementById('dc-huddle-notes').value.trim();
    var signoffNotes = document.getElementById('dc-signoff-notes').value.trim();

    var now = new Date();
    var wasLate = dcIsLate();
    var rec = {
        id: 'dc-' + Date.now(),
        store: store,
        date: dcTodayStr(),
        supervisor: supervisor,
        equipment: dcAnswers.equipment,
        duties: dcAnswers.duties,
        ppe: dcAnswers.ppe,
        toolboxTopic: topic,
        huddleNotes: huddleNotes,
        attendees: attendees,
        signoffNotes: signoffNotes,
        wasLate: wasLate,
        submittedAt: now.toISOString()
    };
    dailyChecklists.unshift(rec);
    dcSave();
    closeDC();
    dcRenderToday();
    dcRenderHistory();
    dcUpdateBadge();
    alert('Daily checklist submitted for ' + store + '.' + (wasLate ? '\n\n⚠ Note: This was submitted AFTER the 11:59 AM deadline and has been flagged as late.' : ''));
}

// ── DC View Modal ──
function dcOpenView(recordId) {
    var rec = dailyChecklists.find(function(r) { return r.id === recordId; });
    if (!rec) return;
    var bd = document.getElementById('dc-view-bd');
    var body = document.getElementById('dc-view-body');
    if (!bd || !body) return;

    function renderItems(items, answers) {
        return '<div class="dc-view-grid">' + items.map(function(label, i) {
            var val = answers[i];
            var mark = val === true ? '<span class="yes">✓</span>' : val === false ? '<span class="no">✗</span>' : '—';
            return '<div class="dc-view-item"><span>' + (i+1) + '. ' + label + '</span>' + mark + '</div>';
        }).join('') + '</div>';
    }

    var dateStr = new Date(rec.date).toLocaleDateString('en-ZA', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
    var timeStr = new Date(rec.submittedAt).toLocaleTimeString('en-ZA', {hour:'2-digit', minute:'2-digit'});
    var attendeesStr = rec.attendees.map(function(a) { return a.name + (a.role ? ' (' + a.role + ')' : ''); }).join(', ');

    body.innerHTML =
        '<div style="background:' + (rec.wasLate?'#fffbeb':'#f0fdf4') + ';border:1.5px solid ' + (rec.wasLate?'#fde68a':'#86efac') + ';border-radius:10px;padding:.85rem 1.1rem;margin-bottom:1.25rem">' +
        '<div style="font-size:1rem;font-weight:700;color:var(--t1);margin-bottom:.2rem"><i class="fas fa-store" style="color:var(--acc);margin-right:.4rem"></i>' + rec.store + ' — ' + dateStr + '</div>' +
        '<div style="font-size:.78rem;color:var(--t2)">Submitted by <strong>' + rec.supervisor + '</strong> at ' + timeStr + (rec.wasLate ? ' <span style="color:var(--warn);font-weight:700">(LATE)</span>' : '') + '</div>' +
        '</div>' +
        '<div class="dc-view-section"><h5>Equipment / Environment</h5>' + renderItems(DAILY_CHECKLIST_CONFIG.equipment, rec.equipment) + '</div>' +
        '<div class="dc-view-section"><h5>Duties Before Hand-over</h5>' + renderItems(DAILY_CHECKLIST_CONFIG.duties, rec.duties) + '</div>' +
        '<div class="dc-view-section"><h5>PPE / Safety Equipment</h5>' + renderItems(DAILY_CHECKLIST_CONFIG.ppe, rec.ppe) + '</div>' +
        '<div class="dc-view-section"><h5>Morning Huddle</h5>' +
        '<div class="dc-view-kv"><strong>Toolbox Topic</strong><span>' + rec.toolboxTopic + '</span></div>' +
        (rec.huddleNotes ? '<div class="dc-view-kv"><strong>Discussion</strong><span>' + rec.huddleNotes + '</span></div>' : '') +
        '<div class="dc-view-kv"><strong>Attendees</strong><span>' + attendeesStr + '</span></div>' +
        '</div>' +
        (rec.signoffNotes ? '<div class="dc-view-section"><h5>Sign-off Notes</h5><div style="padding:.6rem .85rem;background:#f8fafc;border-radius:6px;font-size:.85rem;color:var(--t1)">' + rec.signoffNotes + '</div></div>' : '');

    window._dcViewRecordId = recordId;
    bd.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDCView() {
    var bd = document.getElementById('dc-view-bd');
    if (bd) bd.classList.remove('open');
    document.body.style.overflow = '';
}

function dcPrintRecord() {
    var body = document.getElementById('dc-view-body');
    if (!body) return;
    var w = window.open('', '_blank', 'width=900,height=700');
    w.document.write('<!DOCTYPE html><html><head><title>Daily Checklist Record</title><style>body{font-family:-apple-system,sans-serif;padding:1.5rem;color:#1e293b;font-size:14px}h5{font-size:.85rem;font-weight:700;margin-top:1.2rem;margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid #e2e8f0;color:#64748b;text-transform:uppercase;letter-spacing:.06em}.dc-view-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem}.dc-view-item{padding:.35rem .5rem;background:#f8fafc;border-radius:5px;font-size:.77rem;display:flex;justify-content:space-between;gap:.5rem}.yes{color:#10b981;font-weight:700}.no{color:#ef4444;font-weight:700}.dc-view-kv{display:flex;gap:.65rem;padding:.3rem 0;font-size:.82rem;border-bottom:1px solid #f1f5f9}.dc-view-kv strong{min-width:140px;color:#94a3b8;font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}</style></head><body>' + body.innerHTML + '</body></html>');
    w.document.close();
    setTimeout(function() { w.print(); }, 300);
}

// ── WhatsApp Reminder for Daily Checklist ──
function dcSendReminder(store) {
    var url = getHubUrl();
    var link = url ? url + (url.indexOf('?') === -1 ? '?' : '&') + 'checklist=' + encodeURIComponent(store) : '';
    var msg = '🌅 Good morning! Daily Site Supervisor Checklist reminder for *' + store + '*.\n\n' +
        'Please complete before 11:59 AM:\n' +
        '• Equipment / Environment checks\n' +
        '• Duties Before Hand-over\n' +
        '• PPE / Safety Equipment\n' +
        '• Morning Huddle (Toolbox Talk)\n\n' +
        (link ? 'Tap to open the checklist:\n' + link : 'Open the Astron Operations Hub to complete.');
    var preview = document.getElementById('dc-wa-preview');
    if (preview) preview.textContent = msg;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

// ── URL Parameter Auto-Open ──
// When ?form=StoreName&type=assessment_type is in the URL, auto-open that form
// When ?form=StoreName&type=assessment_type is in the URL, auto-open that form
// When ?checklist=StoreName is in the URL, auto-open the Daily Checklist for that store
(function() {
    var params = new URLSearchParams(window.location.search);
    var fp = params.get('form');
    var tp = params.get('type');
    var cl = params.get('checklist');
    var map = {'hillcrest':'Hillcrest','hammersdale':'Hammersdale','gillits':'Gillits','cato+ridge':'Cato Ridge','cato ridge':'Cato Ridge','catoridge':'Cato Ridge'};
    if (cl) {
        var sn = map[decodeURIComponent(cl).toLowerCase()] || decodeURIComponent(cl).replace('+',' ');
        setTimeout(function() {
            showView('owner');
            showOpsTab('dailychecklist');
            setTimeout(function() { openDC(sn); }, 250);
        }, 500);
    } else if (fp) {
        var sn2 = map[decodeURIComponent(fp).toLowerCase()] || decodeURIComponent(fp).replace('+',' ');
        var validType = tp && ASSESSMENT_TYPES[tp] ? tp : null;
        setTimeout(function() {
            showView('owner');
            showOpsTab('assessments');
            setTimeout(function() {
                if (validType) {
                    openCSAForm(sn2);
                    setTimeout(function() { openCSAFormTyped(sn2, validType); }, 150);
                } else {
                    openCSAForm(sn2);
                }
            }, 200);
        }, 500);
    }
})();

// ── DOMContentLoaded for CSA modal listeners ──
document.addEventListener('DOMContentLoaded', function() {
    var csaFormBd = document.getElementById('csa-form-modal-bd');
    if (csaFormBd) csaFormBd.addEventListener('click', function(e) { if (e.target === this) closeCSAForm(); });
    var csaRemedBd = document.getElementById('csa-remed-modal-bd');
    if (csaRemedBd) csaRemedBd.addEventListener('click', function(e) { if (e.target === this) closeCSARemed(); });
    var csaReportBd = document.getElementById('csa-report-bd');
    if (csaReportBd) csaReportBd.addEventListener('click', function(e) { if (e.target === this) csaCloseReport(); });

    // Show WA URL status
    var waNote = document.getElementById('wa-url-note');
    if (waNote) {
        var detectedUrl = getHubUrl();
        if (detectedUrl) {
            waNote.innerHTML = '<i class="fas fa-check-circle" style="color:var(--ok)"></i><span style="color:var(--ok);font-weight:600">Direct link active</span><span style="color:var(--t3);margin-left:.25rem">— recipients can tap to open the form</span>';
        } else {
            waNote.innerHTML = '<i class="fas fa-info-circle" style="color:var(--t3)"></i><span style="color:var(--t3)">Message sends without a clickable link. Open in full-page view for auto-detected links.</span>';
        }
    }
});

// ── Init ──
loadNotices();