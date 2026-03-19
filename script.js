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
    
    // 按分類群組
    const groups = items.reduce((acc, item) => {
        const cat = item.category || "其他";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    for (const [cat, products] of Object.entries(groups)) {
        container.innerHTML += `<h3 class="menu-category">${cat}</h3>`;
        products.forEach(item => {
            // 建立品項卡片
            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = () => openOrderModal(item); // 點擊卡片開啟彈窗
            
            // 顯示價格預覽
            let priceText = item.small_price ? `小: $${item.small_price}` : "";
            if(item.big_price) priceText += ` / 大: $${item.big_price}`;

            card.innerHTML = `
                <div class="product-info">
                    <span class="product-name">${item.item_name}</span>
                    <div style="font-size:12px; color:gray;">${priceText}</div>
                </div>
                <div class="plus-icon">+</div>
            `;
            container.appendChild(card);
        });
    }
}

// --- 彈窗控制邏輯 ---

function openOrderModal(item) {
    currentSelectItem = { 
        ...item, 
        selectedSize: item.small_price ? '小' : '大', // 預設選小，若無小則選大
        selectedPrice: item.small_price || item.big_price,
        selectedOther: "無"
    };

    document.getElementById('modal-item-name').innerText = item.item_name;
    const sizeArea = document.getElementById('modal-size-options');
    const otherArea = document.getElementById('modal-other-options');
    
    // 1. 生成大小碗選項
    sizeArea.innerHTML = "";
    if(item.small_price) addOptionBtn(sizeArea, '小', item.small_price, 'size');
    if(item.big_price) addOptionBtn(sizeArea, '大', item.big_price, 'size');

    // 2. 生成 Other 選項 (口味/肉類)
    otherArea.innerHTML = "";
    if(item.other && item.other !== "無") {
        const options = item.other.split('/');
        options.forEach(opt => addOptionBtn(otherArea, opt, null, 'other'));
    } else {
        otherArea.innerHTML = "<small style='color:gray'>無特殊選項</small>";
    }

    document.getElementById('order-modal').classList.remove('hidden');
}

function addOptionBtn(container, label, price, type) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerText = price ? `${label} ($${price})` : label;
    
    // 預設選中邏輯
    if(type === 'size' && label === currentSelectItem.selectedSize) btn.classList.add('selected');

    btn.onclick = () => {
        // 切換按鈕樣式
        container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        // 更新暫存資料
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
    document.getElementById('order-modal').classList.add('hidden');
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
