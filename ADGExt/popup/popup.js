document.addEventListener('DOMContentLoaded', function() {
  // Get references to DOM elements
  const connectForm = document.getElementById('connect-form');
  const connectionForm = document.getElementById('connection-form');
  const statsContainer = document.getElementById('stats-container');
  
  // Check if we have saved connection settings and try to connect
  checkConnectionStatus();
  
  // Handle form submission
  connectForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Get form values
    const url = document.getElementById('url').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate URL format
    if (!isValidUrl(url)) {
      showError('Please enter a valid URL (including http:// or https://)');
      return;
    }
    
    // Show loading state
    const connectButton = document.getElementById('connect-button');
    const originalButtonText = connectButton.textContent;
    connectButton.textContent = 'Connecting...';
    connectButton.disabled = true;
    
    // Save credentials securely using the background script
    chrome.runtime.sendMessage({
      action: 'saveCredentials',
      url: url,
      username: username,
      password: password
    }, function(response) {
      if (!response || !response.success) {
        // Failed to save credentials
        connectButton.textContent = originalButtonText;
        connectButton.disabled = false;
        showError('Failed to save credentials securely.');
        return;
      }
      
      // Test the connection
      chrome.runtime.sendMessage({ action: 'testConnection' }, function(response) {
        if (response && response.success) {
          // Connection test successful, now get status
          chrome.runtime.sendMessage({ action: 'refreshStatus' }, function(statusResponse) {
            // Reset button
            connectButton.textContent = originalButtonText;
            connectButton.disabled = false;
            
            if (statusResponse && statusResponse.success) {
              // Connection successful, switch UI state
              connectionForm.classList.add('hidden');
              statsContainer.classList.remove('hidden');
              
              // Display connection status and fetch stats
              displayConnectionStatus(statusResponse.data);
              fetchAndDisplayStats();
            } else {
              // Status refresh failed
              handleConnectionError(statusResponse?.error || { message: 'Failed to get status' });
            }
          });
        } else {
          // Connection test failed
          connectButton.textContent = originalButtonText;
          connectButton.disabled = false;
          handleConnectionError(response?.error || { message: 'Connection test failed' });
        }
      });
    });
  });
  
  // Function to check connection status
  function checkConnectionStatus() {
    chrome.storage.local.get(['adguardUrl', 'adguardUsername'], function(result) {
      if (result.adguardUrl && result.adguardUsername) {
        // If we have saved settings, try to connect automatically
        chrome.runtime.sendMessage({ action: 'getConnectionStatus' }, function(response) {
          if (response && response.isConnected) {
            // We're connected, show stats container
            connectionForm.classList.add('hidden');
            statsContainer.classList.remove('hidden');
            
            // Refresh status and stats
            chrome.runtime.sendMessage({ action: 'refreshStatus' }, function(response) {
              if (response && response.success) {
                displayConnectionStatus(response.data);
                fetchAndDisplayStats();
              } else {
                // Failed to refresh, but show previous state
                displayStatusFromStorage();
                displayStatsFromStorage();
                
                // Add reset button to troubleshoot connection
                addResetConnectionButton();
                
                // Show error if there is one
                if (response && response.error) {
                  showErrorNotification(response.error.message || 'Failed to refresh status');
                }
              }
            });
          } else {
            // Not connected, show connection form
            // Pre-fill the form with saved URL and username
            document.getElementById('url').value = result.adguardUrl || '';
            document.getElementById('username').value = result.adguardUsername || '';
            
            // Check if there are connection errors to display
            if (response && response.connectionErrors && response.connectionErrors.length > 0) {
              const latestError = response.connectionErrors[0];
              showPreviousConnectionError(latestError);
            }
          }
        });
      }
    });
  }
  
  // Add a reset connection button to troubleshoot
  function addResetConnectionButton() {
    // Check if button already exists
    if (document.getElementById('reset-connection-btn')) {
      return;
    }
    
    const resetBtn = document.createElement('button');
    resetBtn.id = 'reset-connection-btn';
    resetBtn.textContent = 'Reset Connection';
    resetBtn.className = 'reset-btn';
    
    // Add event listener
    resetBtn.addEventListener('click', resetConnection);
    
    // Add to the footer
    const footer = document.querySelector('.footer');
    if (footer) {
      footer.insertBefore(resetBtn, footer.firstChild);
    } else {
      statsContainer.appendChild(resetBtn);
    }
  }
  
  // Function to reset connection state
  function resetConnection() {
    showErrorNotification('Resetting connection...');
    
    // Force reset API client
    chrome.runtime.sendMessage({ action: 'resetApiClient' }, function() {
      // Go back to connection form
      statsContainer.classList.add('hidden');
      connectionForm.classList.remove('hidden');
      
      // Clear any stored connection status
      chrome.storage.local.set({
        isConnected: false,
        protectionEnabled: false
      }, function() {
        showErrorNotification('Connection reset. Please reconnect.');
      });
    });
  }
  
  // Function to handle connection errors
  function handleConnectionError(error) {
    // Display the error
    showError(getErrorMessage(error));
    
    // Show troubleshooting tips based on error type
    showTroubleshootingTips(error);
    
    // Add reset button
    addResetConnectionButton();
  }
  
  // Function to get a user-friendly error message
  function getErrorMessage(error) {
    if (!error) return 'Unknown error occurred';
    
    if (typeof error === 'string') return error;
    
    // Return the user-friendly message if available
    if (error.message) return error.message;
    
    return 'Failed to connect to AdGuard Home';
  }
  
  // Function to show an error message
  function showError(message) {
    const errorBox = document.createElement('div');
    errorBox.className = 'error-box';
    errorBox.innerHTML = `
      <p class="error-message">${message}</p>
      <button class="error-close-btn">✕</button>
    `;
    
    // Add to the page
    document.body.appendChild(errorBox);
    
    // Add event listener to close button
    errorBox.querySelector('.error-close-btn').addEventListener('click', function() {
      errorBox.remove();
    });
    
    // Auto close after 10 seconds
    setTimeout(() => {
      if (document.body.contains(errorBox)) {
        errorBox.remove();
      }
    }, 10000);
  }
  
  // Function to show a non-modal error notification
  function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error-notification';
    notification.innerHTML = `
      <p>${message}</p>
      <button class="close-btn">✕</button>
    `;
    
    // Add to the page
    document.body.appendChild(notification);
    
    // Add event listener to close button
    notification.querySelector('.close-btn').addEventListener('click', function() {
      notification.remove();
    });
    
    // Auto close after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.remove();
      }
    }, 5000);
  }
  
  // Function to show troubleshooting tips based on error type
  function showTroubleshootingTips(error) {
    if (!error || !error.code) return;
    
    const tipBox = document.createElement('div');
    tipBox.className = 'tip-box';
    
    let tipContent = '';
    
    switch (error.code) {
      case 'NETWORK_ERROR':
        tipContent = `
          <h3>Troubleshooting Tips:</h3>
          <ul>
            <li>Make sure AdGuard Home is running</li>
            <li>Check that the URL is correct</li>
            <li>Ensure your network connection is stable</li>
            <li>If using a hostname, ensure DNS resolution is working</li>
            <li>Check if a firewall might be blocking the connection</li>
            <li>Try adding or removing "/control" from the URL</li>
          </ul>
        `;
        break;
      case 'AUTH_ERROR':
        tipContent = `
          <h3>Authentication Failed:</h3>
          <ul>
            <li>Double-check your username and password</li>
            <li>Ensure you're using admin credentials</li>
            <li>Try resetting your AdGuard Home password if you're unsure</li>
          </ul>
        `;
        break;
      case 'NOT_FOUND':
        tipContent = `
          <h3>API Endpoint Not Found:</h3>
          <ul>
            <li>Make sure the URL points to an AdGuard Home instance</li>
            <li>Try adding or removing "/control" from the URL</li>
            <li>Verify your AdGuard Home version is compatible</li>
            <li>Check if AdGuard Home API is enabled in settings</li>
          </ul>
        `;
        break;
      default:
        tipContent = `
          <h3>Troubleshooting Tips:</h3>
          <ul>
            <li>Verify AdGuard Home is running correctly</li>
            <li>Try using the server IP address instead of hostname</li>
            <li>Check your network connection</li>
            <li>Try refreshing the page</li>
            <li>Restart AdGuard Home if possible</li>
            <li>Make sure you're using the correct port (usually 80 or 3000)</li>
          </ul>
        `;
    }
    
    tipBox.innerHTML = `
      ${tipContent}
      <div class="tip-actions">
        <button class="tip-close-btn">Close</button>
        <button class="try-again-btn">Try Again</button>
        <button class="reset-connection-tip-btn">Reset Connection</button>
      </div>
    `;
    
    // Add to the page
    document.body.appendChild(tipBox);
    
    // Add event listeners
    tipBox.querySelector('.tip-close-btn').addEventListener('click', function() {
      tipBox.remove();
    });
    
    tipBox.querySelector('.try-again-btn').addEventListener('click', function() {
      tipBox.remove();
      const connectButton = document.getElementById('connect-button');
      if (connectButton) {
        connectButton.click();
      } else {
        refreshAll();
      }
    });
    
    tipBox.querySelector('.reset-connection-tip-btn').addEventListener('click', function() {
      tipBox.remove();
      resetConnection();
    });
  }
  
  // Function to show a previous connection error
  function showPreviousConnectionError(error) {
    if (!error) return;
    
    const errorNotice = document.createElement('div');
    errorNotice.className = 'error-notice';
    
    const timestamp = new Date(error.timestamp).toLocaleString();
    
    errorNotice.innerHTML = `
      <p>Previous connection failed: ${error.message}</p>
      <p class="error-timestamp">Last attempt: ${timestamp}</p>
    `;
    
    // Insert after the form
    connectionForm.appendChild(errorNotice);
  }
  
  // Display connection status from storage
  function displayStatusFromStorage() {
    chrome.storage.local.get(['isConnected', 'protectionEnabled', 'lastUpdated'], function(result) {
      const statusHtml = createStatusHtml(
        result.isConnected, 
        result.protectionEnabled,
        result.lastUpdated ? new Date(result.lastUpdated).toLocaleString() : 'Never'
      );
      
      // Update just the status section
      const existingStats = document.getElementById('stats-section');
      if (existingStats) {
        // If stats section exists, only update the status section
        document.getElementById('status-section').innerHTML = statusHtml;
      } else {
        // Otherwise, replace the entire stats container
        statsContainer.innerHTML = `
          <div id="status-section">${statusHtml}</div>
          <div id="stats-section">Loading stats...</div>
        `;
        displayStatsFromStorage();
      }
      
      // Add event listener to refresh button
      document.getElementById('refresh-button').addEventListener('click', function() {
        refreshAll();
      });
    });
  }
  
  // Display connection status from API response
  function displayConnectionStatus(statusData) {
    const isProtectionEnabled = statusData.protection_enabled;
    
    const statusHtml = createStatusHtml(
      true, // We know we're connected since we got a response
      isProtectionEnabled,
      new Date().toLocaleString()
    );
    
    // Update just the status section
    const existingStats = document.getElementById('stats-section');
    if (existingStats) {
      // If stats section exists, only update the status section
      document.getElementById('status-section').innerHTML = statusHtml;
    } else {
      // Otherwise, replace the entire stats container
      statsContainer.innerHTML = `
        <div id="status-section">${statusHtml}</div>
        <div id="stats-section">Loading stats...</div>
      `;
    }
    
    // Add event listener to refresh button
    document.getElementById('refresh-button').addEventListener('click', function() {
      refreshAll();
    });
  }
  
  // Create the status HTML
  function createStatusHtml(isConnected, isProtectionEnabled, lastUpdated) {
    return `
      <div class="status-box">
        <h2>AdGuard Home Status</h2>
        <p>Connection: <span class="status-indicator ${isConnected ? 'connected' : 'disconnected'}">${isConnected ? 'Connected' : 'Disconnected'}</span></p>
        <p>Protection: <span class="status-indicator ${isProtectionEnabled ? 'enabled' : 'disabled'}">${isProtectionEnabled ? 'Enabled' : 'Disabled'}</span></p>
        <p>Last Updated: ${lastUpdated}</p>
        <button id="refresh-button">Refresh</button>
      </div>
    `;
  }
  
  // Fetch and display stats from the API
  function fetchAndDisplayStats() {
    const statsSection = document.getElementById('stats-section') || document.createElement('div');
    statsSection.id = 'stats-section';
    statsSection.innerHTML = '<p class="loading">Loading stats...</p>';
    
    if (!document.getElementById('stats-section')) {
      statsContainer.appendChild(statsSection);
    }
    
    chrome.runtime.sendMessage({ action: 'refreshStats' }, function(response) {
      if (response && response.success) {
        displayStats(response.data);
      } else {
        // If failed to get fresh stats, try to display stored stats
        displayStatsFromStorage();
        
        // Show error if there is one
        if (response && response.error) {
          showErrorNotification(response.error.message || 'Failed to load statistics');
          
          // Add reset button if needed
          if (response.error.code === 'NETWORK_ERROR' || response.error.code === 'NOT_FOUND') {
            addResetConnectionButton();
          }
        }
      }
    });
  }
  
  // Display stats from storage
  function displayStatsFromStorage() {
    chrome.storage.local.get(['stats', 'lastStatsUpdated'], function(result) {
      if (result.stats) {
        displayStatsData(
          result.stats.num_dns_queries,
          result.stats.num_blocked_filtering,
          result.stats.avg_processing_time,
          result.lastStatsUpdated ? new Date(result.lastStatsUpdated).toLocaleString() : 'Never'
        );
      } else {
        // No stats available
        const statsSection = document.getElementById('stats-section');
        if (statsSection) {
          statsSection.innerHTML = '<p class="error">No statistics available</p>';
        }
      }
    });
  }
  
  // Display stats from API response
  function displayStats(statsData) {
    displayStatsData(
      statsData.num_dns_queries,
      statsData.num_blocked_filtering,
      statsData.avg_processing_time,
      new Date().toLocaleString()
    );
  }
  
  // Create and display stats HTML
  function displayStatsData(queries, blocked, avgTime, lastUpdated) {
    const blockingPercentage = queries > 0 ? ((blocked / queries) * 100).toFixed(1) : 0;
    
    const statsHtml = `
      <div class="stats-box">
        <h2>DNS Statistics</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${formatNumber(queries)}</div>
            <div class="stat-label">Total Queries</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatNumber(blocked)}</div>
            <div class="stat-label">Blocked</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${blockingPercentage}%</div>
            <div class="stat-label">Blocking Rate</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${avgTime ? avgTime.toFixed(2) + 'ms' : 'N/A'}</div>
            <div class="stat-label">Avg. Processing</div>
          </div>
        </div>
        <p class="stats-updated">Last updated: ${lastUpdated}</p>
      </div>
    `;
    
    const statsSection = document.getElementById('stats-section');
    if (statsSection) {
      statsSection.innerHTML = statsHtml;
    }
  }
  
  // Format large numbers with commas
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  
  // Refresh all data (status and stats)
  function refreshAll() {
    // Update status section to show loading
    document.getElementById('status-section').innerHTML = '<p class="loading">Refreshing status...</p>';
    
    // Update stats section to show loading
    const statsSection = document.getElementById('stats-section');
    if (statsSection) {
      statsSection.innerHTML = '<p class="loading">Refreshing stats...</p>';
    }
    
    // First, reset the API client to ensure a fresh connection
    chrome.runtime.sendMessage({ action: 'resetApiClient' }, function() {
      // Then refresh status
      chrome.runtime.sendMessage({ action: 'refreshStatus' }, function(response) {
        if (response && response.success) {
          displayConnectionStatus(response.data);
          
          // Then refresh stats
          chrome.runtime.sendMessage({ action: 'refreshStats' }, function(statsResponse) {
            if (statsResponse && statsResponse.success) {
              displayStats(statsResponse.data);
              
              // Remove any reset connection button if exists
              const resetBtn = document.getElementById('reset-connection-btn');
              if (resetBtn) resetBtn.remove();
            } else {
              // Failed to refresh stats
              const statsSection = document.getElementById('stats-section');
              if (statsSection) {
                const errorMessage = statsResponse && statsResponse.error ? 
                  statsResponse.error.message || 'Unknown error' : 
                  'Failed to refresh stats';
                statsSection.innerHTML = `<p class="error">Failed to refresh stats: ${errorMessage}</p>`;
                
                // Add reset button
                addResetConnectionButton();
              }
            }
          });
        } else {
          // Failed to refresh status
          const errorMessage = response && response.error ? 
            response.error.message || 'Unknown error' : 
            'Failed to refresh status';
          
          document.getElementById('status-section').innerHTML = `<p class="error">Failed to refresh status: ${errorMessage}</p>`;
          
          // Don't attempt to refresh stats if status refresh failed
          const statsSection = document.getElementById('stats-section');
          if (statsSection) {
            statsSection.innerHTML = '<p class="error">Stats refresh skipped due to connection issues</p>';
          }
          
          // Show troubleshooting tips if appropriate
          if (response && response.error && response.error.code) {
            showTroubleshootingTips(response.error);
          }
          
          // Add reset button
          addResetConnectionButton();
        }
      });
    });
  }
  
  // Helper function to validate URL
  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
}); 