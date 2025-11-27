// dashboard.js
// Script untuk Admin Dashboard Toko Hijabina

// Impor auth dan db karena ini sekarang adalah module
import { auth, db } from './firebase-config.js';

// Load data dashboard saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    // Cek authentication
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Load user info
        loadUserInfo(user);
        
        // Load dashboard statistics and recent orders
        loadDashboardStats();
        
        // Setup navigation
        setupNavigation();
        
        // Setup logout button
        setupLogoutButton();
    });
});

// Load user information
async function loadUserInfo(user) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Update UI dengan data user
            const userNameElement = document.getElementById('userName');
            const userEmailElement = document.getElementById('userEmail');
            const userAvatarElement = document.getElementById('userAvatar');
            
            if (userNameElement) {
                userNameElement.textContent = userData.name || 'Admin';
            }
            
            if (userEmailElement) {
                userEmailElement.textContent = user.email;
            }
            
            if (userAvatarElement) {
                userAvatarElement.textContent = (userData.name || 'A')[0].toUpperCase();
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Load total products
        const productsSnapshot = await db.collection('products').get();
        updateStatElement('totalProducts', productsSnapshot.size);
        
        // Load total orders
        const ordersSnapshot = await db.collection('orders').get();
        updateStatElement('totalOrders', ordersSnapshot.size);
        
        // Calculate total revenue
        let totalRevenue = 0;
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.status === 'completed') {
                // Coba beberapa kemungkinan field name
                const amount = order.totalAmount || order.total || order.totalPrice || 0;
                totalRevenue += amount;
            }
        });
        updateStatElement('totalRevenue', formatCurrency(totalRevenue));
        
        // Load total customers
        const customersSnapshot = await db.collection('users')
            .where('role', '==', 'customer')
            .get();
        updateStatElement('totalCustomers', customersSnapshot.size);
        
        // Load recent orders
        loadRecentOrders();

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Update stat element
function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// Load recent orders
async function loadRecentOrders() {
    try {
        const ordersSnapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        const tableBody = document.querySelector('#recentOrdersTable tbody');
        
        if (!tableBody) return;
        
        if (ordersSnapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #999;">
                        📭 Belum ada pesanan
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = '';
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const row = document.createElement('tr');
            
            // Hitung total dari items jika tidak ada totalAmount
            let displayTotal = order.totalAmount || order.total || order.totalPrice || 0;
            if (displayTotal === 0 && order.items && order.items.length > 0) {
                displayTotal = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            }
            
            row.innerHTML = `
                <td>#${doc.id.substring(0, 8)}</td>
                <td>${order.customerName || 'N/A'}</td>
                <td>${formatCurrency(displayTotal)}</td>
                <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
                <td>${formatDate(order.createdAt)}</td>
            `;
            
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading recent orders:', error);
    }
}

// Expose function to be callable from HTML
window.loadRecentOrders = loadRecentOrders;

// Setup navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            navItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Get section name
            const section = this.getAttribute('data-section');
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(s => {
                s.classList.remove('active');
            });
            
            // Show selected section
            const targetSection = document.getElementById(section + '-section');
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // Update page title
            const pageTitles = {
                'dashboard': 'Dashboard',
                'products': 'Manajemen Produk',
                'orders': 'Manajemen Pesanan',
                'customers': 'Manajemen Pelanggan',
                'reports': 'Laporan Penjualan',
                'settings': 'Pengaturan'
            };
            
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
                pageTitle.textContent = pageTitles[section] || 'Dashboard';
            }
            
            // Load data for section
            loadSectionData(section);
        });
    });
}

// Load section data
function loadSectionData(section) {
    switch(section) {
        case 'products':
            loadProductsData();
            break;
        case 'orders':
            loadOrdersData();
            break;
        case 'customers':
            loadCustomersData();
            break;
        case 'reports':
            loadReportsData();
            break;
    }
}

// Setup logout button
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Apakah Anda yakin ingin logout?')) {
                try {
                    localStorage.removeItem('userRole');
                    await auth.signOut();
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Gagal logout: ' + error.message);
                }
            }
        });
    }
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getStatusText(status) {
    const statusTexts = {
        'pending': 'Menunggu',
        'processing': 'Diproses',
        'shipped': 'Dikirim',
        'completed': 'Selesai',
        'cancelled': 'Dibatalkan'
    };
    
    return statusTexts[status] || status;
}

