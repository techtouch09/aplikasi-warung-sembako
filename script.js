let barangList = JSON.parse(localStorage.getItem('sembako_barang')) || [];
let pengeluaranList = JSON.parse(localStorage.getItem('sembako_pengeluaran')) || [];
let transaksiList = JSON.parse(localStorage.getItem('sembako_transaksi')) || [];
let keranjangList = [];
let currentSelectedKasirBarcode = "";

// Variabel Scanner
let keranjangScanner = [];
let selectedProdukAktif = null;
let html5QrCode = null;

// Variabel filter aktif di tab Data Transaksi
let currentFilteredTransaksi = [];

let adminCreds = JSON.parse(localStorage.getItem('sembako_admin')) || {
  username: 'admin',
  password: 'admin',
  avatar: ''
};

let tokoProfile = JSON.parse(localStorage.getItem('sembako_toko')) || {
  nama: 'Toko Sembako MAULANA',
  telp: '087877611218',
  alamat: 'Jl. Bojonegoro Kp. Kernaden rt 05 05',
  notes: 'Terima kasih atas kunjungan Anda!',
  logo: ''
};

let tempAvatarBase64 = '';
let tempLogoBase64 = '';

document.addEventListener('DOMContentLoaded', () => {
  loadProfilData();
  
  const isSessionLoggedIn = sessionStorage.getItem('sembako_logged_in');
  if (isSessionLoggedIn === 'true') {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    showTab('berandaTab');
  } else {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
  }

  renderBarangTable();
  renderPengeluaranTable();
  renderRiwayatTransaksi();
  renderKeranjangScanner();
  populateBarangDatalist();
  populateLaporanBarangSelect();
  updateDashboardStats();
  updateFinancialSummary();
  updateNotifications();
  
  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('pengTgl')) document.getElementById('pengTgl').value = today;
  if(document.getElementById('barExpired')) document.getElementById('barExpired').value = today;
  
  if(document.getElementById('laporanTglDari')) document.getElementById('laporanTglDari').value = '';
  if(document.getElementById('laporanTglSampai')) document.getElementById('laporanTglSampai').value = '';
});

function handleLogin(e) {
  e.preventDefault();
  const uInput = document.getElementById('loginUsername').value.trim();
  const pInput = document.getElementById('loginPassword').value.trim();

  if(uInput === adminCreds.username && pInput === adminCreds.password) {
    sessionStorage.setItem('sembako_logged_in', 'true');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    showTab('berandaTab');
  } else {
    alert("Username atau Password salah! (Default: admin / admin)");
  }
}

