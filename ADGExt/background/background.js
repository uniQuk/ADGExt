// Background service worker for AdGuard Home Manager extension

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
    }
  });
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getConnectionStatus') {
    // This will be implemented in Phase 1.4
    sendResponse({ isConnected: false });
    return true;
  }
  
  if (message.action === 'getStats') {
    // This will be implemented in Phase 1.7
    sendResponse({ 
      num_dns_queries: 0,
      num_blocked_filtering: 0,
      lastUpdated: null
    });
    return true;
  }
}); 