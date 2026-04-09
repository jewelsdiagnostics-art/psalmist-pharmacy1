// ==================== DEFAULT DATA ====================
var DEFAULT_USERS = [
  {id:1, username:'admin',      password:'admin123', role:'admin',      name:'Administrator', enabled:true},
  {id:2, username:'pharmacist', password:'pharm123', role:'pharmacist', name:'Pharmacist',    enabled:true},
  {id:3, username:'accountant', password:'acct123',  role:'accountant', name:'Accountant',    enabled:true},
  {id:4, username:'doctor',     password:'doc123',   role:'doctor',     name:'Doctor',        enabled:true}
];

var DEFAULT_DRUGS = [
  {id:1,name:"Paracetamol",   strength:"500MG", cost:0.90, generalPrice:1.05, petroleumPrice:0.95, stock:450, minBal:20, location:"S3", whenTaken:"After meals",    soldTotal:150},
  {id:2,name:"Amoxicillin",   strength:"500MG", cost:2.20, generalPrice:2.85, petroleumPrice:2.60, stock:200, minBal:15, location:"W2", whenTaken:"With food",      soldTotal:80},
  {id:3,name:"Metformin",     strength:"850MG", cost:1.50, generalPrice:2.10, petroleumPrice:1.90, stock:120, minBal:10, location:"W3", whenTaken:"With meal",      soldTotal:45},
  {id:4,name:"Lisinopril",    strength:"10MG",  cost:1.20, generalPrice:1.65, petroleumPrice:1.50, stock:85,  minBal:10, location:"W3", whenTaken:"Morning",        soldTotal:30},
  {id:5,name:"Azithromycin",  strength:"500MG", cost:12.0, generalPrice:15.5, petroleumPrice:14.0, stock:45,  minBal:8,  location:"W2", whenTaken:"Empty stomach",  soldTotal:22},
  {id:6,name:"Ibuprofen",     strength:"400MG", cost:0.80, generalPrice:1.20, petroleumPrice:1.00, stock:8,   minBal:15, location:"S1", whenTaken:"After meals",    soldTotal:60},
  {id:7,name:"Omeprazole",    strength:"20MG",  cost:1.10, generalPrice:1.80, petroleumPrice:1.60, stock:5,   minBal:10, location:"S2", whenTaken:"Before meals",   soldTotal:40},
  {id:8,name:"Atorvastatin",  strength:"20MG",  cost:2.50, generalPrice:3.50, petroleumPrice:3.20, stock:95,  minBal:10, location:"W4", whenTaken:"Evening",        soldTotal:18},
  {id:9,name:"Amlodipine",    strength:"5MG",   cost:1.30, generalPrice:1.90, petroleumPrice:1.70, stock:110, minBal:10, location:"W3", whenTaken:"Morning",        soldTotal:25},
  {id:10,name:"Ciprofloxacin",strength:"500MG", cost:3.50, generalPrice:5.00, petroleumPrice:4.50, stock:60,  minBal:10, location:"W2", whenTaken:"With water",     soldTotal:35}
];

// ==================== STATE ====================
var drugs = [], users = [], currentPriceTier = 'general', currentUser = null;
var activityLog = [], cartItems = [], debounceTimer = null;
var locationChart = null, lowStockChart = null;
var pendingGeneralData = [], pendingPetrolData = [], pendingLegacyData = [];
var uploadPortalsReady = false, legacyUploadReady = false;

// ==================== PERMISSIONS ====================
var perms = {
  admin:      {inventory:true,  edit:true,  sell:true,  add:true,  reports:true, admin:true,  upload:true},
  pharmacist: {inventory:true,  edit:true,  sell:true,  add:true,  reports:true, admin:false, upload:false},
  accountant: {inventory:false, edit:false, sell:false, add:false, reports:true, admin:false, upload:false},
  doctor:     {inventory:true,  edit:false, sell:false, add:false, reports:true, admin:false, upload:false}
};

// ==================== HELPERS ====================
function getCurrentPrice(drug) {
  return currentPriceTier === 'petroleum'
    ? (parseFloat(drug.petroleumPrice) || parseFloat(drug.generalPrice))
    : parseFloat(drug.generalPrice);
}
function esc(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/[&<>"']/g, function(m){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
}
function toast(msg, type) {
  var t = document.createElement('div');
  t.className = 'fixed bottom-6 right-6 z-[999] px-5 py-3 rounded-2xl text-white text-sm font-medium shadow-lg transition-all '
    + (type==='error' ? 'bg-red-500' : type==='warn' ? 'bg-amber-500' : 'bg-emerald-500');
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; setTimeout(function(){ t.remove(); },400); }, 2800);
}
function addLog(msg) {
  activityLog.unshift({msg:msg, time:new Date().toLocaleTimeString(), user:currentUser ? currentUser.name : 'System'});
  if (activityLog.length > 30) activityLog.pop();
  renderRecentLog();
  saveAllData();
}
function renderRecentLog() {
  var c = document.getElementById('recent-log'); if (!c) return;
  c.innerHTML = activityLog.length
    ? activityLog.map(function(l){
        return '<div class="py-1 border-b border-white/5 flex gap-2"><span class="text-zinc-500 shrink-0">'+l.time+'</span><span>'+esc(l.msg)+'</span></div>';
      }).join('')
    : '<div class="text-zinc-500 italic">No activity yet</div>';
}

// ==================== PERSISTENCE ====================
function saveAllData() {
  try {
    localStorage.setItem('pmc_users', JSON.stringify(users));
    localStorage.setItem('pmc_drugs', JSON.stringify(drugs));
    localStorage.setItem('pmc_log',   JSON.stringify(activityLog));
  } catch(e) { console.warn('localStorage save failed:', e); }
}
function loadAllData() {
  try {
    var d = localStorage.getItem('pmc_drugs');
    var l = localStorage.getItem('pmc_log');
    drugs       = d ? JSON.parse(d) : JSON.parse(JSON.stringify(DEFAULT_DRUGS));
    activityLog = l ? JSON.parse(l) : [];
  } catch(e) {
    drugs       = JSON.parse(JSON.stringify(DEFAULT_DRUGS));
    activityLog = [];
  }
  _loadUsersFromLocal();
}

function _loadUsersFromLocal() {
  try {
    var u = localStorage.getItem('pmc_users');
    users = u ? JSON.parse(u) : JSON.parse(JSON.stringify(DEFAULT_USERS));
  } catch(e) {
    users = JSON.parse(JSON.stringify(DEFAULT_USERS));
  }
  if (!users.find(function(x){ return x.username === 'admin'; })) {
    users.unshift(DEFAULT_USERS[0]);
  }
}