function logout() {
  if(confirm("Keluar dari sesi ini dan kembali ke halaman login?")) {
    sessionStorage.removeItem('sembako_logged_in');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
  }
}

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if(targetTab) targetTab.classList.add('active');

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if(activeBtn) activeBtn.classList.add('active');

  if(tabId === 'berandaTab') {
    updateDashboardStats();
    updateFinancialSummary();
  }
  if(tabId === 'barangTab') populateBarangDatalist();
  if(tabId === 'scannerTab') {
    initScannerCamera();
  } else {
    if(html5QrCode) {
      try { html5QrCode.stop(); } catch(e){}
    }
  }
  if(tabId === 'laporanTab') {
    const tbody = document.getElementById('laporanTbody');
    if(tbody && !tbody.hasAttribute('data-filtered')) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Silakan pilih tanggal dan klik 'Filter Laporan'.</td></tr>`;
    }
  }
  if(tabId === 'kasirTab') {
    if(!document.getElementById('transaksiEditIndex').value) {
      resetKasirForm();
    }
  }

  const sidebar = document.getElementById('appSidebar');
  if(sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('mobile-open');
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('appSidebar');
  if(sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

function toggleForm(formId, iconId) {
  const formCard = document.getElementById(formId);
  const icon = document.getElementById(iconId);
  if(formCard.classList.contains('collapsed')) {
    formCard.classList.remove('collapsed');
    icon.innerText = '▲';
  } else {
    formCard.classList.add('collapsed');
    icon.innerText = '▼';
  }
}

function saveDataToStorage() {
  localStorage.setItem('sembako_barang', JSON.stringify(barangList));
  localStorage.setItem('sembako_pengeluaran', JSON.stringify(pengeluaranList));
  localStorage.setItem('sembako_transaksi', JSON.stringify(transaksiList));
  localStorage.setItem('sembako_admin', JSON.stringify(adminCreds));
  localStorage.setItem('sembako_toko', JSON.stringify(tokoProfile));
  updateNotifications();
}

function updateDashboardStats() {
  document.getElementById('statTotalBarang').innerText = barangList.length;
  document.getElementById('statTotalTransaksi').innerText = transaksiList.length;
  document.getElementById('statTotalPengeluaran').innerText = pengeluaranList.length;
}

function updateFinancialSummary() {
  const totalPengeluaran = pengeluaranList.reduce((sum, p) => sum + (parseFloat(p.modal) || parseFloat(p.nominal) || 0), 0);
  const totalPembelianStok = barangList.reduce((sum, b) => sum + ((parseFloat(b.modal) || 0) * (parseInt(b.stok) || 0)), 0);
  const totalOmset = transaksiList.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

  if(document.getElementById('finPengeluaran')) {
    document.getElementById('finPengeluaran').innerText = `Rp ${formatNumber(totalPengeluaran)}`;
    document.getElementById('finPembelianStok').innerText = `Rp ${formatNumber(totalPembelianStok)}`;
    document.getElementById('finOmset').innerText = `Rp ${formatNumber(totalOmset)}`;
  }
}

function formatDateID(dateString) {
  if(!dateString) return '-';
  const parts = dateString.split('-');
  if(parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

function updateNotifications() {
  const notifList = document.getElementById('notifListContainer');
  const notifCountBadge = document.getElementById('notifCount');
  if(!notifList || !notifCountBadge) return;

  let warnings = [];
  const today = new Date();
  today.setHours(0,0,0,0);

  barangList.forEach((b, idx) => {
    if(b.stok < 3) {
      warnings.push({
        type: 'stok',
        text: `Stok menipis: <b>${b.nama}</b> tersisa ${b.stok} ${b.satuan}`,
        index: idx,
        class: 'stok-warning'
      });
    }

    if(b.expired) {
      const expDate = new Date(b.expired);
      expDate.setHours(0,0,0,0);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if(diffDays <= 15) {
        const formattedExp = formatDateID(b.expired);
        let msg = diffDays < 0 ? `Sudah kadaluarsa (${formattedExp})` : `Kadaluarsa dalam ${diffDays} hari (${formattedExp})`;
        warnings.push({
          type: 'expired',
          text: `Masa aktif habis: <b>${b.nama}</b> - ${msg}`,
          index: idx,
          class: 'expired-warning'
        });
      }
    }
  });

  notifCountBadge.innerText = warnings.length;

  if(warnings.length === 0) {
    notifList.innerHTML = `<div class="notif-empty">Tidak ada peringatan.</div>`;
    return;
  }

  let html = '';
  warnings.forEach(w => {
    let icon = w.type === 'stok' ? '⚠️ [Stok]' : '⏰ [Exp]';
    html += `<div class="notif-item ${w.class}" onclick="navigateToBarang(${w.index})">
      <span>${icon}</span>
      <div>${w.text}</div>
    </div>`;
  });
  notifList.innerHTML = html;
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  if(dropdown) dropdown.classList.toggle('hidden');
}

function navigateToBarang(idx) {
  toggleNotifDropdown();
  showTab('barangTab');
  setTimeout(() => {
    const row = document.getElementById(`barangRow_${idx}`);
    if(row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('highlight-row');
      setTimeout(() => row.classList.remove('highlight-row'), 3000);

      // Otomatis membuka kotak Detail barang
      const detailRow = document.getElementById(`barangDetailRow_${idx}`);
      const btn = document.getElementById(`btnDetail_${idx}`);
      if(detailRow && detailRow.classList.contains('hidden')) {
        detailRow.classList.remove('hidden');
        if(btn) {
          btn.innerText = '❌ Tutup';
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
        }
      }
    }
  }, 100);
}

window.addEventListener('click', function(e) {
  if(!e.target.closest('.notification-wrapper')) {
    const dropdown = document.getElementById('notifDropdown');
    if(dropdown && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
    }
  }
});

/* FUNGSI SCANNER BARCODE (KAMERA & UPLOAD) DENGAN MASA AUTOMATIC KERANJANG */
function switchMode(mode) {
  const btnCamera = document.getElementById('btnTabCamera');
  const btnUpload = document.getElementById('btnTabUpload');
  const camSec = document.getElementById('cameraSection');
  const upSec = document.getElementById('uploadSection');

  if(mode === 'camera') {
    btnCamera.classList.add('active');
    btnUpload.classList.remove('active');
    camSec.classList.remove('hidden');
    upSec.classList.add('hidden');
    initScannerCamera();
  } else {
    btnUpload.classList.add('active');
    btnCamera.classList.remove('active');
    upSec.classList.remove('hidden');
    camSec.classList.add('hidden');
    if(html5QrCode) {
      try { html5QrCode.stop(); } catch(e){}
    }
  }
}

function initScannerCamera() {
  if(!document.getElementById('reader')) return;
  if(!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }
  const config = { fps: 15, qrbox: { width: 280, height: 160 } };

  html5QrCode.start(
    { facingMode: "environment" }, 
    config, 
    (decodedText) => {
      // Pastikan kode terbaca dan belum diproses berulang kali dalam detik yang sama
      if (!decodedText) return;
      
      document.getElementById('scanResultCode').value = decodedText;
      document.getElementById('scannerStatus').innerText = `Berhasil Scan: ${decodedText}`;
      
      // Cari produk dan langsung masukkan ke keranjang secara instan
      cariProdukByBarcodeScanner(decodedText);
      
      if (selectedProdukAktif) {
        document.getElementById('scanQty').value = 1;
        tambahKeKeranjangScanner();
      }
    },
    (errorMessage) => {}
  ).catch(err => {
    const statusEl = document.getElementById('scannerStatus');
    if(statusEl) statusEl.innerText = "Kamera tidak aktif / gunakan mode Unggah Gambar.";
  });
}

function scanImageFromFile(e) {
  const file = e.target.files[0];
  if(!file) return;

  const statusEl = document.getElementById('uploadStatus');
  statusEl.innerText = "Membaca gambar barcode...";

  const qrScanner = new Html5Qrcode("reader");
  qrScanner.scanFile(file, true)
    .then(decodedText => {
      document.getElementById('scanResultCode').value = decodedText;
      statusEl.innerText = `Berhasil membaca barcode: ${decodedText}`;
      cariProdukByBarcodeScanner(decodedText);
      setTimeout(() => {
        if (selectedProdukAktif) {
          tambahKeKeranjangScanner();
        }
      }, 200);
    })
    .catch(err => {
      statusEl.innerText = "Gagal mendeteksi barcode dari gambar. Pastikan gambar jelas.";
    });
}

function cariProdukByBarcodeScanner(code) {
  const cleanCode = code.trim().toLowerCase();
  const infoCard = document.getElementById('productDetailInfo');
  const notFoundText = document.getElementById('productNotFound');

  if(!cleanCode) {
    infoCard.classList.add('hidden');
    notFoundText.classList.add('hidden');
    selectedProdukAktif = null;
    return;
  }

  const found = barangList.find(b => b.kode.toLowerCase() === cleanCode || b.nama.toLowerCase() === cleanCode);

  if(found) {
    selectedProdukAktif = found;
    document.getElementById('infoNama').innerText = found.nama;
    
    let stokBadgeHtml = '';
    if (found.stok > 2) {
      stokBadgeHtml = `<span class="badge-safe">${found.stok} ${found.satuan} (Aman)</span>`;
    } else if (found.stok > 0) {
      stokBadgeHtml = `<span class="badge-warning">${found.stok} ${found.satuan} (Menipis)</span>`;
    } else {
      stokBadgeHtml = `<span class="badge-expired">Habis (0 ${found.satuan})</span>`;
    }
    document.getElementById('infoStok').innerHTML = stokBadgeHtml;

    document.getElementById('infoHarga').innerText = `Rp ${formatNumber(found.jual)}`;
    document.getElementById('scanQty').value = 1;

    const statusExpEl = document.getElementById('infoStatusKadaluarsa');
    if(found.expired) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const expDate = new Date(found.expired);
      expDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const formattedExp = formatDateID(found.expired);

      if(diffDays < 0) {
        statusExpEl.innerHTML = `<span class="badge-expired">Kadaluarsa (${formattedExp})</span>`;
      } else if(diffDays <= 15) {
        statusExpEl.innerHTML = `<span class="badge-warning">Mendekati Expired: ${formattedExp} (${diffDays} hari lagi)</span>`;
      } else {
        statusExpEl.innerHTML = `<span class="badge-safe">Aman (${formattedExp})</span>`;
      }
    } else {
      statusExpEl.innerHTML = `<span class="badge-safe">Aman (Tanpa Tanggal Exp)</span>`;
    }

    infoCard.classList.remove('hidden');
    notFoundText.classList.add('hidden');
  } else {
    selectedProdukAktif = null;
    infoCard.classList.add('hidden');
    notFoundText.classList.remove('hidden');
  }
}

function tambahKeKeranjangScanner() {
  if(!selectedProdukAktif) return;
  const qty = parseInt(document.getElementById('scanQty').value) || 1;

  if(qty <= 0) {
    alert("Jumlah beli minimal 1!");
    return;
  }

  if(qty > selectedProdukAktif.stok) {
    alert("Stok barang tidak mencukupi!");
    return;
  }

  const existing = keranjangScanner.find(k => k.kode === selectedProdukAktif.kode);
  if(existing) {
    if(existing.qty + qty > selectedProdukAktif.stok) {
      alert("Melebihi stok tersedia!");
      return;
    }
    existing.qty += qty;
    existing.subtotal = existing.qty * existing.hargaJual;
  } else {
    keranjangScanner.push({
      kode: selectedProdukAktif.kode,
      nama: selectedProdukAktif.nama,
      hargaJual: selectedProdukAktif.jual,
      qty: qty,
      subtotal: selectedProdukAktif.jual * qty
    });
  }

  renderKeranjangScanner();
  document.getElementById('scanResultCode').value = "";
  document.getElementById('productDetailInfo').classList.add('hidden');
  selectedProdukAktif = null;
}

function renderKeranjangScanner() {
  const tbody = document.getElementById('keranjangScannerTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  let total = 0;

  if(keranjangScanner.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Keranjang kosong.</td></tr>`;
    if(document.getElementById('scannerTotalDisplay')) {
      document.getElementById('scannerTotalDisplay').innerText = `Rp 0`;
    }
    return;
  }

  keranjangScanner.forEach((item, idx) => {
    total += item.subtotal;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${item.nama}</b></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td>
          <input type="number" class="form-control" style="width: 80px; padding: 4px 8px;" value="${item.qty}" min="1" 
            oninput="updateQtyScanner(${idx}, this.value)" 
            onkeydown="if(event.key === 'Enter') { this.blur(); }">
        </td>
        <td>Rp ${formatNumber(item.subtotal)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="hapusItemScan(${idx})">Hapus</button></td>
      </tr>
    `;
  });

  if(document.getElementById('scannerTotalDisplay')) {
    document.getElementById('scannerTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  }
  hitungKembalianScanner();
}

function updateQtyScanner(idx, value) {
  const newQty = parseInt(value) || 0;
  if(newQty <= 0) return;

  const item = keranjangScanner[idx];
  const barang = barangList.find(b => b.kode === item.kode);
  
  if(barang && newQty > barang.stok) {
    alert("Stok barang tidak mencukupi!");
    renderKeranjangScanner();
    return;
  }

  item.qty = newQty;
  item.subtotal = item.qty * item.hargaJual;
  
  let total = keranjangScanner.reduce((sum, i) => sum + i.subtotal, 0);
  document.getElementById('scannerTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  
  const rows = document.getElementById('keranjangScannerTbody').rows;
  if(rows[idx]) {
    rows[idx].cells[4].innerText = `Rp ${formatNumber(item.subtotal)}`;
  }
  hitungKembalianScanner();
}

function hapusItemScan(idx) {
  keranjangScanner.splice(idx, 1);
  renderKeranjangScanner();
}

function hitungKembalianScanner() {
  let total = keranjangScanner.reduce((sum, item) => sum + item.subtotal, 0);
  let bayar = parseFloat(document.getElementById('scannerBayar').value) || 0;
  let kembalian = bayar - total;
  document.getElementById('scannerKembalianDisplay').innerText = kembalian >= 0 ? `Rp ${formatNumber(kembalian)}` : `Rp 0`;
}

function selesaikanTransaksiScanner() {
  if(keranjangScanner.length === 0) {
    alert("Keranjang belanja masih kosong!");
    return;
  }
  let total = keranjangScanner.reduce((sum, item) => sum + item.subtotal, 0);
  let bayar = parseFloat(document.getElementById('scannerBayar').value) || 0;

  if(bayar < total) {
    alert("Jumlah pembayaran kurang dari total belanja!");
    return;
  }

  keranjangScanner.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) {
      b.stok -= item.qty;
      if(b.stok < 0) b.stok = 0;
    }
  });

  const transaksiBaru = {
    id: 'TRX-' + Date.now(),
    tanggalRaw: new Date().toISOString().split('T')[0],
    tanggal: new Date().toLocaleString('id-ID'),
    items: [...keranjangScanner],
    total: total,
    bayar: bayar,
    kembalian: bayar - total
  };

  transaksiList.push(transaksiBaru);

  saveDataToStorage();
  renderBarangTable();
  renderRiwayatTransaksi();
  updateDashboardStats();
  updateFinancialSummary();

  alert("Transaksi scanner berhasil diselesaikan! Stok dan data transaksi telah diperbarui.");
  
  keranjangScanner = [];
  document.getElementById('scannerBayar').value = "";
  renderKeranjangScanner();

  showTab('transaksiTab');
}

/* EKSPOR & IMPORT BACKUP */
async function exportDataApp() {
  const dataToExport = {
    appVersion: "1.0",
    exportDate: new Date().toISOString(),
    barangList: barangList,
    pengeluaranList: pengeluaranList,
    transaksiList: transaksiList,
    adminCreds: adminCreds,
    tokoProfile: tokoProfile
  };

  const jsonString = JSON.stringify(dataToExport, null, 2);
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const suggestedName = `backup_sembako_${dd}-${mm}-${yyyy}.json`;

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedName,
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      alert("Data aplikasi berhasil diekspor dan disimpan!");
      return;
    } catch (err) {
      if (err.name !== 'AbortError') console.log(err);
      else return;
    }
  }

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  alert("Data aplikasi berhasil diekspor!");
}

function importDataApp() {
  const fileInput = document.getElementById('importFileJson');
  const file = fileInput.files[0];
  if(!file) {
    alert("Pilih file backup (.json) terlebih dahulu!");
    return;
  }

  if(confirm("Impor data akan menimpa data saat ini. Lanjutkan?")) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if(data.barangList) barangList = data.barangList;
        if(data.pengeluaranList) pengeluaranList = data.pengeluaranList;
        if(data.transaksiList) transaksiList = data.transaksiList;
        if(data.adminCreds) adminCreds = data.adminCreds;
        if(data.tokoProfile) tokoProfile = data.tokoProfile;

        saveDataToStorage();
        loadProfilData();
        renderBarangTable();
        renderPengeluaranTable();
        renderRiwayatTransaksi();
        populateBarangDatalist();
        populateLaporanBarangSelect();
        updateDashboardStats();
        updateFinancialSummary();
        alert("Pemulihan data berhasil!");
      } catch(err) {
        alert("Format file JSON tidak valid!");
      }
    };
    reader.readAsText(file);
  }
}

function previewLiveBarcode() {
  const code = document.getElementById('pengBarcodeCode').value.trim();
  if(code) {
    try {
      JsBarcode("#liveBarcodeSvg", code, { format: "CODE128", width: 2.5, height: 75, displayValue: true, fontSize: 16 });
    } catch(e) { console.log(e); }
  } else {
    document.getElementById('liveBarcodeSvg').innerHTML = "";
  }
}

function savePengeluaran(e) {
  e.preventDefault();
  const idx = document.getElementById('pengeluaranEditIndex').value;
  
  const newItem = {
    tanggal: document.getElementById('pengTgl').value,
    keterangan: document.getElementById('pengKeterangan').value.trim(),
    modal: parseFloat(document.getElementById('pengHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('pengHargaJual').value) || 0,
    barcode: document.getElementById('pengBarcodeCode').value.trim()
  };

  if(idx === "") {
    pengeluaranList.push(newItem);
  } else {
    const oldItem = pengeluaranList[idx];
    pengeluaranList[idx] = newItem;

    barangList.forEach(b => {
      if(b.kode === oldItem.barcode || b.nama.toUpperCase() === oldItem.keterangan.toUpperCase()) {
        b.nama = newItem.keterangan.toUpperCase();
        b.kode = newItem.barcode;
        b.modal = newItem.modal;
        b.jual = newItem.jual;
      }
    });
  }

  saveDataToStorage();
  renderPengeluaranTable();
  renderBarangTable();
  populateBarangDatalist();
  updateFinancialSummary();
  resetPengeluaranForm();
}

function renderPengeluaranTable() {
  const tbody = document.getElementById('pengeluaranTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  const keyword = (document.getElementById('searchPengeluaranInput')?.value || '').toLowerCase();
  const filtered = pengeluaranList.filter(p => p.keterangan.toLowerCase().includes(keyword) || p.barcode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Belum ada data pengeluaran.</td></tr>`;
    return;
  }

  filtered.forEach((p, idx) => {
    const origIdx = pengeluaranList.indexOf(p);
    const svgId = `tableBarcode_peng_${origIdx}`;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateID(p.tanggal)}</td>
        <td><b>${p.keterangan}</b></td>
        <td>Rp ${formatNumber(p.modal)}</td>
        <td>Rp ${formatNumber(p.jual)}</td>
        <td><svg id="${svgId}" class="table-barcode-svg"></svg></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editPengeluaran(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePengeluaran(${origIdx})">Hapus</button>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, p.barcode, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14 }); } catch(err){}
    }, 50);
  });
}

