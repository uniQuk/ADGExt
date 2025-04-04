// Background service worker for AdGuard Home Manager extension
import { AdGuardHomeAPI } from './api';

// Store the API instance
let adguardApi = null;
let connectionCheckInterval = null;

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('AdGuard Home Manager extension installed');
  
  // Initialize storage with default values if needed
  chrome.storage.local.get(['adguardUrl'], function(result) {
    if (!result.adguardUrl) {
      chrome.storage.local.set({
        adguardUrl: '',
        adguardUsername: '',
        adguardPassword: '',
        isConnected: false,
        protectionEnabled: false,
        stats: {
          num_dns_queries: 0,
          num_blocked_filtering: 0
        },
        lastUpdated: null
      });
    } else {
      // Try to reconnect if we have saved credentials
      tryReconnect();
    }
  });
});

// Try to reconnect using saved credentials
async function tryReconnect() {
  chrome.storage.local.get(
    ['adguardUrl', 'adguardUsername', 'adguardPassword', 'rememberCredentials'], 
    async function(result) {
      if (
        result.adguardUrl && 
        result.adguardUsername && 
        (result.adguardPassword || !result.rememberCredentials)
      ) {
        const password = result.rememberCredentials ? result.adguardPassword : '';
        
        if (password) {
          try {
            await connectToAdGuard(
              result.adguardUrl, 
              result.adguardUsername, 
              password
            );
          } catch (error) {
            console.error('Auto-reconnect failed:', error);
            chrome.storage.local.set({ isConnected: false });
          }
        }
      }
    }
  );
}

// Connect to AdGuard Home
async function connectToAdGuard(url, username, password) {
  // Create new API instance
  adguardApi = new AdGuardHomeAPI(url, username, password);
  
  try {
    // Test connection
    const isConnected = await adguardApi.testConnection();
    
    if (!isConnected) {
      throw new Error('Connection test failed');
    }
    
    // If connection successful, get initial status
    const status = await adguardApi.getStatus();
    const protectionEnabled = status.protection_enabled === true;
    
    // Store connection state
    await chrome.storage.local.set({ 
      isConnected: true,
      protectionEnabled
    });
    
    // Start periodic status checks (every 30 seconds)
    startPeriodicStatusChecks();
    
    return { isConnected: true, protectionEnabled };
  } catch (error) {
    console.error('Connection failed:', error);
    adguardApi = null;
    chrome.storage.local.set({ isConnected: false });
    throw error;
  }
}

// Disconnect from AdGuard Home
function disconnectFromAdGuard() {
  // Stop periodic checks
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
  
  // Reset API instance
  adguardApi = null;
  
  // Update connection state
  chrome.storage.local.set({ 
    isConnected: false,
    protectionEnabled: false
  });
  
  return { isConnected: false };
}

// Start periodic status checks
function startPeriodicStatusChecks() {
  // Clear existing interval if any
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
  }
  
  // Check status initially
  checkStatus();
  
  // Set up periodic checks (every 30 seconds)
  connectionCheckInterval = setInterval(checkStatus, 30000);
}

// Check AdGuard Home status
async function checkStatus() {
  if (!adguardApi) {
    return;
  }
  
  try {
    const status = await adguardApi.getStatus();
    const protectionEnabled = status.protection_enabled === true;
    
    // Update protection status in storage
    chrome.storage.local.set({ protectionEnabled });
    
    // We'll implement stats fetching in Phase 1.7
  } catch (error) {
    console.error('Status check failed:', error);
    // If status check fails, we might have lost connection
    chrome.storage.local.set({ isConnected: false });
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle connection request
  if (message.action === 'connect') {
    connectToAdGuard(message.url, message.username, message.password)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ 
        isConnected: false, 
        error: error.message || 'Connection failed' 
      }));
    return true;
  }
  
  // Handle disconnection request
  if (message.action === 'disconnect') {
    const result = disconnectFromAdGuard();
    sendResponse(result);
    return true;
  }
  
  // Handle connection status request
  if (message.action === 'getConnectionStatus') {
    chrome.storage.local.get(['isConnected', 'protectionEnabled'], function(result) {
      sendResponse({ 
        isConnected: result.isConnected === true,
        protectionEnabled: result.protectionEnabled === true
      });
    });
    return true;
  }
  
  // Handle protection toggle request
  if (message.action === 'toggleProtection') {
    if (!adguardApi) {
      sendResponse({ success: false, error: 'Not connected to AdGuard Home' });
      return true;
    }
    
    adguardApi.toggleProtection(message.enabled)
      .then(() => {
        chrome.storage.local.set({ protectionEnabled: message.enabled });
        sendResponse({ success: true, enabled: message.enabled });
      })
      .catch(error => {
        console.error('Failed to toggle protection:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to toggle protection' 
        });
      });
    return true;
  }
  
  // Handle stats request (to be implemented in Phase 1.7)
  if (message.action === 'getStats') {
    if (!adguardApi) {
      sendResponse({ success: false, error: 'Not connected to AdGuard Home' });
      return true;
    }
    
    // This will be expanded in Phase 1.7
    sendResponse({ 
      success: true,
      num_dns_queries: 0,
      num_blocked_filtering: 0,
      lastUpdated: new Date().toISOString()
    });
    return true;
  }
}); 