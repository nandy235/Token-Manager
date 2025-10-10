import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Save } from 'lucide-react';

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
  const [tokenCap, setTokenCap] = useState(200);
  const [editingCap, setEditingCap] = useState(false);
  const [tempCap, setTempCap] = useState(200);
  
  const totalTokensUsed = shops.reduce((sum, shop) => sum + shop.tokens, 0);
  const remainingTokens = tokenCap - totalTokensUsed;

  // Fetch shops and token cap from API on mount
  useEffect(() => {
    fetchShops();
    fetchTokenCap();
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

  const fetchTokenCap = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings/token-cap`);
      const data = await response.json();
      setTokenCap(data.tokenCap);
      setTempCap(data.tokenCap);
    } catch (error) {
      console.error('Failed to fetch token cap:', error);
    }
  };

  const addShop = async () => {
    if (newShopName.trim()) {
      try {
        const newShop = { 
          id: Date.now(), 
          name: newShopName.trim(), 
          tokens: 0,
          expected_tokens: 0,
          avg_sale: 0
        };
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
    const maxAllowed = tokenCap - otherShopsTokens;
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

  const updateExpectedTokens = async (id, value) => {
    const numValue = parseInt(value) || 0;
    
    try {
      await fetch(`${API_URL}/api/shops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_tokens: numValue })
      });
      
      setShops(shops.map(s => 
        s.id === id ? { ...s, expected_tokens: numValue } : s
      ));
    } catch (error) {
      console.error('Failed to update expected tokens:', error);
      setSaveMessage('Error updating expected tokens!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const updateAvgSale = async (id, value) => {
    const numValue = parseFloat(value) || 0;
    
    try {
      await fetch(`${API_URL}/api/shops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avg_sale: numValue })
      });
      
      setShops(shops.map(s => 
        s.id === id ? { ...s, avg_sale: numValue } : s
      ));
    } catch (error) {
      console.error('Failed to update avg sale:', error);
      setSaveMessage('Error updating avg sale!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addShop();
    }
  };

  const updateTokenCap = async () => {
    try {
      const newCap = parseInt(tempCap);
      if (newCap < totalTokensUsed) {
        setSaveMessage('Token cap cannot be less than currently allocated tokens!');
        setTimeout(() => setSaveMessage(''), 3000);
        setTempCap(tokenCap);
        setEditingCap(false);
        return;
      }
      
      const response = await fetch(`${API_URL}/api/settings/token-cap`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenCap: newCap })
      });
      const data = await response.json();
      setTokenCap(data.tokenCap);
      setEditingCap(false);
      setSaveMessage('Token cap updated successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update token cap:', error);
      setSaveMessage('Error updating token cap!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const saveData = () => {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shop Token Manager - Report</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 { color: #4F46E5; margin-bottom: 10px; }
          .info { color: #666; margin-bottom: 30px; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
          }
          th { 
            background-color: #4F46E5; 
            color: white;
          }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .summary { 
            background: #EEF2FF; 
            padding: 20px; 
            border-radius: 8px;
            margin: 20px 0;
          }
          .summary-item {
            display: inline-block;
            margin-right: 40px;
          }
          .summary-label { 
            font-weight: bold; 
            color: #666;
          }
          .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #4F46E5;
          }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>Shop Token Manager</h1>
        <p class="info">Generated on: ${currentDate}</p>
        
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Total Token Cap</div>
            <div class="summary-value">${tokenCap}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Shops</div>
            <div class="summary-value">${shops.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Tokens Used</div>
            <div class="summary-value">${totalTokensUsed}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Remaining</div>
            <div class="summary-value">${remainingTokens}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>S. No</th>
              <th>Shop Name</th>
              <th>Expected Tokens</th>
              <th>Avg Sale</th>
              <th>Tokens Allocated</th>
            </tr>
          </thead>
          <tbody>
            ${shops.map((shop, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${shop.name}</td>
                <td>${shop.expected_tokens || 0}</td>
                <td>${shop.avg_sale || 0}</td>
                <td>${shop.tokens}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setSaveMessage('Print dialog opened! Choose "Save as PDF" in the print dialog.');
    setTimeout(() => setSaveMessage(''), 5000);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Shop Token Manager</h1>
          <div className="flex items-center gap-3 mb-6">
            <p className="text-gray-600">Total Token Cap:</p>
            {editingCap ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tempCap}
                  onChange={(e) => setTempCap(e.target.value)}
                  className="w-24 px-3 py-1 border-2 border-indigo-500 rounded-lg focus:outline-none"
                  min="0"
                />
                <button
                  onClick={updateTokenCap}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingCap(false);
                    setTempCap(tokenCap);
                  }}
                  className="bg-gray-600 text-white px-3 py-1 rounded-lg hover:bg-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-indigo-600">{tokenCap}</p>
                <button
                  onClick={() => setEditingCap(true)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm underline"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

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
              onClick={saveData}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <Save size={20} />
              Save as PDF
            </button>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-4 text-green-800 text-center font-medium">
              {saveMessage}
            </div>
          )}

          {/* Shop List Table */}
          <div className="bg-white border-2 border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">S. No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Shop Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Expected Tokens</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Avg Sale</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tokens</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {shops.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No shops added yet. Add your first shop above!
                    </td>
                  </tr>
                ) : (
                  shops.map((shop, index) => (
                    <tr key={shop.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-4 text-gray-800">{index + 1}</td>
                      <td className="px-6 py-4 text-gray-800 font-medium">{shop.name}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={shop.expected_tokens === 0 ? '' : shop.expected_tokens}
                          onChange={(e) => updateExpectedTokens(shop.id, e.target.value)}
                          placeholder="0"
                          className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={shop.avg_sale === 0 ? '' : shop.avg_sale}
                          onChange={(e) => updateAvgSale(shop.id, e.target.value)}
                          placeholder="0.00"
                          className="w-28 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={shop.tokens === 0 ? '' : shop.tokens}
                          onChange={(e) => updateTokens(shop.id, e.target.value)}
                          placeholder="0"
                          className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-4">
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
              <strong>How it works:</strong> Manually assign tokens to each shop. The total cannot exceed the token cap. 
              You can allocate them however you want - some shops can have more, others less, as long as the total stays within the cap. 
              <strong>✏️ Edit the token cap</strong> by clicking "Edit" next to the cap value above.
            </p>
            <p className="text-sm text-gray-700">
              <strong>🗄️ Auto-Save:</strong> All changes are automatically saved to PostgreSQL database and synced in real-time! 
              <strong>📄 Save as PDF:</strong> Generate a printable PDF report of all shops and token allocations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}