function editPengeluaran(idx) {
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
  const p = pengeluaranList[idx];
  document.getElementById('pengeluaranEditIndex').value = idx;
  document.getElementById('pengTgl').value = p.tanggal;
  document.getElementById('pengKeterangan').value = p.keterangan;
  document.getElementById('pengHargaModal').value = p.modal;
  document.getElementById('pengHargaJual').value = p.jual;
  document.getElementById('pengBarcodeCode').value = p.barcode;
  previewLiveBarcode();
}

function deletePengeluaran(idx) {
  if(confirm("Hapus data pengeluaran ini?")) {
    pengeluaranList.splice(idx, 1);
    saveDataToStorage();
    renderPengeluaranTable();
    populateBarangDatalist();
    updateFinancialSummary();
  }
}

function resetPengeluaranForm() {
  document.getElementById('pengeluaranForm').reset();
  document.getElementById('pengeluaranEditIndex').value = "";
  document.getElementById('liveBarcodeSvg').innerHTML = "";
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
}

function populateBarangDatalist() {
  const datalist = document.getElementById('listPengeluaranBarang');
  if(!datalist) return;
  datalist.innerHTML = '';
  
  pengeluaranList.forEach(p => {
    datalist.innerHTML += `<option value="${p.keterangan}"></option>`;
  });
}

