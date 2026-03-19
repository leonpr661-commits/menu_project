// 全域變數
let myOrder = [];

function parseCSV(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return headers.reduce((obj, header, i) => { 
            obj[header] = values[i] || ""; 
            return obj; 
        }, {});
    });
}

// 網頁初始化
window.onload = () => {
    loadAllMise(); // 改為從外部讀取商家總表
    updateCartUI();
};

// --- A. 商家清單處理 (從 CSV 讀取) ---

async function loadAllMise() {
    const container = document.getElementById('shop-container');
    container.innerHTML = '載入商家中...';

    try {
        // 抓取商家總表 CSV
        const response = await fetch('./data/all_mise.csv');
        if (!response.ok) throw new Error('找不到商家總表 (all_mise.csv)');
        
        const text = await response.text();
        const shops = parseCSV(text); // 使用我們寫好的解析工具
        
        // 渲染商家卡片
        container.innerHTML = shops.map(shop => `
            <div class="card" onclick="loadCSVMenu('${shop.id}', '${shop.name}')">
                <h3>${shop.name}</h3>
                <p style="font-size:12px; color:gray;">${shop.address}</p>
            </div>
        `).join('');
        
    } catch (err) {
        container.innerHTML = `<p style="color:red">無法載入商家列表：${err.message}</p>`;
    }
}

// --- B. 產品菜單處理 (從對應 ID 的 CSV 讀取) ---

async function loadCSVMenu(shopId, shopName) {
    const container = document.getElementById('product-container');
    document.getElementById('shop-container').classList.add('hidden');
    document.getElementById('product-view').classList.remove('hidden');
    document.getElementById('current-shop-name').innerText = shopName;
    container.innerHTML = '讀取菜單中...';

    try {
        // 這裡會動態抓取對應 ID 的 CSV (例如 R_03.csv)
        const response = await fetch(`./data/${shopId}.csv`);
        if (!response.ok) throw new Error(`找不到該店家的菜單 (${shopId}.csv)`);
        
        const text = await response.text();
        const data = parseCSV(text);
        renderMenu(data);
    } catch (err) {
        container.innerHTML = `
            <div style="padding: 20px; text-align:center;">
                <p style="color:red; margin-bottom: 10px;">目前尚無此店家的菜單資料</p>
                <small>請確認 data/${shopId}.csv 是否存在</small>
            </div>
        `;
    }
}

// --- C. 核心解析工具 (CSV 轉物件) ---


// --- D. 渲染菜單 ---
function renderMenu(items) {
    const container = document.getElementById('product-container');
    container.innerHTML = '';
    
    // 按分類群組資料
    const groups = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = {};
        if (!acc[item.category][item.item_name]) acc[item.category][item.item_name] = [];
        acc[item.category][item.item_name].push(item);
        return acc;
    }, {});

    for (const [cat, products] of Object.entries(groups)) {
        container.innerHTML += `<h3 class="menu-category">${cat}</h3>`;
        for (const [name, options] of Object.entries(products)) {
            let btns = options.map(opt => `
                <button class="order-btn" onclick="addToOrder('${name}', '${opt.size}', ${opt.price})">
                    ${opt.size}: $${opt.price}
                </button>
            `).join('');
            container.innerHTML += `
                <div class="product-card">
                    <span class="product-name">${name}</span>
                    <div class="price-options">${btns}</div>
                </div>`;
        }
    }
}

// --- E. 點餐與 UI 控制 (保持不變) ---

function addToOrder(name, size, price) {
    const item = { name, size, price, time: new Date().toLocaleTimeString() };
    myOrder.push(item);
    updateCartUI();
    // 小提示功能
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "已加入!";
    setTimeout(() => btn.innerText = originalText, 1000);
}

function updateCartUI() {
    document.getElementById('cart-count').innerText = myOrder.length;
    const list = document.getElementById('history-list');
    const totalSpan = document.getElementById('total-price');
    
    if (myOrder.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:gray; padding:20px;">尚無點餐紀錄，快去點餐吧！</p>';
        totalSpan.innerText = '0';
        return;
    }

    let total = 0;
    list.innerHTML = myOrder.map((item, index) => {
        total += parseInt(item.price);
        return `
            <div class="history-item">
                <div>
                    <strong>${item.name}</strong> (${item.size})<br>
                    <small style="color:gray;">${item.time}</small>
                </div>
                <div style="color:#ff6b6b; font-weight:bold;">$${item.price}</div>
            </div>
        `;
    }).join('');
    totalSpan.innerText = total;
}

function clearOrder() {
    if(confirm("確定要清空所有紀錄嗎？")) {
        myOrder = [];
        updateCartUI();
    }
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
