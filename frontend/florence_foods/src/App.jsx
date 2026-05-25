import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';

// ─── API ────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const apiCall = async (endpoint, method = 'GET', data = null, token = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { method, headers, body: data ? JSON.stringify(data) : null };
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, config);
    let result;
    try { result = await response.json(); } catch (e) { throw new Error(`API error: ${response.status}`); }
    if (!response.ok) throw new Error(result.message || `API failed: ${response.status}`);
    return result;
};

// ─── CONTEXTS ───────────────────────────────────────────
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const CartContext = createContext(null);
const useCart = () => useContext(CartContext);

const initialAuthState = { isAuthenticated: false, user: null, token: null, userType: null, userRole: null, isStaff: false };

// ─── MINI COMPONENTS ────────────────────────────────────
const Loader = ({ message = "Loading..." }) => (
    <div className="flex items-center justify-center p-4 bg-gray-50 rounded-lg shadow-inner">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-base font-semibold text-gray-800">{message}</span>
    </div>
);

const Alert = ({ message, type = 'error', onClose }) => {
    const styles = { success: 'bg-green-100 border-green-400 text-green-700', info: 'bg-blue-100 border-blue-400 text-blue-700', error: 'bg-red-100 border-red-400 text-red-700' };
    return message ? (
        <div className={`p-4 border-l-4 rounded-md shadow-lg mb-4 flex justify-between items-center ${styles[type] || styles.error}`} role="alert">
            <p className="font-semibold">{message}</p>
            {onClose && <button onClick={onClose} className="ml-4 hover:opacity-75 text-2xl leading-none">&times;</button>}
        </div>
    ) : null;
};

// ─── CART PROVIDER (persists across auth changes) ───────
const CartProvider = ({ children }) => {
    const [cart, setCart] = useState({});

    const updateCart = useCallback((item, delta) => {
        setCart(prev => {
            const qty = (prev[item._id]?.quantity || 0) + delta;
            if (qty <= 0) {
                const { [item._id]: _, ...rest } = prev;
                return rest;
            }
            const price = typeof item.price === 'object' ? Number(Object.values(item.price)[0] || 0) : Number(item.price);
            return { ...prev, [item._id]: { ...item, quantity: qty, orderPrice: isNaN(price) ? 0 : price } };
        });
    }, []);

    const clearCart = useCallback(() => setCart({}), []);

    const cartArray = useMemo(() => Object.values(cart), [cart]);
    const totalItems = useMemo(() => cartArray.reduce((s, i) => s + i.quantity, 0), [cartArray]);
    const totalAmount = useMemo(() => cartArray.reduce((s, i) => s + i.orderPrice * i.quantity, 0), [cartArray]);

    return <CartContext.Provider value={{ cart, cartArray, totalItems, totalAmount, updateCart, clearCart }}>{children}</CartContext.Provider>;
};

// ─── AUTH MODAL (inline login/register without page change) ──
const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
    const { login } = useAuth();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleLogin = async (e) => {
        e.preventDefault(); setError(null); setLoading(true);
        try {
            const result = await apiCall('/api/auth/login', 'POST', { email, password });
            login(result);
            onAuthSuccess();
            onClose();
        } catch (err) { setError(err.message || 'Login failed.'); }
        finally { setLoading(false); }
    };

    const handleRegister = async (e) => {
        e.preventDefault(); setError(null); setLoading(true);
        try {
            const result = await apiCall('/api/auth/register', 'POST', { name, email, phone, password });
            login(result);
            onAuthSuccess();
            onClose();
        } catch (err) { setError(err.message || 'Registration failed.'); }
        finally { setLoading(false); }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 transition-opacity backdrop-blur-sm bg-black/40" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-premium-transition relative" onClick={e => e.stopPropagation()}>
                    <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>

                    {mode === 'login' ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
                            <p className="text-gray-600 text-sm mb-4">Sign in to complete your order</p>
                            {error && <Alert message={error} type="error" onClose={() => setError(null)} />}
                            <form onSubmit={handleLogin} className="space-y-3">
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-400 text-sm" />
                                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-400 text-sm" />
                                <button type="submit" disabled={loading} className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg transition disabled:opacity-50 text-sm">
                                    {loading ? <Loader message="Signing in..." /> : 'Sign In & Continue'}
                                </button>
                            </form>
                            <p className="text-center text-sm text-gray-600 mt-4">
                                New customer?
                                <button onClick={() => { setMode('register'); setError(null); }} className="ml-1 font-semibold text-green-700 hover:text-green-800">Create an account</button>
                            </p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
                            <p className="text-gray-600 text-sm mb-4">Register to complete your order</p>
                            {error && <Alert message={error} type="error" onClose={() => setError(null)} />}
                            <form onSubmit={handleRegister} className="space-y-3">
                                <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-400 text-sm" />
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-400 text-sm" />
                                <input type="tel" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-400 text-sm" />
                                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-400 text-sm" />
                                <button type="submit" disabled={loading} className="w-full py-2.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg transition disabled:opacity-50 text-sm">
                                    {loading ? <Loader message="Creating account..." /> : 'Register & Continue'}
                                </button>
                            </form>
                            <p className="text-center text-sm text-gray-600 mt-4">
                                Already have an account?
                                <button onClick={() => { setMode('login'); setError(null); }} className="ml-1 font-semibold text-green-700 hover:text-green-800">Sign in</button>
                            </p>
                        </>
                    )}
                    <p className="text-xs text-center text-gray-400 mt-4">Your cart items are saved — no progress lost</p>
                </div>
            </div>
        </>
    );
};

