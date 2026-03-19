/**
 * order.js - 點餐頁面專用邏輯
 */

// --- 1. 全域變數 ---
// 從瀏覽器快取讀取舊訂單，若無則為空陣列
let myOrder = JSON.parse(localStorage.getItem('myCart') || '[]');
let currentSelectItem = null;

// 從網址列抓取參數 (例如: order.html?id=R_03&name=海盜飯鋪)
const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('id');
const shopName = decodeURIComponent(urlParams.get('name') || "未知商家");

// --- 2. 網頁啟動順序 ---
window.onload = async () => {
    // 安全檢查：如果沒 ID 就回首頁
    if (!shopId) {
        alert("無效的商家 ID，將返回首頁");
        window.location.href = 'index.html';
        return;
    }

    // 更新介面標題
    const titleElement = document.getElementById('shop-title');
    if (titleElement) titleElement.innerText = shopName;

    // 執行核心功能
    await loadMenuData();
    updateCartUI(); // 顯示目前的紀錄
};

// --- 3. 核心工具：CSV 解析 (處理中文與 BOM) ---
function parseCSV(text) {
    if (!text) return [];
    // 移除 UTF-8 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
    
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
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

// --- 4. 資料抓取：讀取該店家的 CSV ---
async function loadMenuData() {
    const container = document.getElementById('product-container');
    if (!container) return;
    container.innerHTML = '<p class="loading-text">菜單載入中...</p>';

    try {
        // 使用 shopId 動態抓取對應檔案
        const response = await fetch(`${shopId}.csv?t=${Date.now()}`);
        if (!response.ok) throw new Error(`找不到菜單檔案: ${shopId}.csv`);
        
        const text = await response.text();
        const items = parseCSV(text);
        
        if (items.length === 0) {
            container.innerHTML = '<p>此商家目前無菜單資料</p>';
            return;
        }

        renderMenu(items);
    } catch (err) {
        container.innerHTML = `<p style="color:red; padding:20px;">載入失敗：${err.message}</p>`;
        console.error("Fetch Error:", err);
    }
}

// --- 5. 介面渲染：顯示分類與品項 ---
function renderMenu(items) {
    const container = document.getElementById('product-container');
    container.innerHTML = '';

    // 自動偵測 CSV 標題 Key
    const first = items[0];
    const kCat = Object.keys(first).find(k => k.includes('category') || k.includes('分類')) || 'category';
    const kName = Object.keys(first).find(k => k.includes('item_name') || k.includes('品項')) || 'item_name';
    const kBig = Object.keys(first).find(k => k.includes('big')) || 'big_price';
    const kSmall = Object.keys(first).find(k => k.includes('small')) || 'small_price';
    const kOther = Object.keys(first).find(k => k.includes('other') || k.includes('備註')) || 'other';

    // 按分類分組
    const groups = items.reduce((acc, item) => {
        const cat = (item[kCat] || "其他").trim();
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    // 產生 HTML
    for (const [cat, products] of Object.entries(groups)) {
        const catHeader = document.createElement('h3');
        catHeader.className = 'menu-category';
        catHeader.innerText = cat;
        container.appendChild(catHeader);

        products.forEach(item => {
            if (!item[kName]) return; // 跳過空行

            const card = document.createElement('div');
            card.className = 'product-card';
            
            const bP = item[kBig] ? item[kBig].trim() : "";
            const sP = item[kSmall] ? item[kSmall].trim() : "";
            const priceInfo = [sP ? `小$${sP}` : '', bP ? `大$${bP}` : ''].filter(p=>p).join(' / ');

            card.innerHTML = `
                <div class="product-info">
                    <span class="product-name">${item[kName]}</span>
                    <div class="product-price-preview">${priceInfo}</div>
                </div>
                <div class="plus-btn">+</div>
            `;

            // 綁定點擊開啟彈窗
            card.onclick = () => openOrderModal(item, kName, kBig, kSmall, kOther);
            container.appendChild(card);
        });
    }
}

// --- 6. 彈窗邏輯：選擇規格與口味 ---
function openOrderModal(item, kName, kBig, kSmall, kOther) {
    currentSelectItem = {
        name: item[kName],
        bigPrice: item[kBig],
        smallPrice: item[kSmall],
        otherStr: item[kOther] || "",
        selectedSize: item[kSmall] ? '小' : '大',
        selectedPrice: item[kSmall] || item[kBig],
        selectedOther: "原味"
    };

    document.getElementById('modal-item-name').innerText = currentSelectItem.name;
    
    // 生成大小選項
    const sArea = document.getElementById('modal-size-options');
    sArea.innerHTML = "";
    if(item[kSmall]) createOptionBtn(sArea, '小', item[kSmall], 'size');
    if(item[kBig]) createOptionBtn(sArea, '大', item[kBig], 'size');

    // 生成口味選項 (依 / 分隔)
    const oArea = document.getElementById('modal-other-options');
    oArea.innerHTML = "";
    if(currentSelectItem.otherStr && currentSelectItem.otherStr !== "無") {
        const opts = currentSelectItem.otherStr.split('/');
        opts.forEach(o => createOptionBtn(oArea, o, null, 'other'));
        currentSelectItem.selectedOther = opts[0]; // 預設選第一個
    } else {
        oArea.innerHTML = "<small style='color:gray'>無其他選項</small>";
        currentSelectItem.selectedOther = "無";
    }

    const modal = document.getElementById('order-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function createOptionBtn(container, label, price, type) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    
    // 判斷是否預設選中
    if(label === currentSelectItem.selectedSize || label === currentSelectItem.selectedOther) {
        btn.classList.add('selected');
    }
    
    btn.innerText = price ? `${label}($${price})` : label;
    
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
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

// --- 7. 購物車邏輯：存入 LocalStorage ---
function confirmOrder() {
    const orderItem = {
        shopName: shopName,
        name: currentSelectItem.name,
        size: currentSelectItem.selectedSize,
        price: currentSelectItem.selectedPrice,
        other: currentSelectItem.selectedOther,
        time: new Date().toLocaleTimeString()
    };

    myOrder.push(orderItem);
    localStorage.setItem('myCart', JSON.stringify(myOrder)); // 存檔
    
    updateCartUI();
    closeModal();
    alert(`已加入：${orderItem.name}`);
}

function updateCartUI() {
    const countBadge = document.getElementById('cart-count');
    if (countBadge) countBadge.innerText = myOrder.length;

    const list = document.getElementById('history-list');
    if (!list) return;

    let total = 0;
    list.innerHTML = myOrder.map((item, idx) => {
        total += parseInt(item.price || 0);
        return `
            <div class="history-item">
                <div>
                    <strong>${item.name}</strong> (${item.size})<br>
                    <small>${item.other} | ${item.shopName}</small>
                </div>
                <div style="color:#ff6b6b; font-weight:bold;">$${item.price}</div>
            </div>
        `;
    }).join('');

    const totalSpan = document.getElementById('total-price');
    if (totalSpan) totalSpan.innerText = total;
}

function clearCart() {
    if(confirm("確定要清空所有紀錄嗎？")) {
        myOrder = [];
        localStorage.removeItem('myCart');
        updateCartUI();
    }
}
// 在 order.js 加入這段來顯示紀錄
function displayHistory() {
    const list = document.getElementById('history-list');
    if(!list) return;
    
    let cart = JSON.parse(localStorage.getItem('myCart') || '[]');
    list.innerHTML = cart.map(item => `
        <div class="history-item">
            <strong>${item.name}</strong> - ${item.size} ($${item.price})
        </div>
    `).join('');
}
