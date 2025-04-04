// Background service worker for AdGuard Home Manager extension
// Import the API client and crypto utilities
import { AdGuardHomeAPI } from './api.js';
import { encrypt, decrypt } from './crypto.js';

// Map of instance IDs to API clients
let apiInstances = {};
let statusCheckInterval = null;
let activeInstanceId = null;
let previousProtectionStatus = null;

// Variables for temporary disable functionality
let disableTimer = null;
let disableEndTime = null;

// Status check interval in milliseconds (default: 60 seconds)
const STATUS_CHECK_INTERVAL = 60000;

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

// Function to show browser notifications
function showNotification(title, message, iconUrl = 'images/icon128.png') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL(iconUrl),
    title: title,
    message: message,
    silent: false
  });
}

// Initialize when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('AdGuard Home Manager extension installed');
  
  // Initialize storage with default values if needed
  chrome.storage.sync.get(['adguardInstances', 'activeInstance', 'showNotifications'], function(result) {
    if (!result.adguardInstances) {
      chrome.storage.sync.set({
        adguardInstances: [],
        activeInstance: null
      });
    }
    
    // Set default notification preference if not set
    if (result.showNotifications === undefined) {
      chrome.storage.sync.set({
        showNotifications: true // Enable notifications by default
      });
    }
    
    // Check if we have legacy data to migrate
    migrateLegacyDataIfNeeded();
    
    // Start periodic status checks if we have an active instance
    if (result.activeInstance) {
      activeInstanceId = result.activeInstance;
      startPeriodicStatusChecks();
    }
  });
  
  // Initialize local storage for instance-specific data
  chrome.storage.local.get(['protectionEnabled'], function(result) {
    previousProtectionStatus = result.protectionEnabled;
  });

  chrome.storage.local.set({
    instanceData: {},
    connectionErrors: [],
    autoRefresh: true, // Enable auto refresh by default
    refreshInterval: STATUS_CHECK_INTERVAL, // Default refresh interval
  });
});

// Function to migrate legacy data to the new multi-instance structure
async function migrateLegacyDataIfNeeded() {
  const legacyData = await chrome.storage.local.get([
    'adguardUrl', 
    'adguardUsername', 
    SECURE_KEYS.PASSWORD
  ]);
  
  if (legacyData.adguardUrl && legacyData.adguardUsername && legacyData[SECURE_KEYS.PASSWORD]) {
    console.log('Migrating legacy data to multi-instance structure');
    
    try {
      // Decrypt the password
      const password = await decrypt(legacyData[SECURE_KEYS.PASSWORD]);
      
      // Get existing instances
      const data = await chrome.storage.sync.get(['adguardInstances']);
      const instances = data.adguardInstances || [];
      
      // Create new instance from legacy data
      const newInstance = {
        id: crypto.randomUUID(),
        name: 'My AdGuard Home',
        url: legacyData.adguardUrl,
        username: legacyData.adguardUsername,
        password: password
      };
      
      // Add the new instance and set it as active
      instances.push(newInstance);
      
      // Save the updated instances and set active instance
      await chrome.storage.sync.set({
        adguardInstances: instances,
        activeInstance: newInstance.id
      });
      
      activeInstanceId = newInstance.id;
      
      // Clear legacy data
      await chrome.storage.local.remove([
        'adguardUrl', 
        'adguardUsername', 
        SECURE_KEYS.PASSWORD
      ]);
      
      console.log('Legacy data migration complete');
    } catch (error) {
      console.error('Failed to migrate legacy data:', error);
    }
  }
}

// Function to start periodic status checks
function startPeriodicStatusChecks() {
  // Clear any existing interval
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  
  // Check if auto refresh is enabled
  chrome.storage.local.get(['autoRefresh', 'refreshInterval'], function(result) {
    if (result.autoRefresh === false) {
      console.log('Automatic refresh is disabled');
      return;
    }
    
    const interval = result.refreshInterval || STATUS_CHECK_INTERVAL;
    
    console.log(`Starting periodic status checks every ${interval / 1000} seconds`);
    
    // Create new interval
    statusCheckInterval = setInterval(async () => {
      console.log('Running periodic status check');
      
      // Check if we have an active instance
      if (!activeInstanceId) {
        console.log('No active instance, skipping periodic check');
        return;
      }
      
      // Refresh status and stats for active instance
      try {
        await refreshStatus();
        await refreshStats();
        console.log('Periodic status check completed successfully');
      } catch (error) {
        console.error('Periodic status check failed:', error);
      }
    }, interval);
  });
}