// ==================== LOGIN ====================
function attemptLogin() {
  var uname = document.getElementById('loginUsername').value.trim();
  var pwd   = document.getElementById('loginPassword').value;
  if (!uname || !pwd) { showLoginError('Please enter username and password'); return; }
  var btn = document.getElementById('doLoginBtn');
  btn.innerText = 'Signing in...'; btn.disabled = true;
  
  setTimeout(function() {
    btn.innerText = 'Sign In'; btn.disabled = false;
    _localLogin(uname, pwd);
  }, 500);
}

function _localLogin(uname, pwd) {
  var user = users.find(function(u){
    return u.username === uname && u.password === pwd &&
           (u.enabled === true || u.enabled === 'true' || u.enabled === 'TRUE');
  });
  if (user) { _completeLogin(user); }
  else { showLoginError('Invalid username or password'); }
}

function _completeLogin(user) {
  currentUser = user;
  if (document.getElementById('rememberMe').checked) {
    localStorage.setItem('pmc_ru', user.username);
  } else {
    localStorage.removeItem('pmc_ru');
    localStorage.removeItem('pmc_rp');
  }
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');
  document.getElementById('userNameDisplay').innerText = user.name;
  document.getElementById('userRoleBadge').innerText   = user.role.toUpperCase();
  document.getElementById('roleDisplay').innerHTML     =
    'Logged in as <span class="text-sky-300 font-medium">' + user.role + '</span>';
  buildNav(); setupLiveSearch(); updateStats(); renderRecentLog();
  addLog(user.name + ' logged in');
}

function showLoginError(msg) {
  var e = document.getElementById('loginError');
  e.innerHTML = 'Error: ' + msg;
  e.classList.remove('hidden');
  document.getElementById('loginPassword').value = '';
  setTimeout(function(){ e.classList.add('hidden'); }, 3000);
}
function logout() {
  addLog((currentUser ? currentUser.name : 'User') + ' logged out');
  currentUser = null; uploadPortalsReady = false; legacyUploadReady = false;
  cartItems = []; currentPriceTier = 'general';
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('loginPassword').value = '';
}
function loadRememberedLogin() {
  var ru = localStorage.getItem('pmc_ru'), rp = localStorage.getItem('pmc_rp');
  if (ru && rp) {
    document.getElementById('loginUsername').value = ru;
    document.getElementById('loginPassword').value = rp;
    document.getElementById('rememberMe').checked  = true;
  }
}

// ==================== NAVIGATION ====================
function buildNav() {
  var nav = document.getElementById('navContainer'); if (!nav) return;
  var p = perms[currentUser.role];
  var items = [{id:'dashboard', label:'Dashboard'}];
  if (p.inventory) items.push({id:'inventory', label:'Inventory'});
  if (p.add)       items.push({id:'add',       label:'Add Drug'});
  if (p.reports)   items.push({id:'reports',   label:'Reports'});
  if (p.upload)    items.push({id:'uploads',   label:'Uploads'});
  if (p.admin)     items.push({id:'admin',     label:'Admin'});
  nav.innerHTML = items.map(function(i){
    return '<button data-nav="'+i.id+'" class="px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 transition">'+i.label+'</button>';
  }).join('');
  document.querySelectorAll('[data-nav]').forEach(function(btn){
    btn.addEventListener('click', function(){ showSection(btn.dataset.nav); });
  });
  showSection('dashboard');
}
window.showSection = function(section) {
  document.querySelectorAll('.section').forEach(function(s){ s.classList.add('hidden'); });
  var el = document.getElementById(section + '-section');
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('[data-nav]').forEach(function(b){
    b.className = b.dataset.nav === section
      ? 'px-4 py-2 rounded-full text-sm font-semibold bg-sky-500 text-white transition'
      : 'px-4 py-2 rounded-full text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 transition';
  });
  if (section === 'inventory') { renderInventory(); renderCart(); }
  if (section === 'dashboard') updateStats();
  if (section === 'reports')   updateStats();
  if (section === 'add')       document.getElementById('formTitle').innerText = document.getElementById('editId').value ? 'Edit Drug' : 'Add New Drug';
  if (section === 'uploads')   { if (!uploadPortalsReady) { setupUploadPortals(); uploadPortalsReady = true; } }
  if (section === 'admin' && currentUser && currentUser.role === 'admin') { renderUserList(); setupPetrolUpload(); setupLegacyUpload(); }
};

// ==================== STATS & CHARTS ====================
function renderTopSelling() {
  var sorted = drugs.slice().sort(function(a,b){ return (b.soldTotal||0)-(a.soldTotal||0); }).slice(0,5);
  var c = document.getElementById('topSellingList'); if (!c) return;
  c.innerHTML = sorted.length
    ? sorted.map(function(d,i){
        var medals = ['1st','2nd','3rd','4th','5th'];
        return '<div class="flex justify-between py-1.5 border-b border-white/5">'+
          '<span>'+medals[i]+' '+esc(d.name)+'</span>'+
          '<span class="text-emerald-400 font-medium">'+(d.soldTotal||0)+' units</span></div>';
      }).join('')
    : '<div class="text-zinc-500 italic">No sales yet</div>';
}
function updateCharts() {
  var lm = {};
  drugs.forEach(function(d){ var l = d.location || 'Other'; lm[l] = (lm[l]||0) + d.stock * d.generalPrice; });
  var c1 = document.getElementById('locationChart');
  if (c1) {
    if (locationChart) locationChart.destroy();
    locationChart = new Chart(c1.getContext('2d'), {
      type:'bar',
      data:{labels:Object.keys(lm), datasets:[{label:'Value (GHS)', data:Object.values(lm).map(function(v){ return parseFloat(v.toFixed(2)); }), backgroundColor:'#0ea5e9', borderRadius:6}]},
      options:{responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:function(v){ return 'GHS'+v; }}}}}
    });
  }
  var low = drugs.filter(function(d){ return d.stock <= d.minBal; }).slice(0,6);
  var c2 = document.getElementById('lowStockChart');
  if (c2) {
    if (lowStockChart) lowStockChart.destroy();
    lowStockChart = new Chart(c2.getContext('2d'), {
      type:'bar',
      data:{
        labels: low.map(function(d){ return d.name.length > 10 ? d.name.slice(0,9)+'..' : d.name; }),
        datasets:[
          {label:'Stock',   data:low.map(function(d){ return d.stock; }),  backgroundColor:'#f59e0b', borderRadius:4},
          {label:'Min Bal', data:low.map(function(d){ return d.minBal; }), backgroundColor:'#ef4444', borderRadius:4}
        ]
      },
      options:{responsive:true, plugins:{legend:{labels:{color:'#ccc',font:{size:11}}}}}
    });
  }
}
function updateStats() {
  document.getElementById('stat-total').innerText = drugs.length;
  var val = drugs.reduce(function(s,d){ return s + d.stock * d.generalPrice; }, 0);
  document.getElementById('stat-value').innerHTML = 'GHS' + val.toFixed(2);
  document.getElementById('stat-low').innerText   = drugs.filter(function(d){ return d.stock <= d.minBal; }).length;
  document.getElementById('stat-sold').innerText  = drugs.reduce(function(s,d){ return s + (d.soldTotal||0); }, 0);
  var lw = document.getElementById('lowStockList');
  if (lw) {
    var li = drugs.filter(function(d){ return d.stock <= d.minBal; });
    lw.innerHTML = li.length
      ? li.map(function(d){
          return '<div class="flex justify-between border-b border-white/10 py-2 items-center">'+
            '<span>'+esc(d.name)+' <span class="text-xs text-zinc-500">'+esc(d.strength||'')+'</span></span>'+
            '<span class="text-amber-400 font-bold">'+Math.floor(d.stock)+' / '+d.minBal+'</span></div>';
        }).join('')
      : '<div class="text-emerald-400 py-2">All stock levels are healthy</div>';
  }
  var locMap = {};
  drugs.forEach(function(d){ var l = d.location || 'Other'; locMap[l] = (locMap[l]||0) + d.stock * d.generalPrice; });
  var ld = document.getElementById('locationValue');
  if (ld) ld.innerHTML = Object.keys(locMap).map(function(k){
    return '<div class="flex justify-between border-b border-white/5 py-1.5"><span class="text-zinc-300">'+esc(k)+'</span><span class="font-medium text-sky-300">GHS'+locMap[k].toFixed(2)+'</span></div>';
  }).join('');
  renderTopSelling();
  updateCharts();
}

