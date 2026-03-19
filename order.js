/**
 * order.js - 最終穩定版 (支援 CSV 多種分隔符與口味取消功能)
 */

// --- 1. 全域變數與初始化 ---
let myOrder = JSON.parse(localStorage.getItem('myCart') || '[]');
const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('id');
const shopName = decodeURIComponent(urlParams.get('name') || "未知商家");

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

// --- 2. CSV 解析 ---
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

// --- 3. 讀取資料 ---
async function loadMenuData() {
    const container = document.getElementById('product-container');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;">菜單載入中...</p>';
    try {
        const response = await fetch(`${shopId}.csv?t=${Date.now()}`);
        if (!response.ok) throw new Error(`找不到檔案: ${shopId}.csv`);
        const text = await response.text();
        const items = parseCSV(text);
        renderMenu(items);
    } catch (err) {
        container.innerHTML = `<p style="color:red; padding:20px;">載入失敗：${err.message}</p>`;
    }
}

// --- 4. 渲染菜單 ---
function renderMenu(items) {
    const container = document.getElementById('product-container');
    container.innerHTML = '';

    const getK = (keys, target) => keys.find(k => k.toLowerCase().replace(/\s/g, '').includes(target)) || "";
    const keys = Object.keys(items[0]);
    const kCat = getK(keys, 'category') || getK(keys, '分類');
    const kName = getK(keys, 'item_name') || getK(keys, '品項');
    const kBig = getK(keys, 'big');
    const kSmall = getK(keys, 'small');
    const kOther = getK(keys, 'other') || getK(keys, '備註') || getK(keys, '口味');

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

            // 初始化卡片選取狀態
            const cardState = {
                name: item[kName].trim(),
                selectedSize: item[kSmall] ? "小" : (item[kBig] ? "大" : "標準"),
                selectedPrice: item[kSmall] || item[kBig] || 0,
                selectedOther: "無"
            };

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `<div class="card-header"><span class="product-name">${cardState.name}</span><span class="add-icon">+</span></div>`;

            const optionsArea = document.createElement('div');
            optionsArea.className = 'card-options';

            // 大小選項
            if (item[kSmall] || item[kBig]) {
                const sGroup = document.createElement('div');
                sGroup.className = 'option-group';
                sGroup.innerHTML = `<div class="option-title">大小：</div>`;
                if (item[kSmall]) createOptionBtnInCard(sGroup, '小', item[kSmall], 'size', cardState);
                if (item[kBig]) createOptionBtnInCard(sGroup, '大', item[kBig], 'size', cardState);
                optionsArea.appendChild(sGroup);
            }

            // 口味選項 (支援多種分隔符)
            const otherVal = (item[kOther] || "").trim();
            if (otherVal && otherVal !== "無") {
                const oGroup = document.createElement('div');
                oGroup.className = 'option-group';
                oGroup.innerHTML = `<div class="option-title">口味/備註：</div>`;
                
                // 這裡正則表達式會切分：/ 、 ， , 還有空格
                const opts = otherVal.split(/[/、，, ]+/).filter(o => o.trim() !== "");
                opts.forEach(o => createOptionBtnInCard(oGroup, o.trim(), null, 'other', cardState));
                optionsArea.appendChild(oGroup);
            }
            
            card.appendChild(optionsArea);

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

// --- 5. 按鈕點擊 (含口味取消選取邏輯) ---
function createOptionBtnInCard(container, label, price, type, state) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    if (type === 'size' && label === state.selectedSize) btn.classList.add('selected');
    
    btn.innerText = price ? `${label}($${price})` : label;
    
    btn.onclick = () => {
        const isAlreadySelected = btn.classList.contains('selected');

        if (type === 'other') {
            container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            if (isAlreadySelected) {
                state.selectedOther = "無"; // 第二下取消
            } else {
                btn.classList.add('selected'); // 第一下選中
                state.selectedOther = label;
            }
        } else if (type === 'size') {
            container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.selectedSize = label;
            state.selectedPrice = price;
        }
    };
    container.appendChild(btn);
}

// --- 6. 紀錄儲存與介面更新 ---
function confirmOrderFromCard(state) {
    const orderItem = {
        shopName: shopName,
        name: state.name,
        size: state.selectedSize || "標準",
        price: Number(state.selectedPrice) || 0,
        other: state.selectedOther || "無",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    myOrder.push(orderItem);
    localStorage.setItem('myCart', JSON.stringify(myOrder));
    updateCartUI();

    // 噴出 Toast 通知
    const toast = document.createElement('div');
    toast.innerText = `✅ 已加入: ${orderItem.name}`;
    toast.style = "position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:#333; color:white; padding:10px 25px; border-radius:30px; font-size:14px; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.2);";
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = '0.5s'; setTimeout(() => toast.remove(), 500); }, 1000);
}

function updateCartUI() {
    const countBadge = document.getElementById('cart-count');
    if (countBadge) countBadge.innerText = myOrder.length;

    const list = document.getElementById('history-list');
    const totalSpan = document.getElementById('total-price');
    if (!list || !totalSpan) return;

    let total = 0;
    list.innerHTML = myOrder.map(item => {
        total += Number(item.price);
        return `
            <div class="history-item">
                <div class="item-info">
                    <span class="item-name">${item.name} <small>(${item.size})</small></span>
                    <span class="item-details">${item.other}</span>
                </div>
                <div class="item-price">$${item.price}</div>
            </div>
        `;
    }).join('');
    totalSpan.innerText = total;
    list.scrollTop = list.scrollHeight;
}

function clearCart() {
    if(myOrder.length > 0 && confirm("確定要清空所有點餐紀錄嗎？")) {
        myOrder = [];
        localStorage.removeItem('myCart');
        updateCartUI();
    }
}
