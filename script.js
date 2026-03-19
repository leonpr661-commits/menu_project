// 全域變數
let myOrder = [];

function parseCSV(text) {
    // 【關鍵指令 2】使用正則表達式切分換行，相容 Windows 與 Mac/Linux
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return [];
    
    // 取得標題列 (例如: id,name,address)
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        // 處理每一列的內容
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, i) => {
            // 將內容塞入對應的中文或英文標題下
            obj[header] = values[i] || ""; 
        });
        return obj;
    });
}

// 網頁初始化
window.onload = () => {
    loadAllMise(); // 改為從外部讀取商家總表
    updateCartUI();
};

// --- A. 商家清單處理 (從 CSV 讀取) ---

// --- A. 商家清單處理 ---
async function loadAllMise() {
    const container = document.getElementById('shop-container');
    
    // 1. 抓取檔案
    const response = await fetch('all_mise.csv');
    let text = await response.text();

    // 2. 處理 BOM 標頭 (處理中文必備)
    if (text.startsWith('\uFEFF')) text = text.substring(1);

    // 3. 解析
    const shops = parseCSV(text);

    // 4. 呈現 (中文名稱會正確顯示)
    container.innerHTML = shops.map(shop => `
        <div class="card" onclick="loadCSVMenu('${shop.id}', '${shop.name}')">
            <h3>${shop.name}</h3>
            <p>${shop.address}</p>
        </div>
    `).join('');
}
// --- B. 產品菜單處理 ---
// 讀取 CSV 並處理中文編碼
async function loadCSVData(fileName) {
    try {
        const response = await fetch(fileName + '?t=' + new Date().getTime());
        if (!response.ok) throw new Error('找不到檔案');

        // 讀取原始文字
        let text = await response.text();

        // 【關鍵指令 1】移除 UTF-8 的 BOM 標頭 (防止中文欄位名稱解析錯誤)
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
        }

        return parseCSV(text);
    } catch (err) {
        console.error("讀取失敗:", err);
        return [];
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