function onInputBarangNama(val) {
  const cleanVal = val.trim().toLowerCase();
  const matched = pengeluaranList.find(p => p.keterangan.toLowerCase() === cleanVal);

  if(matched) {
    document.getElementById('barKode').value = matched.barcode;
    document.getElementById('barHargaModal').value = matched.modal;
    document.getElementById('barHargaJual').value = matched.jual;
  } else {
    document.getElementById('barKode').value = '';
    document.getElementById('barHargaModal').value = '';
    document.getElementById('barHargaJual').value = '';
  }
}

function saveBarang(e) {
  e.preventDefault();
  const idx = document.getElementById('barangEditIndex').value;
  const barcodeVal = document.getElementById('barKode').value.trim();
  
  if(!barcodeVal) {
    alert("Barcode wajib terisi otomatis dari data pengeluaran.");
    return;
  }

  const barang = {
    kode: barcodeVal,
    nama: document.getElementById('barNama').value.toUpperCase().trim(),
    stok: parseInt(document.getElementById('barStok').value) || 0,
    satuan: document.getElementById('barSatuan').value,
    expired: document.getElementById('barExpired').value,
    modal: parseFloat(document.getElementById('barHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('barHargaJual').value) || 0
  };

  if(idx === "") barangList.push(barang);
  else barangList[idx] = barang;

  saveDataToStorage();
  renderBarangTable();
  populateLaporanBarangSelect();
  updateDashboardStats();
  updateFinancialSummary();
  resetBarangForm();
}

function renderBarangTable() {
  const tbody = document.getElementById('barangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  const keyword = (document.getElementById('searchBarangInput')?.value || '').toLowerCase();
  const filtered = barangList.filter(b => b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #777;">Belum ada data barang. Silakan input dari Data Pengeluaran terlebih dahulu.</td></tr>`;
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  filtered.forEach((b, idx) => {
    const origIdx = barangList.indexOf(b);
    const formattedExpDate = formatDateID(b.expired);
    const svgIdBarang = `tableBarcode_bar_${origIdx}`;
    
    let expBadge = formattedExpDate;
    if(b.expired) {
      const expDate = new Date(b.expired);
      expDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      if(diffDays <= 15) {
        let label = diffDays < 0 ? `Expired (${formattedExpDate})` : `${formattedExpDate} (⚠️ ${diffDays} hari)`;
        expBadge = `<span class="badge-expired">${label}</span>`;
      } else {
        expBadge = `<span class="badge-safe">${formattedExpDate}</span>`;
      }
    }

    let stokBadge = `<b>${b.stok}</b> ${b.satuan}`;
    if(b.stok < 3) {
      stokBadge = `<span class="badge-warning">${b.stok} ${b.satuan} (⚠️ Menipis)</span>`;
    }

    tbody.innerHTML += `
      <tr id="barangRow_${origIdx}">
        <td style="width: 10%;">${idx + 1}</td>
        <td style="width: 45%; text-align: center;">
          <svg id="${svgIdBarang}" class="table-barcode-svg"></svg>
          <div style="margin-top: 5px;">
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 2px 6px;" onclick="downloadBarangBarcodePNG(${origIdx})">📥 Download PNG</button>
          </div>
        </td>
        <td style="width: 30%;"><b>${b.nama}</b></td>
        <td style="width: 15%;">
          <button class="btn btn-primary btn-sm" onclick="toggleDetailBarang(${origIdx})" id="btnDetail_${origIdx}">🔍 Detail</button>
        </td>
      </tr>
      <tr id="barangDetailRow_${origIdx}" class="hidden">
        <td colspan="4" style="padding: 0; background-color: #f8fafc;">
          <div style="padding: 15px 20px; border-left: 4px solid #4f46e5; background: #ffffff; margin: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9rem; margin-bottom: 15px; align-items: center;">
              <div><b>Stok:</b> ${stokBadge}</div>
              <div><b>Satuan:</b> ${b.satuan}</div>
              <div style="display: inline-flex; align-items: center; gap: 6px;"><b>Kadaluarsa:</b> ${expBadge}</div>
              <div><b>Harga Modal:</b> Rp ${formatNumber(b.modal)}</div>
              <div><b>Harga Jual:</b> Rp ${formatNumber(b.jual)}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-success btn-sm" onclick="editBarangKeKasir(${origIdx})">🛒 Beli (Kasir)</button>
              <button class="btn btn-primary btn-sm" onclick="editBarang(${origIdx})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteBarang(${origIdx})">Hapus</button>
            </div>
          </div>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgIdBarang}`, b.kode, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14 }); } catch(err){}
    }, 50);
  });
}

function toggleDetailBarang(idx) {
  const detailRow = document.getElementById(`barangDetailRow_${idx}`);
  const btn = document.getElementById(`btnDetail_${idx}`);
  if(detailRow.classList.contains('hidden')) {
    detailRow.classList.remove('hidden');
    btn.innerText = '❌ Tutup';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  } else {
    detailRow.classList.add('hidden');
    btn.innerText = '🔍 Detail';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
  }
}