// ==================== PRICE TIER ====================
function setPriceTier(tier) {
  currentPriceTier = tier;
  var gBtn = document.getElementById('tierGeneral'), pBtn = document.getElementById('tierPetroleum');
  gBtn.className = tier === 'general'
    ? 'px-5 py-2 rounded-full font-semibold transition bg-sky-500 text-white shadow shadow-sky-500/20'
    : 'px-5 py-2 rounded-full font-semibold transition bg-zinc-700 text-zinc-300 hover:bg-zinc-600';
  document.getElementById('cartPriceLabel').innerText  = 'General Public';
  document.getElementById('priceHeader').innerHTML     = 'General Price (GHS)';
  cartItems.forEach(function(item){
    var drug = drugs.find(function(d){ return d.id == item.id; });
    if (drug) item.price = getCurrentPrice(drug);
  });
  renderInventory();
  renderCart();
}

// ==================== CART ====================
function renderCart() {
  var c = document.getElementById('selectedDrugsContainer'); if (!c) return;
  if (!cartItems.length) {
    c.innerHTML = '<div class="text-zinc-500 text-sm italic py-2">No items in cart. Click Add Cart on any drug below.</div>';
    document.getElementById('cartTotalItems').innerText = '0';
    document.getElementById('cartTotalAmount').innerHTML = 'GHS0.00';
    return;
  }
  c.innerHTML = cartItems.map(function(item){
    return '<div class="cart-item">'+
      '<span class="font-medium text-sm">'+esc(item.name)+'</span>'+
      (item.strength ? '<span class="text-xs text-zinc-400">'+esc(item.strength)+'</span>' : '')+
      '<span class="text-emerald-300 text-sm">GHS'+item.price.toFixed(2)+'</span>'+
      '<input type="number" value="'+item.qty+'" min="1" class="cart-qty-input" onchange="updateCartQty('+item.id+',this.value)">'+
      '<span class="text-emerald-200 text-xs font-medium">= GHS'+(item.price*item.qty).toFixed(2)+'</span>'+
      '<button onclick="removeFromCart('+item.id+')" class="text-red-400 hover:text-red-300 font-bold text-lg leading-none">×</button>'+
      '</div>';
  }).join('');
  document.getElementById('cartTotalItems').innerText = cartItems.reduce(function(s,i){ return s + i.qty; }, 0);
  document.getElementById('cartTotalAmount').innerHTML = 'GHS' + cartItems.reduce(function(s,i){ return s + (i.price * i.qty); }, 0).toFixed(2);
}
function updateCartQty(id, v) {
  var q = parseInt(v); if (isNaN(q) || q < 1) q = 1;
  var item = cartItems.find(function(i){ return i.id == id; });
  if (item) { item.qty = q; renderCart(); }
}
function addToCart(drug) {
  var price = getCurrentPrice(drug);
  var ex = cartItems.find(function(i){ return i.id == drug.id; });
  if (ex) ex.qty++;
  else cartItems.push({id:drug.id, name:drug.name, strength:drug.strength, price:price, qty:1});
  renderCart();
}
function removeFromCart(id) { cartItems = cartItems.filter(function(i){ return i.id != id; }); renderCart(); }
function clearCart() { cartItems = []; renderCart(); }

// ==================== SALE + RECEIPT ====================
function processMultiSale() {
  if (!cartItems.length) { toast('No items in cart', 'warn'); return; }
  var errors = [], soldItems = [], receiptItems = [], total = 0;
  cartItems.forEach(function(item){
    var drug = drugs.find(function(d){ return d.id == item.id; });
    if (!drug) { errors.push(item.name + ': not found'); return; }
    if (drug.stock < item.qty) { errors.push(item.name + ': only ' + drug.stock + ' in stock'); return; }
    var priceUsed = getCurrentPrice(drug);
    drug.stock -= item.qty;
    drug.soldTotal = (drug.soldTotal||0) + item.qty;
    var subtotal = priceUsed * item.qty; total += subtotal;
    soldItems.push(item.qty + 'x ' + item.name);
    receiptItems.push({name:item.name, strength:item.strength, qty:item.qty, price:priceUsed, subtotal:subtotal});
  });
  if (soldItems.length > 0) {
    addLog('SALE: ' + soldItems.join(', ') + ' - Total: GHS' + total.toFixed(2) + ' (General)');
    renderInventory(); updateStats(); saveAllData();
    showReceipt(receiptItems, total);
  }
  if (errors.length > 0) { toast('Errors: ' + errors.join('; '), 'error'); }
  clearCart();
}
function showReceipt(items, total) {
  var h = '<div class="text-center border-b border-gray-200 pb-3 mb-3">'+
    '<h2 class="text-lg font-bold">PSALMIST MEDICAL CENTRE</h2>'+
    '<p class="text-xs text-gray-500">'+new Date().toLocaleString()+'</p>'+
    '<p class="text-xs">Price Tier: <strong>General Public</strong></p>'+
    '<p class="text-xs">Cashier: '+esc(currentUser ? currentUser.name : 'Staff')+'</p></div>'+
    '<table class="w-full text-xs"><thead><tr class="border-b border-gray-200">'+
    '<th class="text-left pb-1">Item</th><th class="text-center pb-1">Qty</th><th class="text-right pb-1">Price</th><th class="text-right pb-1">Subtotal</th>'+
    '</tr></thead><tbody>';
  items.forEach(function(i){
    h += '<tr><td class="py-1">'+esc(i.name)+(i.strength?' ('+esc(i.strength)+')':'')+'</td>'+
      '<td class="text-center">'+i.qty+'</td>'+
      '<td class="text-right">GHS'+parseFloat(i.price).toFixed(2)+'</td>'+
      '<td class="text-right">GHS'+parseFloat(i.subtotal).toFixed(2)+'</td></tr>';
  });
  h += '</tbody><tfoot><tr class="border-t-2 border-gray-300"><td colspan="3" class="pt-2 font-bold text-sm">TOTAL</td>'+
    '<td class="text-right font-bold pt-2 text-sm">GHS'+total.toFixed(2)+'</td></tr></tfoot></table>'+
    '<div class="text-center text-xs text-gray-400 mt-4 border-t border-gray-200 pt-3">Thank you for your patronage!</div>';
  document.getElementById('receiptContent').innerHTML = h;
  document.getElementById('receiptModal').classList.remove('hidden');
}
function closeReceipt() { document.getElementById('receiptModal').classList.add('hidden'); }

