import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Save, Upload } from 'lucide-react';

// Auto-detect environment
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV 
    ? 'http://localhost:5001' 
    : 'https://token-manager-production.up.railway.app');

export default function TokenManager() {
  const [shops, setShops] = useState([]);
  const [newShopName, setNewShopName] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  const MAX_TOKENS = 200;
  const totalTokensUsed = shops.reduce((sum, shop) => sum + shop.tokens, 0);
  const remainingTokens = MAX_TOKENS - totalTokensUsed;

  // Fetch shops from API on mount
  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      const response = await fetch(`${API_URL}/api/shops`);
      const data = await response.json();
      setShops(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch shops:', error);
      setSaveMessage('Error connecting to server!');
      setTimeout(() => setSaveMessage(''), 3000);
      setLoading(false);
    }
  };

  const addShop = async () => {
    if (newShopName.trim()) {
      try {
        const newShop = { id: Date.now(), name: newShopName.trim(), tokens: 0 };
        const response = await fetch(`${API_URL}/api/shops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newShop)
        });
        const data = await response.json();
        setShops([...shops, data]);
        setNewShopName('');
      } catch (error) {
        console.error('Failed to add shop:', error);
        setSaveMessage('Error adding shop!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    }
  };

  const removeShop = async (id) => {
    try {
      await fetch(`${API_URL}/api/shops/${id}`, {
        method: 'DELETE'
      });
      setShops(shops.filter(shop => shop.id !== id));
    } catch (error) {
      console.error('Failed to delete shop:', error);
      setSaveMessage('Error deleting shop!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const updateTokens = async (id, value) => {
    const numValue = parseInt(value) || 0;
    const shop = shops.find(s => s.id === id);
    const otherShopsTokens = totalTokensUsed - shop.tokens;
    
    // Ensure we don't exceed the cap
    const maxAllowed = MAX_TOKENS - otherShopsTokens;
    const newTokenValue = Math.min(Math.max(0, numValue), maxAllowed);
    
    try {
      await fetch(`${API_URL}/api/shops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: newTokenValue })
      });
      
      setShops(shops.map(s => 
        s.id === id ? { ...s, tokens: newTokenValue } : s
      ));
    } catch (error) {
      console.error('Failed to update tokens:', error);
      setSaveMessage('Error updating tokens!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addShop();
    }
  };

  const saveData = () => {
    const dataStr = JSON.stringify(shops, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shop-tokens.json';
    link.click();
    URL.revokeObjectURL(url);
    
    setSaveMessage('Data exported successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const loadData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const loadedShops = JSON.parse(event.target.result);
            if (Array.isArray(loadedShops)) {
              // Upload to backend
              const response = await fetch(`${API_URL}/api/shops/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shops: loadedShops })
              });
              const data = await response.json();
              setShops(data);
              setSaveMessage('Data imported successfully!');
              setTimeout(() => setSaveMessage(''), 3000);
            } else {
              setSaveMessage('Invalid file format!');
              setTimeout(() => setSaveMessage(''), 3000);
            }
          } catch (error) {
            console.error('Error importing data:', error);
            setSaveMessage('Error reading file!');
            setTimeout(() => setSaveMessage(''), 3000);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Shop Token Manager</h1>
          <p className="text-gray-600 mb-6">Total Token Cap: {MAX_TOKENS}</p>

          {/* Token Distribution Info */}
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Shops</p>
                <p className="text-2xl font-bold text-indigo-600">{shops.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Tokens Used</p>
                <p className="text-2xl font-bold text-indigo-600">{totalTokensUsed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining</p>
                <p className={`text-2xl font-bold ${remainingTokens === 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {remainingTokens}
                </p>
              </div>
            </div>
          </div>

          {/* Warning when at cap */}
          {remainingTokens === 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={24} />
              <p className="text-red-800 font-medium">Token limit reached! Remove tokens from other shops to allocate more.</p>
            </div>
          )}

          {/* Add Shop Input */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newShopName}
              onChange={(e) => setNewShopName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter shop name"
              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={addShop}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <Plus size={20} />
              Add Shop
            </button>
            <button
              onClick={loadData}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Upload size={20} />
              Load
            </button>
            <button
              onClick={saveData}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <Save size={20} />
              Export
            </button>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-4 text-green-800 text-center font-medium">
              {saveMessage}
            </div>
          )}

          {/* Shop List Table */}
          <div className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">S. No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Shop Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tokens</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {shops.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                      No shops added yet. Add your first shop above!
                    </td>
                  </tr>
                ) : (
                  shops.map((shop, index) => (
                    <tr key={shop.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-800">{index + 1}</td>
                      <td className="px-6 py-4 text-gray-800 font-medium">{shop.name}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={shop.tokens === 0 ? '' : shop.tokens}
                          onChange={(e) => updateTokens(shop.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const inputs = document.querySelectorAll('input[type="text"][placeholder="0"]');
                              const currentIndex = Array.from(inputs).indexOf(e.target);
                              if (currentIndex < inputs.length - 1) {
                                inputs[currentIndex + 1].focus();
                              }
                            }
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => removeShop(shop.id)}
                          className="text-red-600 hover:text-red-800 transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading shops...</p>
            </div>
          )}

          {/* Example Info */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700 mb-2">
              <strong>How it works:</strong> Manually assign tokens to each shop. The total cannot exceed 200 tokens. 
              You can allocate them however you want - some shops can have more, others less, as long as the total stays within the cap.
            </p>
            <p className="text-sm text-gray-700">
              <strong>🗄️ Database:</strong> All data is stored in PostgreSQL database and accessible from anywhere! 
              <strong>📤 Export:</strong> Download a backup JSON file. 
              <strong>📥 Load:</strong> Import a previously saved JSON file.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}