function downloadBarangBarcodePNG(idx) {
  const barang = barangList[idx];
  if(!barang) return;
  const svgEl = document.getElementById(`tableBarcode_bar_${idx}`);
  if(!svgEl) return;

  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 300;
    canvas.height = img.height || 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    const a = document.createElement('a');
    a.download = `barcode_${barang.nama}_${barang.kode}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  img.src = url;
}

function editBarangKeKasir(idx) {
  showTab('kasirTab');
  setTimeout(() => {
    const b = barangList[idx];
    document.getElementById('kasirBarangInput').value = `${b.nama} (Stok: ${b.stok} ${b.satuan}) - Rp ${formatNumber(b.jual)}`;
    document.getElementById('selectedKasirBarangIndex').value = idx;
    onKasirBarangChange(idx);
  }, 100);
}

function editBarang(idx) {
  toggleForm('barangFormCard', 'barangToggleIcon');
  const b = barangList[idx];
  document.getElementById('barangEditIndex').value = idx;
  document.getElementById('barNama').value = b.nama;
  document.getElementById('barKode').value = b.kode;
  document.getElementById('barStok').value = b.stok;
  document.getElementById('barSatuan').value = b.satuan;
  document.getElementById('barExpired').value = b.expired || new Date().toISOString().split('T')[0];
  document.getElementById('barHargaModal').value = b.modal;
  document.getElementById('barHargaJual').value = b.jual;
}

function deleteBarang(idx) {
  if(confirm("Hapus barang ini?")) {
    barangList.splice(idx, 1);
    saveDataToStorage();
    renderBarangTable();
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function resetBarangForm() {
  document.getElementById('barangForm').reset();
  document.getElementById('barangEditIndex').value = "";
  toggleForm('barangFormCard', 'barangToggleIcon');
}

function onKetikCariBarang() {
  const keyword = document.getElementById('kasirBarangInput').value.toLowerCase().trim();
  const dropdown = document.getElementById('autocompleteDropdown');
  
  if(keyword === "") {
    dropdown.innerHTML = "";
    dropdown.classList.add('hidden');
    document.getElementById('selectedKasirBarangIndex').value = "";
    onKasirBarangChange("");
    return;
  }

  const filtered = barangList.map((b, idx) => ({ ...b, originalIndex: idx })).filter(b => 
    b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword)
  );

  if(filtered.length === 0) {
    dropdown.innerHTML = `<div class="autocomplete-item" style="color: #94a3b8; cursor: default;">Barang tidak ditemukan</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = "";
  filtered.forEach(item => {
    html += `<div class="autocomplete-item" onclick="pilihItemAutocomplete(${item.originalIndex})">
      <b>${item.nama}</b> (Stok: ${item.stok} ${item.satuan}) - Rp ${formatNumber(item.jual)} [Kode: ${item.kode}]
    </div>`;
  });
  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

function pilihItemAutocomplete(idx) {
  const barang = barangList[idx];
  document.getElementById('kasirBarangInput').value = `${barang.nama} (Stok: ${barang.stok} ${barang.satuan}) - Rp ${formatNumber(barang.jual)}`;
  document.getElementById('selectedKasirBarangIndex').value = idx;
  document.getElementById('autocompleteDropdown').classList.add('hidden');
  document.getElementById('kasirQty').value = 1;
  onKasirBarangChange(idx);
}

function onKasirBarangChange(idx) {
  const previewArea = document.getElementById('kasirBarcodePreviewArea');
  const placeholder = document.getElementById('kasirBarcodePlaceholder');

  if(idx !== "" && idx !== undefined && barangList[idx]) {
    const barang = barangList[idx];
    currentSelectedKasirBarcode = barang.kode;
    previewArea.classList.remove('hidden');
    placeholder.classList.add('hidden');
    try {
      JsBarcode("#kasirBarcodeSvg", barang.kode, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14 });
    } catch(e) { console.log(e); }
  } else {
    currentSelectedKasirBarcode = "";
    previewArea.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

function downloadKasirBarcodePNG() {
  if(!currentSelectedKasirBarcode) return;
  const svgEl = document.getElementById('kasirBarcodeSvg');
  if(!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 300;
    canvas.height = img.height || 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    const a = document.createElement('a');
    a.download = `barcode_${currentSelectedKasirBarcode}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  img.src = url;
}

function tambahItemKeranjang() {
  const idx = document.getElementById('selectedKasirBarangIndex').value;
  const qty = parseInt(document.getElementById('kasirQty').value) || 0;
  if(idx === "" || idx === undefined || qty <= 0 || !barangList[idx]) {
    alert("Silakan ketik dan pilih barang yang valid, lalu masukkan jumlah beli!");
    return;
  }

  const barang = barangList[idx];
  if(qty > barang.stok) {
    alert("Stok barang tidak mencukupi!");
    return;
  }

  const existing = keranjangList.find(k => k.kode === barang.kode);
  if(existing) {
    if(existing.qty + qty > barang.stok) {
      alert("Melebihi stok tersedia!");
      return;
    }
    existing.qty += qty;
    existing.subtotal = existing.qty * existing.hargaJual;
  } else {
    keranjangList.push({
      kode: barang.kode,
      nama: barang.nama,
      hargaJual: barang.jual,
      qty: qty,
      subtotal: barang.jual * qty
    });
  }

  renderKeranjang();
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirQty').value = 1;
  document.getElementById('kasirBarcodePreviewArea').classList.add('hidden');
  document.getElementById('kasirBarcodePlaceholder').classList.remove('hidden');
  currentSelectedKasirBarcode = "";
}

function renderKeranjang() {
  const tbody = document.getElementById('keranjangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  let total = 0;

  if(keranjangList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Keranjang masih kosong.</td></tr>`;
    if(document.getElementById('kasirTotalDisplay')) {
      document.getElementById('kasirTotalDisplay').innerText = `Rp 0`;
    }
    return;
  }

  const isEditing = document.getElementById('transaksiEditIndex').value !== "";

  keranjangList.forEach((item, idx) => {
    total += item.subtotal;
    const svgId = `keranjangBarcode_${idx}`;
    const editBadgeLabel = isEditing ? `<span class="badge-edit-mode">Mode Edit</span>` : '';

    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.nama} ${editBadgeLabel}</td>
        <td><svg id="${svgId}" class="table-barcode-svg"></svg></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td>
          <input type="number" class="form-control" style="width: 80px; padding: 4px 8px;" value="${item.qty}" min="1" 
            oninput="updateQtyKeranjang(${idx}, this.value)" 
            onkeydown="if(event.key === 'Enter') { this.blur(); }">
        </td>
        <td>Rp ${formatNumber(item.subtotal)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="hapusItemKeranjang(${idx})">Hapus</button></td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, item.kode, { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12 }); } catch(err){}
    }, 50);
  });

  if(document.getElementById('kasirTotalDisplay')) {
    document.getElementById('kasirTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  }
  hitungKembalian();
}

function updateQtyKeranjang(idx, value) {
  const newQty = parseInt(value) || 0;
  if(newQty <= 0) return;

  const item = keranjangList[idx];
  const barang = barangList.find(b => b.kode === item.kode);
  if(barang && newQty > barang.stok) {
    alert("Stok barang tidak mencukupi!");
    renderKeranjang();
    return;
  }

  item.qty = newQty;
  item.subtotal = item.qty * item.hargaJual;
  
  let total = keranjangList.reduce((sum, i) => sum + i.subtotal, 0);
  document.getElementById('kasirTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  
  const rows = document.getElementById('keranjangTbody').rows;
  if(rows[idx]) {
    rows[idx].cells[5].innerText = `Rp ${formatNumber(item.subtotal)}`;
  }
  hitungKembalian();
}

function hapusItemKeranjang(idx) {
  keranjangList.splice(idx, 1);
  renderKeranjang();
}

function hitungKembalian() {
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  let bayarInput = document.getElementById('kasirBayar').value;
  let bayar = parseFloat(bayarInput) || 0;

  if (bayar > 0 && bayar < total && bayarInput.length <= 2) {
    let bayarRibuan = bayar * 1000;
    if (bayarRibuan >= total) {
      bayar = bayarRibuan;
    }
  }

  let kembalian = bayar - total;
  document.getElementById('kasirKembalianDisplay').innerText = kembalian >= 0 ? `Rp ${formatNumber(kembalian)}` : `Rp 0`;
}

function prosesPembayaran() {
  if(keranjangList.length === 0) {
    alert("Keranjang belanja masih kosong!");
    return;
  }
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  let bayarInput = document.getElementById('kasirBayar').value;
  let bayar = parseFloat(bayarInput) || 0;
  
  if (bayar > 0 && bayar < total && bayarInput.length <= 2) {
    if ((bayar * 1000) >= total) {
      bayar = bayar * 1000;
    }
  }

  if(bayar < total) {
    alert("Jumlah bayar kurang dari total belanja!");
    return;
  }

  const editIdx = document.getElementById('transaksiEditIndex').value;

  keranjangList.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) {
      b.stok -= item.qty;
      if(b.stok < 0) b.stok = 0;
    }
  });

  let trxId = '';
  let tanggalRaw = new Date().toISOString().split('T')[0];
  let tanggalStr = new Date().toLocaleString('id-ID');

  if(editIdx !== "") {
    trxId = transaksiList[editIdx].id;
    tanggalRaw = transaksiList[editIdx].tanggalRaw;
    tanggalStr = transaksiList[editIdx].tanggal;
    transaksiList.splice(editIdx, 1);
  } else {
    trxId = 'TRX-' + Date.now();
  }

  const transaksi = {
    id: trxId,
    tanggalRaw: tanggalRaw,
    tanggal: tanggalStr,
    items: [...keranjangList],
    total: total,
    bayar: bayar,
    kembalian: bayar - total
  };

  transaksiList.push(transaksi);

  saveDataToStorage();
  renderBarangTable();
  renderRiwayatTransaksi();
  resetKasirForm();
  updateDashboardStats();
  updateFinancialSummary();

  alert("Transaksi berhasil diperbarui dan disimpan! Stok barang otomatis dikurangi.");
  showTab('transaksiTab');
}

