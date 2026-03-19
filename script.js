// 全域變數
let myOrder = [];
let currentSelectItem = null;

// --- 1. 核心解析工具：解決中文、BOM 與空格問題 ---
function parseCSV(text) {
    if (!text) return [];
    // 移除 UTF-8 BOM 隱藏字元
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

// 網頁啟動
window.onload = () => {
    loadAllMise();
    updateCartUI();
};

// --- 2. 商家列表 (處理 all_mise.csv) ---
async function loadAllMise() {
    const container = document.getElementById('shop-container');
    container.innerHTML = '載入商家中...';

    try {
        const response = await fetch('all_mise.csv?t=' + new Date().getTime());
        if (!response.ok) throw new Error('找不到 all_mise.csv');
        const text = await response.text();
        const shops = parseCSV(text);

        // 修改 onclick 邏輯
container.innerHTML = shops.map(shop => `
    <div class="card" onclick="location.href='order.html?id=${shop.id}&name=${encodeURIComponent(shop.name)}'">
        <h3>${shop.name}</h3>
        <p>${shop.address}</p>
    </div>
`).join('');
    } catch (err) {
        container.innerHTML = `<p style="color:red">商家載入失敗：${err.message}</p>`;
    }
}

// --- 3. 菜單處理 (處理 R_03.csv 等) ---
async function loadCSVMenu(shopId, shopName) {
    const container = document.getElementById('product-container');
    document.getElementById('shop-container').classList.add('hidden');
    document.getElementById('product-view').classList.remove('hidden');
    document.getElementById('current-shop-name').innerText = shopName;
    container.innerHTML = '菜單載入中...';

    try {
        const response = await fetch(`${shopId}.csv?t=` + new Date().getTime());
        if (!response.ok) throw new Error(`找不到 ${shopId}.csv`);
        const text = await response.text();
        const items = parseCSV(text);
        renderMenu(items);
    } catch (err) {
        container.innerHTML = `<p style="color:red">菜單載入失敗：${err.message}</p>`;
    }
}

function renderMenu(items) {
    const container = document.getElementById('product-container');
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = '<p>此店家目前無菜單資料</p>';
        return;
    }

    // 1. 自動找尋 Key (增加防錯)
    const first = items[0];
    const kCat = Object.keys(first).find(k => k.toLowerCase().includes('category') || k.includes('分類')) || 'category';
    const kName = Object.keys(first).find(k => k.toLowerCase().includes('item_name') || k.includes('品項')) || 'item_name';
    const kBig = Object.keys(first).find(k => k.toLowerCase().includes('big')) || 'big_price';
    const kSmall = Object.keys(first).find(k => k.toLowerCase().includes('small')) || 'small_price';
    const kOther = Object.keys(first).find(k => k.toLowerCase().includes('other') || k.includes('備註')) || 'other';

    // 2. 按分類群組 (確保不因分類名重複而壞掉)
    const groups = items.reduce((acc, item) => {
        const cat = (item[kCat] || "其他").trim();
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    // 3. 渲染
    for (const [cat, products] of Object.entries(groups)) {
        // 分類標題
        const catTitle = document.createElement('h3');
        catTitle.className = 'menu-category';
        catTitle.innerText = cat;
        container.appendChild(catTitle);

        products.forEach((item, index) => {
            // 檢查品項名稱是否存在，避免空行導致崩潰
            if (!item[kName]) return;

            const card = document.createElement('div');
            card.className = 'product-card';
            card.style.cursor = 'pointer';
            
            const bP = item[kBig] ? item[kBig].trim() : "";
            const sP = item[kSmall] ? item[kSmall].trim() : "";
            
            // 建立價格文字
            let priceInfo = "";
            if (sP && bP) priceInfo = `小$${sP} / 大$${bP}`;
            else if (sP) priceInfo = `小$${sP}`;
            else if (bP) priceInfo = `大$${bP}`;

            card.innerHTML = `
                <div class="product-info">
                    <span class="product-name" style="display:block; font-weight:bold;">${item[kName]}</span>
                    <div style="font-size:12px; color:gray; margin-top:4px;">${priceInfo}</div>
                </div>
                <div style="color:#ff6b6b; font-size:24px; font-weight:bold;">+</div>
            `;

            // 【關鍵修正】確保每個卡片都確實綁定 onclick
            card.onclick = (e) => {
                e.preventDefault();
                console.log("嘗試開啟彈窗:", item[kName]);
                openOrderModal(item, kName, kBig, kSmall, kOther);
            };

            container.appendChild(card);
        });
    }
}

// --- 4. 彈窗與點餐邏輯 ---
function openOrderModal(item, kName, kBig, kSmall, kOther) {
    currentSelectItem = {
        name: item[kName],
        bigPrice: item[kBig],
        smallPrice: item[kSmall],
        otherStr: item[kOther],
        selectedSize: item[kSmall] ? '小' : '大',
        selectedPrice: item[kSmall] || item[kBig],
        selectedOther: "原味"
    };

    document.getElementById('modal-item-name').innerText = currentSelectItem.name;
    
    // 大小碗按鈕
    const sArea = document.getElementById('modal-size-options');
    sArea.innerHTML = "";
    if(item[kSmall]) createOpt(sArea, '小', item[kSmall], 'size');
    if(item[kBig]) createOpt(sArea, '大', item[kBig], 'size');

    // 口味按鈕
    const oArea = document.getElementById('modal-other-options');
    oArea.innerHTML = "";
    if(item[kOther] && item[kOther] !== "無") {
        const opts = item[kOther].split('/');
        opts.forEach(o => createOpt(oArea, o, null, 'other'));
        currentSelectItem.selectedOther = opts[0];
    } else {
        oArea.innerHTML = "無其他選項";
        currentSelectItem.selectedOther = "無";
    }

    const modal = document.getElementById('order-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function createOpt(container, label, price, type) {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    if(label === currentSelectItem.selectedSize || label === currentSelectItem.selectedOther) btn.classList.add('selected');
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
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function confirmOrder() {
    const orderItem = {
        name: currentSelectItem.name,
        size: currentSelectItem.selectedSize,
        price: currentSelectItem.selectedPrice,
        other: currentSelectItem.selectedOther,
        time: new Date().toLocaleTimeString()
    };
    myOrder.push(orderItem);
    updateCartUI();
    closeModal();
    alert("已加入紀錄！");
}

function updateCartUI() {
    const count = document.getElementById('cart-count');
    if(count) count.innerText = myOrder.length;
    const list = document.getElementById('history-list');
    if(!list) return;
    
    let total = 0;
    list.innerHTML = myOrder.map(item => {
        total += parseInt(item.price || 0);
        return `<div class="history-item">
            <div><strong>${item.name}</strong>(${item.size})<br><small>${item.other}</small></div>
            <div style="color:#ff6b6b">$${item.price}</div>
        </div>`;
    }).join('');
    document.getElementById('total-price').innerText = total;
}

// 側邊欄切換與返回
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
