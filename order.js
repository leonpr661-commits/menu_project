// 全域變數
let myOrder = JSON.parse(localStorage.getItem('myCart') || '[]'); // 從快取讀取舊訂單
let currentSelectItem = null;

// 1. 核心：從網址抓參數 (這個要最先執行)
const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('id');
const shopName = decodeURIComponent(urlParams.get('name') || "未知商家");

// 2. 網頁啟動順序
window.onload = async () => {
    // 檢查有沒有抓到 ID
    if (!shopId) {
        alert("無法識別商家 ID，將返回首頁");
        window.location.href = 'index.html';
        return;
    }

    // 更新標題
    document.getElementById('shop-title').innerText = shopName;
    
    // 開始讀取檔案
    await loadMenuData();
    
    // 更新購物車數量顯示
    updateCartBadge();
};

// 3. 讀取 CSV 檔案
async function loadMenuData() {
    const container = document.getElementById('product-container');
    container.innerHTML = '菜單載入中...';

    try {
        // 根據網址抓到的 shopId 去 fetch 檔案
        const response = await fetch(`${shopId}.csv?t=${Date.now()}`);
        if (!response.ok) throw new Error(`找不到菜單檔案: ${shopId}.csv`);
        
        const text = await response.text();
        const items = parseCSV(text); // 複用之前的 parseCSV 函式
        
        if (items.length === 0) {
            container.innerHTML = '此商家目前沒有菜單內容';
            return;
        }

        renderMenu(items); // 呼叫渲染函式
    } catch (err) {
        container.innerHTML = `<p style="color:red">載入失敗：${err.message}</p>`;
        console.error(err);
    }
}

// 4. 點確認加入紀錄 (使用 localStorage)
function confirmOrder() {
    const orderItem = {
        shopName: shopName,
        name: currentSelectItem.name,
        size: currentSelectItem.selectedSize,
        price: currentSelectItem.selectedPrice,
        other: currentSelectItem.selectedOther,
        time: new Date().toLocaleTimeString()
    };
    
    // 存入陣列
    myOrder.push(orderItem);
    
    // 同步到瀏覽器快取 (LocalStorage)
    localStorage.setItem('myCart', JSON.stringify(myOrder));
    
    updateCartBadge();
    closeModal();
    alert(`已加入：${orderItem.name}`);
}

// 更新購物車的小數字 (如果 order.html 有顯示的話)
function updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = myOrder.length;
}

// --- 以下請複用你之前的 parseCSV, renderMenu, openOrderModal, closeModal ---


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