function resetKasirForm() {
  keranjangList = [];
  document.getElementById('transaksiEditIndex').value = "";
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirBayar').value = "";
  document.getElementById('kasirFormTitle').innerText = "🛒 Kasir Penjualan Toko Sembako";
  document.getElementById('btnSimpanTransaksi').innerText = "✅ Selesaikan Transaksi";
  document.getElementById('btnBatalEditTransaksi').classList.add('hidden');
  document.getElementById('kasirBarcodePreviewArea').classList.add('hidden');
  document.getElementById('kasirBarcodePlaceholder').classList.remove('hidden');
  currentSelectedKasirBarcode = "";
  renderKeranjang();
}

function batalEditTransaksi() {
  resetKasirForm();
  showTab('transaksiTab');
}

function filterSimpanTransaksi(tipe) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  if(tipe === 'all') {
    currentFilteredTransaksi = [...transaksiList];
    document.getElementById('riwayatHeaderTitle').innerText = "📜 Riwayat Data Transaksi Penjualan (Semua)";
  } else if(tipe === 'harian') {
    currentFilteredTransaksi = transaksiList.filter(t => (t.tanggalRaw || t.tanggal.split(',')[0]) === todayStr);
    document.getElementById('riwayatHeaderTitle').innerText = `📜 Riwayat Data Transaksi Penjualan (Harian: ${formatDateID(todayStr)})`;
  } else if(tipe === 'mingguan') {
    const past7Days = new Date();
    past7Days.setDate(today.getDate() - 7);
    currentFilteredTransaksi = transaksiList.filter(t => {
      const tgl = new Date(t.tanggalRaw || Date.now());
      return tgl >= past7Days && tgl <= today;
    });
    document.getElementById('riwayatHeaderTitle').innerText = `📜 Riwayat Data Transaksi Penjualan (7 Hari Terakhir)`;
  } else if(tipe === 'bulanan') {
    currentFilteredTransaksi = transaksiList.filter(t => {
      const tgl = new Date(t.tanggalRaw || Date.now());
      return tgl.getFullYear() === currentYear && tgl.getMonth() === currentMonth;
    });
    document.getElementById('riwayatHeaderTitle').innerText = `📜 Riwayat Data Transaksi Penjualan (Bulanan)`;
  } else if(tipe === 'tahunan') {
    currentFilteredTransaksi = transaksiList.filter(t => {
      const tgl = new Date(t.tanggalRaw || Date.now());
      return tgl.getFullYear() === currentYear;
    });
    document.getElementById('riwayatHeaderTitle').innerText = `📜 Riwayat Data Transaksi Penjualan (Tahunan ${currentYear})`;
  }

  renderRiwayatTransaksiFiltered();
}

function renderRiwayatTransaksi() {
  currentFilteredTransaksi = [...transaksiList];
  document.getElementById('riwayatHeaderTitle').innerText = "📜 Riwayat Data Transaksi Penjualan (Semua)";
  renderRiwayatTransaksiFiltered();
}

