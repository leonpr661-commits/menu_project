// 全域變數：儲存點餐紀錄
let myOrder = [];

// --- 核心：強大且相容中文的 CSV 解析工具 ---
function parseCSV(text) {
    // 1. 移除 UTF-8 BOM 隱藏字元 (防止第一個欄位變成 undefined)
    if (text.startsWith('\uFEFF')) {
        text = text.substring(1);
    }
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.substring(1);
    }

    // 2. 切分行並過濾掉空行
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return [];

    // 3. 取得標題列並清理空格
    const headers = lines[0].split(',').map(h => h.trim());
    console.log("偵測到的標題欄位:", headers); // 偵錯用

    // 4. 解析每一行數據
    return lines.slice(1).map((line, lineIdx) => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, i) => {
            // 如果該列資料不足，給予空字串，避免 undefined
            obj[header] = values[i] !== undefined ? values[i] : "";
        });
        return obj;
    });
}

// 網頁初始化
window.onload = () => {
    loadAllMise();
    updateCartUI();
};

// --- A. 商家清單處理 ---
async function loadAllMise() {
    const container = document.getElementById('shop-container');
    container.innerHTML = '<p>商家載入中...</p>';

    try {
        // 使用 timestamp 確保抓到 GitHub 最新檔案
        const response = await fetch('all_mise.csv?t=' + new Date().getTime());
        if (!response.ok) throw new Error('找不到 all_mise.csv 檔案');
        
        const text = await response.text();
        const shops = parseCSV(text);
        
        if (shops.length === 0) {
            container.innerHTML = '<p>總表內無資料</p>';
            return;
        }

        // 渲染商家卡片
        container.innerHTML = shops.map(shop => {
            // 這裡做個保險：如果欄位抓不到，顯示提示文字
            const shopName = shop.name || "名稱讀取失敗";
            const shopAddr = shop.address || "地址讀取失敗";
            const shopId = shop.id || "";

            return `
                <div class="card" onclick="loadCSVMenu('${shopId}', '${shopName}')">
                    <h3>${shopName}</h3>
                    <p style="font-size:12px; color:gray;">${shopAddr}</p>
                </div>
            `;
        }).join('');
        
    } catch (err) {
        container.innerHTML = `<p style="color:red">無法載入商家列表：<br>${err.message}</p>`;
        console.error("載入失敗詳情:", err);
    }
}

// --- B. 產品菜單處理 ---
async function loadCSVMenu(shopId, shopName) {
    if (!shopId) {
        alert("此商家缺少 ID，無法載入菜單");
        return;
    }

    const container = document.getElementById('product-container');
    document.getElementById('shop-container').classList.add('hidden');
    document.getElementById('product-view').classList.remove('hidden');
    document.getElementById('current-shop-name').innerText = shopName;
    container.innerHTML = '<p>菜單載入中...</p>';

    try {
        const response = await fetch(`${shopId}.csv?t=` + new Date().getTime());
        if (!response.ok) throw new Error(`找不到菜單檔案: ${shopId}.csv`);
        
        const text = await response.text();
        const data = parseCSV(text);
        renderMenu(data);
    } catch (err) {
        container.innerHTML = `<p style="color:red">無法加載菜單: ${err.message}</p>`;
    }
}

// --- C. 渲染產品菜單 ---
let currentSelectItem = null; // 暫存目前正在點選的品項資訊

