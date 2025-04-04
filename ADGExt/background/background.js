// Background service worker for AdGuard Home Manager extension
// Import the API client and crypto utilities
import { AdGuardHomeAPI } from './api.js';
import { encrypt, decrypt } from './crypto.js';

let adguardApi = null;

// Secure storage keys
const SECURE_KEYS = {
  PASSWORD: 'secure_password'
};

// Error codes
const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  API_ERROR: 'API_ERROR'
};

// Retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000, // ms
};

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('AdGuard Home Manager extension installed');
  
  // Initialize storage with default values if needed
  chrome.storage.local.get(['adguardUrl'], function(result) {
    if (!result.adguardUrl) {
      chrome.storage.local.set({
        adguardUrl: '',
        adguardUsername: '',
        isConnected: false,
        protectionEnabled: false,
        stats: {
          num_dns_queries: 0,
          num_blocked_filtering: 0
        },
        lastUpdated: null,
        connectionErrors: []
      });
    }
  });
});

// Function to save credentials securely
async function saveCredentials(url, username, password) {
  try {
    console.log('Saving credentials for:', url);
    // Reset API client when credentials change
    adguardApi = null;
    
    // Encrypt the password
    const encryptedPassword = await encrypt(password);
    
    // Store the encrypted password and other details
    await chrome.storage.local.set({
      adguardUrl: url,
      adguardUsername: username,
      [SECURE_KEYS.PASSWORD]: encryptedPassword,
      connectionErrors: [] // Reset any previous connection errors
    });
    
    return true;
  } catch (error) {
    console.error('Failed to save credentials:', error);
    return false;
  }
}

// Function to get credentials
async function getCredentials() {
  try {
    const result = await chrome.storage.local.get(['adguardUrl', 'adguardUsername', SECURE_KEYS.PASSWORD]);
    
    if (!result.adguardUrl || !result.adguardUsername || !result[SECURE_KEYS.PASSWORD]) {
      console.log('Missing credentials, returning null');
      return null;
    }
    
    // Decrypt the password
    const password = await decrypt(result[SECURE_KEYS.PASSWORD]);
    if (!password) {
      console.error('Failed to decrypt password');
      return null;
    }
    
    console.log('Retrieved credentials for:', result.adguardUrl);
    return {
      url: result.adguardUrl,
      username: result.adguardUsername,
      password: password
    };
  } catch (error) {
    console.error('Failed to get credentials:', error);
    return null;
  }
}

// Function to initialize the API client with stored credentials
async function initializeApiClient(forceNew = false) {
  if (adguardApi && !forceNew) {
    console.log('Using existing API client');
    return adguardApi;
  }
  
  console.log('Initializing API client...');
  const credentials = await getCredentials();
  if (credentials && credentials.url && credentials.username && credentials.password) {
    console.log('Creating new API client for:', credentials.url);
    adguardApi = new AdGuardHomeAPI(credentials.url, credentials.username, credentials.password);
    return adguardApi;
  }
  
  console.log('No credentials available, API client not initialized');
  return null;
}

// Helper function to add an error to the error log
async function logConnectionError(error) {
  try {
    // Get existing errors
    const result = await chrome.storage.local.get(['connectionErrors']);
    const errors = result.connectionErrors || [];
    
    // Add new error with timestamp
    const errorWithTimestamp = {
      ...error,
      timestamp: new Date().toISOString()
    };
    
    console.log('Logging connection error:', errorWithTimestamp);
    
    // Keep only the last 10 errors
    const updatedErrors = [errorWithTimestamp, ...errors].slice(0, 10);
    
    // Save updated errors
    await chrome.storage.local.set({ connectionErrors: updatedErrors });
    
    return updatedErrors;
  } catch (err) {
    console.error('Failed to log error:', err);
    return null;
  }
}

