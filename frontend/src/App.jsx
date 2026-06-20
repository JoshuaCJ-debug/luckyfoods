import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';

// ─── API ────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const apiCall = async (endpoint, method = 'GET', data = null, token = null, timeoutMs = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const controller = timeoutMs ? new AbortController() : null;
    const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const config = { method, headers, body: data ? JSON.stringify(data) : null };
    if (controller) config.signal = controller.signal;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    let response;
    try { response = await fetch(url, config); } finally { if (timeoutId) clearTimeout(timeoutId); }
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
        <div className={`p-4 rounded-md shadow-lg mb-4 flex justify-between items-center ${styles[type] || styles.error}`} role="alert">
            <p className="font-semibold">{message}</p>
            {onClose && <button onClick={onClose} className="ml-4 hover:opacity-75 text-2xl leading-none">&times;</button>}
        </div>
    ) : null;
};

const CartToast = ({ toast, onViewCart }) => {
    if (!toast) return null;
    return (
        <div className="fixed bottom-4 right-4 bg-green-700 text-white px-6 py-4 rounded-lg shadow-xl flex items-center space-x-4 animate-premium-transition z-50">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span className="font-semibold">{toast.message}</span>
            <button onClick={onViewCart} className="bg-white text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-50 transition">View Cart</button>
        </div>
    );
};

// ─── FLY TO CART ANIMATION COMPONENT ─────────────────────
const FlyToCartAnimation = ({ startPos, endPos, image, onComplete }) => {
    useEffect(() => {
        // Create flying element
        const flyer = document.createElement('div');
        flyer.style.cssText = `
            position: fixed;
            z-index: 9999;
            pointer-events: none;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            left: ${startPos.x}px;
            top: ${startPos.y}px;
        `;

        const img = document.createElement('img');
        img.src = image;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        flyer.appendChild(img);
        document.body.appendChild(flyer);

        // Calculate animation parameters
        const deltaX = endPos.x - startPos.x;
        const deltaY = endPos.y - startPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const duration = Math.min(800, Math.max(400, distance / 2));

        // Animate using Web Animations API
        const keyframes = [
            { 
                left: `${startPos.x}px`, 
                top: `${startPos.y}px`, 
                opacity: 1, 
                transform: 'scale(1) rotate(0deg)' 
            },
            { 
                left: `${startPos.x + deltaX * 0.3}px`, 
                top: `${startPos.y + deltaY * 0.3 - 100}px`,
                opacity: 1, 
                transform: 'scale(0.8) rotate(-15deg)' 
            },
            { 
                left: `${startPos.x + deltaX * 0.7}px`, 
                top: `${startPos.y + deltaY * 0.7 - 50}px`,
                opacity: 0.8, 
                transform: 'scale(0.6) rotate(-30deg)' 
            },
            { 
                left: `${endPos.x}px`, 
                top: `${endPos.y}px`, 
                opacity: 0, 
                transform: 'scale(0.1) rotate(-45deg)' 
            }
        ];

        flyer.animate(keyframes, {
            duration: duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            fill: 'forwards'
        }).onfinish = () => {
            flyer.remove();
            if (onComplete) onComplete();
        };

        return () => flyer.remove();
    }, [startPos, endPos, image, onComplete]);

    return null;
};