// --- 更新後的渲染菜單 ---
function renderMenu(items) {
    const container = document.getElementById('product-container');
    container.innerHTML = '';
    
    // 取得 CSV 欄位名稱 (自動相容大小寫)
    const first = items[0] || {};
    const keyCat = Object.keys(first).find(k => k.toLowerCase().includes('category')) || 'category';
    const keyName = Object.keys(first).find(k => k.toLowerCase().includes('item_name')) || 'item_name';
    const keyBig = Object.keys(first).find(k => k.toLowerCase().includes('big')) || 'big_price';
    const keySmall = Object.keys(first).find(k => k.toLowerCase().includes('small')) || 'small_price';
    const keyOther = Object.keys(first).find(k => k.toLowerCase().includes('other')) || 'other';

    const groups = items.reduce((acc, item) => {
        const cat = item[keyCat] || "其他";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    for (const [cat, products] of Object.entries(groups)) {
        container.innerHTML += `<h3 class="menu-category">${cat}</h3>`;
        
        products.forEach(item => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.cursor = 'pointer'; // 讓滑鼠變成手指形狀
            
            // 點擊整塊卡片觸發彈窗
            card.onclick = () => {
                console.log("點擊了品項:", item[keyName]); // 偵錯用
                openOrderModal(item, keyName, keyBig, keySmall, keyOther);
            };

            const pBig = item[keyBig] ? `大: $${item[keyBig]}` : "";
            const pSmall = item[keySmall] ? `小: $${item[keySmall]}` : "";
            const priceInfo = [pSmall, pBig].filter(p => p).join(' / ');

            card.innerHTML = `
                <div class="product-info">
                    <span class="product-name" style="font-weight:bold; font-size:1.1rem;">${item[keyName]}</span>
                    <div style="font-size:0.85rem; color:gray; margin-top:4px;">${priceInfo}</div>
                </div>
                <div class="plus-icon" style="color:#ff6b6b; font-size:1.5rem;">+</div>
            `;
            container.appendChild(card);
        });
    }
}

// --- 彈窗控制邏輯 ---

let currentSelectItem = null; 

function openOrderModal(item, keyName, keyBig, keySmall, keyOther) {
    // 初始化暫存資料
    currentSelectItem = {
        name: item[keyName],
        bigPrice: item[keyBig],
        smallPrice: item[keySmall],
        otherStr: item[keyOther],
        selectedSize: item[keySmall] ? '小' : '大',
        selectedPrice: item[keySmall] || item[keyBig],
        selectedOther: "原味/預設" 
    };

    // 顯示名稱
    document.getElementById('modal-item-name').innerText = currentSelectItem.name;

    // 處理大小選項
    const sizeArea = document.getElementById('modal-size-options');
    sizeArea.innerHTML = "";
    if(item[keySmall]) createOptionBtn(sizeArea, '小', item[keySmall], 'size');
    if(item[keyBig]) createOptionBtn(sizeArea, '大', item[keyBig], 'size');

    // 處理其他選項 (口味)
    const otherArea = document.getElementById('modal-other-options');
    otherArea.innerHTML = "";
    if(item[keyOther] && item[keyOther] !== "無") {
        const opts = item[keyOther].split('/');
        opts.forEach(opt => createOptionBtn(otherArea, opt, null, 'other'));
        currentSelectItem.selectedOther = opts[0]; // 預設選第一個
    } else {
        otherArea.innerHTML = "<small style='color:gray'>無特殊選項</small>";
        currentSelectItem.selectedOther = "無";
    }

    // 顯示彈窗 (移除 hidden 類別)
    const modal = document.getElementById('order-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // 強制確保它是 flex 顯示
}

function createOptionBtn(container, label, price, type) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    if (label === currentSelectItem.selectedSize || label === currentSelectItem.selectedOther) {
        btn.classList.add('selected');
    }
    
    btn.innerText = price ? `${label} ($${price})` : label;
    
    btn.onclick = () => {
        container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if(type === 'size') {
            currentSelectItem.selectedSize = label;
            currentSelectItem.selectedPrice = price;
        } else {
            currentSelectItem.selectedOther = label;
        }
    };
    container.appendChild(btn);
}

function closeModal() {
    const modal = document.getElementById('order-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}
function confirmOrder() {
    const item = {
        name: currentSelectItem.item_name,
        size: currentSelectItem.selectedSize,
        price: currentSelectItem.selectedPrice,
        other: currentSelectItem.selectedOther,
        time: new Date().toLocaleTimeString()
    };
    
    myOrder.push(item);
    updateCartUI(); // 更新紀錄區
    closeModal();
    
    // 成功提示
    alert(`已加入：${item.name} (${item.size}) - ${item.other}`);
}

// 修改 updateCartUI 顯示詳細資訊
function updateCartUI() {
    document.getElementById('cart-count').innerText = myOrder.length;
    const list = document.getElementById('history-list');
    const totalSpan = document.getElementById('total-price');
    
    let total = 0;
    list.innerHTML = myOrder.map(item => {
        total += parseInt(item.price);
        return `
            <div class="history-item">
                <div>
                    <strong>${item.name}</strong> (${item.size})<br>
                    <small>口味：${item.other}</small>
                </div>
                <div style="color:#ff6b6b; font-weight:bold;">$${item.price}</div>
            </div>
        `;
    }).join('');
    totalSpan.innerText = total;
}
// --- D. 點餐與 UI 控制 ---
function addToOrder(e, name, size, price) {
    const item = { name, size, price, time: new Date().toLocaleTimeString() };
    myOrder.push(item);
    updateCartUI();
    
    const btn = e.target;
    const originalText = btn.innerText;
    btn.innerText = "已加入!";
    setTimeout(() => btn.innerText = originalText, 800);
}

function updateCartUI() {
    document.getElementById('cart-count').innerText = myOrder.length;
    const list = document.getElementById('history-list');
    const totalSpan = document.getElementById('total-price');
    
    if (myOrder.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:gray; padding:20px;">尚無點餐紀錄</p>';
        if(totalSpan) totalSpan.innerText = '0';
        return;
    }

    let total = 0;
    list.innerHTML = myOrder.map(item => {
        total += parseInt(item.price || 0);
        return `
            <div class="history-item">
                <div><strong>${item.name}</strong> (${item.size})</div>
                <div style="color:#ff6b6b; font-weight:bold;">$${item.price}</div>
            </div>
        `;
    }).join('');
    if(totalSpan) totalSpan.innerText = total;
}

function backToShops() {
    document.getElementById('shop-container').classList.remove('hidden');
    document.getElementById('product-view').classList.add('hidden');
}

function showSection(id) {
    document.querySelectorAll('.content-block').forEach(b => b.classList.add('hidden'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(id).classList.remove('hidden');
    document.getElementById('nav-' + id.split('-')[0]).classList.add('active');
}