// Function to retry an operation
async function retryOperation(operation, maxRetries = RETRY_CONFIG.MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // First attempt or retry
      console.log(`Attempt ${attempt + 1}/${maxRetries + 1} for operation`);
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);
      
      // Reset API client on first failure
      if (attempt === 0) {
        console.log('Resetting API client after failure');
        adguardApi = null;
        await initializeApiClient(true);
      }
      
      // Don't retry for certain error types
      if (error.code === ERROR_CODES.AUTH_ERROR) {
        await logConnectionError(error);
        throw error; // No point retrying auth errors
      }
      
      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        console.log(`Waiting ${RETRY_CONFIG.RETRY_DELAY}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.RETRY_DELAY));
      }
    }
  }
  
  // If we get here, all attempts failed
  console.error('All retry attempts failed');
  await logConnectionError(lastError);
  throw lastError;
}

// Function to test connection with retry
async function testConnection() {
  try {
    console.log('Testing connection to AdGuard Home...');
    // Always force a new API client when testing connection
    const api = await initializeApiClient(true);
    if (!api) return { success: false, error: { message: 'No connection details available' } };
    
    return await retryOperation(async () => {
      const result = await api.testConnection();
      if (!result.success) throw result.error;
      return result;
    });
  } catch (error) {
    console.error('Connection test failed completely:', error);
    return { success: false, error };
  }
}

// Function to get and store the current status
async function refreshStatus() {
  try {
    console.log('Refreshing AdGuard Home status...');
    const api = await initializeApiClient();
    if (!api) {
      console.error('No API client available');
      return { success: false, error: { message: 'Not connected' } };
    }
    
    const status = await retryOperation(async () => {
      return await api.getStatus();
    });
    
    // Store the protection status
    console.log('Status refresh successful:', status);
    chrome.storage.local.set({
      isConnected: true,
      protectionEnabled: status.protection_enabled,
      lastUpdated: new Date().toISOString(),
      // Clear any connection errors since we're now connected
      connectionErrors: []
    });
    
    return { success: true, data: status };
  } catch (error) {
    console.error('Failed to refresh status:', error);
    
    // Reset API client on failure
    adguardApi = null;
    
    // Update connection status and log the error
    chrome.storage.local.set({
      isConnected: false
    });
    
    await logConnectionError(error);
    
    return { success: false, error };
  }
}

// Function to get and store DNS statistics
async function refreshStats() {
  try {
    console.log('Refreshing AdGuard Home stats...');
    const api = await initializeApiClient();
    if (!api) {
      console.error('No API client available');
      return { success: false, error: { message: 'Not connected' } };
    }
    
    const stats = await retryOperation(async () => {
      return await api.getStats();
    });
    
    // Store the stats
    console.log('Stats refresh successful:', stats);
    chrome.storage.local.set({
      stats: {
        num_dns_queries: stats.num_dns_queries,
        num_blocked_filtering: stats.num_blocked_filtering,
        avg_processing_time: stats.avg_processing_time
      },
      lastStatsUpdated: new Date().toISOString()
    });
    
    return { success: true, data: stats };
  } catch (error) {
    console.error('Failed to refresh stats:', error);
    await logConnectionError(error);
    return { success: false, error };
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'saveCredentials') {
    saveCredentials(message.url, message.username, message.password)
      .then(success => {
        sendResponse({ success });
      });
    return true;
  }
  
  if (message.action === 'testConnection') {
    testConnection()
      .then(result => {
        sendResponse(result);
      });
    return true;
  }
  
  if (message.action === 'getConnectionStatus') {
    // Get the current connection status from storage
    chrome.storage.local.get(['isConnected', 'protectionEnabled', 'lastUpdated', 'connectionErrors'], (result) => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'getConnectionErrors') {
    // Get the connection errors from storage
    chrome.storage.local.get(['connectionErrors'], (result) => {
      sendResponse({ errors: result.connectionErrors || [] });
    });
    return true;
  }
  
  if (message.action === 'refreshStatus') {
    // Refresh the status and return result
    refreshStatus().then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'getStats') {
    // Get the current stats from storage
    chrome.storage.local.get(['stats', 'lastStatsUpdated'], (result) => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'refreshStats') {
    // Refresh the stats and return result
    refreshStats().then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.action === 'resetApiClient') {
    // Force reset the API client
    adguardApi = null;
    initializeApiClient(true).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error });
    });
    return true;
  }
}); 