function renderRiwayatTransaksiFiltered() {
  const tbody = document.getElementById('riwayatTransaksiTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  if(currentFilteredTransaksi.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Tidak ada data transaksi untuk kategori ini.</td></tr>`;
    return;
  }

  let totalKeseluruhan = 0;

  currentFilteredTransaksi.forEach((t, idx) => {
    const originalIndex = transaksiList.indexOf(t);
    const namaBarangUtama = t.items.map((i, iIdx) => `${iIdx + 1}. ${i.nama} (${i.qty}x)`).join('<br>');
    totalKeseluruhan += t.total;
    
    tbody.innerHTML += `
      <tr style="vertical-align: middle;">
        <td>${idx + 1}</td>
        <td style="line-height: 1.6; padding: 10px;"><b>${namaBarangUtama}</b></td>
        <td>${t.tanggal}</td>
        <td>${t.items.length} item</td>
        <td>Rp ${formatNumber(t.total)}</td>
        <td class="no-print">
          <button class="btn btn-secondary btn-sm" onclick="bukaModalCetakNota(${originalIndex})">🖨️ Cetak Nota</button>
          <button class="btn btn-primary btn-sm" onclick="editTransaksi(${originalIndex})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTransaksi(${originalIndex})">🗑️ Hapus</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML += `
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td colspan="4" style="text-align: right;">TOTAL KESELURUHAN:</td>
      <td colspan="2" style="color: #16a34a;">Rp ${formatNumber(totalKeseluruhan)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td colspan="6">
        <div style="font-size: 0.9rem; color: #334155; padding: 5px 0;">
          <b>Terbilang:</b> <i>${getTerbilangRupiah(totalKeseluruhan)}</i>
        </div>
      </td>
    </tr>
  `;
}

function cetakDataTransaksiTerfilter() {
  window.print();
}

function bukaModalCetakNota(idx) {
  const t = transaksiList[idx];
  
  let itemsHtml = '';
  t.items.forEach(i => {
    itemsHtml += `
      <tr>
        <td colspan="2" style="padding-top: 4px;"><b>${i.nama}</b></td>
      </tr>
      <tr>
        <td>${i.qty} PCS x ${formatNumber(i.hargaJual)}</td>
        <td style="text-align: right;">${formatNumber(i.subtotal)}</td>
      </tr>
    `;
  });

  let strukHtml = `
    <div class="receipt-header">
      <h4>${tokoProfile.nama}</h4>
      <p>${tokoProfile.alamat}</p>
      <p>Telp: ${tokoProfile.telp}</p>
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-info" style="font-size: 0.75rem; margin-bottom: 5px;">
      <span>Tgl : ${t.tanggal}</span><br>
      <span>Kasir : admin</span><br>
      <span>Struk : #${t.id || (idx + 1)}</span>
    </div>
    <div class="receipt-divider"></div>
    <table class="receipt-items-table">
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <div class="receipt-divider"></div>
    <div class="receipt-totals">
      <div class="row"><span>TOTAL :</span> <b>Rp ${formatNumber(t.total)}</b></div>
      <div class="row"><span>TUNAI :</span> <span>Rp ${formatNumber(t.bayar)}</span></div>
      <div class="row"><span>KEMBALI :</span> <span>Rp ${formatNumber(t.kembalian)}</span></div>
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer">
      <p>${tokoProfile.notes}</p>
      <p>LAYANAN KONSUMEN: ${tokoProfile.telp}</p>
      <p style="margin-top: 5px;">Terima Kasih & Selamat Belanja Kembali</p>
    </div>
  `;

  document.getElementById('printReceiptContent').innerHTML = strukHtml;
  document.getElementById('printModalOverlay').classList.remove('hidden');
}

function closePrintModal() {
  document.getElementById('printModalOverlay').classList.add('hidden');
}

function triggerWindowPrint() {
  window.print();
}

function editTransaksi(idx) {
  const t = transaksiList[idx];
  if(confirm(`Edit transaksi ini? Item dan jumlah beli akan dimuat ke Kasir.`)) {
    t.items.forEach(item => {
      const b = barangList.find(x => x.kode === item.kode);
      if(b) b.stok += item.qty;
    });

    keranjangList = t.items.map(i => ({ ...i }));
    showTab('kasirTab');
    document.getElementById('transaksiEditIndex').value = idx;
    document.getElementById('kasirBayar').value = t.bayar;
    document.getElementById('kasirFormTitle').innerText = `✏️ Edit Transaksi Penjualan`;
    document.getElementById('btnSimpanTransaksi').innerText = "🔄 Perbarui Transaksi";
    document.getElementById('btnBatalEditTransaksi').classList.remove('hidden');
    renderKeranjang();
  }
}

function deleteTransaksi(idx) {
  if(confirm("Yakin ingin menghapus riwayat transaksi ini?")) {
    const t = transaksiList[idx];
    t.items.forEach(item => {
      const b = barangList.find(x => x.kode === item.kode);
      if(b) b.stok += item.qty;
    });

    transaksiList.splice(idx, 1);
    saveDataToStorage();
    renderRiwayatTransaksi();
    renderBarangTable();
    updateDashboardStats();
    updateFinancialSummary();
    alert("Transaksi berhasil dihapus dan stok dikembalikan.");
  }
}

function populateLaporanBarangSelect() {
  const select = document.getElementById('laporanBarangSelect');
  if(!select) return;
  select.innerHTML = '<option value="">-- Semua Barang --</option>';
  barangList.forEach(b => {
    select.innerHTML += `<option value="${b.nama}">${b.nama}</option>`;
  });
}

function terbilang(nilai) {
  nilai = Math.abs(nilai);
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let temp = "";
  
  if (nilai < 12) {
    temp = " " + angka[nilai];
  } else if (nilai < 20) {
    temp = terbilang(nilai - 10) + " Belas";
  } else if (nilai < 100) {
    temp = terbilang(Math.floor(nilai / 10)) + " Puluh" + terbilang(nilai % 10);
  } else if (nilai < 200) {
    temp = " Seratus" + terbilang(nilai - 100);
  } else if (nilai < 1000) {
    temp = terbilang(Math.floor(nilai / 100)) + " Ratus" + terbilang(nilai % 100);
  } else if (nilai < 2000) {
    temp = " Seribu" + terbilang(nilai - 1000);
  } else if (nilai < 1000000) {
    temp = terbilang(Math.floor(nilai / 1000)) + " Ribu" + terbilang(nilai % 1000);
  } else if (nilai < 1000000000) {
    temp = terbilang(Math.floor(nilai / 1000000)) + " Juta" + terbilang(nilai % 1000000);
  }
  return temp;
}

function getTerbilangRupiah(nominal) {
  if (nominal === 0) return "Nol Rupiah";
  let hasil = terbilang(nominal).trim();
  return hasil + " Rupiah";
}

function filterLaporan() {
  const namaBarang = document.getElementById('laporanBarangSelect').value;
  const tglDari = document.getElementById('laporanTglDari').value;
  const tglSampai = document.getElementById('laporanTglSampai').value;
  const tbody = document.getElementById('laporanTbody');
  if(!tbody) return;
  
  tbody.setAttribute('data-filtered', 'true');
  tbody.innerHTML = "";

  if(!tglDari || !tglSampai) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Silakan pilih tanggal Dari dan S.d Tanggal, lalu klik 'Filter Laporan'.</td></tr>`;
    return;
  }

  let filtered = [];

  transaksiList.forEach(t => {
    const matchTanggal = (t.tanggalRaw || t.tanggal.split(',')[0]) >= tglDari && (t.tanggalRaw || t.tanggal.split(',')[0]) <= tglSampai;
    if(!matchTanggal) return;

    if(namaBarang) {
      // Filter item di dalam transaksi yang hanya sesuai dengan barang yang dipilih
      const matchedItems = t.items.filter(i => i.nama.toLowerCase() === namaBarang.toLowerCase());
      if(matchedItems.length > 0) {
        // Hitung total khusus untuk barang tersebut dalam transaksi ini
        const subtotalBarang = matchedItems.reduce((sum, i) => sum + i.subtotal, 0);
        
        filtered.push({
          ...t,
          items: matchedItems,
          total: subtotalBarang
        });
      }
    } else {
      // Jika tidak memilih barang (tampilkan semua)
      filtered.push({ ...t });
    }
  });

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Tidak ada data laporan dalam rentang tanggal tersebut.</td></tr>`;
    return;
  }

  let totalKeseluruhan = 0;

  filtered.forEach((t, idx) => {
    const origIdx = transaksiList.findIndex(x => x.id === t.id);
    const itemStr = t.items.map(i => `${i.nama} (Qty: ${i.qty})`).join(', ');
    const namaBarangUtama = t.items.length > 0 ? t.items[0].nama : '-';
    totalKeseluruhan += t.total;

    tbody.innerHTML += `
      <tr style="vertical-align: middle;">
        <td>${idx + 1}</td>
        <td>${formatDateID(t.tanggalRaw || t.tanggal)}</td>
        <td><b>${namaBarangUtama}</b></td>
        <td>${itemStr}</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print">
          <button class="btn btn-primary btn-sm" onclick="bukaModalCetakNota(${origIdx !== -1 ? origIdx : 0})">Detail / Cetak</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTransaksi(${origIdx !== -1 ? origIdx : 0})">Hapus</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML += `
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td colspan="4" style="text-align: right;">TOTAL KESELURUHAN:</td>
      <td colspan="2" style="color: #16a34a;">Rp ${formatNumber(totalKeseluruhan)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td colspan="6">
        <div style="font-size: 0.9rem; color: #334155; padding: 5px 0;">
          <b>Terbilang:</b> <i>${getTerbilangRupiah(totalKeseluruhan)}</i>
        </div>
      </td>
    </tr>
  `;
}

function cetakRekapLaporan() {
  window.print();
}

function loadProfilData() {
  if(!document.getElementById('profilUsername')) return;
  
  document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  const faviconEl = document.getElementById('browserFavicon');
  if (faviconEl && tokoProfile.logo) {
    faviconEl.href = tokoProfile.logo;
  }

  document.getElementById('profilUsername').value = adminCreds.username;
  document.getElementById('tokoNama').value = tokoProfile.nama;
  document.getElementById('tokoTelp').value = tokoProfile.telp;
  document.getElementById('tokoAlamat').value = tokoProfile.alamat;
  document.getElementById('tokoNotes').value = tokoProfile.notes;

  document.getElementById('userDisplayName').innerText = adminCreds.username;
  document.getElementById('dashboardCompanyName').innerText = tokoProfile.nama;
  document.getElementById('dashboardCompanyAlamat').innerText = tokoProfile.alamat;
  document.getElementById('printHeaderCompanyName').innerText = tokoProfile.nama;
  document.getElementById('printHeaderCompanyAlamat').innerText = tokoProfile.alamat;
  document.getElementById('navBrandText').innerText = tokoProfile.nama;
  document.getElementById('bannerStoreName').innerText = tokoProfile.nama;
  document.getElementById('bannerTelp').innerText = tokoProfile.telp;
  document.getElementById('bannerAlamat').innerText = tokoProfile.alamat;
  document.getElementById('sidebarUserText').innerText = `Halo, ${adminCreds.username}`;
  document.getElementById('loginPortalTitle').innerText = tokoProfile.nama;
  document.getElementById('loginPortalSubtitle').innerText = `Sistem Manajemen Toko & Kasir`;
  document.getElementById('loginFooterCopyright').innerText = `© 2026 ${tokoProfile.nama}`;

  tempAvatarBase64 = adminCreds.avatar || '';
  if(adminCreds.avatar) {
    document.getElementById('previewAvatarImg').src = adminCreds.avatar;
    document.getElementById('previewAvatarImg').classList.remove('hidden');
    document.getElementById('previewAvatarIcon').classList.add('hidden');
    document.getElementById('navUserAvatarImg').src = adminCreds.avatar;
    document.getElementById('navUserAvatarImg').classList.remove('hidden');
    document.getElementById('navUserAvatarIcon').classList.add('hidden');
  } else {
    document.getElementById('previewAvatarImg').classList.add('hidden');
    document.getElementById('previewAvatarIcon').classList.remove('hidden');
    document.getElementById('navUserAvatarImg').classList.add('hidden');
    document.getElementById('navUserAvatarIcon').classList.remove('hidden');
  }

  tempLogoBase64 = tokoProfile.logo || '';
  if(tokoProfile.logo) {
    document.getElementById('previewLogoImg').src = tokoProfile.logo;
    document.getElementById('previewLogoImg').classList.remove('hidden');
    document.getElementById('previewLogoIcon').classList.add('hidden');
    document.getElementById('navBrandImg').src = tokoProfile.logo;
    document.getElementById('navBrandImg').classList.remove('hidden');
    document.getElementById('bannerLogoImg').src = tokoProfile.logo;
    document.getElementById('bannerLogoImg').classList.remove('hidden');
    document.getElementById('bannerLogoIcon').classList.add('hidden');
  } else {
    document.getElementById('previewLogoImg').classList.add('hidden');
    document.getElementById('previewLogoIcon').classList.remove('hidden');
    document.getElementById('navBrandImg').classList.add('hidden');
    document.getElementById('bannerLogoImg').classList.add('hidden');
    document.getElementById('bannerLogoIcon').classList.remove('hidden');
  }
}

function previewAvatar(e) {
  const file = e.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      tempAvatarBase64 = event.target.result;
      const img = document.getElementById('previewAvatarImg');
      img.src = tempAvatarBase64;
      img.classList.remove('hidden');
      document.getElementById('previewAvatarIcon').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function hapusFotoAdmin() {
  if(confirm("Yakin ingin menghapus foto profil admin?")) {
    adminCreds.avatar = '';
    tempAvatarBase64 = '';
    document.getElementById('profilAvatarFile').value = '';
    saveDataToStorage();
    loadProfilData();
    alert("Foto profil admin berhasil dihapus!");
  }
}

function previewLogo(e) {
  const file = e.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      tempLogoBase64 = event.target.result;
      const img = document.getElementById('previewLogoImg');
      img.src = tempLogoBase64;
      img.classList.remove('hidden');
      document.getElementById('previewLogoIcon').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function hapusLogoToko() {
  if(confirm("Yakin ingin menghapus logo perusahaan/toko?")) {
    tokoProfile.logo = '';
    tempLogoBase64 = '';
    document.getElementById('tokoLogoFile').value = '';
    saveDataToStorage();
    loadProfilData();
    alert("Logo perusahaan/toko berhasil dihapus!");
  }
}

function saveProfilAdmin(e) {
  e.preventDefault();
  adminCreds.username = document.getElementById('profilUsername').value;
  const p = document.getElementById('profilPassword').value;
  if(p.trim() !== "") adminCreds.password = p;
  if(tempAvatarBase64) adminCreds.avatar = tempAvatarBase64;

  saveDataToStorage();
  loadProfilData();
  document.getElementById('profilPassword').value = '';
  alert("Profil admin berhasil diperbarui!");
}

function saveProfilToko(e) {
  e.preventDefault();
  tokoProfile.nama = document.getElementById('tokoNama').value;
  tokoProfile.telp = document.getElementById('tokoTelp').value;
  tokoProfile.alamat = document.getElementById('tokoAlamat').value;
  tokoProfile.notes = document.getElementById('tokoNotes').value;
  if(tempLogoBase64) tokoProfile.logo = tempLogoBase64;

  saveDataToStorage();
  loadProfilData();
  alert("Profil toko & logo berhasil disimpan!");
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}