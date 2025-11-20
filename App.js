import React, { useState, useEffect } from 'react';
import { Package, MapPin, Clock, Shield, Search, Plus, X, Activity, LogOut, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = 'https://blockchain-tracker-oh1n.onrender.com';

const SupplyChainTrackerV2 = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    company: '',
    role: 'manufacturer',
    licenseNumber: '',
    address: ''
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'pharmaceutical',
    origin: '',
    batchNumber: '',
    photo: null
  });

  const [trackEvent, setTrackEvent] = useState({
    stage: 'manufacturing',
    location: '',
    handler: '',
    notes: '',
    photo: null
  });

  // API call helper
  const apiCall = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  };

  // Load data on mount
  useEffect(() => {
    if (token) {
      loadUserData();
    }
  }, [token]);

  const loadUserData = async () => {
    try {
      const user = await apiCall('/api/user');
      setCurrentUser(user);
      await loadProducts();
      
      if (user.role === 'admin') {
        const [usersData, logs, activities] = await Promise.all([
          apiCall('/api/users'),
          apiCall('/api/audit-logs'),
          apiCall('/api/suspicious-activities')
        ]);
        setUsers(usersData);
        setAuditLogs(logs);
        setSuspiciousActivities(activities);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await apiCall('/api/products');
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiCall('/api/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });

      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('token', data.token);
      setLoginForm({ username: '', password: '' });
      await loadProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.password || !registerForm.company) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiCall('/api/register', {
        method: 'POST',
        body: JSON.stringify(registerForm)
      });

      alert('Registration successful! Pending admin verification.');
      setRegisterForm({
        username: '',
        password: '',
        company: '',
        role: 'manufacturer',
        licenseNumber: '',
        address: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('token');
    setProducts([]);
    setSelectedProduct(null);
  };

  const loginAsGuest = async () => {
    setCurrentUser({ id: 'guest', username: 'Guest', role: 'customer', verified: false });
    await loadProducts();
  };

  const createProduct = async () => {
    if (!newProduct.name || !newProduct.origin) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const gps = await getGeolocation();
      const productData = { ...newProduct, gps };
      
      const product = await apiCall('/api/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      });

      setProducts([product, ...products]);
      setNewProduct({
        name: '',
        category: 'pharmaceutical',
        origin: '',
        batchNumber: '',
        photo: null
      });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCheckpoint = async () => {
    if (!trackEvent.location || !trackEvent.handler) {
      setError('Please fill location and handler fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const gps = await getGeolocation();
      const checkpointData = { ...trackEvent, gps };

      const updatedProduct = await apiCall(`/api/products/${selectedProduct.id}/checkpoint`, {
        method: 'POST',
        body: JSON.stringify(checkpointData)
      });

      setProducts(products.map(p => p.id === selectedProduct.id ? updatedProduct : p));
      setSelectedProduct(updatedProduct);
      setTrackEvent({
        stage: 'manufacturing',
        location: '',
        handler: '',
        notes: '',
        photo: null
      });
      setShowTrackForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyUser = async (userId) => {
    try {
      await apiCall(`/api/users/${userId}/verify`, { method: 'POST' });
      const updatedUsers = await apiCall('/api/users');
      setUsers(updatedUsers);
    } catch (err) {
      setError(err.message);
    }
  };

  const searchProduct = async () => {
    if (!searchId.trim()) return;

    try {
      const product = await apiCall(`/api/products/${searchId.trim()}`);
      setSelectedProduct(product);
      setSearchId('');
    } catch (err) {
      alert('Product not found');
    }
  };

  const getGeolocation = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          () => resolve(null)
        );
      } else {
        resolve(null);
      }
    });
  };

  const handlePhotoUpload = (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getStageColor = (stage) => {
    const colors = {
      created: 'bg-blue-100 text-blue-800',
      manufacturing: 'bg-purple-100 text-purple-800',
      quality_check: 'bg-yellow-100 text-yellow-800',
      warehouse: 'bg-orange-100 text-orange-800',
      distribution: 'bg-cyan-100 text-cyan-800',
      retail: 'bg-green-100 text-green-800',
      delivered: 'bg-emerald-100 text-emerald-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (product) => {
    if (!product.verified) {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold flex items-center gap-1">
        <AlertTriangle size={14} />
        Unverified
      </span>;
    }
    if (product.status === 'delivered') {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1">
        <CheckCircle size={14} />
        Delivered
      </span>;
    }
    return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">In Transit</span>;
  };

  // Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supply Chain Tracker</h1>
              <p className="text-gray-600 text-sm">Secure & Verified</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Login</h2>
            <input
              type="text"
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button
              onClick={() => setError(null)}
              className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              Register Company
            </button>
            <button
              onClick={loginAsGuest}
              className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Continue as Guest (View Only)
            </button>
            <p className="text-sm text-gray-600 text-center mt-4">
              Demo: <strong>admin</strong> / <strong>admin123</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Blockchain Supply Chain</h1>
                <p className="text-gray-600 text-sm">Secure & Transparent Tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-semibold text-gray-900">{currentUser.company || currentUser.username}</p>
                <p className="text-sm text-gray-600 capitalize">{currentUser.role}</p>
              </div>
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => setShowAuditLog(!showAuditLog)}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Activity size={20} />
                </button>
              )}
              <button
                onClick={handleLogout}
                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {!currentUser.verified && currentUser.role !== 'customer' && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <AlertTriangle size={20} className="text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Your account is pending verification. You can view products but cannot register new ones.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchProduct()}
                placeholder="Enter Product ID to track..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={searchProduct}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Track
            </button>
            {(currentUser.role === 'manufacturer' || currentUser.role === 'admin') && currentUser.verified && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus size={20} />
                Add Product
              </button>
            )}
          </div>
        </div>

        {/* Admin Panel */}
        {currentUser.role === 'admin' && showAuditLog && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Admin Dashboard</h2>
              <button onClick={() => setShowAuditLog(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Pending Verifications</h3>
              <div className="space-y-2">
                {users.filter(u => !u.verified && u.role !== 'admin').map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{user.company}</p>
                      <p className="text-sm text-gray-600">{user.username} • {user.role}</p>
                      <p className="text-xs text-gray-500">License: {user.licenseNumber || 'N/A'}</p>
                    </div>
                    <button
                      onClick={() => verifyUser(user.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      Verify
                    </button>
                  </div>
                ))}
                {users.filter(u => !u.verified && u.role !== 'admin').length === 0 && (
                  <p className="text-gray-500 text-sm">No pending verifications</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Recent Activity</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {auditLogs.slice(0, 10).map(log => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{log.action}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 mt-1">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Products ({products.length})
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {products.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No products yet</p>
                  </div>
                ) : (
                  products.map(product => (
                    <div
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedProduct?.id === product.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{product.name}</h3>
                          <p className="text-sm text-gray-600 font-mono">{product.id}</p>
                        </div>
                        {getStatusBadge(product)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin size={14} />
                        <span>{product.origin}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <Package size={14} />
                        <span>{product.chain.length} checkpoints</span>
</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Product Details */}
          <div className="lg:col-span-2">
            {selectedProduct ? (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {selectedProduct.name}
                      </h2>
                      <p className="text-gray-600 font-mono text-sm">{selectedProduct.id}</p>
                    </div>
                    {getStatusBadge(selectedProduct)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="font-semibold capitalize">{selectedProduct.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Manufacturer</p>
                      <p className="font-semibold">{selectedProduct.manufacturer}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Origin</p>
                      <p className="font-semibold">{selectedProduct.origin}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Batch Number</p>
                      <p className="font-semibold">{selectedProduct.batchNumber || 'N/A'}</p>
                    </div>
                  </div>

                  {currentUser.role !== 'customer' && currentUser.verified && (
                    <button
                      onClick={() => setShowTrackForm(true)}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Add Checkpoint
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Supply Chain History
                  </h3>
                  <div className="space-y-4">
                    {selectedProduct.chain.map((block, index) => (
                      <div key={index} className="relative pl-8 pb-4 border-l-2 border-blue-200 last:border-0">
                        <div className="absolute left-0 top-0 w-4 h-4 bg-blue-600 rounded-full -translate-x-[9px]"></div>
                        
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStageColor(block.stage)}`}>
                              {block.stage.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-600">
                              Block #{block.blockNumber}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                            <div>
                              <p className="text-gray-600">Location</p>
                              <p className="font-semibold">{block.location}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Handler</p>
                              <p className="font-semibold">{block.handler}</p>
                            </div>
                          </div>

                          {block.gps && (
                            <div className="text-xs text-gray-600 mb-2">
                              📍 GPS: {block.gps.lat.toFixed(4)}, {block.gps.lng.toFixed(4)}
                            </div>
                          )}

                          {block.photo && (
                            <div className="mb-3">
                              <img src={block.photo} alt="Checkpoint" className="w-full h-32 object-cover rounded-lg" />
                            </div>
                          )}

                          {block.notes && (
                            <p className="text-sm text-gray-700 mb-3">{block.notes}</p>
                          )}

                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex items-center gap-2">
                              <Clock size={12} />
                              <span>{new Date(block.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="font-mono bg-gray-100 px-2 py-1 rounded break-all">
                              Hash: {block.hash}
                            </div>
                            {block.previousHash !== '0' && (
                              <div className="font-mono bg-gray-100 px-2 py-1 rounded break-all">
                                Prev: {block.previousHash}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <Package size={64} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Product Selected</h3>
                <p className="text-gray-600">Select a product from the list or search by ID</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Product Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Register New Product</h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Product Name *"
                />
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="pharmaceutical">Pharmaceutical</option>
                  <option value="food">Food & Beverage</option>
                  <option value="electronics">Electronics</option>
                  <option value="textiles">Textiles</option>
                  <option value="automotive">Automotive</option>
                </select>
                <input
                  type="text"
                  value={newProduct.origin}
                  onChange={(e) => setNewProduct({...newProduct, origin: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Origin Location *"
                />
                <input
                  type="text"
                  value={newProduct.batchNumber}
                  onChange={(e) => setNewProduct({...newProduct, batchNumber: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Batch Number"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, setNewProduct)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
                {newProduct.photo && (
                  <img src={newProduct.photo} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={createProduct}
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
                >
                  {loading ? 'Creating...' : 'Register'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Checkpoint Modal */}
        {showTrackForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add Checkpoint</h3>
              
              <div className="space-y-4">
                <select
                  value={trackEvent.stage}
                  onChange={(e) => setTrackEvent({...trackEvent, stage: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="manufacturing">Manufacturing</option>
                  <option value="quality_check">Quality Check</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="distribution">Distribution</option>
                  <option value="retail">Retail</option>
                  <option value="delivered">Delivered</option>
                </select>
                <input
                  type="text"
                  value={trackEvent.location}
                  onChange={(e) => setTrackEvent({...trackEvent, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Location *"
                />
                <input
                  type="text"
                  value={trackEvent.handler}
                  onChange={(e) => setTrackEvent({...trackEvent, handler: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="Handler *"
                />
                <textarea
                  value={trackEvent.notes}
                  onChange={(e) => setTrackEvent({...trackEvent, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  rows="3"
                  placeholder="Notes"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e, setTrackEvent)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
                {trackEvent.photo && (
                  <img src={trackEvent.photo} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowTrackForm(false)}
                  className="flex-1 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={addCheckpoint}
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
                >
                  {loading ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplyChainTrackerV2;