// Function to stop periodic status checks
function stopPeriodicStatusChecks() {
  if (statusCheckInterval) {
    console.log('Stopping periodic status checks');
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

// Function to save credentials securely
async function saveCredentials(url, username, password) {
  try {
    console.log('Saving credentials for:', url);
    // Reset API client when credentials change
    apiInstances = {};
    
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

// Function to get the active instance data
async function getActiveInstance() {
  try {
    // Get active instance ID
    const result = await chrome.storage.sync.get(['activeInstance', 'adguardInstances']);
    const instanceId = result.activeInstance;
    
    if (!instanceId) {
      console.log('No active instance set');
      return null;
    }
    
    // Find instance in the instances array
    const instances = result.adguardInstances || [];
    const instance = instances.find(inst => inst.id === instanceId);
    
    if (!instance) {
      console.log('Active instance not found in instances array');
      return null;
    }
    
    return instance;
  } catch (error) {
    console.error('Failed to get active instance:', error);
    return null;
  }
}

// Function to initialize the API client for the active instance
async function initializeApiClient(forceNew = false) {
  // Get the active instance ID
  const activeId = activeInstanceId;
  
  // If we already have an API client for this instance and not forcing new, return it
  if (!forceNew && apiInstances[activeId]) {
    console.log('Using existing API client for instance:', activeId);
    return apiInstances[activeId];
  }
  
  console.log('Initializing API client for instance:', activeId);
  const instance = await getActiveInstance();
  
  if (instance && instance.url && instance.username && instance.password) {
    console.log('Creating new API client for:', instance.url);
    apiInstances[activeId] = new AdGuardHomeAPI(instance.url, instance.username, instance.password);
    
    // Start periodic checks when API client is initialized
    startPeriodicStatusChecks();
    
    return apiInstances[activeId];
  }
  
  console.log('No active instance found, API client not initialized');
  // Stop periodic checks if no credentials
  stopPeriodicStatusChecks();
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
        apiInstances = {};
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
    
    // Get previous settings
    const { protectionEnabled: oldStatus } = await chrome.storage.local.get(['protectionEnabled']);
    const { showNotifications } = await chrome.storage.sync.get(['showNotifications']);
    
    // Update storage
    chrome.storage.local.set({
      isConnected: true,
      protectionEnabled: status.protection_enabled,
      lastUpdated: new Date().toISOString(),
      // Clear any connection errors since we're now connected
      connectionErrors: []
    });
    
    // If status has changed and notifications are enabled, show notification
    if (showNotifications && oldStatus !== status.protection_enabled) {
      const instanceName = await getActiveInstanceName();
      if (status.protection_enabled) {
        showNotification(
          `Protection Enabled`,
          `AdGuard Home protection has been enabled for ${instanceName}.`,
          'images/icon128.png'
        );
      } else {
        showNotification(
          `Protection Disabled`,
          `AdGuard Home protection has been disabled for ${instanceName}.`,
          'images/icon128.png'
        );
      }
      
      // Update previous status
      previousProtectionStatus = status.protection_enabled;
    }
    
    return { success: true, data: status };
  } catch (error) {
    console.error('Failed to refresh status:', error);
    
    // Reset API client on failure
    apiInstances = {};
    
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
    
    // Store the stats - include all available stats
    console.log('Stats refresh successful:', stats);
    chrome.storage.local.set({
      stats: {
        num_dns_queries: stats.num_dns_queries || 0,
        num_blocked_filtering: stats.num_blocked_filtering || 0,
        num_replaced_safebrowsing: stats.num_replaced_safebrowsing || 0,
        num_replaced_parental: stats.num_replaced_parental || 0,
        num_replaced_safesearch: stats.num_replaced_safesearch || 0,
        avg_processing_time: stats.avg_processing_time || 0
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

// Function to get the active instance name
async function getActiveInstanceName() {
  try {
    const { adguardInstances, activeInstance } = await chrome.storage.sync.get(['adguardInstances', 'activeInstance']);
    if (!adguardInstances || !activeInstance) return "AdGuard Home";
    
    const instance = adguardInstances.find(inst => inst.id === activeInstance);
    return instance ? instance.name : "AdGuard Home";
  } catch (error) {
    console.error('Failed to get active instance name:', error);
    return "AdGuard Home";
  }
}

// Message handler
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message:', request.action);
  
  if (request.action === 'saveCredentials') {
    saveCredentials(request.url, request.username, request.password)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        console.error('Error saving credentials:', error);
        sendResponse({ success: false, error });
      });
    return true; // Indicates async response
  } else if (request.action === 'testConnection') {
    testConnection()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'getActiveInstanceId') {
    sendResponse({ instanceId: activeInstanceId });
    return true;
  } else if (request.action === 'getActiveInstance') {
    getActiveInstance()
      .then(instance => {
        sendResponse({ 
          success: !!instance, 
          instance: instance 
        });
      })
      .catch(error => {
        console.error('Error getting active instance:', error);
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'switchActiveInstance') {
    switchActiveInstance(request.instanceId)
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        console.error('Error switching instance:', error);
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'refreshStatus') {
    refreshStatus()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'refreshStats') {
    refreshStats()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'toggleProtection') {
    toggleProtection(request.enabled)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'disableTemporarily') {
    disableTemporarily(request.minutes)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'cancelTemporaryDisable') {
    // Handle cancel temporary disable request
    cancelTemporaryDisable()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'getTemporaryDisableStatus') {
    // Return the current temporary disable status
    getTemporaryDisableStatus()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error });
      });
    return true;
  } else if (request.action === 'getConnectionStatus') {
    getActiveInstance().then(instance => {
      sendResponse({
        isConnected: !!instance,
        activeInstance: instance ? {
          id: instance.id,
          name: instance.name,
          url: instance.url
        } : null
      });
    }).catch(error => {
      sendResponse({ isConnected: false, error });
    });
    return true;
  } else if (request.action === 'getLastError') {
    chrome.storage.local.get(['connectionErrors'], (result) => {
      const errors = result.connectionErrors || [];
      sendResponse({ error: errors.length > 0 ? errors[0] : null });
    });
    return true;
  } else if (request.action === 'disconnect') {
    // Clear the active connection state
    clearConnectionState();
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'updateRefreshInterval') {
    // Update the refresh interval for status checks
    updateRefreshInterval(request.refreshInterval);
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

/**
 * Update the refresh interval for status checks
 * @param {number} interval - New interval in milliseconds
 */
function updateRefreshInterval(interval) {
  console.log(`Updating refresh interval to ${interval / 1000} seconds`);
  
  // Store the new interval
  chrome.storage.local.set({ refreshInterval: interval });
  
  // Restart periodic checks with the new interval
  stopPeriodicStatusChecks();
  
  // Only start checks if auto refresh is enabled
  chrome.storage.local.get(['autoRefresh'], function(result) {
    if (result.autoRefresh !== false) {
      startPeriodicStatusChecks();
    }
  });
}

/**
 * Clear the active connection state
 */
function clearConnectionState() {
  // Mark as disconnected but keep the saved credentials
  // This allows the user to reconnect without re-entering credentials
  chrome.storage.local.set({
    isConnected: false
  });
  
  // Clear any active timers or protection state
  clearTimeout(disableTimer);
  disableTimer = null;
  disableEndTime = null;
}

// Function to toggle AdGuard Home protection
async function toggleProtection(enabled) {
  try {
    console.log(`Toggling protection to: ${enabled ? 'enabled' : 'disabled'}`);
    const api = await initializeApiClient();
    if (!api) {
      throw { message: 'API client not initialized' };
    }
    
    return await retryOperation(async () => {
      const result = await api.toggleProtection(enabled);
      
      // Get settings
      const { showNotifications } = await chrome.storage.sync.get(['showNotifications']);
      
      // Update local storage with new protection state
      await chrome.storage.local.set({
        protectionEnabled: enabled,
        lastUpdated: new Date().toISOString()
      });
      
      // Show notification if settings allow
      if (showNotifications && previousProtectionStatus !== enabled) {
        const instanceName = await getActiveInstanceName();
        if (enabled) {
          showNotification(
            `Protection Enabled`,
            `AdGuard Home protection has been enabled for ${instanceName}.`,
            'images/icon128.png'
          );
        } else {
          showNotification(
            `Protection Disabled`,
            `AdGuard Home protection has been disabled for ${instanceName}.`,
            'images/icon128.png'
          );
        }
        
        // Update previous status
        previousProtectionStatus = enabled;
      }
      
      return { success: true, data: result };
    });
  } catch (error) {
    console.error('Failed to toggle protection:', error);
    return { success: false, error };
  }
}

// Function to temporarily disable protection
async function disableTemporarily(minutes) {
  try {
    console.log(`Temporarily disabling protection for ${minutes} minutes`);
    const api = await initializeApiClient();
    if (!api) {
      throw { message: 'API client not initialized' };
    }
    
    return await retryOperation(async () => {
      const result = await api.disableTemporarily(minutes);
      
      // Get settings
      const { showNotifications } = await chrome.storage.sync.get(['showNotifications']);
      
      // Calculate end time
      const startTime = new Date();
      disableEndTime = new Date(startTime.getTime() + minutes * 60 * 1000);
      
      // Store disable info in storage for persistence between popup sessions
      await chrome.storage.local.set({
        protectionEnabled: false,
        lastUpdated: startTime.toISOString(),
        temporaryDisableMinutes: minutes,
        temporaryDisableStartTime: startTime.toISOString(),
        temporaryDisableEndTime: disableEndTime.toISOString()
      });
      
      // Set a timer to re-enable protection
      if (disableTimer) {
        clearTimeout(disableTimer);
      }
      
      disableTimer = setTimeout(() => {
        reEnableProtection();
      }, minutes * 60 * 1000);
      
      // Show notification if settings allow
      if (showNotifications && previousProtectionStatus !== false) {
        const instanceName = await getActiveInstanceName();
        showNotification(
          `Protection Temporarily Disabled`,
          `AdGuard Home protection has been disabled for ${instanceName} for ${minutes} minutes.`,
          'images/icon128.png'
        );
        
        // Update previous status
        previousProtectionStatus = false;
      }
      
      return { success: true, data: result };
    });
  } catch (error) {
    console.error('Failed to disable temporarily:', error);
    return { success: false, error };
  }
}

/**
 * Cancel temporary disable and re-enable protection immediately
 */
async function cancelTemporaryDisable() {
  try {
    console.log('Cancelling temporary disable and re-enabling protection');
    
    // Clear the timer
    if (disableTimer) {
      clearTimeout(disableTimer);
      disableTimer = null;
    }
    disableEndTime = null;
    
    // Clear temporary disable info from storage
    await chrome.storage.local.remove([
      'temporaryDisableMinutes',
      'temporaryDisableStartTime',
      'temporaryDisableEndTime'
    ]);
    
    // Re-enable protection
    const result = await toggleProtection(true);
    
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Failed to cancel temporary disable:', error);
    return { success: false, error };
  }
}

/**
 * Get the current temporary disable status
 */
async function getTemporaryDisableStatus() {
  try {
    // Check storage first for persistence between popup sessions
    const data = await chrome.storage.local.get([
      'temporaryDisableEndTime',
      'protectionEnabled'
    ]);
    
    // If protection is enabled, it's not temporarily disabled
    if (data.protectionEnabled === true) {
      return { isTemporarilyDisabled: false };
    }
    
    // Check if we have an end time in storage
    if (data.temporaryDisableEndTime) {
      const endTime = new Date(data.temporaryDisableEndTime);
      const now = new Date();
      
      // If the end time is in the future, it's still temporarily disabled
      if (endTime > now) {
        return {
          isTemporarilyDisabled: true,
          endTime: endTime
        };
      } else {
        // End time has passed, make sure protection is re-enabled
        await reEnableProtection();
        return { isTemporarilyDisabled: false };
      }
    }
    
    // Check in-memory variables as fallback
    if (disableEndTime) {
      const now = new Date();
      
      if (disableEndTime > now) {
        return {
          isTemporarilyDisabled: true,
          endTime: disableEndTime
        };
      } else {
        // End time has passed, make sure protection is re-enabled
        await reEnableProtection();
        return { isTemporarilyDisabled: false };
      }
    }
    
    return { isTemporarilyDisabled: false };
  } catch (error) {
    console.error('Failed to get temporary disable status:', error);
    return { isTemporarilyDisabled: false, error };
  }
}

/**
 * Re-enable protection after temporary disable period
 */
async function reEnableProtection() {
  try {
    console.log('Re-enabling protection after temporary disable');
    
    // Clear timer variables
    disableTimer = null;
    disableEndTime = null;
    
    // Clear temporary disable info from storage
    await chrome.storage.local.remove([
      'temporaryDisableMinutes',
      'temporaryDisableStartTime',
      'temporaryDisableEndTime'
    ]);
    
    // Toggle protection back on
    const result = await toggleProtection(true);
    
    // Send refresh message to any open popups to update UI
    chrome.runtime.sendMessage({ 
      action: 'protectionAutoReEnabled',
      result: result
    }).catch(() => {
      // Ignore errors if no popups are open to receive the message
    });
    
    return result;
  } catch (error) {
    console.error('Failed to re-enable protection:', error);
    return { success: false, error };
  }
}

// Function to switch the active instance
async function switchActiveInstance(instanceId) {
  try {
    // Get the instances array
    const result = await chrome.storage.sync.get(['adguardInstances']);
    const instances = result.adguardInstances || [];
    
    // Check if the instance exists
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) {
      console.error('Instance not found:', instanceId);
      return false;
    }
    
    // Update the active instance
    await chrome.storage.sync.set({ activeInstance: instanceId });
    activeInstanceId = instanceId;
    
    // Force a new API client initialization for the new active instance
    await initializeApiClient(true);
    
    console.log('Switched active instance to:', instanceId);
    return true;
  } catch (error) {
    console.error('Failed to switch active instance:', error);
    return false;
  }
} 