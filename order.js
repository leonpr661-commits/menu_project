/**
 * order.js - 點餐頁面專用邏輯 (卡片內選擇版)
 */

// --- 1. 全域變數 ---
let myOrder = JSON.parse(localStorage.getItem('myCart') || '[]');
const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('id');
const shopName = decodeURIComponent(urlParams.get('name') || "未知商家");

// --- 2. 網頁啟動順序 ---
window.onload = async () => {
    if (!shopId) {
        alert("無效的商家 ID，將返回首頁");
        window.location.href = 'index.html';
        return;
    }

    const titleElement = document.getElementById('shop-title');
    if (titleElement) titleElement.innerText = shopName;

    await loadMenuData();
    updateCartUI(); 
};

// --- 3. 核心工具：CSV 解析 ---
function parseCSV(text) {
    if (!text) return [];
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

// --- 4. 資料抓取 ---
async function loadMenuData() {
    const container = document.getElementById('product-container');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;">菜單載入中...</p>';

    try {
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
    }
}

// --- 5. 介面渲染 (直接在卡片內生成選擇按鈕) ---
function renderMenu(items) {
    const container = document.getElementById('product-container');
    container.innerHTML = '';

    const first = items[0];
    const kCat = Object.keys(first).find(k => k.toLowerCase().includes('category') || k.includes('分類')) || 'category';
    const kName = Object.keys(first).find(k => k.toLowerCase().includes('item_name') || k.includes('品項')) || 'item_name';
    const kBig = Object.keys(first).find(k => k.toLowerCase().includes('big')) || 'big_price';
    const kSmall = Object.keys(first).find(k => k.toLowerCase().includes('small')) || 'small_price';
    const kOther = Object.keys(first).find(k => k.toLowerCase().includes('other') || k.includes('備註')) || 'other';

    const groups = items.reduce((acc, item) => {
        const cat = (item[kCat] || "其他").trim();
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    for (const [cat, products] of Object.entries(groups)) {
        container.innerHTML += `<h3 class="menu-category">${cat}</h3>`;
        const grid = document.createElement('div');
        grid.className = 'product-grid';

        products.forEach(item => {
            if (!item[kName]) return;

            // 為每個卡片建立獨立的選取狀態
            const cardState = {
                name: item[kName],
                selectedSize: item[kSmall] ? '小' : '大',
                selectedPrice: item[kSmall] || item[kBig],
                selectedOther: "原味" 
            };

            const card = document.createElement('div');
            card.className = 'product-card';

            // 卡片標題
            card.innerHTML = `
                <div class="card-header">
                    <span class="product-name">${cardState.name}</span>
                    <span class="add-icon">+</span>
                </div>
            `;

            const optionsArea = document.createElement('div');
            optionsArea.className = 'card-options';

            // 大小碗選項
            const sizeGroup = document.createElement('div');
            sizeGroup.className = 'option-group';
            sizeGroup.innerHTML = `<div class="option-title">大小：</div>`;
            if(item[kSmall]) createOptionBtnInCard(sizeGroup, '小', item[kSmall], 'size', cardState);
            if(item[kBig]) createOptionBtnInCard(sizeGroup, '大', item[kBig], 'size', cardState);
            optionsArea.appendChild(sizeGroup);

            // 口味選項
            const otherGroup = document.createElement('div');
            otherGroup.className = 'option-group';
            otherGroup.innerHTML = `<div class="option-title">口味/備註：</div>`;
            const otherVal = item[kOther] || "";
            if(otherVal && otherVal !== "無") {
                const opts = otherVal.split('/');
                opts.forEach(o => createOptionBtnInCard(otherGroup, o, null, 'other', cardState));
                cardState.selectedOther = opts[0]; // 預設選第一個
            } else {
                otherGroup.innerHTML += "<small style='color:gray'>無</small>";
                cardState.selectedOther = "無";
            }
            optionsArea.appendChild(otherGroup);
            card.appendChild(optionsArea);

            // 加入按鈕
            const addBtn = document.createElement('button');
            addBtn.className = 'add-to-cart-btn';
            addBtn.innerText = '加入紀錄';
            addBtn.onclick = () => confirmOrderFromCard(cardState);
            card.appendChild(addBtn);

            grid.appendChild(card);
        });
        container.appendChild(grid);
    }
}

// --- 6. 選項按鈕處理 ---
function createOptionBtnInCard(container, label, price, type, state) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    
    if(label === state.selectedSize || label === state.selectedOther) {
        btn.classList.add('selected');
    }
    
    btn.innerText = price ? `${label}($${price})` : label;
    
    btn.onclick = () => {
        container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if(type === 'size') {
            state.selectedSize = label;
            state.selectedPrice = price;
        } else {
            state.selectedOther = label;
        }
    };
    container.appendChild(btn);
}

// --- 7. 紀錄儲存邏輯 ---
function confirmOrderFromCard(state) {
    const orderItem = {
        shopName: shopName,
        name: state.name,
        size: state.selectedSize,
        price: state.selectedPrice,
        other: state.selectedOther,
        time: new Date().toLocaleTimeString()
    };

    myOrder.push(orderItem);
    localStorage.setItem('myCart', JSON.stringify(myOrder));
    
    updateCartUI();
    
    // 簡單的視覺回饋替代 alert
    console.log("已加入:", orderItem.name);
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
                <div class="item-info">
                    <span class="item-name">${item.name} (${item.size})</span>
                    <span class="item-details">${item.other}</span>
                </div>
                <div class="item-price">$${item.price}</div>
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