// ==================== INVENTORY RENDER ====================
function renderInventory() {
  if (!currentUser || !perms[currentUser.role].inventory) {
    document.getElementById('inventory-tbody').innerHTML =
      '<tr><td colspan="7" class="p-8 text-center text-zinc-500">Access Denied</td></tr>'; return;
  }
  var q = (document.getElementById('searchInput') ? document.getElementById('searchInput').value : '').toLowerCase().trim();
  var filtered = drugs.filter(function(d){
    return d.name.toLowerCase().includes(q) ||
           (d.strength||'').toLowerCase().includes(q) ||
           (d.location||'').toLowerCase().includes(q) ||
           (d.whenTaken||'').toLowerCase().includes(q);
  });
  var sort = document.getElementById('sortSelect') ? document.getElementById('sortSelect').value : 'name';
  if (sort === 'stock-asc')  filtered.sort(function(a,b){ return a.stock - b.stock; });
 else if (sort === 'price-asc') filtered.sort(function(a,b){ return getCurrentPrice(a) - getCurrentPrice(b); });
  else filtered.sort(function(a,b){ return a.name.localeCompare(b.name); });

  var canSell = perms[currentUser.role].sell;
  var canEdit = perms[currentUser.role].edit;

  document.getElementById('inventory-tbody').innerHTML = filtered.length
    ? filtered.map(function(d){
        var isLow = d.stock <= d.minBal;
        return '<tr class="border-t border-white/5 hover:bg-white/5 transition">'+
          '<td class="p-3 font-medium">'+esc(d.name)+'</td>'+
          '<td class="p-3 text-zinc-400">'+esc(d.strength||'')+'</td>'+
          '<td class="p-3 text-right font-medium text-emerald-300">GHS'+getCurrentPrice(d).toFixed(2)+'</td>'+
          '<td class="p-3 text-center '+(isLow ? 'text-amber-400 font-bold' : 'text-white')+'">'+
            Math.floor(d.stock)+(isLow ? ' !' : '')+'</td>'+
          '<td class="p-3 text-center text-zinc-400">'+d.minBal+'</td>'+
          '<td class="p-3 text-zinc-400">'+esc(d.location||'')+'</td>'+
          '<td class="p-3"><div class="flex gap-1.5 justify-center flex-wrap">'+
            (canSell && d.stock > 0
              ? '<button onclick="addToCartById('+d.id+')" class="bg-emerald-500/80 hover:bg-emerald-600 px-3 py-1.5 rounded-full text-xs text-white transition">Add Cart</button>'
              : (canSell ? '<span class="text-xs text-red-400 px-2">Out of stock</span>' : ''))+
            (canEdit
              ? '<button onclick="openRestockModal('+d.id+')" class="bg-amber-500/80 hover:bg-amber-600 px-3 py-1.5 rounded-full text-xs text-white transition">Restock</button>'+
                '<button onclick="editDrug('+d.id+')" class="bg-sky-500/80 hover:bg-sky-600 px-3 py-1.5 rounded-full text-xs text-white transition">Edit</button>'
              : '')+
          '</div></td>'+
          '</tr>';
      }).join('')
    : '<tr><td colspan="7" class="p-10 text-center text-zinc-500 italic">No drugs found matching your search</td></tr>';

  var rs = document.getElementById('searchResultCount');
  if (rs) rs.innerHTML = q
    ? 'Found <strong>'+filtered.length+'</strong> result(s) for "'+esc(q)+'"'
    : 'Showing all <strong>'+filtered.length+'</strong> drugs';
  var xi = document.getElementById('searchClearIcon');
  if (xi) xi.classList.toggle('hidden', !q.length);
}

// ==================== PETROLEUM PRICE TABLE ====================
function renderPetroleumPriceTable() {
  var tbody = document.getElementById('petroleumPriceTable'); if (!tbody) return;
  tbody.innerHTML = drugs.map(function(d){
    return '<tr class="border-t border-white/10 hover:bg-white/5 transition">'+
      '<td class="p-3 font-medium">'+esc(d.name)+'</td>'+
      '<td class="p-3 text-zinc-400">'+esc(d.strength||'')+'</td>'+
      '<td class="p-3 text-right text-emerald-300">GHS'+parseFloat(d.generalPrice).toFixed(2)+'</td>'+
      '<td class="p-3 text-right">'+
        '<input type="number" step="0.01" min="0" id="petroPrice_'+d.id+'" value="'+
        parseFloat(d.petroleumPrice||d.generalPrice).toFixed(2)+
        '" class="bg-zinc-800 border border-zinc-600 rounded-xl px-3 py-1 w-28 text-right text-white outline-none focus:border-amber-400 transition">'+
      '</td>'+
      '<td class="p-3 text-center">'+
        '<button onclick="updatePetroleumPrice('+d.id+')" class="bg-amber-500/80 hover:bg-amber-500 px-3 py-1 rounded-full text-xs text-white transition">Update</button>'+
      '</td>'+
      '</tr>';
  }).join('');
}
function updatePetroleumPrice(id) {
  var drug = drugs.find(function(d){ return d.id == id; }); if (!drug) return;
  var newPrice = parseFloat(document.getElementById('petroPrice_'+id).value);
  if (isNaN(newPrice) || newPrice < 0) newPrice = drug.generalPrice;
  drug.petroleumPrice = newPrice;
  saveAllData();
  addLog('Updated Petroleum price for '+drug.name+': GHS'+newPrice.toFixed(2));
  toast('Petroleum price updated for '+drug.name, 'success');
  renderPetroleumPriceTable();
  renderInventory();
}