// ─── NAVIGATION ─────────────────────────────────────────
const NavItem = ({ name, active, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2 text-base font-semibold rounded-full transition-all duration-300 hover:scale-105 active:scale-95 ${active ? 'bg-white text-green-700 shadow-md' : 'text-gray-200 hover:bg-green-800'}`}>{name}</button>
);

const Navigation = ({ activeView, setActiveView, onCartClick, onOpenAuth }) => {
    const { user, isStaff, userRole, logout, isAuthenticated } = useAuth();
    const { totalItems } = useCart();

    const navItems = useMemo(() => {
        if (!isStaff) return [
            { name: 'Menu', view: 'customer_order' },
        ];
        const items = [
            { name: 'POS Terminal', view: 'staff_pos' },
            { name: 'Orders', view: 'staff_orders' },
        ];
        if (userRole === 'Manager' || userRole === 'Admin') items.push({ name: 'Menu Editor', view: 'staff_menu' });
        if (userRole === 'Admin') items.push({ name: '👑 Admin', view: 'admin_panel' });
        return items;
    }, [isStaff, user, userRole]);

    // Customer nav includes extra items only when authenticated
    const customerExtra = useMemo(() => {
        if (isStaff || !isAuthenticated) return [];
        return [
            { name: 'My Orders', view: 'customer_history' },
            { name: `🪙 ${user?.loyaltyPoints || 0} Pts`, view: 'customer_profile' },
        ];
    }, [isStaff, isAuthenticated, user]);

    const allItems = isStaff ? navItems : [...navItems, ...customerExtra];

    return (
        <nav className="bg-green-700 p-3 shadow-xl z-50 relative">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <div className="flex items-center space-x-4 flex-1">
                    <h1 className="text-3xl font-black text-white tracking-wider cursor-pointer" onClick={() => setActiveView(isStaff ? 'staff_pos' : 'customer_order')}>LUCKY FOODS</h1>
                    <span className="text-green-200 text-sm font-medium">{isStaff ? userRole?.toUpperCase() : ''}</span>
                </div>
                <div className="flex items-center space-x-2">
                    {allItems.map(item => (
                        <NavItem key={item.view} name={item.name} active={activeView === item.view} onClick={() => setActiveView(item.view)} />
                    ))}
                    {(activeView === 'customer_order' || !isAuthenticated) && (
                        <button onClick={onCartClick} className="relative p-2 text-white hover:bg-green-800 rounded-full transition-all" title="View Cart">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                            {totalItems > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">{totalItems > 99 ? '99+' : totalItems}</span>
                            )}
                        </button>
                    )}
                    {isAuthenticated && (
                        <button onClick={logout} className="px-3 py-1.5 text-sm font-semibold rounded-full text-white bg-red-500 hover:bg-red-600 transition shadow">Logout</button>
                    )}

                    {!isStaff && (
                        isAuthenticated ? (
                            <span className="text-green-200 text-sm font-medium flex items-center cursor-default ml-3">
                                <svg className="w-4 h-4 mr-1 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                {user?.name || user?.email}
                            </span>
                        ) : (
                            <button onClick={onOpenAuth} className="text-green-200 hover:text-white text-sm font-medium flex items-center transition ml-3">
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                                Sign In
                            </button>
                        )
                    )}
                </div>
            </div>
        </nav>
    );
};

// ─── CART DRAWER ────────────────────────────────────────
const CartDrawer = ({ isOpen, onClose, onCheckout }) => {
    const { cartArray, totalItems, totalAmount, updateCart, clearCart } = useCart();
    const { isAuthenticated } = useAuth();

    return (
        <>
            {isOpen && <div className="fixed inset-0 z-40 transition-opacity backdrop-blur-sm bg-black/40" onClick={onClose} />}
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center p-4 border-b bg-green-700 text-white">
                        <h2 className="text-xl font-bold">Your Cart ({totalItems})</h2>
                        <button onClick={onClose} className="text-white hover:text-green-200 text-3xl leading-none">&times;</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cartArray.length === 0 ? (
                            <div className="text-center text-gray-500 mt-10">
                                <svg className="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                                <p className="text-xl">Cart empty</p>
                                <p className="text-sm mt-2">Add items from the menu!</p>
                            </div>
                        ) : (
                            cartArray.map(item => (
                                <div key={item._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:shadow transition">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-900 truncate">{item.name}</p>
                                        <p className="text-sm text-gray-600">UGX {item.orderPrice.toLocaleString()} ea</p>
                                    </div>
                                    <div className="flex items-center space-x-2 ml-2">
                                        <button onClick={() => updateCart(item, -1)} className="w-7 h-7 rounded-full bg-red-100 text-red-600 font-bold hover:bg-red-200 flex items-center justify-center">−</button>
                                        <span className="font-bold text-base w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => updateCart(item, 1)} className="w-7 h-7 rounded-full bg-green-100 text-green-600 font-bold hover:bg-green-200 flex items-center justify-center">+</button>
                                    </div>
                                    <span className="ml-2 font-bold text-gray-900 w-20 text-right text-sm">UGX {(item.orderPrice * item.quantity).toLocaleString()}</span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="border-t p-4 space-y-3 bg-gray-50">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-600">Total ({totalItems} items)</span>
                            <span className="text-2xl font-bold text-green-700">UGX {totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex space-x-2">
                            {cartArray.length > 0 && <button onClick={clearCart} className="flex-1 py-2.5 border border-red-300 text-red-600 font-bold rounded-lg hover:bg-red-50 transition text-sm">Clear</button>}
                            <button onClick={() => { if (cartArray.length > 0) { onClose(); onCheckout(); } }} disabled={cartArray.length === 0}
                                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:transform-none text-sm">
                                Proceed to Checkout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

// ─── FULL-WIDTH MENU (public — no login required) ──────
const MenuView = ({ onAddToCart }) => {
    const [menu, setMenu] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const result = await apiCall('/api/menu', 'GET');
                const combined = [
                    ...(result.dishes || []).map(d => ({ ...d, type: 'Dishes' })),
                    ...(result.salads || []).map(d => ({ ...d, type: 'Salads' })),
                    ...(result.drinks || []).map(d => ({ ...d, type: 'Drinks' })),
                ];
                setMenu(combined);
            } catch (err) { setError(err.message); }
            finally { setLoading(false); }
        };
        fetchMenu();
    }, []);

    if (loading) return <Loader message="Loading Menu..." />;
    if (error) return <Alert message={error} type="error" />;

    const categories = ['All', ...new Set(menu.map(m => m.type))];
    const filtered = menu.filter(m => {
        const matchCat = activeCategory === 'All' || m.type === activeCategory;
        const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });

    const grouped = filtered.reduce((acc, item) => {
        (acc[item.type] = acc[item.type] || []).push(item);
        return acc;
    }, {});

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-3 md:space-y-0">
                <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${activeCategory === cat ? 'bg-green-700 text-white shadow' : 'bg-white text-gray-700 hover:bg-green-50 border'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
                <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-green-400 text-sm" />
            </div>

            {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4 border-l-4 border-green-500 pl-3">{category}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {items.map(item => {
                            const priceDisplay = typeof item.price === 'object' ? `From UGX ${Object.values(item.price)[0]?.toLocaleString()}` : `UGX ${Number(item.price).toLocaleString()}`;
                            return (
                                <div key={item._id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border hover:border-green-300 group">
                                    {item.image && (
                                        <div className="h-40 overflow-hidden">
                                            <img src={item.image.startsWith('http') ? item.image : `/images/menu/${item.image}`} alt={item.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onError={e => e.target.style.display = 'none'} />
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-lg text-gray-900">{item.name}</h4>
                                            <span className="text-green-700 font-bold whitespace-nowrap ml-2">{priceDisplay}</span>
                                        </div>
                                        {item.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>}
                                        <button onClick={() => onAddToCart(item)}
                                            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow">
                                            + Add to Cart
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── CHECKOUT SCREEN ────────────────────────────────────
const CheckoutScreen = ({ token, onBack }) => {
    const { cartArray, totalItems, totalAmount, clearCart } = useCart();
    const { user, updateUser } = useAuth();
    const [step, setStep] = useState('review');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    // Preserve the paid amount so clearing the cart doesn't reset the displayed paid total
    const [paidAmount, setPaidAmount] = useState(null);

    useEffect(() => {
        if (step === 'processing') {
            const interval = setInterval(() => setProgress(p => Math.min(p + 5, 100)), 150);
            return () => clearInterval(interval);
        }
    }, [step]);

    const handlePay = async () => {
        setStep('processing'); setProgress(0); setError(null);
        try {
            await apiCall('/api/payments/process', 'POST', { amount: totalAmount }, token);
            setProgress(100);
            await new Promise(r => setTimeout(r, 500));
            const orderItems = cartArray.map(i => ({ name: i.name, quantity: i.quantity, price: i.orderPrice }));
            const order = await apiCall('/api/orders', 'POST', { items: orderItems, totalAmount }, token);
            setResult(order);
            // If backend returned loyalty info, update local user immediately so UI reflects new points
            if (order && order.loyalty && typeof order.loyalty.totalPoints === 'number') {
                updateUser({ loyaltyPoints: order.loyalty.totalPoints });
            }
            clearCart(); setStep('success');
        } catch (err) { setError(err.message); setStep('review'); }
    };

    if (step === 'processing') return (
        <div className="max-w-lg mx-auto p-8 text-center animate-premium-transition">
            <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="mb-6"><div className="w-20 h-20 mx-auto border-4 border-green-200 border-t-green-700 rounded-full animate-spin" /></div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing Payment</h2>
                <p className="text-gray-600 mb-6">Please wait while we process your payment...</p>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                    <div className="bg-green-600 h-full rounded-full transition-all duration-150 ease-linear" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm text-gray-500">{progress < 100 ? 'Contacting payment gateway...' : 'Payment confirmed! Placing order...'}</p>
            </div>
        </div>
    );

    if (step === 'success') return (
        <div className="max-w-lg mx-auto p-8 animate-premium-transition">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-green-600 p-6 text-center text-white">
                    <div className="w-16 h-16 mx-auto bg-white rounded-full flex items-center justify-center mb-3">
                        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold">Payment Successful!</h2>
                </div>
                <div className="p-6 space-y-3">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-green-700">UGX {(paidAmount ?? totalAmount).toLocaleString()}</p>
                        <p className="text-sm text-gray-600">Paid</p>
                    </div>
                    {result && (
                        <>
                            <div className="flex justify-between text-sm border-b pb-2"><span className="text-gray-600">Order ID</span><span className="font-bold text-gray-800">#{result.order?._id?.slice(-6) || 'N/A'}</span></div>
                            {result.loyaltyUpdate && <div className="flex justify-between text-sm border-b pb-2"><span className="text-gray-600">Loyalty</span><span className="font-bold text-green-700">{result.loyaltyUpdate}</span></div>}
                        </>
                    )}
                    <button onClick={onBack} className="w-full py-3 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg shadow transition">Back to Menu</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6 animate-premium-transition">
            <button onClick={onBack} className="mb-4 text-green-700 hover:text-green-800 font-semibold flex items-center text-sm">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to Menu
            </button>
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-green-700 text-white p-6">
                    <h2 className="text-2xl font-bold">Order Summary</h2>
                    <p className="text-green-200 text-sm mt-1">Review your order before payment</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="border-b pb-3"><span className="text-lg font-semibold text-gray-700">Items ({totalItems})</span></div>
                    {cartArray.map(item => (
                        <div key={item._id} className="flex justify-between items-center py-2 border-b border-gray-100">
                            <div className="flex-1"><p className="font-semibold text-gray-900">{item.name}</p><p className="text-sm text-gray-500">UGX {item.orderPrice.toLocaleString()} × {item.quantity}</p></div>
                            <span className="font-bold text-gray-900">UGX {(item.orderPrice * item.quantity).toLocaleString()}</span>
                        </div>
                    ))}
                    <div className="border-t pt-4 mt-4">
                        <div className="flex justify-between items-center"><span className="text-lg font-semibold text-gray-700">Total</span><span className="text-3xl font-bold text-green-700">UGX {totalAmount.toLocaleString()}</span></div>
                    </div>
                    {error && <Alert message={error} type="error" onClose={() => setError(null)} />}
                    <button onClick={handlePay} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95">Pay UGX {totalAmount.toLocaleString()}</button>
                    <p className="text-xs text-center text-gray-400">💳 Simulated payment — no real charge</p>
                </div>
            </div>
        </div>
    );
};

// ─── STAFF POS ──────────────────────────────────────────
const StaffOrderPlacer = ({ token }) => {
    const { cartArray, totalAmount, updateCart, clearCart } = useCart();
    const [menu, setMenu] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [status, setStatus] = useState(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const [menuData, custData] = await Promise.all([apiCall('/api/menu','GET',null,token), apiCall('/api/customers','GET',null,token)]);
                const combined = [...(menuData.dishes||[]).map(d=>({...d,type:'Dishes'})), ...(menuData.salads||[]).map(d=>({...d,type:'Salads'})), ...(menuData.drinks||[]).map(d=>({...d,type:'Drinks'}))];
                setMenu(combined); setCustomers(custData);
            } catch (err) { setError(err.message); } finally { setLoading(false); }
        };
        fetch();
    }, [token]);

    const placeOrder = async () => {
        if (!selectedCustomer) { setStatus({type:'error',message:'Select a customer'}); return; }
        if (cartArray.length === 0) { setStatus({type:'error',message:'Cart empty'}); return; }
        try {
            setStatus({type:'info',message:'Placing order...'});
            const items = cartArray.map(i => ({ name: i.name, quantity: i.quantity, price: i.orderPrice }));
            const result = await apiCall('/api/orders','POST',{items,totalAmount,customerId:selectedCustomer},token);
            setStatus({type:'success',message:`Order #${result.order._id.slice(-6)} placed! ${result.loyaltyUpdate||''}`});
            clearCart();
        } catch (err) { setStatus({type:'error',message:err.message}); }
    };

    if (loading) return <Loader message="Loading POS..." />;
    if (error) return <Alert message={error} type="error" />;
    const grouped = menu.reduce((acc, item) => { (acc[item.type]=acc[item.type]||[]).push(item); return acc; }, {});
    const price = (item) => typeof item.price === 'object' ? Number(Object.values(item.price)[0]||0) : Number(item.price);

    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 bg-white rounded-xl shadow-lg p-4 overflow-y-auto max-h-[80vh]">
                    <h3 className="text-xl font-bold text-green-700 mb-4 border-b pb-2">Menu</h3>
                    {Object.entries(grouped).map(([cat, items]) => (
                        <div key={cat} className="mb-4">
                            <h4 className="font-bold text-gray-700 mb-2">{cat}</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {items.map(item => (
                                    <button key={item._id} onClick={() => updateCart(item, 1)} className="p-2 bg-gray-50 border rounded-lg hover:bg-green-50 hover:border-green-300 transition text-left">
                                        <p className="font-semibold text-sm">{item.name}</p>
                                        <p className="text-xs text-green-700">UGX {price(item).toLocaleString()}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="w-full lg:w-80 bg-white rounded-xl shadow-lg p-4 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">Order</h3>
                    <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full p-2 border rounded mb-3 text-sm" required>
                        <option value="">Select customer...</option>
                        {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <div className="flex-1 overflow-y-auto max-h-60 space-y-2 mb-3">
                        {cartArray.length === 0 ? <p className="text-gray-500 text-sm italic">Cart empty</p> : (
                            cartArray.map(item => (
                                <div key={item._id} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                    <span className="font-semibold truncate flex-1">{item.name}</span>
                                    <div className="flex items-center space-x-1 ml-2">
                                        <button onClick={() => updateCart(item, -1)} className="w-5 h-5 bg-red-100 text-red-600 rounded text-xs flex items-center justify-center">−</button>
                                        <span className="font-bold w-5 text-center text-xs">{item.quantity}</span>
                                        <button onClick={() => updateCart(item, 1)} className="w-5 h-5 bg-green-100 text-green-600 rounded text-xs flex items-center justify-center">+</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="border-t pt-2">
                        <div className="flex justify-between font-bold text-lg mb-2"><span>Total</span><span>UGX {totalAmount.toLocaleString()}</span></div>
                        <button onClick={placeOrder} disabled={cartArray.length===0} className="w-full py-2 bg-green-700 text-white font-bold rounded-lg hover:bg-green-800 disabled:bg-gray-300 transition">Place Order</button>
                    </div>
                    {status && <Alert message={status.message} type={status.type} onClose={() => setStatus(null)} />}
                </div>
            </div>
        </div>
    );
};

// ─── ORDERS VIEW ────────────────────────────────────────
const OrdersView = ({ token, isStaff }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('All');
    useEffect(() => {
        const fetch = async () => { setLoading(true); try { setOrders(await apiCall('/api/orders','GET',null,token)); } catch (err) { setError(err.message); } finally { setLoading(false); } };
        fetch();
    }, [token]);
    if (loading) return <Loader />;
    if (error) return <Alert message={error} type="error" />;
    const filtered = filter === 'All' ? orders : orders.filter(o => o.status === filter);
    const sc = { Pending:'bg-yellow-100 text-yellow-800', Preparing:'bg-blue-100 text-blue-800', Ready:'bg-green-100 text-green-800', Completed:'bg-gray-100 text-gray-800', Cancelled:'bg-red-100 text-red-800' };
    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">{isStaff ? 'Orders' : 'My Orders'}</h3>
                <select value={filter} onChange={e => setFilter(e.target.value)} className="p-2 border rounded text-sm">{['All','Pending','Preparing','Ready','Completed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}</select>
            </div>
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th><th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th></tr></thead>
                    <tbody className="divide-y divide-gray-200">
                        {filtered.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-gray-500">No orders</td></tr> : (
                            filtered.map(order => (
                                <tr key={order._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-bold text-green-600 text-sm">#{order._id.slice(-6)}</td>
                                    <td className="px-4 py-3 font-semibold text-sm">{order.customerName}</td>
                                    <td className="px-4 py-3 text-sm">{order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</td>
                                    <td className="px-4 py-3 font-bold text-sm">UGX {(order.totalAmount||0).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs font-bold rounded-full ${sc[order.status]||'bg-gray-200'}`}>{order.status}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── PROFILE ────────────────────────────────────────────
const ProfileView = ({ user }) => (
    <div className="p-8 max-w-lg mx-auto animate-premium-transition">
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-green-700 mb-4">My Profile</h3>
            <p className="text-lg font-semibold">Name: <span className="font-bold">{user?.name}</span></p>
            <p className="text-lg font-semibold">Email: <span className="font-bold">{user?.email}</span></p>
            {user?.phone && <p className="text-lg font-semibold">Phone: <span className="font-bold">{user.phone}</span></p>}
            <p className="text-2xl font-black mt-4 text-green-600">Loyalty Points: {user?.loyaltyPoints || 0}</p>
        </div>
    </div>
);

// ─── MANAGER DASHBOARD ──────────────────────────────────
const ManagerView = ({ token }) => {
    const [tab, setTab] = useState('menu'); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
    const [menuItems, setMenuItems] = useState({ dishes:[], drinks:[], salads:[] }); const [adding, setAdding] = useState(false);
    const [newItem, setNewItem] = useState({ name:'',description:'',price:'',category:'dishes',image:'' });
    const [staff, setStaff] = useState([]); const [customers, setCustomers] = useState([]);
    const [newStaff, setNewStaff] = useState({ name:'',role:'Waiter',contact:'',password:'' });

    useEffect(() => {
        const fetch = async () => { setLoading(true); try { const [m,s,c]=await Promise.all([apiCall('/api/menu','GET',null,token),apiCall('/api/staff','GET',null,token),apiCall('/api/customers','GET',null,token)]); setMenuItems({dishes:m.dishes||[],drinks:m.drinks||[],salads:m.salads||[]}); setStaff(s); setCustomers(c); } catch(err){setError(err.message)} finally{setLoading(false)} };
        fetch();
    }, [token]);

    const handleAdd = async (e) => { e.preventDefault(); try { await apiCall(`/api/menu/${newItem.category}`,'POST',newItem,token); setAdding(false); setNewItem({name:'',description:'',price:'',category:'dishes',image:''}); const m=await apiCall('/api/menu','GET',null,token); setMenuItems({dishes:m.dishes||[],drinks:m.drinks||[],salads:m.salads||[]}); } catch(err){setError(err.message)} };
    const handleAddStaff = async (e) => { e.preventDefault(); try { await apiCall('/api/staff/register','POST',newStaff,token); setNewStaff({name:'',role:'Waiter',contact:'',password:''}); setStaff(await apiCall('/api/staff','GET',null,token)); } catch(err){setError(err.message)} };

    if (loading) return <Loader />;
    if (error) return <Alert message={error} type="error" onClose={()=>setError(null)} />;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800">Manager Dashboard</h2>
            <div className="border-b flex space-x-6">
                {['menu','staff','customers'].map(t => (<button key={t} onClick={()=>setTab(t)} className={`py-3 border-b-2 font-medium text-sm capitalize ${tab===t?'border-green-500 text-green-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>{t==='menu'?'Menu':t==='staff'?'Staff':'Customers'}</button>))}
            </div>
            {tab==='menu' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center"><h3 className="text-xl font-semibold">Menu Items</h3><button onClick={()=>setAdding(true)} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">+ Add Item</button></div>
                    {adding && <div className="bg-white p-4 rounded-lg shadow-md"><h4 className="font-bold mb-3">New Menu Item</h4><form onSubmit={handleAdd} className="space-y-3"><input type="text" placeholder="Name" value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})} className="w-full p-2 border rounded text-sm" required /><input type="number" placeholder="Price" value={newItem.price} onChange={e=>setNewItem({...newItem,price:e.target.value})} className="w-full p-2 border rounded text-sm" required /><textarea placeholder="Description" value={newItem.description} onChange={e=>setNewItem({...newItem,description:e.target.value})} className="w-full p-2 border rounded text-sm" rows={2} /><div className="flex space-x-2"><button type="button" onClick={()=>setAdding(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 text-sm">Cancel</button><button type="submit" className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 text-sm">Save</button></div></form></div>}
                    {['dishes','drinks','salads'].map(cat => (
                        <div key={cat} className="bg-white p-4 rounded-lg shadow"><h4 className="text-lg font-bold text-green-700 capitalize mb-3">{cat} ({menuItems[cat]?.length||0})</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{(menuItems[cat]||[]).map(item => (<div key={item._id} className="p-3 border rounded-lg text-sm"><p className="font-bold">{item.name}</p><p className="text-gray-600">UGX {typeof item.price==='object'?Object.values(item.price)[0]:Number(item.price).toLocaleString()}</p></div>))}</div>
                        </div>
                    ))}
                </div>
            )}
            {tab==='staff' && (
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow-md"><h4 className="font-bold mb-3">Add Staff</h4><form onSubmit={handleAddStaff} className="space-y-3"><input type="text" placeholder="Name" value={newStaff.name} onChange={e=>setNewStaff({...newStaff,name:e.target.value})} className="w-full p-2 border rounded text-sm" required /><select value={newStaff.role} onChange={e=>setNewStaff({...newStaff,role:e.target.value})} className="w-full p-2 border rounded text-sm"><option value="Waiter">Waiter</option><option value="Manager">Manager</option></select><input type="text" placeholder="Contact" value={newStaff.contact} onChange={e=>setNewStaff({...newStaff,contact:e.target.value})} className="w-full p-2 border rounded text-sm" required /><input type="password" placeholder="Password" value={newStaff.password} onChange={e=>setNewStaff({...newStaff,password:e.target.value})} className="w-full p-2 border rounded text-sm" required /><button type="submit" className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 text-sm">Add Staff</button></form></div>
                    <div className="bg-white shadow rounded-md">{staff.map(s => (<div key={s._id} className="px-4 py-3 border-b flex justify-between items-center"><div><p className="font-bold text-green-600">{s.name}</p><p className="text-sm text-gray-600">{s.contact}</p></div><span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">{s.role}</span></div>))}</div>
                </div>
            )}
            {tab==='customers' && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{customers.map(c => (<div key={c._id} className="bg-white p-4 rounded-lg border hover:shadow transition"><p className="font-bold">{c.name}</p><p className="text-sm text-gray-600">{c.email}</p><p className="text-sm font-semibold mt-2">Points: <span className="text-green-600">{c.loyaltyPoints||0}</span></p></div>))}</div>}
        </div>
    );
};

// ─── ADMIN PANEL ────────────────────────────────────────
const AdminPanel = ({ token }) => {
    const [staff, setStaff] = useState([]); const [customers, setCustomers] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(null);
    useEffect(() => { fetchStaff(); fetchCustomers(); }, []);
    const fetchStaff = async () => { setLoading(true); try { setStaff(await apiCall('/api/staff','GET',null,token)); } catch(err){setError(err.message)} finally{setLoading(false)} };
    const fetchCustomers = async () => { try { setCustomers(await apiCall('/api/customers','GET',null,token)); } catch(err){setError(err.message)} };
    const changeRole = async (id,role) => { try { await apiCall(`/api/staff/${id}/change-role`,'POST',{newRole:role},token); fetchStaff(); } catch(err){setError(err.message)} };
    if (loading) return <Loader />;
    return (
        <div className="p-6 max-w-7xl mx-auto">
            {error && <Alert message={error} type="error" onClose={()=>setError(null)} />}
            <h1 className="text-3xl font-bold text-green-700 mb-6">👑 Admin Panel</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-lg p-4"><h2 className="text-xl font-bold mb-4">Staff ({staff.length})</h2><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="pb-2">Name</th><th>Role</th><th>Action</th></tr></thead><tbody>{staff.map(s => (<tr key={s._id} className="border-b hover:bg-gray-50"><td className="py-2">{s.name}</td><td><span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${s.role==='Admin'?'bg-red-600':s.role==='Manager'?'bg-blue-600':'bg-green-600'}`}>{s.role}</span></td><td>{s.role==='Waiter'&&<button onClick={()=>changeRole(s._id,'Manager')} className="text-blue-600 hover:underline text-xs">Promote</button>}{s.role==='Manager'&&<button onClick={()=>changeRole(s._id,'Waiter')} className="text-yellow-600 hover:underline text-xs">Demote</button>}</td></tr>))}</tbody></table></div>
                <div className="bg-white rounded-xl shadow-lg p-4"><h2 className="text-xl font-bold mb-4">Customers ({customers.length})</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{customers.map(c => (<div key={c._id} className="p-3 border rounded-lg"><p className="font-bold text-sm">{c.name}</p><p className="text-xs text-gray-600">{c.email}</p><p className="text-xs font-semibold mt-1">Points: {c.loyaltyPoints||0}</p></div>))}</div></div>
            </div>
        </div>
    );
};

// ─── APP ROUTER ─────────────────────────────────────────
const AppRouter = () => {
    const { isAuthenticated, user, isStaff, token } = useAuth();
    const [activeView, setActiveView] = useState('customer_order');
    const [cartOpen, setCartOpen] = useState(false);
    const [showCheckout, setShowCheckout] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const pendingCheckout = useRef(false);

    // Staff auto-redirect on login
    useEffect(() => {
        if (isAuthenticated && isStaff) setActiveView('staff_pos');
    }, [isAuthenticated, isStaff]);

    const handleCheckoutAction = () => {
        if (!isAuthenticated) {
            pendingCheckout.current = true;
            setShowAuth(true);
        } else {
            setShowCheckout(true);
        }
    };

    const handleAuthSuccess = () => {
        if (pendingCheckout.current) {
            pendingCheckout.current = false;
            setShowCheckout(true);
        }
    };

    const renderView = () => {
        // Public menu view — no auth needed
        if (activeView === 'customer_order' && !showCheckout) {
            return <CartContext.Consumer>{({ updateCart }) => <MenuView onAddToCart={(item) => updateCart(item, 1)} />}</CartContext.Consumer>;
        }

        // Checkout — requires auth (checked via handleCheckoutAction)
        if (showCheckout && isAuthenticated) {
            return <CheckoutScreen token={token} onBack={() => setShowCheckout(false)} />;
        }

        // Staff views
        if (isStaff) {
            switch (activeView) {
                case 'staff_pos': return <StaffOrderPlacer token={token} />;
                case 'staff_orders': return <OrdersView token={token} isStaff={true} />;
                case 'staff_menu': return <ManagerView token={token} />;
                case 'admin_panel': return user?.role === 'Admin' ? <AdminPanel token={token} /> : <div className="p-8 text-center text-red-600 font-bold">Access Denied</div>;
                default: return <div className="p-8"><Alert message="Welcome" type="info" /></div>;
            }
        }

        // Customer authenticated views
        if (isAuthenticated && !isStaff) {
            switch (activeView) {
                case 'customer_history': return <OrdersView token={token} isStaff={false} />;
                case 'customer_profile': return <ProfileView user={user} />;
                default: return <CartContext.Consumer>{({ updateCart }) => <MenuView onAddToCart={(item) => updateCart(item, 1)} />}</CartContext.Consumer>;
            }
        }

        return <CartContext.Consumer>{({ updateCart }) => <MenuView onAddToCart={(item) => updateCart(item, 1)} />}</CartContext.Consumer>;
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <Navigation activeView={activeView} setActiveView={setActiveView} onCartClick={() => setCartOpen(true)} onOpenAuth={() => { pendingCheckout.current = false; setShowAuth(true); }} />
            <main className="flex-1 overflow-auto bg-gray-50">
                <div key={activeView + (showCheckout ? '-checkout' : '')} className="h-full animate-premium-transition">{renderView()}</div>
            </main>
            <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckoutAction} />
            <AuthModal isOpen={showAuth} onClose={() => { setShowAuth(false); pendingCheckout.current = false; }} onAuthSuccess={handleAuthSuccess} />
        </div>
    );
};

// ─── AUTH PROVIDER ──────────────────────────────────────
const AuthProvider = ({ children }) => {
    const [authState, setAuthState] = useState(initialAuthState);
    const [authType, setAuthType] = useState('login');
    const login = useCallback((data) => {
        const isStaff = data.userType === 'staff';
        const userRole = data.role || 'Customer';
        localStorage.setItem('auth_token', data.token); localStorage.setItem('user_type', data.userType); localStorage.setItem('user_role', userRole);
        setAuthState({ isAuthenticated: true, user: data, token: data.token, isStaff, userType: data.userType, userRole });
    }, []);

    // Merge partial updates into the current user object (useful for loyalty point updates)
    const updateUser = useCallback((patch) => {
        setAuthState(prev => ({ ...prev, user: { ...(prev.user || {}), ...patch } }));
    }, []);
    const logout = useCallback(() => {
        localStorage.removeItem('auth_token'); localStorage.removeItem('user_type'); localStorage.removeItem('user_role');
        setAuthState(initialAuthState);
    }, []);
    useEffect(() => { const t = localStorage.getItem('auth_token'); if (t) logout(); }, [logout]);
    return <AuthContext.Provider value={{ ...authState, login, logout, authType, setAuthType }}>{children}</AuthContext.Provider>;
};

// ─── MAIN APP ───────────────────────────────────────────
const App = () => (
    <>
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .animate-premium-transition { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        `}} />
        <AuthProvider>
            <CartProvider>
                <AppRouter />
            </CartProvider>
        </AuthProvider>
    </>
);

export default App;