// Load products data
async function loadProductsData() {
    try {
        const productsSnapshot = await db.collection('products').get();
        const tableBody = document.querySelector('#productsTable tbody');
        
        if (!tableBody) return;
        
        if (productsSnapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                        📦 Belum ada produk
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = '';
        
        productsSnapshot.forEach(doc => {
            const product = doc.data();
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><img src="${product.image || 'https://via.placeholder.com/50'}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" alt="${product.name}"></td>
                <td>${product.name}</td>
                <td>${product.category || 'N/A'}</td>
                <td>${formatCurrency(product.price || 0)}</td>
                <td>${product.stock || 0}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="editProduct('${doc.id}')">✏️</button>
                    <button class="action-btn btn-delete" onclick="deleteProduct('${doc.id}')">🗑️</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Fungsi untuk melihat detail produk di halaman user
window.viewProduct = (productId) => {
    window.open(`user-product-detail.html?id=${productId}`, '_blank');
}

// Fungsi untuk mengarahkan ke halaman edit produk
window.editProduct = (productId) => {
    window.location.href = `admin-edit-product.html?id=${productId}`;
}

// Fungsi untuk menghapus produk
window.deleteProduct = async (productId) => {
    if (confirm('Apakah Anda yakin ingin menghapus produk ini secara permanen? Tindakan ini tidak dapat dibatalkan.')) {
        try {
            await db.collection('products').doc(productId).delete();
            alert('Produk berhasil dihapus.');
            loadProductsData();
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Gagal menghapus produk. Silakan coba lagi.');
        }
    }
};

// Load orders data
async function loadOrdersData() {
    try {
        const ordersSnapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .get();
        
        const tableBody = document.querySelector('#ordersTable tbody');
        
        if (!tableBody) return;
        
        if (ordersSnapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                        📦 Belum ada pesanan
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = '';

        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            const row = document.createElement('tr');
            const orderId = doc.id;

            // Hitung total dari items jika tidak ada totalAmount
            let displayTotal = order.totalAmount || order.total || order.totalPrice || 0;
            if (displayTotal === 0 && order.items && order.items.length > 0) {
                displayTotal = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            }

            // Siapkan tombol aksi
            let actionButtons = `<button class="action-btn btn-view" onclick="viewOrderDetails('${orderId}')">Lihat</button>`;
            if (order.status !== 'completed' && order.status !== 'cancelled') {
                actionButtons += ` <button class="action-btn btn-finish" title="Tandai Selesai" onclick="window.markOrderAsCompleted('${orderId}')">✓</button>`;
            }
            
            row.innerHTML = `
                <td>#${orderId.substring(0, 8)}...</td>
                <td>${order.customerName || 'N/A'}</td>
                <td>${formatCurrency(displayTotal)}</td>
                <td><span class="status-badge status-${order.status || 'pending'}">${getStatusText(order.status)}</span></td>
                <td>${formatDate(order.createdAt)}</td>
                <td>
                    ${actionButtons}
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Fungsi untuk melihat detail pesanan
window.viewOrderDetails = async (orderId) => {
    const modal = document.getElementById('orderDetailModal');
    const modalLoading = document.getElementById('modalLoading');
    const modalDetails = document.getElementById('modalOrderDetails');

    modal.style.display = 'flex';
    modalLoading.style.display = 'block';
    modalDetails.style.display = 'none';

    try {
        const orderRef = db.collection('orders').doc(orderId);
        const doc = await orderRef.get();

        if (!doc.exists) {
            alert('Pesanan tidak ditemukan!');
            modal.style.display = 'none';
            return;
        }

        const order = doc.data();
        
        // DEBUG: Log data order untuk melihat struktur data
        console.log('Order Data:', order);
        console.log('Order Items:', order.items);

        // Hitung total item yang dipesan
        const totalItems = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

        // Isi detail dasar
        document.getElementById('modalOrderId').textContent = doc.id;
        document.getElementById('modalCustomerName').textContent = order.customerName || 'N/A';
        document.getElementById('modalTotalItems').textContent = `${totalItems} produk`;
        document.getElementById('modalOrderDate').textContent = formatDate(order.createdAt);
        document.getElementById('modalOrderStatus').innerHTML = `<span class="status-badge status-${order.status || 'pending'}">${getStatusText(order.status)}</span>`;

        // Isi item yang dipesan dan hitung total
        const itemsBody = document.getElementById('modalOrderItems');
        itemsBody.innerHTML = '';
        
        let calculatedTotal = 0;
        
        if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
                const itemPrice = parseFloat(item.price) || 0;
                const itemQuantity = parseInt(item.quantity) || 0;
                const itemTotal = itemQuantity * itemPrice;
                calculatedTotal += itemTotal;
                
                console.log(`Item: ${item.name}, Qty: ${itemQuantity}, Price: ${itemPrice}, Total: ${itemTotal}`);
                
                itemsBody.innerHTML += `
                    <tr>
                        <td>${item.name}</td>
                        <td>${itemQuantity} x ${formatCurrency(itemPrice)}</td>
                        <td>${formatCurrency(itemTotal)}</td>
                    </tr>`;
            });
            
            // Ambil total dari database atau gunakan calculated total
            let finalTotal = order.totalAmount || order.total || order.totalPrice || 0;
            
            // Jika total di database 0 atau tidak ada, gunakan calculated total
            if (finalTotal === 0) {
                finalTotal = calculatedTotal;
            }
            
            console.log('Calculated Total:', calculatedTotal);
            console.log('Final Total:', finalTotal);
            
            // Tambahkan baris Total di akhir tabel item
            itemsBody.innerHTML += `
                <tr style="font-weight: bold; border-top: 2px solid #333; background-color: #f9f9f9;">
                    <td colspan="2" style="text-align: right; padding-right: 10px;">Total Keseluruhan</td>
                    <td>${formatCurrency(finalTotal)}</td>
                </tr>`;
        } else {
            itemsBody.innerHTML = `
                <tr>
                    <td colspan="3" style="text-align: center; padding: 20px; color: #999;">
                        Tidak ada item dalam pesanan ini
                    </td>
                </tr>`;
        }
    } catch (error) {
        console.error("Error fetching order details:", error);
        alert('Gagal memuat detail pesanan.');
    } finally {
        modalLoading.style.display = 'none';
        modalDetails.style.display = 'block';
    }
};

// Expose function to be callable from HTML
window.loadOrdersData = loadOrdersData;

// Load customers data
async function loadCustomersData() {
    try {
        // 1. Ambil semua pengguna dengan peran 'customer'
        const customersSnapshot = await db.collection('users')
            .where('role', '==', 'customer')
            .get();
        
        const tableBody = document.querySelector('#customersTable tbody');
        if (!tableBody) return;

        if (customersSnapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
                        👥 Belum ada pelanggan
                    </td>
                </tr>
            `;
            return;
        }

        // 2. Ambil semua pesanan untuk dihitung
        const ordersSnapshot = await db.collection('orders').get();
        const customerData = new Map();

        ordersSnapshot.forEach(orderDoc => {
            const order = orderDoc.data();
            if (order.userId) {
                // Jika userId belum ada di Map, buat entri baru
                if (!customerData.has(order.userId)) {
                    customerData.set(order.userId, { orderCount: 0 });
                }
                const data = customerData.get(order.userId);
                data.orderCount++;
                
                // Tambahkan total belanja
                if (order.status === 'completed') {
                    let orderTotal = order.totalAmount || order.total || order.totalPrice || 0;
                    // Jika total 0, hitung dari items
                    if (orderTotal === 0 && order.items && order.items.length > 0) {
                        orderTotal = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                    }
                }
            } else {
                console.warn(`Peringatan: Pesanan dengan ID ${orderDoc.id} tidak memiliki field 'userId'.`);
            }
        });

        tableBody.innerHTML = '';
        
        // 3. Tampilkan setiap pelanggan
        for (const doc of customersSnapshot.docs) {
            const customer = doc.data();
            const customerId = doc.id;

            const data = customerData.get(customerId) || { orderCount: 0 };

            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${customer.name || 'N/A'}</td>
                <td>${customer.email || 'N/A'}</td>
                <td>${customer.phone || 'N/A'}</td>
                <td>${data.orderCount} pesanan</td>
                <td>${formatDate(customer.createdAt)}</td>
            `;
            tableBody.appendChild(row);
        }
        
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

// Fungsi untuk melihat detail pelanggan
window.viewCustomer = (customerId) => {
    alert(`Melihat detail untuk pelanggan dengan ID: ${customerId}`);
};

// Load reports data
async function loadReportsData() {
    try {
        const ordersSnapshot = await db.collection('orders').get();
        
        let todaySales = 0;
        let weekSales = 0;
        let monthSales = 0;
        let yearSales = 0;
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.setDate(now.getDate() - 7));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);
        
        ordersSnapshot.forEach(doc => {
            const order = doc.data();
            if (order.status === 'completed' && order.createdAt) {
                const orderDate = order.createdAt.toDate();
                
                // Ambil total dengan beberapa kemungkinan field name
                let total = order.totalAmount || order.total || order.totalPrice || 0;
                
                // Jika total 0, hitung dari items
                if (total === 0 && order.items && order.items.length > 0) {
                    total = order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
                }
                
                if (orderDate >= todayStart) todaySales += total;
                if (orderDate >= weekStart) weekSales += total;
                if (orderDate >= monthStart) monthSales += total;
                if (orderDate >= yearStart) yearSales += total;
            }
        });
        
        updateStatElement('todaySales', formatCurrency(todaySales));
        updateStatElement('weekSales', formatCurrency(weekSales));
        updateStatElement('monthSales', formatCurrency(monthSales));
        updateStatElement('yearSales', formatCurrency(yearSales));
        
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// Expose function to be callable from HTML
window.loadReportsData = loadReportsData;