// ==================== DRUG CRUD ====================
function addToCartById(id) {
  var drug = drugs.find(function(d){ return d.id == id; });
  if (drug && drug.stock > 0) { addToCart(drug); toast('Added '+drug.name+' to cart'); }
  else toast('Out of stock', 'warn');
}
function openRestockModal(id) {
  if (!perms[currentUser.role].edit) return;
  window.restockTargetId = id;
  var drug = drugs.find(function(d){ return d.id == id; });
  document.getElementById('restockDrugTitle').innerText = 'Restock: ' + drug.name + ' (' + (drug.strength||'') + ')';
  document.getElementById('restockQtyInput').value = 10;
  document.getElementById('restockModal').classList.remove('hidden');
  setTimeout(function(){ document.getElementById('restockQtyInput').select(); }, 100);
}
function confirmRestock() {
  var drug = drugs.find(function(d){ return d.id == window.restockTargetId; }); if (!drug) return;
  var qty = parseInt(document.getElementById('restockQtyInput').value);
  if (isNaN(qty) || qty < 1) { toast('Enter a valid quantity', 'warn'); return; }
  drug.stock += qty;
  addLog('Restocked +'+qty+' × '+drug.name+' (new stock: '+drug.stock+')');
  toast('Added '+qty+' units to '+drug.name);
  renderInventory(); updateStats(); saveAllData();
  document.getElementById('restockModal').classList.add('hidden');
}
function editDrug(id) {
  if (!perms[currentUser.role].edit) return;
  var d = drugs.find(function(x){ return x.id == id; }); if (!d) return;
  document.getElementById('editId').value        = d.id;
  document.getElementById('drugName').value      = d.name;
  document.getElementById('strength').value      = d.strength || '';
  document.getElementById('cost').value          = d.cost;
  document.getElementById('generalPrice').value  = d.generalPrice;
  document.getElementById('stock').value         = d.stock;
  document.getElementById('minBal').value        = d.minBal;
  document.getElementById('location').value      = d.location || '';
  document.getElementById('whenTaken').value     = d.whenTaken || '';
  showSection('add');
}
function saveDrug(e) {
  e.preventDefault();
  if (!perms[currentUser.role].add) { toast('Permission denied', 'error'); return; }
  var id   = parseInt(document.getElementById('editId').value);
  var name = document.getElementById('drugName').value.trim();
  if (!name) { toast('Drug name is required', 'warn'); return; }
  var gp   = parseFloat(document.getElementById('generalPrice').value) || 0;
  var drug = {
    id:             id || Date.now(),
    name:           name,
    strength:       document.getElementById('strength').value.trim(),
    cost:           parseFloat(document.getElementById('cost').value) || 0,
    generalPrice:   gp,
    petroleumPrice: gp, // Default petroleum price same as general
    stock:          parseInt(document.getElementById('stock').value) || 0,
    minBal:         parseInt(document.getElementById('minBal').value) || 5,
    location:       document.getElementById('location').value.trim(),
    whenTaken:      document.getElementById('whenTaken').value.trim(),
    soldTotal:      0
  };
  var idx = drugs.findIndex(function(d){ return d.id == id; });
  if (id && idx >= 0) {
    drug.soldTotal = drugs[idx].soldTotal || 0;
    drugs[idx] = drug;
    addLog('Updated drug: ' + name);
    toast('Drug updated successfully');
  } else {
    drugs.push(drug);
    addLog('Added new drug: ' + name);
    toast('Drug added successfully');
  }
  renderInventory(); updateStats(); saveAllData();
  clearForm(); showSection('inventory');
}
function clearForm() {
  ['editId','drugName','strength','cost','generalPrice','stock','location','whenTaken']
    .forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('minBal').value = '10';
}

// ==================== LIVE SEARCH ====================
function setupLiveSearch() {
  var si = document.getElementById('searchInput'); if (!si) return;
  si.addEventListener('input', function(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function(){ renderInventory(); }, 150);
  });
  var xi = document.getElementById('searchClearIcon');
  if (xi) xi.addEventListener('click', function(){
    document.getElementById('searchInput').value = '';
    renderInventory();
    document.getElementById('searchInput').focus();
  });
}

