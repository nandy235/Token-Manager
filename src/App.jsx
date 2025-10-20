import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Save } from 'lucide-react';

// Auto-detect environment
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV 
    ? 'http://localhost:5001' 
    : 'https://token-manager-production.up.railway.app');

export default function TokenManager() {
  const [mode, setMode] = useState('planning'); // 'planning' or 'real'
  const [shops, setShops] = useState([]); // Planning mode shops
  const [realShops, setRealShops] = useState([]); // Real mode shops
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [tokenCap, setTokenCap] = useState(200);
  const [editingCap, setEditingCap] = useState(false);
  const [tempCap, setTempCap] = useState(200);
  
  // New state for districts and excise stations
  const [districts, setDistricts] = useState([]);
  const [exciseStations, setExciseStations] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedStation, setSelectedStation] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [masterShops, setMasterShops] = useState([]);
  const [pdfStationFilter, setPdfStationFilter] = useState('all');
  const [pdfDistrictFilter, setPdfDistrictFilter] = useState('all');
  const [pdfStations, setPdfStations] = useState([]);
  
  // Get current shops based on mode
  const currentShops = mode === 'planning' ? shops : realShops;
  
  // Filter shops based on PDF filters and sort by district then gazette code
  const filteredShops = currentShops
    .filter(shop => {
      if (pdfDistrictFilter !== 'all' && shop.district !== pdfDistrictFilter) {
        return false;
      }
      if (pdfStationFilter !== 'all' && shop.station !== pdfStationFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // First sort by district alphabetically (case-insensitive)
      const districtA = (a.district || '').toLowerCase();
      const districtB = (b.district || '').toLowerCase();
      const districtCompare = districtA.localeCompare(districtB);
      if (districtCompare !== 0) {
        return districtCompare;
      }
      // Then sort by gazette_code within same district (ascending order)
      const codeA = (a.gazette_code || '').toLowerCase();
      const codeB = (b.gazette_code || '').toLowerCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

  const totalTokensUsed = shops.reduce((sum, shop) => sum + shop.tokens, 0);
  const remainingTokens = tokenCap - totalTokensUsed;

  // Fetch shops and token cap from API on mount
  useEffect(() => {
    fetchShops();
    fetchTokenCap();
    fetchDistricts();
    fetchCategories();
  }, []);
  
  // Fetch excise stations when district changes
  useEffect(() => {
    if (selectedDistrict && selectedDistrict !== 'all') {
      fetchExciseStations(selectedDistrict);
    } else {
      setExciseStations([]);
      setSelectedStation('all');
    }
  }, [selectedDistrict]);
  
  // Re-fetch shops when filter changes or mode changes
  useEffect(() => {
    fetchShops();
  }, [selectedDistrict, selectedStation, mode]);
  
  // Sync planning mode shops to real mode when switching
  useEffect(() => {
    const syncPlanningToReal = async () => {
      if (mode === 'real') {
        // Fetch both planning and real shops to compare
        try {
          const [planningResponse, realResponse] = await Promise.all([
            fetch(`${API_URL}/api/shops`),
            fetch(`${API_URL}/api/real`)
          ]);
          
          const planningShops = await planningResponse.json();
          const currentRealShops = await realResponse.json();
          
          if (planningShops.length > 0) {
            let syncCount = 0;
            for (const shop of planningShops) {
              // Check if shop already exists in real mode by gazette_code
              const existsInReal = currentRealShops.some(rs => rs.gazette_code === shop.gazette_code);
              if (!existsInReal) {
                const newRealShop = {
                  name: shop.name,
                  gazette_code: shop.gazette_code,
                  category: shop.category,
                  district: shop.district,
                  station: shop.station,
                  total_tokens: 0,
                  allocated_tokens: ''
                };
                
                const response = await fetch(`${API_URL}/api/real`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newRealShop)
                });
                
                if (response.ok) {
                  syncCount++;
                }
              }
            }
            
            // Refresh real shops after sync if any shops were added
            if (syncCount > 0) {
              fetchShops();
              setSaveMessage(`✅ Synced ${syncCount} shop(s) from Planning Mode!`);
              setTimeout(() => setSaveMessage(''), 3000);
            }
          }
        } catch (error) {
          console.error('Failed to sync planning to real mode:', error);
        }
      }
    };
    
    syncPlanningToReal();
  }, [mode]);
  
  // Fetch PDF stations when PDF district changes
  useEffect(() => {
    fetchPdfStations(pdfDistrictFilter);
  }, [pdfDistrictFilter]);
  
  // Fetch master shops when filters change
  useEffect(() => {
    fetchMasterShops();
  }, [selectedDistrict, selectedStation, selectedCategory, searchQuery]);

  const fetchShops = async () => {
    try {
      const endpoint = mode === 'planning' ? '/api/shops' : '/api/real';
      let url = `${API_URL}${endpoint}`;
      const params = new URLSearchParams();
      
      if (selectedDistrict && selectedDistrict !== 'all') {
        params.append('district', selectedDistrict);
      }
      
      if (selectedStation && selectedStation !== 'all') {
        params.append('station', selectedStation);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (mode === 'planning') {
        setShops(data);
      } else {
        setRealShops(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch shops:', error);
      setSaveMessage('Error connecting to server!');
      setTimeout(() => setSaveMessage(''), 3000);
      setLoading(false);
    }
  };
  
  const fetchDistricts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/districts`);
      const data = await response.json();
      setDistricts(data);
    } catch (error) {
      console.error('Failed to fetch districts:', error);
    }
  };
  
  const fetchExciseStations = async (districtName) => {
    try {
      const response = await fetch(`${API_URL}/api/excise-stations?district=${encodeURIComponent(districtName)}`);
      const data = await response.json();
      setExciseStations(data);
    } catch (error) {
      console.error('Failed to fetch excise stations:', error);
    }
  };
  
  const fetchPdfStations = async (districtName) => {
    try {
      if (districtName && districtName !== 'all') {
        const response = await fetch(`${API_URL}/api/excise-stations?district=${encodeURIComponent(districtName)}`);
        const data = await response.json();
        setPdfStations(data);
      } else {
        setPdfStations([]);
        setPdfStationFilter('all');
      }
    } catch (error) {
      console.error('Failed to fetch PDF stations:', error);
    }
  };
  
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };
  
  const fetchMasterShops = async () => {
    try {
      let url = `${API_URL}/api/master-shops`;
      const params = new URLSearchParams();
      
      if (selectedDistrict && selectedDistrict !== 'all') {
        params.append('district', selectedDistrict);
      }
      
      if (selectedStation && selectedStation !== 'all') {
        params.append('station', selectedStation);
      }
      
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      
      if (searchQuery && searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setMasterShops(data);
    } catch (error) {
      console.error('Failed to fetch master shops:', error);
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

  const addShopFromMaster = async (masterShop) => {
    try {
      // Check if shop already exists by gazette_code in current mode
      const existingShop = currentShops.find(s => s.gazette_code === masterShop.gazette_code);
      if (existingShop) {
        setSaveMessage('Shop already added!');
        setTimeout(() => setSaveMessage(''), 3000);
        return;
      }

      const endpoint = mode === 'planning' ? '/api/shops' : '/api/real';
      
      let newShop;
      if (mode === 'planning') {
        newShop = { 
          name: masterShop.locality,
          gazette_code: masterShop.gazette_code,
          category: masterShop.category,
          district: masterShop.district,
          station: masterShop.excise_station,
          tokens: 0,
          expected_tokens: 0,
          avg_sale: ''
        };
      } else {
        newShop = { 
          name: masterShop.locality,
          gazette_code: masterShop.gazette_code,
          category: masterShop.category,
          district: masterShop.district,
          station: masterShop.excise_station,
          total_tokens: 0,
          allocated_tokens: ''
        };
      }
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShop)
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update correct shops state based on mode
        if (mode === 'planning') {
          setShops([...shops, data]);
        } else {
          setRealShops([...realShops, data]);
        }
        setSaveMessage('Shop added successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else if (response.status === 409) {
        setSaveMessage('Shop with this gazette code already exists!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        throw new Error('Failed to add shop');
      }
    } catch (error) {
      console.error('Failed to add shop:', error);
      setSaveMessage('Error adding shop!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const removeShop = async (id) => {
    try {
      const endpoint = mode === 'planning' ? '/api/shops' : '/api/real';
      await fetch(`${API_URL}${endpoint}/${id}`, {
        method: 'DELETE'
      });
      
      if (mode === 'planning') {
        setShops(shops.filter(shop => shop.id !== id));
      } else {
        setRealShops(realShops.filter(shop => shop.id !== id));
      }
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
    try {
      await fetch(`${API_URL}/api/shops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avg_sale: value })
      });
      
      setShops(shops.map(s => 
        s.id === id ? { ...s, avg_sale: value } : s
      ));
    } catch (error) {
      console.error('Failed to update avg sale:', error);
      setSaveMessage('Error updating avg sale!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const updateTotalTokens = async (id, value) => {
    const numValue = parseInt(value) || 0;
    
    try {
      await fetch(`${API_URL}/api/real/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_tokens: numValue })
      });
      
      setRealShops(realShops.map(s => 
        s.id === id ? { ...s, total_tokens: numValue } : s
      ));
    } catch (error) {
      console.error('Failed to update total tokens:', error);
      setSaveMessage('Error updating total tokens!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const updateAllocatedTokens = async (id, value) => {
    try {
      // Update only allocated_tokens (not total_tokens)
      await fetch(`${API_URL}/api/real/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocated_tokens: value })
      });
      
      setRealShops(realShops.map(s => 
        s.id === id ? { ...s, allocated_tokens: value } : s
      ));
    } catch (error) {
      console.error('Failed to update allocated tokens:', error);
      setSaveMessage('Error updating allocated tokens!');
      setTimeout(() => setSaveMessage(''), 3000);
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

  const downloadPDF = () => {
    console.log('PDF download started');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to download PDF');
      return;
    }
    const currentDate = new Date().toLocaleDateString();
    
    console.log('PDF filters:', { pdfDistrictFilter, pdfStationFilter });
    
    // Filter shops based on PDF filters - use currentShops based on mode
    let filteredShops = currentShops;
    if (pdfDistrictFilter !== 'all') {
      filteredShops = filteredShops.filter(shop => shop.district === pdfDistrictFilter);
    }
    if (pdfStationFilter !== 'all') {
      filteredShops = filteredShops.filter(shop => shop.station === pdfStationFilter);
    }
    
    // Exclude shops with zero data
    filteredShops = filteredShops.filter(shop => {
      if (mode === 'planning') {
        // In planning mode, exclude shops with 0 tokens
        return shop.tokens > 0;
      } else {
        // In real mode, exclude shops with no allocated tokens
        const allocatedTokens = shop.allocated_tokens || '';
        const tokenCount = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
        return tokenCount > 0;
      }
    });
    
    // Sort by district alphabetically, then by gazette_code within each district
    filteredShops = filteredShops.sort((a, b) => {
      // First sort by district alphabetically (case-insensitive)
      const districtA = (a.district || '').toLowerCase();
      const districtB = (b.district || '').toLowerCase();
      const districtCompare = districtA.localeCompare(districtB);
      if (districtCompare !== 0) {
        return districtCompare;
      }
      // Then sort by gazette_code within same district (ascending order)
      const codeA = (a.gazette_code || '').toLowerCase();
      const codeB = (b.gazette_code || '').toLowerCase();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    console.log('Filtered shops (excluding zero data):', filteredShops.length);
    
    // Determine report title based on filters
    let reportTitle = 'Shop Token Manager Report';
    let isStationWise = false;
    let isFiltered = false; // Flag to indicate if any filter is applied (for summary)
    
    if (pdfDistrictFilter !== 'all' && pdfStationFilter === 'all') {
      reportTitle = `${pdfDistrictFilter.toUpperCase()} DISTRICT SUMMARY`;
      isFiltered = true;
    } else if (pdfDistrictFilter !== 'all' && pdfStationFilter !== 'all') {
      reportTitle = `${pdfStationFilter.toUpperCase()} Token Management`;
      isStationWise = true;
      isFiltered = true;
    } else if (pdfDistrictFilter === 'all' && pdfStationFilter !== 'all') {
      reportTitle = `${pdfStationFilter.toUpperCase()} Token Management`;
      isStationWise = true;
      isFiltered = true;
    }
    
    // Group shops by district, then by station
    let groupedShops = {};
    filteredShops.forEach(shop => {
      const district = shop.district || 'Unknown District';
      if (!groupedShops[district]) groupedShops[district] = {};
      const station = shop.station || 'Unknown Station';
      if (!groupedShops[district][station]) groupedShops[district][station] = [];
      groupedShops[district][station].push(shop);
    });
    
    // Generate summary table with district rowspan
    let summaryByDistrict = {};
    Object.keys(groupedShops).sort().forEach(district => {
      const stations = groupedShops[district];
      summaryByDistrict[district] = [];
      Object.keys(stations).sort().forEach(station => {
        const stationShops = stations[station];
        const tokens = mode === 'planning'
          ? stationShops.reduce((sum, shop) => sum + shop.tokens, 0)
          : stationShops.reduce((sum, shop) => {
              const allocatedTokens = shop.allocated_tokens || '';
              const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
              return sum + count;
            }, 0);
        summaryByDistrict[district].push({ station, tokens });
      });
    });
    
    // Generate table rows with rowspan
    let summaryRows = '';
    let serialNo = 1;
    let grandTotal = 0;
    
    Object.keys(summaryByDistrict).sort().forEach(district => {
      const stations = summaryByDistrict[district];
      const districtRowspan = stations.length;
      
      stations.forEach((stationData, stationIndex) => {
        grandTotal += stationData.tokens;
        if (stationIndex === 0) {
          // First row for this district - include district cell with rowspan
          summaryRows += `
            <tr>
              <td>${serialNo++}</td>
              <td rowspan="${districtRowspan}" style="vertical-align: middle; font-weight: bold; background-color: #EEF2FF;">${district}</td>
              <td>${stationData.station}</td>
              <td style="font-weight: bold; color: #4F46E5;">${stationData.tokens}</td>
            </tr>
          `;
        } else {
          // Subsequent rows - no district cell
          summaryRows += `
            <tr>
              <td>${serialNo++}</td>
              <td>${stationData.station}</td>
              <td style="font-weight: bold; color: #4F46E5;">${stationData.tokens}</td>
            </tr>
          `;
        }
      });
    });
    
    const summaryHtml = `
      <div class="summary-section">
        <h2 class="summary-title">📊 Token Allocation Summary</h2>
        <table>
          <thead>
            <tr>
              <th>S. No</th>
              <th>District</th>
              <th>Station</th>
              <th>No of Tokens</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
            <tr class="total-row">
              <td colspan="3" style="text-align: right; font-weight: bold;">Grand Total:</td>
              <td style="font-weight: bold; background-color: #C7D2FE;">${grandTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    // Generate tables based on grouping
    let tablesHtml = '';
    let globalIndex = 1;
    
    Object.keys(groupedShops).sort().forEach(district => {
      const stations = groupedShops[district];
      
      Object.keys(stations).sort().forEach(station => {
        const stationShops = stations[station];
        // Sort shops by gazette_code in ascending order (case-insensitive, numeric-aware)
        const sortedShops = [...stationShops].sort((a, b) => {
          const codeA = (a.gazette_code || '').toLowerCase();
          const codeB = (b.gazette_code || '').toLowerCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        const stationTotal = mode === 'planning' 
          ? sortedShops.reduce((sum, shop) => sum + shop.tokens, 0)
          : sortedShops.reduce((sum, shop) => {
              const allocatedTokens = shop.allocated_tokens || '';
              const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
              return sum + count;
            }, 0);
        
        if (isStationWise) {
          // Station-wise format: Show district/station header once, then individual shops
          tablesHtml += `
            <div class="station-section">
              <div class="simple-header">
                <span><strong>DISTRICT:</strong> ${district}</span>
                <span><strong>STATION:</strong> ${station} <strong>Tokens:</strong> ${stationTotal}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>S. No</th>
                    <th>Shop Name</th>
                    ${mode === 'planning' ? `
                      <th>Avg Sale</th>
                      <th>Expected Tokens</th>
                      <th>Our Tokens</th>
                    ` : `
                      <th>Total Tokens</th>
                      <th>Our Allocated Tokens</th>
                      <th>Total Allocated Tokens</th>
                    `}
                  </tr>
                </thead>
                <tbody>
                  ${sortedShops.map((shop, index) => `
                    <tr>
                      <td>${globalIndex++}</td>
                      <td>${shop.gazette_code && `${shop.gazette_code} - `}${shop.name}</td>
                      ${mode === 'planning' ? `
                        <td>${shop.avg_sale || ''}</td>
                        <td>${shop.expected_tokens || 0}</td>
                        <td style="font-weight: bold; color: #4F46E5;">${shop.tokens || 0}</td>
                      ` : `
                        <td>${shop.total_tokens || 0}</td>
                        <td>${shop.allocated_tokens || ''}</td>
                        <td style="font-weight: bold; color: #4F46E5;">${shop.allocated_tokens ? shop.allocated_tokens.split(',').filter(t => t.trim() !== '').length : 0}</td>
                      `}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        } else {
          // Regular format: Detailed shop table
          const colspanValue = mode === 'planning' ? '4' : '4';
          tablesHtml += `
            <div class="station-section">
              <div class="simple-header">
                <span><strong>DISTRICT:</strong> ${district}</span>
                <span><strong>STATION:</strong> ${station} <strong>Tokens:</strong> ${stationTotal}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>S. No</th>
                    <th>Shop Name</th>
                    ${mode === 'planning' ? `
                      <th>Avg Sale</th>
                      <th>Expected Tokens</th>
                      <th>Tokens</th>
                    ` : `
                      <th>Total Tokens</th>
                      <th>Our Allocated Tokens</th>
                      <th>Total Allocated Tokens</th>
                    `}
                  </tr>
                </thead>
                <tbody>
                  ${sortedShops.map((shop) => `
                    <tr>
                      <td>${globalIndex++}</td>
                      <td>${shop.gazette_code && `${shop.gazette_code} - `}${shop.name}${shop.category && shop.category.toUpperCase() !== 'OPEN' ? ` (${shop.category})` : ''}</td>
                      ${mode === 'planning' ? `
                        <td>${shop.avg_sale || ''}</td>
                        <td>${shop.expected_tokens || 0}</td>
                        <td>${shop.tokens}</td>
                      ` : `
                        <td>${shop.total_tokens || 0}</td>
                        <td>${shop.allocated_tokens || ''}</td>
                        <td>${shop.allocated_tokens ? shop.allocated_tokens.split(',').filter(t => t.trim() !== '').length : 0}</td>
                      `}
                    </tr>
                  `).join('')}
                  <tr class="subtotal-row">
                    <td colspan="${colspanValue}" style="text-align: right; font-weight: bold;">${station} - Total:</td>
                    <td style="font-weight: bold; background-color: #E0E7FF;">${stationTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
        }
      });
    });
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shop Token Manager - Report</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px;
            max-width: 100%;
            margin: 0 auto;
          }
          h1 { color: #4F46E5; margin-bottom: 10px; }
          .info { color: #666; margin-bottom: 10px; }
          .summary { 
            background: #EEF2FF; 
            padding: 20px; 
            border-radius: 8px;
            margin: 20px 0;
            display: flex;
            justify-content: space-around;
          }
          .summary-item { text-align: center; }
          .summary-label { font-weight: bold; color: #666; font-size: 14px; }
          .summary-value { font-size: 28px; font-weight: bold; color: #4F46E5; margin-top: 5px; }
          
          .district-section { margin: 40px 0; page-break-inside: avoid; }
          .district-title {
            color: #1E40AF;
            background: #DBEAFE;
            padding: 15px;
            border-left: 5px solid #1E40AF;
            margin: 30px 0 20px 0;
            font-size: 20px;
          }
          .station-section { margin: 25px 0; }
          .station-title {
            color: #7C3AED;
            background: #F3E8FF;
            padding: 12px;
            border-left: 4px solid #7C3AED;
            margin: 20px 0 10px 0;
            font-size: 16px;
          }
          .section { margin: 30px 0; }
          .section-title {
            color: #7C3AED;
            background: #F3E8FF;
            padding: 12px;
            border-left: 4px solid #7C3AED;
            margin: 20px 0 10px 0;
            font-size: 18px;
          }
          
          .summary-section {
            margin: 30px 0;
            page-break-inside: avoid;
            background: #F0FDF4;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid #10B981;
          }
          .summary-title {
            color: #065F46;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #10B981;
          }
          
          .simple-header {
            display: flex;
            justify-content: space-between;
            padding: 12px 15px;
            background: #F3F4F6;
            border: 1px solid #D1D5DB;
            margin-bottom: 10px;
            font-size: 14px;
            color: #374151;
          }
          .simple-header span {
            margin-right: 30px;
          }
          
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #4F46E5; color: white; font-size: 14px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .subtotal-row td { background-color: #E0E7FF; border-top: 2px solid #6366F1; font-size: 15px; }
          .total-row td { background-color: #C7D2FE; border-top: 2px solid #4F46E5; font-size: 15px; }
          
          .district-total {
            background: #DBEAFE;
            padding: 15px;
            margin: 20px 0;
            text-align: right;
            font-size: 18px;
            border-radius: 8px;
            border: 2px solid #3B82F6;
          }
          .total-value {
            color: #1E40AF;
            font-size: 24px;
            font-weight: bold;
            margin-left: 15px;
          }
          
          @media print {
            body { padding: 20px; }
            .district-section { page-break-after: auto; }
            .station-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${reportTitle}</h1>
        <p class="info">Generated on: ${currentDate}</p>
        
        ${!isFiltered ? `
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Total Token Cap</div>
            <div class="summary-value">${tokenCap}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Shops</div>
            <div class="summary-value">${filteredShops.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Tokens Allocated</div>
            <div class="summary-value">${mode === 'planning' 
              ? filteredShops.reduce((sum, shop) => sum + shop.tokens, 0)
              : filteredShops.reduce((sum, shop) => {
                  const allocatedTokens = shop.allocated_tokens || '';
                  const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
                  return sum + count;
                }, 0)
            }</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Remaining</div>
            <div class="summary-value">${(() => {
              const allocated = mode === 'planning'
                ? filteredShops.reduce((sum, shop) => sum + shop.tokens, 0)
                : filteredShops.reduce((sum, shop) => {
                    const allocatedTokens = shop.allocated_tokens || '';
                    const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
                    return sum + count;
                  }, 0);
              return tokenCap - allocated;
            })()}</div>
          </div>
        </div>
        ` : ''}

        ${!isStationWise ? summaryHtml : ''}

        ${tablesHtml}

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
    
    console.log('PDF content written to window');
    setSaveMessage('Print dialog opened! Choose "Save as PDF" in the print dialog.');
    setTimeout(() => setSaveMessage(''), 5000);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold text-gray-800">Shop Token Manager</h1>
            {mode === 'real' && (
              <button
                onClick={async () => {
                  try {
                    const [planningResponse, realResponse] = await Promise.all([
                      fetch(`${API_URL}/api/shops`),
                      fetch(`${API_URL}/api/real`)
                    ]);
                    
                    const planningShops = await planningResponse.json();
                    const currentRealShops = await realResponse.json();
                    
                    let syncCount = 0;
                    for (const shop of planningShops) {
                      const existsInReal = currentRealShops.some(rs => rs.gazette_code === shop.gazette_code);
                      if (!existsInReal) {
                        const newRealShop = {
                          name: shop.name,
                          gazette_code: shop.gazette_code,
                          category: shop.category,
                          district: shop.district,
                          station: shop.station,
                          total_tokens: 0,
                          allocated_tokens: ''
                        };
                        
                        const response = await fetch(`${API_URL}/api/real`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newRealShop)
                        });
                        
                        if (response.ok) syncCount++;
                      }
                    }
                    
                    if (syncCount > 0) {
                      fetchShops();
                      setSaveMessage(`✅ Synced ${syncCount} shop(s) from Planning Mode!`);
                    } else {
                      setSaveMessage('ℹ️ All shops are already synced!');
                    }
                    setTimeout(() => setSaveMessage(''), 3000);
                  } catch (error) {
                    console.error('Failed to sync:', error);
                    setSaveMessage('❌ Error syncing shops!');
                    setTimeout(() => setSaveMessage(''), 3000);
                  }
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 text-sm font-semibold"
                title="Sync all shops from Planning Mode to Real Mode"
              >
                🔄 Sync from Planning Mode
              </button>
            )}
          </div>
          
          {/* Mode Selection Radio Buttons */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
            <div className="flex items-center gap-8">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="mode"
                  value="planning"
                  checked={mode === 'planning'}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-5 h-5 text-purple-600 cursor-pointer"
                />
                <span className={`text-lg font-semibold ${mode === 'planning' ? 'text-purple-700' : 'text-gray-600'} group-hover:text-purple-700 transition`}>
                  📋 Planning Mode
                </span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="mode"
                  value="real"
                  checked={mode === 'real'}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-5 h-5 text-blue-600 cursor-pointer"
                />
                <span className={`text-lg font-semibold ${mode === 'real' ? 'text-blue-700' : 'text-gray-600'} group-hover:text-blue-700 transition`}>
                  ⚡ Real Mode
                </span>
              </label>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {mode === 'planning' 
                ? '📝 Planning mode for initial token planning and estimation' 
                : '✅ Real mode for actual token allocation tracking'}
            </p>
          </div>
          
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

          {/* Token Distribution Info - Always show total across all shops */}
          {mode === 'planning' && (
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
          )}
          
          {/* Real Mode Token Distribution - Always show total across all shops */}
          {mode === 'real' && (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Total Shops</p>
                  <p className="text-2xl font-bold text-indigo-600">{realShops.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tokens Allocated</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {realShops.reduce((sum, shop) => {
                      const allocatedTokens = shop.allocated_tokens || '';
                      const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
                      return sum + count;
                    }, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Remaining</p>
                  <p className={`text-2xl font-bold ${(() => {
                    const allocated = realShops.reduce((sum, shop) => {
                      const allocatedTokens = shop.allocated_tokens || '';
                      const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
                      return sum + count;
                    }, 0);
                    return tokenCap - allocated === 0 ? 'text-red-600' : 'text-green-600';
                  })()}`}>
                    {(() => {
                      const allocated = realShops.reduce((sum, shop) => {
                        const allocatedTokens = shop.allocated_tokens || '';
                        const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
                        return sum + count;
                      }, 0);
                      return tokenCap - allocated;
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning when at cap */}
          {mode === 'planning' && remainingTokens === 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={24} />
              <p className="text-red-800 font-medium">Token limit reached! Remove tokens from other shops to allocate more.</p>
            </div>
          )}
          {mode === 'real' && (() => {
            const allocated = realShops.reduce((sum, shop) => {
              const allocatedTokens = shop.allocated_tokens || '';
              const count = allocatedTokens.trim() ? allocatedTokens.split(',').filter(t => t.trim() !== '').length : 0;
              return sum + count;
            }, 0);
            return tokenCap - allocated === 0;
          })() && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={24} />
              <p className="text-red-800 font-medium">Token limit reached! Remove tokens from other shops to allocate more.</p>
            </div>
          )}

          {/* Filter Section */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">🔍 Search & Filter Shops</h3>
            
            {/* Search Bar */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name or Gazette Code</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search..."
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
            
            {/* Filter Dropdowns */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Districts</option>
                  {districts.map(district => (
                    <option key={district.name} value={district.name}>{district.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Excise Station</label>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  disabled={selectedDistrict === 'all'}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="all">All Stations</option>
                  {exciseStations.map(station => (
                    <option key={station.name} value={station.name}>{station.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              {(selectedDistrict !== 'all' || selectedStation !== 'all' || selectedCategory !== 'all' || searchQuery) && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSelectedDistrict('all');
                      setSelectedStation('all');
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Master Shops List - Select Shops to Add */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-800">📋 Available Shops ({masterShops.length})</h3>
            </div>
            
            <div className="bg-white border-2 border-gray-200 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Gazette Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Shop Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">District</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Station</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Annual Tax</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {masterShops.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                        No shops found. Try adjusting your filters.
                      </td>
                    </tr>
                  ) : (
                    masterShops.map((shop) => {
                      const isSelected = currentShops.some(s => 
                        s.gazette_code === shop.gazette_code ||
                        s.name === shop.locality
                      );
                      
                      return (
                        <tr key={`${shop.gazette_code}-${isSelected}`} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-800 font-medium text-sm">{shop.gazette_code}</td>
                          <td className="px-4 py-3 text-gray-800">{shop.locality}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{shop.district}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{shop.excise_station}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              {shop.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{shop.annual_excise_tax}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => addShopFromMaster(shop)}
                              disabled={isSelected}
                              className={`px-4 py-1 rounded-lg transition flex items-center gap-1 mx-auto text-sm ${
                                isSelected 
                                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed' 
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              <Plus size={16} />
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-4 text-green-800 text-center font-medium">
              {saveMessage}
            </div>
          )}

          {/* PDF Filters and Download */}
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">📄 PDF Report & Filters</h3>
              <div className="flex items-center gap-3">
                <select
                  value={pdfDistrictFilter}
                  onChange={(e) => setPdfDistrictFilter(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                >
                  <option value="all">All Districts</option>
                  {districts.map(district => (
                    <option key={district.name} value={district.name}>{district.name}</option>
                  ))}
                </select>
                <select
                  value={pdfStationFilter}
                  onChange={(e) => setPdfStationFilter(e.target.value)}
                  className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                  disabled={pdfDistrictFilter === 'all'}
                >
                  <option value="all">All Stations</option>
                  {pdfStations.map(station => (
                    <option key={station.name} value={station.name}>{station.name}</option>
                  ))}
                </select>
                <button
                  onClick={downloadPDF}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm font-semibold"
                  title="Download PDF Report"
                >
                  <Save size={18} />
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Selected Shops - Token Allocation */}
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">
                ✅ Selected Shops for Token Allocation ({filteredShops.length})
                {pdfDistrictFilter !== 'all' || pdfStationFilter !== 'all' ? (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    (Filtered: {pdfDistrictFilter !== 'all' ? pdfDistrictFilter : 'All Districts'} - {pdfStationFilter !== 'all' ? pdfStationFilter : 'All Stations'})
                  </span>
                ) : null}
              </h3>
              {(pdfDistrictFilter !== 'all' || pdfStationFilter !== 'all') && (
                <button
                  onClick={() => {
                    setPdfDistrictFilter('all');
                    setPdfStationFilter('all');
                  }}
                  className="bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 transition text-sm"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
          
          <div className="bg-white border-2 border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">S. No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Shop Name</th>
                  {mode === 'planning' ? (
                    <>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Avg Sale</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Expected Tokens</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Tokens</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total Tokens</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Our Allocated Tokens</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total Allocated Tokens</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={mode === 'planning' ? "6" : "6"} className="px-6 py-8 text-center text-gray-500">
                      {currentShops.length === 0 
                        ? "No shops selected yet. Search and select shops from the list above to allocate tokens."
                        : `No shops match the current filter (${pdfDistrictFilter !== 'all' ? pdfDistrictFilter : 'All Districts'} - ${pdfStationFilter !== 'all' ? pdfStationFilter : 'All Stations'}). Try adjusting the PDF filters above.`
                      }
                    </td>
                  </tr>
                ) : (
                  filteredShops.map((shop, index) => (
                    <tr key={shop.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-4 text-gray-800">{index + 1}</td>
                      <td className="px-6 py-4 text-gray-800 font-medium">
                        {shop.gazette_code && `${shop.gazette_code} - `}
                        {shop.name}
                        {shop.category && shop.category.toUpperCase() !== 'OPEN' && ` (${shop.category})`}
                      </td>
                      {mode === 'planning' ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={shop.avg_sale || ''}
                              onChange={(e) => updateAvgSale(shop.id, e.target.value)}
                              placeholder="e.g. 3.5L"
                              className="w-28 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                            />
                          </td>
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
                              value={shop.tokens === 0 ? '' : shop.tokens}
                              onChange={(e) => updateTokens(shop.id, e.target.value)}
                              placeholder="0"
                              className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={shop.total_tokens === 0 ? '' : shop.total_tokens}
                              onChange={(e) => updateTotalTokens(shop.id, e.target.value)}
                              placeholder="0"
                              className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={shop.allocated_tokens || ''}
                              onChange={(e) => updateAllocatedTokens(shop.id, e.target.value)}
                              placeholder="e.g. 8, 19, 23"
                              className="w-40 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 font-mono"
                              title="Enter token numbers separated by commas"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={(() => {
                                const tokens = shop.allocated_tokens || '';
                                return tokens.trim() ? tokens.split(',').filter(token => token.trim() !== '').length : '';
                              })()}
                              readOnly
                              placeholder="0"
                              className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-semibold cursor-not-allowed"
                              title="Auto-calculated from allocated tokens"
                            />
                          </td>
                        </>
                      )}
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
              <strong>How it works:</strong> {mode === 'planning' 
                ? 'Manually assign tokens to each shop. The total cannot exceed the token cap. You can allocate them however you want - some shops can have more, others less, as long as the total stays within the cap.'
                : 'In Real Mode: Shops from Planning Mode are automatically synced when you switch modes. Enter the grand total tokens in "Total Tokens" field. Then enter the specific token numbers (e.g., 8, 19, 23) in "Our Allocated Tokens" field. The "Total Allocated Tokens" column will automatically count how many tokens you\'ve entered.'}
              {' '}<strong>✏️ Edit the token cap</strong> by clicking "Edit" next to the cap value above.
            </p>
            <p className="text-sm text-gray-700">
              <strong>📄 Save as PDF:</strong> Generate a printable PDF report of all shops and token allocations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}