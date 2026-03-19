// 核心：從網址抓參數 (例如 order.html?id=R_03)
const urlParams = new URLSearchParams(window.location.search);
const shopId = urlParams.get('id');
const shopName = urlParams.get('name');

window.onload = () => {
    if (!shopId) {
        alert("無效的商家 ID");
        location.href = 'index.html';
        return;
    }
    document.getElementById('shop-title').innerText = shopName;
    loadMenu();
};

async function loadMenu() {
    try {
        const response = await fetch(`${shopId}.csv?t=${Date.now()}`);
        const text = await response.text();
        const items = parseCSV(text); // 複用之前的 parseCSV
        renderMenu(items);
    } catch (err) {
        console.error("載入失敗", err);
    }
}

// 點餐加入紀錄時，改用 localStorage 存檔
function confirmOrder() {
    const orderItem = { ... }; // 你的訂單物件
    
    // 從 localStorage 拿舊紀錄
    let cart = JSON.parse(localStorage.getItem('myCart') || '[]');
    cart.push(orderItem);
    
    // 存回去
    localStorage.setItem('myCart', JSON.stringify(cart));
    
    alert("已加入購物車！");
    closeModal();
}