// ─── CART PROVIDER (persists across auth changes) ───────
const CartProvider = ({ children }) => {
    const [cart, setCart] = useState({});
    const [toast, setToast] = useState(null);
    const [flyingItem, setFlyingItem] = useState(null);

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

    const addToCart = useCallback((item, startElement = null) => {
        if (startElement && item.image) {
            // Get start position from the clicked element
            const rect = startElement.getBoundingClientRect();
            const startPos = {
                x: rect.left + rect.width / 2 - 30,
                y: rect.top + rect.height / 2 - 30
            };

            // Get cart icon position (prefer nav cart, fallback to floating button)
            const navCart = document.querySelector('nav button[title="View Cart"]');
            const floatingCart = document.querySelector('button[title="View Cart"]:not(nav button)');
            const cartElement = navCart || floatingCart;
            
            if (cartElement) {
                const cartRect = cartElement.getBoundingClientRect();
                const endPos = {
                    x: cartRect.left + cartRect.width / 2 - 30,
                    y: cartRect.top + cartRect.height / 2 - 30
                };

                // Set flying item to trigger animation
                setFlyingItem({
                    startPos,
                    endPos,
                    image: item.image.startsWith('http') ? item.image : `/images/menu/${item.image}`,
                    itemId: item._id
                });

                // Add to cart after animation starts
                setTimeout(() => {
                    updateCart(item, 1);
                    setToast({ message: `${item.name} added to cart`, type: 'success' });
                    setTimeout(() => setToast(null), 3000);
                }, 200);

                // Clear flying item after animation
                setTimeout(() => setFlyingItem(null), 800);
            } else {
                // Fallback if no cart found
                updateCart(item, 1);
                setToast({ message: `${item.name} added to cart`, type: 'success' });
                setTimeout(() => setToast(null), 3000);
            }
        } else {
            updateCart(item, 1);
            setToast({ message: `${item.name} added to cart`, type: 'success' });
            setTimeout(() => setToast(null), 3000);
        }
    }, [updateCart]);

    const clearCart = useCallback(() => setCart({}), []);

    const cartArray = useMemo(() => Object.values(cart), [cart]);
    const totalItems = useMemo(() => cartArray.reduce((s, i) => s + i.quantity, 0), [cartArray]);
    const totalAmount = useMemo(() => cartArray.reduce((s, i) => s + i.orderPrice * i.quantity, 0), [cartArray]);

    return (
        <CartContext.Provider value={{ 
            cart, 
            cartArray, 
            totalItems, 
            totalAmount, 
            updateCart, 
            addToCart, 
            clearCart, 
            toast, 
            setToast,
            flyingItem,
            setFlyingItem
        }}>
            {children}
        </CartContext.Provider>
    );
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
const NavItem = ({ name, active, onClick, icon }) => (
    <button
        onClick={onClick}
        className={[
            'flex items-center space-x-1 font-semibold transition-colors duration-200',
            // Mobile: flat, minimal, no pill background, no scale, thin underline when active
            'px-1.5 py-1 text-xs border-b-2',
            active
                ? 'border-white text-white'
                : 'border-transparent text-green-100 hover:text-white',
            // Desktop (sm+): restore the original pill button look
            'sm:px-4 sm:py-2 sm:text-base sm:rounded-full sm:border-b-0 sm:border-0 sm:transition-all sm:duration-300 sm:hover:scale-105 sm:active:scale-95',
            active
                ? 'sm:bg-green-600 sm:text-white sm:shadow-sm'
                : 'sm:text-gray-200 sm:hover:bg-green-800 sm:hover:text-gray-200',
        ].join(' ')}
    >
        {icon && <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
        <span>{name}</span>
    </button>
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
            { name: `${user?.loyaltyPoints || 0} Pts`, view: 'customer_profile', icon: true },
        ];
    }, [isStaff, isAuthenticated, user]);

    const allItems = isStaff ? navItems : [...navItems, ...customerExtra];

    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <nav className="bg-green-700 px-2 py-2 sm:p-3 shadow-xl z-50 relative animate-[nav-reveal_0.6s_ease-out]">
            <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
                <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                    <button onClick={() => setMobileOpen(true)} className="sm:hidden p-1.5 text-white hover:bg-green-800 rounded-lg transition">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <h1 className="text-lg sm:text-3xl text-white cursor-pointer whitespace-nowrap" style={{ fontFamily: "'Archivo Black', 'Inter', sans-serif", letterSpacing: '0.02em' }} onClick={() => setActiveView(isStaff ? 'staff_pos' : 'customer_order')}>LUCKY FOODS</h1>
                    <span className="hidden sm:inline text-green-200 text-sm font-medium">{isStaff ? userRole?.toUpperCase() : ''}</span>
                </div>

                {/* Desktop nav items */}
                <div className="hidden sm:flex items-center space-x-1 sm:space-x-3">
                    {allItems.map(item => (
                        <NavItem key={item.view} name={item.name} active={activeView === item.view} onClick={() => setActiveView(item.view)} icon={item.icon} />
                    ))}
                </div>

                {/* Right section - cart + desktop user controls */}
                <div className="flex items-center space-x-1 sm:space-x-2">
                    {(activeView === 'customer_order' || !isAuthenticated) && (
                        <button onClick={onCartClick} className="relative p-2 text-white hover:bg-green-800 rounded-full transition-all" title="View Cart">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                            {totalItems > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">{totalItems > 99 ? '99+' : totalItems}</span>
                            )}
                        </button>
                    )}
                    <div className="hidden sm:flex items-center space-x-1 sm:space-x-2 sm:ml-2 sm:pl-2 sm:border-l border-green-600">
                        {!isStaff && isAuthenticated && (
                            <span className="text-green-200 text-sm font-medium flex items-center cursor-default">
                                <svg className="w-4 h-4 mr-1 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                {user?.name || user?.email}
                            </span>
                        )}
                        {isAuthenticated && (
                            <button onClick={logout} className="px-3 py-1.5 text-sm font-semibold rounded-full text-white bg-red-500 hover:bg-red-600 transition shadow ml-1" title="Sign out">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            </button>
                        )}
                        {!isStaff && !isAuthenticated && (
                            <button onClick={onOpenAuth} className="text-green-200 hover:text-white text-sm font-medium flex items-center transition">
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 sm:hidden">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b bg-green-700 text-white">
                            <span className="font-bold text-lg" style={{ fontFamily: "'Archivo Black', sans-serif" }}>LUCKY FOODS</span>
                            <button onClick={() => setMobileOpen(false)} className="text-white hover:text-green-200 text-2xl leading-none">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-1">
                            {allItems.map(item => (
                                <button key={item.view} onClick={() => { setActiveView(item.view); setMobileOpen(false); }}
                                    className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition text-sm ${activeView === item.view ? 'bg-green-700 text-white shadow' : 'text-gray-700 hover:bg-green-50'}`}>
                                    {item.name}
                                </button>
                            ))}
                        </div>
                        <div className="border-t p-4 space-y-3">
                            {!isStaff && isAuthenticated && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    {user?.name || user?.email}
                                </div>
                            )}
                            {isAuthenticated && (
                                <button onClick={() => { logout(); setMobileOpen(false); }} className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-red-500 hover:bg-red-600 transition text-center">
                                    Sign Out
                                </button>
                            )}
                            {!isStaff && !isAuthenticated && (
                                <button onClick={() => { onOpenAuth(); setMobileOpen(false); }} className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700 transition text-center">
                                    Sign In
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-gray-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
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
                                <div key={item._id} className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow transition">
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
const MENU_CACHE_KEY = 'menu_cache_v1';

const readMenuCache = () => {
    try {
        const raw = localStorage.getItem(MENU_CACHE_KEY);
        const cached = raw ? JSON.parse(raw) : null;
        return Array.isArray(cached) && cached.length ? cached : null;
    } catch { return null; }
};

const MenuView = ({ onAddToCart }) => {
    // Hydrate instantly from the last cached menu so returning visitors skip the
    // skeleton entirely — fresh data is fetched in the background and swapped in.
    const cachedMenu = useMemo(() => readMenuCache(), []);
    const [menu, setMenu] = useState(cachedMenu);
    const [loading, setLoading] = useState(!cachedMenu);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [retrying, setRetrying] = useState(null);
    const buttonRefs = useRef({});

    useEffect(() => {
        const hasCache = !!cachedMenu;
        const fetchWithRetry = async () => {
            // When we already show cached data, the wait is invisible — keep messaging silent.
            // On a true first visit, reassure that a sleeping backend may take a moment to wake.
            const attempts = [
                { timeout: 50000, delay: 0, label: 'Waking up the kitchen — first visit can take up to a minute…' },
                { timeout: 10000, delay: 0, label: 'Almost there — finishing up…' },
                { timeout: 30000, delay: 15000, label: 'Almost there — finishing up…' },
            ];
            for (const attempt of attempts) {
                if (attempt.delay) await new Promise(r => setTimeout(r, attempt.delay));
                if (!hasCache) setRetrying(attempt.label);
                try {
                    const result = await apiCall('/api/menu', 'GET', null, null, attempt.timeout);
                    const combined = [
                        ...(result.dishes || []).map(d => ({ ...d, type: 'Dishes' })),
                        ...(result.salads || []).map(d => ({ ...d, type: 'Salads' })),
                        ...(result.drinks || []).map(d => ({ ...d, type: 'Drinks' })),
                    ];
                    setMenu(combined);
                    try { localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(combined)); } catch { /* quota/private mode — ignore */ }
                    setRetrying(null);
                    setLoading(false);
                    return;
                } catch (err) {
                    if (attempt === attempts[attempts.length - 1]) {
                        // Only surface an error if we have nothing to show; otherwise keep stale data.
                        if (!hasCache) setError(err.message);
                        setRetrying(null);
                        setLoading(false);
                    }
                }
            }
        };
        fetchWithRetry();
    }, [cachedMenu]);

    const handleAddToCart = (item, button) => {
        onAddToCart(item, button);
    };

    if (loading) return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            {retrying && (
                <div className="flex items-center justify-center mb-4 text-sm text-gray-400">
                    <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {retrying}
                </div>
            )}
            <div className="animate-pulse">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-3 md:space-y-0 md:gap-8">
                <div className="flex space-x-3">
                    {[1,2,3,4].map(i => <div key={i} className="h-9 w-20 bg-gray-200 rounded-full" />)}
                </div>
                <div className="w-full md:w-72 h-9 bg-gray-200 rounded-full" />
            </div>
            {['Dishes', 'Salads', 'Drinks'].map(cat => (
                <div key={cat} className="mb-8">
                    <div className="h-7 w-28 bg-gray-200 rounded mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="h-48 bg-gray-200" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    <div className="h-3 bg-gray-200 rounded w-full" />
                                    <div className="h-9 bg-gray-200 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            </div>
        </div>
    );
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

    let cardIdx = 0;
    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-3 md:space-y-0 md:gap-8">
                <div className="flex space-x-3 overflow-x-auto pb-2 md:pb-0">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${activeCategory === cat ? 'bg-green-700 text-white shadow' : 'bg-white text-gray-500 hover:bg-green-50 border border-gray-300'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-72 xl:mr-[352px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                    <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-400 text-sm" />
                </div>
            </div>

            
            {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">{category}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-6">
                        {items.map(item => {
                            const delay = 700 + cardIdx++ * 120;
                            const priceDisplay = typeof item.price === 'object' ? `From UGX ${Object.values(item.price)[0]?.toLocaleString()}` : `UGX ${Number(item.price).toLocaleString()}`;
                            return (
                                <div key={item._id} className="bg-white rounded-xl shadow-sm hover:shadow-lg active:shadow-lg transition-all duration-300 overflow-hidden border hover:border-green-300 active:border-green-300 group">
                                    {item.image && (
                                        <div style={{ animationDelay: `${delay}ms` }} className="h-48 overflow-hidden cursor-pointer animate-[card-nudge_600ms_ease-out_both]" onClick={(e) => handleAddToCart(item, e.currentTarget)}>
                                            {(() => {
                                                const imgUrl = item.image.startsWith('http') ? item.image : `/images/menu/${item.image}`;
                                                const isCloud = imgUrl.includes('res.cloudinary.com');
                                                const cx = (w) => isCloud ? imgUrl.replace('/image/upload/', `/image/upload/f_auto,q_80,w_${w}/`) : imgUrl;
                                                return <img src={cx(400)} alt={item.name} loading="lazy"
                                                    srcSet={isCloud ? `${cx(400)} 400w, ${cx(800)} 800w, ${cx(1200)} 1200w` : undefined}
                                                    sizes={isCloud ? '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw' : undefined}
                                                    className="w-full h-full object-cover group-hover:scale-105 group-active:scale-105 transition-all duration-500 opacity-0"
                                                    onLoad={e => e.currentTarget.classList.add('opacity-100')}
                                                    onError={e => e.target.style.display = 'none'} />;
                                            })()}
                                        </div>
                                    )}
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-lg text-gray-900">{item.name}</h4>
                                            <span className="text-green-700 font-bold whitespace-nowrap ml-2">{priceDisplay}</span>
                                        </div>
                                        {item.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>}
                                        <button onClick={(e) => handleAddToCart(item, e.currentTarget)}
                                            className="w-full py-2 bg-green-600 hover:bg-green-700 active:bg-green-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow"
                                            data-item-id={item._id}>
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
const CheckoutScreen = ({ token, onBack, onViewOrders }) => {
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
            setPaidAmount(totalAmount); clearCart(); setStep('success');
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
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600 text-center">
                        We&rsquo;ll reach out to you later with delivery instructions.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onBack} className="flex-1 py-3 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg shadow transition">Back to Menu</button>
                        <button onClick={onViewOrders} className="flex-1 py-3 border-2 border-green-700 text-green-700 hover:bg-green-50 font-bold rounded-lg transition">See My Orders</button>
                    </div>
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
                    <p className="text-xs text-center text-gray-400">Simulated payment — no real charge</p>
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
            <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wide">Order ID</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wide">Customer</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wide">Items</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 uppercase tracking-wide">Total</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-gray-700 uppercase tracking-wide">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filtered.length === 0 ? (
                            <tr><td colSpan="5" className="text-center py-12 text-gray-500 text-lg">No orders found</td></tr>
                        ) : (
                            filtered.map(order => (
                                <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-4 font-bold text-green-700 text-base">#{order._id.slice(-6).toUpperCase()}</td>
                                    <td className="px-4 py-4 font-semibold text-base text-gray-800">{order.customerName}</td>
                                    <td className="px-4 py-4 text-base text-gray-700">{order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</td>
                                    <td className="px-4 py-4 font-bold text-base text-gray-900">UGX {(order.totalAmount||0).toLocaleString()}</td>
                                    <td className="px-4 py-4 text-center"><span className={`px-3 py-1.5 text-sm font-bold rounded-full ${sc[order.status]||'bg-gray-200 text-gray-700'}`}>{order.status}</span></td>
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
const ProfileView = ({ user }) => {
    const points = user?.loyaltyPoints || 0;
    const nextReward = Math.ceil((points + 1) / 100) * 100;
    const progress = ((points % 100) / 100) * 100;
    const totalSpent = points * 10; // Assuming 1 point per 10 UGX spent

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto animate-premium-transition">
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-800">My Profile</h2>
                <p className="text-gray-600">Manage your account and rewards</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Loyalty Card */}
                <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-green-200 text-sm font-medium">LOYALTY MEMBER</span>
                            <svg className="w-8 h-8 text-green-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                        </div>
                        <p className="text-4xl font-black mb-2">{points.toLocaleString()}</p>
                        <p className="text-green-200 text-sm mb-4">Available Points</p>
                        <div className="bg-green-900 bg-opacity-30 rounded-full h-2 mb-2">
                            <div className="bg-yellow-400 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-xs text-green-200">{100 - (points % 100)} points until next reward!</p>
                    </div>
                </div>

                {/* Account Info */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Account Details
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Full Name</p>
                            <p className="font-semibold text-gray-800">{user?.name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Email</p>
                            <p className="font-semibold text-gray-800">{user?.email || 'N/A'}</p>
                        </div>
                        {user?.phone && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">Phone</p>
                                <p className="font-semibold text-gray-800">{user.phone}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Estimated Total Spent</p>
                            <p className="font-semibold text-green-600">UGX {totalSpent.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rewards Info */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13l0-5m0-5l-3 3m3-3l3 3M20 12a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
                    How Loyalty Points Work
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="text-2xl font-bold text-green-700 mb-1">Earn</div>
                        <p className="text-sm text-gray-600">Get 1 point for every 10 UGX spent on orders</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="text-2xl font-bold text-green-700 mb-1">Redeem</div>
                        <p className="text-sm text-gray-600">Use 100 points for UGX 1,000 off your next order</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <div className="text-2xl font-bold text-green-700 mb-1">Benefits</div>
                        <p className="text-sm text-gray-600">Exclusive deals and early access to new menu items</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── MANAGER DASHBOARD ──────────────────────────────────
const ManagerView = ({ token }) => {
    const [tab, setTab] = useState('menu'); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
    const [menuItems, setMenuItems] = useState({ dishes:[], drinks:[], salads:[] }); const [adding, setAdding] = useState(false);
    const [newItem, setNewItem] = useState({ name:'',description:'',price:'',category:'dishes',image:'' });
    const [editingItem, setEditingItem] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [staff, setStaff] = useState([]); const [customers, setCustomers] = useState([]);
    const [newStaff, setNewStaff] = useState({ name:'',role:'Waiter',contact:'',password:'' });

    useEffect(() => {
        const fetch = async () => { setLoading(true); try { const [m,s,c]=await Promise.all([apiCall('/api/menu','GET',null,token),apiCall('/api/staff','GET',null,token),apiCall('/api/customers','GET',null,token)]); setMenuItems({dishes:m.dishes||[],drinks:m.drinks||[],salads:m.salads||[]}); setStaff(s); setCustomers(c); } catch(err){setError(err.message)} finally{setLoading(false)} };
        fetch();
    }, [token]);

    const handleAdd = async (e) => { e.preventDefault(); try { if (editingItem) { await apiCall(`/api/menu/${newItem.category}/${editingItem._id}`,'PUT',newItem,token); } else { await apiCall(`/api/menu/${newItem.category}`,'POST',newItem,token); } setAdding(false); setEditingItem(null); setNewItem({name:'',description:'',price:'',category:'dishes',image:''}); const m=await apiCall('/api/menu','GET',null,token); setMenuItems({dishes:m.dishes||[],drinks:m.drinks||[],salads:m.salads||[]}); } catch(err){setError(err.message)} };
    const handleEdit = (item, cat) => { setEditingItem(item); setNewItem({name:item.name,description:item.description||'',price:typeof item.price==='object'?JSON.stringify(item.price):item.price,category:cat,image:item.image||''}); setAdding(true); };
    const handleDelete = async (item, cat) => { if (!confirm(`Delete "${item.name}"?`)) return; try { await apiCall(`/api/menu/${cat}/${item._id}`,'DELETE',null,token); const m=await apiCall('/api/menu','GET',null,token); setMenuItems({dishes:m.dishes||[],drinks:m.drinks||[],salads:m.salads||[]}); } catch(err){setError(err.message)} };
    const handleAddStaff = async (e) => { e.preventDefault(); try { await apiCall('/api/staff','POST',newStaff,token); setNewStaff({name:'',role:'Waiter',contact:'',password:''}); setStaff(await apiCall('/api/staff','GET',null,token)); } catch(err){setError(err.message)} };
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await fetch(`${API_BASE_URL}/api/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            setNewItem(prev => ({ ...prev, image: data.url }));
        } catch (err) { setError(err.message); }
        finally { setUploading(false); }
    };

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
                    {adding && <div className="bg-white p-4 rounded-lg shadow-md"><h4 className="font-bold mb-3">{editingItem?'Edit Menu Item':'New Menu Item'}</h4><form onSubmit={handleAdd} className="space-y-3"><input type="text" placeholder="Name" value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})} className="w-full p-2 border rounded text-sm" required /><input type="text" placeholder="Price (or JSON for multiple)" value={newItem.price} onChange={e=>setNewItem({...newItem,price:e.target.value})} className="w-full p-2 border rounded text-sm" required /><textarea placeholder="Description" value={newItem.description} onChange={e=>setNewItem({...newItem,description:e.target.value})} className="w-full p-2 border rounded text-sm" rows={2} /><div className="flex items-center gap-3">{newItem.image ? <div className="relative w-16 h-16 rounded overflow-hidden border"><img src={newItem.image} alt="" className="w-full h-full object-cover" /><button type="button" onClick={()=>setNewItem(prev=>({...prev,image:''}))} className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs leading-none rounded-bl">x</button></div>:<label className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer ${uploading?'opacity-50 pointer-events-none':''}`}><svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>{uploading?'Uploading...':'Image'}<input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" /></label>}{uploading && <svg className="animate-spin h-4 w-4 text-green-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}</div><div className="flex space-x-2"><button type="button" onClick={()=>{setAdding(false);setEditingItem(null);setNewItem({name:'',description:'',price:'',category:'dishes',image:''});}} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 text-sm">Cancel</button><button type="submit" className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 text-sm">{editingItem?'Update':'Save'}</button></div></form></div>}
                    {['dishes','drinks','salads'].map(cat => (
                        <div key={cat} className="bg-white p-4 rounded-lg shadow"><h4 className="text-lg font-bold text-green-700 capitalize mb-3">{cat} ({menuItems[cat]?.length||0})</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{(menuItems[cat]||[]).map(item => (<div key={item._id} className="p-3 border rounded-lg text-sm"><div className="flex justify-between items-start"><p className="font-bold">{item.name}</p><div className="flex gap-1 shrink-0"><button onClick={()=>handleEdit(item,cat)} className="text-blue-600 hover:text-blue-800" title="Edit"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button><button onClick={()=>handleDelete(item,cat)} className="text-red-500 hover:text-red-700" title="Delete"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div></div><p className="text-gray-600">UGX {typeof item.price==='object'?Object.values(item.price)[0]:Number(item.price).toLocaleString()}</p></div>))}</div>
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
    const [staff, setStaff] = useState([]); const [customers, setCustomers] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [editingPoints, setEditingPoints] = useState(null); const [pointsValue, setPointsValue] = useState('');
    useEffect(() => { fetchStaff(); fetchCustomers(); }, []);
    const fetchStaff = async () => { setLoading(true); try { setStaff(await apiCall('/api/staff','GET',null,token)); } catch(err){setError(err.message)} finally{setLoading(false)} };
    const fetchCustomers = async () => { try { setCustomers(await apiCall('/api/customers','GET',null,token)); } catch(err){setError(err.message)} };
    const changeRole = async (id,role) => { try { await apiCall(`/api/staff/${id}/change-role`,'POST',{newRole:role},token); fetchStaff(); } catch(err){setError(err.message)} };
    const deleteStaff = async (id,name) => { if (!confirm(`Delete staff "${name}"?`)) return; try { await apiCall(`/api/staff/${id}`,'DELETE',null,token); fetchStaff(); } catch(err){setError(err.message)} };
    const savePoints = async (id) => { try { await apiCall(`/api/customers/${id}/loyalty-points`,'PUT',{points:Number(pointsValue)},token); setEditingPoints(null); fetchCustomers(); } catch(err){setError(err.message)} };
    const deleteCustomer = async (id,name) => { if (!confirm(`Delete customer "${name}"?`)) return; try { await apiCall(`/api/customers/${id}`,'DELETE',null,token); fetchCustomers(); } catch(err){setError(err.message)} };
    if (loading) return <Loader />;
    return (
        <div className="p-6 max-w-7xl mx-auto">
            {error && <Alert message={error} type="error" onClose={()=>setError(null)} />}
            <h1 className="text-3xl font-bold text-green-700 mb-6">👑 Admin Panel</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-lg p-4"><h2 className="text-xl font-bold mb-4">Staff ({staff.length})</h2><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="pb-2">Name</th><th>Role</th><th>Action</th></tr></thead><tbody>{staff.map(s => (<tr key={s._id} className="border-b hover:bg-gray-50"><td className="py-2">{s.name}</td><td><span className={`px-2 py-1 rounded-full text-xs font-bold text-white ${s.role==='Admin'?'bg-red-600':s.role==='Manager'?'bg-blue-600':'bg-green-600'}`}>{s.role}</span></td><td className="flex gap-2 py-2">{s.role!=='Admin'&&<>{s.role==='Waiter'&&<button onClick={()=>changeRole(s._id,'Manager')} className="text-blue-600 hover:underline text-xs">Promote</button>}{s.role==='Manager'&&<button onClick={()=>changeRole(s._id,'Waiter')} className="text-yellow-600 hover:underline text-xs">Demote</button>}</>}<button onClick={()=>deleteStaff(s._id,s.name)} className="text-red-600 hover:underline text-xs">Delete</button></td></tr>))}</tbody></table></div>
                <div className="bg-white rounded-xl shadow-lg p-4"><h2 className="text-xl font-bold mb-4">Customers ({customers.length})</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{customers.map(c => (<div key={c._id} className="p-3 border rounded-lg"><div className="flex justify-between items-start"><p className="font-bold text-sm">{c.name}</p><button onClick={()=>deleteCustomer(c._id,c.name)} className="text-red-500 hover:text-red-700" title="Delete"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div><p className="text-xs text-gray-600">{c.email}</p>{editingPoints===c._id?<div className="flex items-center gap-1 mt-1"><input type="number" value={pointsValue} onChange={e=>setPointsValue(e.target.value)} className="w-20 p-1 border rounded text-xs" autoFocus /><button onClick={()=>savePoints(c._id)} className="text-green-600 text-xs font-bold">Save</button><button onClick={()=>setEditingPoints(null)} className="text-gray-500 text-xs">x</button></div>:<p className="text-xs font-semibold mt-1">Points: <button onClick={()=>{setEditingPoints(c._id);setPointsValue(c.loyaltyPoints||0)}} className="text-green-600 hover:underline text-xs">{c.loyaltyPoints||0}</button></p>}</div>))}</div></div>
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

    // Get flying item from cart context for animation
    const { flyingItem } = useCart();

    const renderView = () => {
        // Public menu view — no auth needed
        if (activeView === 'customer_order' && !showCheckout) {
            return <CartContext.Consumer>{({ addToCart }) => <MenuView onAddToCart={addToCart} />}</CartContext.Consumer>;
        }

        // Checkout — requires auth (checked via handleCheckoutAction)
        if (showCheckout && isAuthenticated) {
            return <CheckoutScreen token={token} onBack={() => setShowCheckout(false)} onViewOrders={() => { setShowCheckout(false); setActiveView('customer_history'); }} />;
        }

        // Staff views
        if (isStaff) {
            switch (activeView) {
                case 'staff_pos': return <StaffOrderPlacer token={token} />;
                case 'staff_orders': return <OrdersView token={token} isStaff={true} />;
                case 'staff_menu': return (user?.role === 'Manager' || user?.role === 'Admin') ? <ManagerView token={token} /> : <div className="p-8 text-center text-red-600 font-bold">Access Denied</div>;
                case 'admin_panel': return user?.role === 'Admin' ? <AdminPanel token={token} /> : <div className="p-8 text-center text-red-600 font-bold">Access Denied</div>;
                default: return <div className="p-8"><Alert message="Welcome" type="info" /></div>;
            }
        }

        // Customer authenticated views
        if (isAuthenticated && !isStaff) {
            switch (activeView) {
                case 'customer_history': return <OrdersView token={token} isStaff={false} />;
                case 'customer_profile': return <ProfileView user={user} />;
                default: return <CartContext.Consumer>{({ addToCart }) => <MenuView onAddToCart={addToCart} />}</CartContext.Consumer>;
            }
        }

        return <CartContext.Consumer>{({ addToCart }) => <MenuView onAddToCart={addToCart} />}</CartContext.Consumer>;
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <Navigation activeView={activeView} setActiveView={setActiveView} onCartClick={() => setCartOpen(true)} onOpenAuth={() => { pendingCheckout.current = false; setShowAuth(true); }} />
            <main className="flex-1 overflow-auto bg-gray-50">
                <div key={activeView + (showCheckout ? '-checkout' : '')} className="animate-premium-transition relative z-20">
                        {renderView()}
                        {activeView === 'customer_order' && !showCheckout && (
                            <aside className="hidden xl:block absolute right-0 w-80 top-[126px] bottom-[56px] z-10 bg-gradient-to-br from-green-700 to-green-800 rounded-l-2xl shadow-2xl overflow-hidden">
                            {/* Decorative semi-transparent rings */}
                            <div className="absolute -top-24 -right-16 w-40 h-40 border-2 border-white/10 rounded-full pointer-events-none" />
                            <div className="absolute top-1/3 -left-8 w-36 h-36 border-2 border-white/10 rounded-full pointer-events-none" />
                            <div className="absolute top-1/2 right-2 w-14 h-14 border-2 border-white/5 rounded-full pointer-events-none" />
                            <div className="absolute top-[55%] left-10 w-8 h-8 border border-white/5 rounded-full pointer-events-none" />
                            <div className="absolute top-[80%] -right-4 w-24 h-24 border border-white/10 rounded-full pointer-events-none" />
                            <div className="absolute bottom-12 -right-6 w-28 h-28 border border-white/5 rounded-full pointer-events-none" />
                            <div className="absolute bottom-4 left-4 w-16 h-16 border border-white/5 rounded-full pointer-events-none" />
                            <div className="absolute bottom-6 left-12 w-10 h-10 border-2 border-white/5 rounded-full pointer-events-none" />

                            <div className="p-6 text-white flex flex-col items-center text-center">
                                {/* Zone 1: The Hook */}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-20 h-20 mb-4">
                                    <text x="50%" y="52" text-anchor="middle"
                                        fontFamily="'Archivo Black', 'Arial Black', system-ui, sans-serif"
                                        fontWeight="900" fontSize="36" fill="#ffffff"
                                        letterSpacing="-2">LF</text>
                                </svg>
                                <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Archivo Black', sans-serif" }}>Welcome</h2>
                                <p className="text-sm text-white/85 leading-relaxed mb-12">
                                    Discover our delicious menu crafted with love. Browse dishes, salads, and drinks.
                                </p>

                                {/* Zone 2: Operational Info */}
                                <div className="w-full space-y-6">
                                    <p className="text-xs font-bold tracking-widest text-green-300 uppercase">Store Info</p>
                                    <div className="flex items-start gap-3 justify-center">
                                        <svg className="w-5 h-5 text-green-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="text-sm text-left">
                                            <p className="text-green-300 text-xs">Open Daily</p>
                                            <p className="text-white font-semibold">8:00 AM - 10:00 PM</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 justify-center">
                                        <svg className="w-5 h-5 text-green-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <div className="text-sm text-left">
                                            <p className="text-green-300 text-xs">Order Online</p>
                                            <p className="text-white font-semibold">Pickup or Delivery</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Zone 3: The Quote */}
                                <div className="w-full mt-12 pt-6 border-t border-white/20">
                                    <p className="text-green-200 text-xs italic">&ldquo;Good food brings people together.&rdquo;</p>
                                </div>
                            </div>
                        </aside>
                    )}
                </div>
            </main>
            <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckoutAction} />
            <AuthModal isOpen={showAuth} onClose={() => { setShowAuth(false); pendingCheckout.current = false; }} onAuthSuccess={handleAuthSuccess} />
            {/* Flying item animation */}
            {flyingItem && (
                <FlyToCartAnimation
                    startPos={flyingItem.startPos}
                    endPos={flyingItem.endPos}
                    image={flyingItem.image}
                />
            )}
            <CartContext.Consumer>
                {({ totalItems }) => totalItems > 0 && (
                    <button onClick={() => setCartOpen(true)} className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-xl hover:bg-green-700 transition-all transform hover:scale-110 active:scale-95 z-40" title="View Cart">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{totalItems > 99 ? '99+' : totalItems}</span>
                    </button>
                )}
            </CartContext.Consumer>
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
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_type', data.userType);
        localStorage.setItem('user_role', userRole);
        localStorage.setItem('user_data', JSON.stringify(data));
        setAuthState({ isAuthenticated: true, user: data, token: data.token, isStaff, userType: data.userType, userRole });
    }, []);

    // Merge partial updates into the current user object (useful for loyalty point updates)
    const updateUser = useCallback((patch) => {
        setAuthState(prev => ({ ...prev, user: { ...(prev.user || {}), ...patch } }));
    }, []);
    const logout = useCallback(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_type');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_data');
        setAuthState(initialAuthState);
    }, []);
    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        const userType = localStorage.getItem('user_type');
        const userRole = localStorage.getItem('user_role');
        const userData = localStorage.getItem('user_data');
        if (token && userData) {
            const user = JSON.parse(userData);
            const isStaff = userType === 'staff';
            setAuthState({
                isAuthenticated: true,
                user,
                token,
                isStaff,
                userType,
                userRole
            });
        }
    }, []);
    return <AuthContext.Provider value={{ ...authState, login, logout, updateUser, authType, setAuthType }}>{children}</AuthContext.Provider>;
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