// ==================== EXPORT CSV ====================
function exportCSV() {
  var rows = [["ID","Name","Strength","Cost","GeneralPrice","PetroleumPrice","Stock","MinBal","Location","WhenTaken","SoldTotal"]];
  drugs.forEach(function(d){
    rows.push([d.id, d.name, d.strength||'', d.cost, d.generalPrice,
      d.petroleumPrice||d.generalPrice, d.stock, d.minBal,
      d.location||'', d.whenTaken||'', d.soldTotal||0]);
  });
  var blob = new Blob([rows.map(function(r){
    return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(',');
  }).join('\n')], {type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'psalmist_inventory_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  addLog('Inventory CSV exported by ' + currentUser.name);
  toast('CSV exported');
}

// ==================== USER MANAGEMENT ====================
function renderUserList() {
  var c = document.getElementById('userListContainer'); if (!c) return;
  c.innerHTML = users.map(function(u){
    var isAdmin = u.username === 'admin';
    return '<div class="flex justify-between items-center bg-zinc-800 p-3 rounded-2xl gap-3">'+
      '<div class="flex items-center gap-3">'+
        '<div class="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">'+
          u.name.charAt(0).toUpperCase()+'</div>'+
        '<div>'+
          '<span class="font-medium">'+esc(u.username)+'</span>'+
          '<span class="text-xs text-zinc-400 ml-2">('+u.role+')</span>'+
          '<span class="text-xs ml-2 '+(u.enabled ? 'text-emerald-400' : 'text-red-400')+'">'+
            (u.enabled ? 'Active' : 'Disabled')+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="flex gap-2">'+
        (!isAdmin
          ? '<button onclick="toggleUser('+u.id+')" class="px-3 py-1 rounded-full text-xs font-medium '+
              (u.enabled ? 'bg-red-500/30 text-red-300 hover:bg-red-500/50' : 'bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500/50')+
              ' transition">'+(u.enabled ? 'Disable' : 'Enable')+'</button>'+
            '<button onclick="deleteUser('+u.id+')" class="px-3 py-1 bg-red-500/40 hover:bg-red-500/60 text-red-200 rounded-full text-xs transition">Delete</button>'
          : '<span class="text-xs text-zinc-500 italic px-2">Protected</span>')+
      '</div></div>';
  }).join('');
}
function addUser() {
  var uname = document.getElementById('newUsername').value.trim();
  var role  = document.getElementById('newRole').value;
  var pwd   = document.getElementById('newPassword').value.trim();
  if (!uname) { toast('Enter a username', 'warn'); return; }
  if (!pwd)   { toast('Enter a password', 'warn'); return; }
  if (users.find(function(u){ return u.username === uname; })) {
    toast('Username already exists', 'error'); return;
  }

  var newUser = {
    id: Date.now(),
    username: uname,
    password: pwd,
    role:     role,
    name:     uname,
    enabled:  true
  };

  users.push(newUser);
  saveAllData();
  renderUserList();
  addLog('New user added: ' + uname + ' (' + role + ')');
  toast('User "' + uname + '" created');
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
}
function toggleUser(id) {
  var u = users.find(function(x){ return x.id == id; });
  if (u && u.username !== 'admin') {
    u.enabled = !u.enabled;
    saveAllData();
    renderUserList();
    addLog((u.enabled ? 'Enabled' : 'Disabled') + ' user: ' + u.username);
    toast((u.enabled ? 'Enabled' : 'Disabled') + ': ' + u.username);
  } else toast('Cannot modify admin account', 'error');
}
function deleteUser(id) {
  var u = users.find(function(x){ return x.id == id; });
  if (u && u.username !== 'admin') {
    if (!confirm('Delete user "' + u.username + '"? This cannot be undone.')) return;
    users = users.filter(function(x){ return x.id != id; });
    saveAllData();
    renderUserList();
    addLog('Deleted user: ' + u.username);
    toast('User deleted');
  } else toast('Cannot delete admin account', 'error');
}

// ==================== FILE UPLOAD HELPERS ====================
function readFileAsWorkbook(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e){
    var data = new Uint8Array(e.target.result);
    var wb   = XLSX.read(data, {type:'array'});
    var ws   = wb.Sheets[wb.SheetNames[0]];
    callback(XLSX.utils.sheet_to_json(ws, {header:1, defval:''}));
  };
  reader.readAsArrayBuffer(file);
}
function findCol(hdr, keywords) {
  for (var k = 0; k < keywords.length; k++) {
    var idx = hdr.findIndex(function(h){ return h && h.toString().toLowerCase().includes(keywords[k]); });
    if (idx >= 0) return idx;
  }
  return -1;
}

// ==================== GENERAL UPLOAD ====================
function setupGeneralUpload() {
  var zone = document.getElementById('generalUploadZone');
  var fi   = document.getElementById('generalFileInput');
  if (!zone || !fi) return;
  zone.addEventListener('click', function(){ fi.click(); });
  document.getElementById('generalBrowseBtn').addEventListener('click', function(e){ e.stopPropagation(); fi.click(); });
  zone.addEventListener('dragover',  function(e){ e.preventDefault(); zone.classList.add('drag-active'); });
  zone.addEventListener('dragleave', function(){ zone.classList.remove('drag-active'); });
  zone.addEventListener('drop', function(e){
    e.preventDefault(); zone.classList.remove('drag-active');
    if (e.dataTransfer.files[0]) handleGeneralFile(e.dataTransfer.files[0]);
  });
  fi.addEventListener('change', function(e){ if (e.target.files[0]) handleGeneralFile(e.target.files[0]); fi.value = ''; });
  document.getElementById('generalConfirmBtn').addEventListener('click', confirmGeneralUpload);
  document.getElementById('generalCancelBtn').addEventListener('click', function(){
    document.getElementById('generalPreview').classList.add('hidden'); pendingGeneralData = [];
  });
}
function handleGeneralFile(file) {
  readFileAsWorkbook(file, function(json){ processGeneralFile(json); });
}
function processGeneralFile(data) {
  pendingGeneralData = [];
  var hdr = data[0] || [];
  var ni  = findCol(hdr, ['name']);         if (ni < 0) ni = 0;
  var si  = findCol(hdr, ['strength']);
  var ci  = findCol(hdr, ['cost']);
  var pi  = findCol(hdr, ['price','selling']);
  var qi  = findCol(hdr, ['stock','qty','quantity']);
  var mi  = findCol(hdr, ['min','minimum']);
  var li  = findCol(hdr, ['location','shelf','store']);
  var wi  = findCol(hdr, ['when','taken','dosage']);
  for (var i = 1; i < Math.min(data.length, 500); i++) {
    var row = data[i]; if (!row[ni]) continue;
    pendingGeneralData.push({
      name:       String(row[ni]).trim(),
      strength:   si >= 0 ? String(row[si]||'').trim() : '',
      cost:       ci >= 0 ? parseFloat(row[ci])||0 : 0,
      generalPrice: pi >= 0 ? parseFloat(row[pi])||0 : 0,
      stock:      qi >= 0 ? parseInt(row[qi])||0 : 0,
      minBal:     mi >= 0 ? parseInt(row[mi])||10 : 10,
      location:   li >= 0 ? String(row[li]||'').trim() : '',
      whenTaken:  wi >= 0 ? String(row[wi]||'').trim() : ''
    });
  }
  document.getElementById('generalPreviewTable').innerHTML =
    '<div class="font-semibold mb-2 text-zinc-200">'+pendingGeneralData.length+' rows ready to import:</div>'+
    pendingGeneralData.slice(0,5).map(function(d){
      return '<div class="text-zinc-400 py-0.5">- <strong>'+esc(d.name)+'</strong> '+esc(d.strength)+
        ' | Price: GHS'+d.generalPrice+' | Stock: '+d.stock+'</div>';
    }).join('')+
    (pendingGeneralData.length > 5 ? '<div class="text-zinc-500 mt-1">...and '+(pendingGeneralData.length-5)+' more</div>' : '');
  document.getElementById('generalPreview').classList.remove('hidden');
}
function confirmGeneralUpload() {
  var btn = document.getElementById('generalConfirmBtn');
  btn.disabled = true; btn.innerText = 'Importing...';
  setTimeout(function(){
    var added = 0, updated = 0;
    pendingGeneralData.forEach(function(d){
      if (!d.name) return;
      var ex = drugs.find(function(x){
        return x.name.toLowerCase() === d.name.toLowerCase() && (x.strength||'') === (d.strength||'');
      });
      if (ex) {
       ex.cost         = d.cost         > 0 ? d.cost         : ex.cost;
       ex.generalPrice = d.generalPrice > 0 ? d.generalPrice : ex.generalPrice;
       ex.stock        = d.stock        > 0 ? d.stock        : ex.stock;
       ex.minBal       = d.minBal       > 0 ? d.minBal       : ex.minBal;
       ex.location     = d.location     || ex.location;
       ex.whenTaken    = d.whenTaken    || ex.whenTaken;
        updated++;
      } else {
        drugs.push({
          id: Date.now() + Math.floor(Math.random()*9999),
          name:d.name, strength:d.strength, cost:d.cost,
          generalPrice:d.generalPrice, petroleumPrice:d.generalPrice,
          stock:d.stock, minBal:d.minBal, location:d.location,
          whenTaken:d.whenTaken, soldTotal:0
        }); added++;
      }
    });

    saveAllData();
    renderInventory(); updateStats();
    addLog('General upload: +'+added+' new, '+updated+' updated');
    toast('Imported: '+added+' new, '+updated+' updated');

    document.getElementById('generalResult').innerHTML =
      '<div class="text-emerald-300 mt-1">Added '+added+' new drugs, updated '+updated+'</div>';

    document.getElementById('generalPreview').classList.add('hidden');
    pendingGeneralData = []; btn.disabled = false; btn.innerText = 'Import';
    setTimeout(function(){ document.getElementById('generalResult').innerHTML = ''; }, 6000);
  }, 100);
}

// ==================== PETROLEUM UPLOAD ====================
function setupPetrolUpload() {
  var zone = document.getElementById('petrolUploadZone');
  var fi   = document.getElementById('petrolFileInput');
  if (!zone || !fi) return;
  zone.addEventListener('click', function(){ fi.click(); });
  document.getElementById('petrolBrowseBtn').addEventListener('click', function(e){ e.stopPropagation(); fi.click(); });
  zone.addEventListener('dragover',  function(e){ e.preventDefault(); zone.classList.add('drag-active'); });
  zone.addEventListener('dragleave', function(){ zone.classList.remove('drag-active'); });
  zone.addEventListener('drop', function(e){
    e.preventDefault(); zone.classList.remove('drag-active');
    if (e.dataTransfer.files[0]) handlePetrolFile(e.dataTransfer.files[0]);
  });
  fi.addEventListener('change', function(e){ if (e.target.files[0]) handlePetrolFile(e.target.files[0]); fi.value = ''; });
  document.getElementById('petrolConfirmBtn').addEventListener('click', confirmPetrolUpload);
  document.getElementById('petrolCancelBtn').addEventListener('click', function(){
    document.getElementById('petrolPreview').classList.add('hidden'); pendingPetrolData = [];
  });
}
function handlePetrolFile(file) {
  readFileAsWorkbook(file, function(json){ processPetrolFile(json); });
}
function processPetrolFile(data) {
  pendingPetrolData = [];
  var hdr = data[0] || [];
  var ni  = findCol(hdr, ['name']); if (ni < 0) ni = 0;
  var pi  = findCol(hdr, ['petroleum','price']); if (pi < 0) pi = 1;
  for (var i = 1; i < Math.min(data.length, 500); i++) {
    var row = data[i]; if (!row[ni]) continue;
    pendingPetrolData.push({ name:String(row[ni]).trim(), price:parseFloat(row[pi])||0 });
  }
  document.getElementById('petrolPreviewTable').innerHTML =
    '<div class="font-semibold mb-2 text-zinc-200">'+pendingPetrolData.length+' price updates ready:</div>'+
    pendingPetrolData.slice(0,5).map(function(d){
      return '<div class="text-zinc-400 py-0.5">- <strong>'+esc(d.name)+'</strong> | Petroleum Price: GHS'+d.price+'</div>';
    }).join('')+
    (pendingPetrolData.length > 5 ? '<div class="text-zinc-500 mt-1">...and '+(pendingPetrolData.length-5)+' more</div>' : '');
  document.getElementById('petrolPreview').classList.remove('hidden');
}
function confirmPetrolUpload() {
  var btn = document.getElementById('petrolConfirmBtn');
  btn.disabled = true; btn.innerText = 'Importing...';
  setTimeout(function(){
    var updated = 0, notFound = 0;
    pendingPetrolData.forEach(function(d){
      if (!d.name) return;
      var drug = drugs.find(function(x){ return x.name.toLowerCase() === d.name.toLowerCase(); });
      if (drug) { drug.petroleumPrice = d.price; updated++; }
      else notFound++;
    });

    saveAllData();
    renderInventory(); renderPetroleumPriceTable();
    addLog('Petroleum upload: updated '+updated+' drugs'+(notFound?' ('+notFound+' not found)':''));
    toast('Updated '+updated+' petroleum prices');

    document.getElementById('petrolResult').innerHTML =
      '<div class="text-emerald-300 mt-1">Updated '+updated+' drugs'+
      (notFound?' | '+notFound+' not found':'')+'</div>';

    document.getElementById('petrolPreview').classList.add('hidden');
    pendingPetrolData = []; btn.disabled = false; btn.innerText = 'Import Prices';
    setTimeout(function(){ document.getElementById('petrolResult').innerHTML = ''; }, 6000);
  }, 100);
}

// ==================== LEGACY BULK UPLOAD ====================
function setupLegacyUpload() {
  var zone = document.getElementById('uploadZone');
  var fi   = document.getElementById('fileInput');
  if (!zone || !fi) return;
  zone.addEventListener('click', function(){ fi.click(); });
  document.getElementById('browseBtn').addEventListener('click', function(e){ e.stopPropagation(); fi.click(); });
  zone.addEventListener('dragover',  function(e){ e.preventDefault(); zone.classList.add('drag-active'); });
  zone.addEventListener('dragleave', function(){ zone.classList.remove('drag-active'); });
  zone.addEventListener('drop', function(e){
    e.preventDefault(); zone.classList.remove('drag-active');
    if (e.dataTransfer.files[0]) handleLegacyFile(e.dataTransfer.files[0]);
  });
  fi.addEventListener('change', function(e){ if (e.target.files[0]) handleLegacyFile(e.target.files[0]); fi.value = ''; });
  document.getElementById('confirmUploadBtn').addEventListener('click', confirmLegacyUpload);
  document.getElementById('cancelUploadBtn').addEventListener('click', function(){
    document.getElementById('uploadPreview').classList.add('hidden'); pendingLegacyData = [];
  });
}
function handleLegacyFile(file) {
  readFileAsWorkbook(file, function(json){ processLegacyFile(json); });
}
function processLegacyFile(data) {
  pendingLegacyData = [];
  var hdr = data[0] || [];
  var ni  = findCol(hdr, ['name']);               if (ni < 0) ni = 0;
  var si  = findCol(hdr, ['strength']);
  var ci  = findCol(hdr, ['cost']);
  var gi  = findCol(hdr, ['general']);
  var pti = findCol(hdr, ['petroleum']);
  var qi  = findCol(hdr, ['stock','qty']);
  var mi  = findCol(hdr, ['min']);
  var li  = findCol(hdr, ['location']);
  var wi  = findCol(hdr, ['when','taken']);
  for (var i = 1; i < Math.min(data.length, 500); i++) {
    var row = data[i]; if (!row[ni]) continue;
    var gp = gi >= 0 ? parseFloat(row[gi])||0 : 0;
    pendingLegacyData.push({
      name:           String(row[ni]).trim(),
      strength:       si  >= 0 ? String(row[si]||'').trim() : '',
      cost:           ci  >= 0 ? parseFloat(row[ci])||0 : 0,
      generalPrice:   gp,
      petroleumPrice: pti >= 0 ? parseFloat(row[pti])||gp : gp,
      stock:          qi  >= 0 ? parseInt(row[qi])||0 : 0,
      minBal:         mi  >= 0 ? parseInt(row[mi])||10 : 10,
      location:       li  >= 0 ? String(row[li]||'').trim() : '',
      whenTaken:      wi  >= 0 ? String(row[wi]||'').trim() : ''
    });
  }
  document.getElementById('previewTable').innerHTML =
    '<div class="font-semibold mb-2 text-zinc-200">'+pendingLegacyData.length+' rows ready:</div>'+
    pendingLegacyData.slice(0,5).map(function(d){
      return '<div class="text-zinc-400 py-0.5">- <strong>'+esc(d.name)+'</strong> | General: GHS'+d.generalPrice+' | Petrol: GHS'+d.petroleumPrice+'</div>';
    }).join('')+
    (pendingLegacyData.length > 5 ? '<div class="text-zinc-500 mt-1">...and '+(pendingLegacyData.length-5)+' more</div>' : '');
  document.getElementById('uploadPreview').classList.remove('hidden');
}
function confirmLegacyUpload() {
  var btn = document.getElementById('confirmUploadBtn');
  btn.disabled = true; btn.innerText = 'Importing...';
  setTimeout(function(){
    var added = 0, updated = 0;
    pendingLegacyData.forEach(function(d){
      if (!d.name) return;
      var ex = drugs.find(function(x){
        return x.name.toLowerCase() === d.name.toLowerCase() && (x.strength||'') === (d.strength||'');
      });
      if (ex) {
        ex.cost           = d.cost           > 0 ? d.cost           : ex.cost;
       ex.generalPrice   = d.generalPrice   > 0 ? d.generalPrice   : ex.generalPrice;
       ex.petroleumPrice = d.petroleumPrice > 0 ? d.petroleumPrice : ex.petroleumPrice;
       ex.stock          = d.stock          > 0 ? d.stock          : ex.stock;
       ex.minBal         = d.minBal         > 0 ? d.minBal         : ex.minBal;
       ex.location       = d.location       || ex.location;
       ex.whenTaken      = d.whenTaken      || ex.whenTaken;
        updated++;
      } else {
        drugs.push({
          id: Date.now() + Math.floor(Math.random()*9999),
          name:d.name, strength:d.strength, cost:d.cost,
          generalPrice:d.generalPrice, petroleumPrice:d.petroleumPrice,
          stock:d.stock, minBal:d.minBal, location:d.location,
          whenTaken:d.whenTaken, soldTotal:0
        }); added++;
      }
    });

    saveAllData();
    renderInventory(); updateStats();
    addLog('Bulk import: +'+added+' new, '+updated+' updated');
    toast('Bulk import: '+added+' new, '+updated+' updated');

    document.getElementById('uploadResult').innerHTML =
      '<div class="text-emerald-300 mt-1">Added '+added+' new, updated '+updated+'</div>';

    document.getElementById('uploadPreview').classList.add('hidden');
    pendingLegacyData = []; btn.disabled = false; btn.innerText = 'Import';
    setTimeout(function(){ document.getElementById('uploadResult').innerHTML = ''; }, 6000);
  }, 100);
}

function setupUploadPortals() { setupGeneralUpload(); }

// ==================== RESET FUNCTIONS ====================
function resetDrugs() {
  if (!confirm('Reset all drugs to default values? This will remove all custom drugs and restore the original sample data.')) return;
  drugs = JSON.parse(JSON.stringify(DEFAULT_DRUGS));
  saveAllData();
  renderInventory(); updateStats();
  addLog('Drugs reset to defaults by ' + currentUser.name);
  toast('Drugs reset to defaults');
}
function resetUsers() {
  if (!confirm('Reset all users to default values? This will remove all custom users except admin.')) return;
  users = JSON.parse(JSON.stringify(DEFAULT_USERS));
  saveAllData();
  renderUserList();
  addLog('Users reset to defaults by ' + currentUser.name);
  toast('Users reset to defaults');
}
function resetActivity() {
  if (!confirm('Clear all activity log? This cannot be undone.')) return;
  activityLog = [];
  saveAllData();
  renderRecentLog();
  addLog('Activity log cleared by ' + currentUser.name);
  toast('Activity log cleared');
}

// ==================== EVENT BINDINGS ====================
document.getElementById('doLoginBtn').addEventListener('click', attemptLogin);
document.getElementById('loginPassword').addEventListener('keypress', function(e){ if (e.key === 'Enter') attemptLogin(); });
document.getElementById('loginUsername').addEventListener('keypress', function(e){ if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });
document.getElementById('togglePwd').addEventListener('click', function(){
  var p = document.getElementById('loginPassword');
  p.type = p.type === 'password' ? 'text' : 'password';
  this.innerText = p.type === 'password' ? '' : '';
});
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('drugForm').addEventListener('submit', saveDrug);
document.getElementById('cancelFormBtn').addEventListener('click', function(){ clearForm(); showSection('inventory'); });
document.getElementById('clearSearchBtn').addEventListener('click', function(){ document.getElementById('searchInput').value = ''; renderInventory(); });
document.getElementById('sortSelect').addEventListener('change', function(){ renderInventory(); });
document.getElementById('exportReportBtn').addEventListener('click', exportCSV);
document.getElementById('addUserBtn').addEventListener('click', addUser);
document.getElementById('processMultiSaleBtn').addEventListener('click', processMultiSale);
document.getElementById('clearCartBtn').addEventListener('click', clearCart);
document.getElementById('confirmRestockBtn').addEventListener('click', confirmRestock);
document.getElementById('closeRestockModal').addEventListener('click', function(){ document.getElementById('restockModal').classList.add('hidden'); });
document.getElementById('restockModal').addEventListener('click', function(e){ if (e.target === this) this.classList.add('hidden'); });
document.getElementById('receiptModal').addEventListener('click', function(e){ if (e.target === this) closeReceipt(); });

// Reset buttons
document.getElementById('resetDrugsButton').addEventListener('click', resetDrugs);
document.getElementById('resetUsersButton').addEventListener('click', resetUsers);
document.getElementById('resetActivityButton').addEventListener('click', resetActivity);

// ==================== GLOBAL EXPORTS ====================
window.addToCartById        = addToCartById;
window.updateCartQty        = updateCartQty;
window.removeFromCart       = removeFromCart;
window.openRestockModal     = openRestockModal;
window.editDrug             = editDrug;
window.setPriceTier         = setPriceTier;
window.closeReceipt         = closeReceipt;
window.toggleUser           = toggleUser;
window.deleteUser           = deleteUser;
window.updatePetroleumPrice = updatePetroleumPrice;
window.showSection          = showSection;

// ==================== INIT ====================
loadAllData();
loadRememberedLogin();
