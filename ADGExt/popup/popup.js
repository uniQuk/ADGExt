import { localizeHtml, getMessage, getFormattedMessage, formatDate, formatNumber } from '../src/utils/i18n.js';

document.addEventListener('DOMContentLoaded', function() {
  // Localize HTML elements
  localizeHtml();
  
  // Get references to DOM elements
  const connectForm = document.getElementById('connect-form');
  const connectionForm = document.getElementById('connection-form');
  const statsContainer = document.getElementById('stats-container');
  const protectionToggle = document.getElementById('protection-toggle');
  const tempDisableBtn = document.getElementById('temp-disable-btn');
  const timerModal = document.getElementById('timer-modal');
  const timerOptions = document.querySelectorAll('.timer-option');
  const cancelTimerSelectionBtn = document.getElementById('cancel-timer-selection');
  const applyCustomTimerBtn = document.getElementById('apply-custom-timer');
  const customMinutesInput = document.getElementById('custom-minutes');
  const cancelTimerBtn = document.getElementById('cancel-timer-btn');
  const settingsButton = document.getElementById('settings-button');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  
  // Localize timer options
  localizeTimerOptions();
  
  // Add event listener for settings button
  settingsButton.addEventListener('click', function() {
    window.location.href = '../settings/settings.html';
  });
  
  // Add event listener for open dashboard button
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', openDashboard);
  }
  
  // Check if we have saved connection settings and try to connect
  checkConnectionStatus();
  
  // Add event listener for protection toggle
  protectionToggle.addEventListener('change', toggleProtection);
  
  // Add event listener for temporary disable button
  if (tempDisableBtn) {
    tempDisableBtn.addEventListener('click', showTimerModal);
  }
  
  // Add event listeners for timer option buttons
  timerOptions.forEach(option => {
    option.addEventListener('click', function() {
      const minutes = parseInt(this.getAttribute('data-minutes'), 10);
      disableTemporarily(minutes);
    });
  });
  
  // Add event listener for custom timer button
  if (applyCustomTimerBtn) {
    applyCustomTimerBtn.addEventListener('click', function() {
      const minutes = parseInt(customMinutesInput.value, 10);
      if (isNaN(minutes) || minutes < 1) {
        showErrorNotification(getMessage('invalidMinutes'));
        return;
      }
      disableTemporarily(minutes);
    });
  }
  
  // Add event listener for cancel timer selection button
  if (cancelTimerSelectionBtn) {
    cancelTimerSelectionBtn.addEventListener('click', hideTimerModal);
  }
  
  // Add event listener for cancel timer button
  if (cancelTimerBtn) {
    cancelTimerBtn.addEventListener('click', cancelTemporaryDisable);
  }
  
  // Handle form submission
  connectForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Get form values
    const url = document.getElementById('url').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate URL format
    if (!isValidUrl(url)) {
      showError(getMessage('invalidUrl'));
      return;
    }
    
    // Show loading state
    const connectButton = document.getElementById('connect-button');
    const originalButtonText = showConnectButtonLoader(connectButton);
    
    // Save credentials securely using the background script
    chrome.runtime.sendMessage({
      action: 'saveCredentials',
      url: url,
      username: username,
      password: password
    }, function(response) {
      if (!response || !response.success) {
        // Failed to save credentials
        restoreConnectButton(connectButton, originalButtonText);
        showError(getMessage('failedToSaveCredentials'));
        return;
      }
      
      // Test the connection
      chrome.runtime.sendMessage({ action: 'testConnection' }, function(response) {
        if (response && response.success) {
          // Connection test successful, now get status
          chrome.runtime.sendMessage({ action: 'refreshStatus' }, function(statusResponse) {
            // Reset button
            restoreConnectButton(connectButton, originalButtonText);
            
            if (statusResponse && statusResponse.success) {
              // Connection successful, switch UI state
              connectionForm.classList.add('hidden');
              statsContainer.classList.remove('hidden');
              
              // Display connection status and fetch stats
              displayConnectionStatus(statusResponse.data);
              fetchAndDisplayStats();
            } else {
              // Status refresh failed
              handleConnectionError(statusResponse?.error || { message: getMessage('failedToRefreshStatus') });
            }
          });
        } else {
          // Connection test failed
          restoreConnectButton(connectButton, originalButtonText);
          handleConnectionError(response?.error || { message: getMessage('connectionTestFailed') });
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
            
            // Check if protection is temporarily disabled
            checkTemporaryDisableStatus();
            
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
                  showErrorNotification(response.error.message || getMessage('failedToRefreshStatus'));
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
    resetBtn.textContent = getMessage('resetConnection');
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
    showErrorNotification(getMessage('resettingConnection'));
    
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
        showErrorNotification(getMessage('connectionResetPleaseReconnect'));
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
    if (!error) return getMessage('unknownErrorOccurred');
    
    if (typeof error === 'string') return error;
    
    // Return the user-friendly message if available
    if (error.message) return error.message;
    
    return getMessage('failedToConnectToAdGuardHome');
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
  
  // Add loader animation to connect button
  function showConnectButtonLoader(button) {
    const originalText = button.textContent;
    button.innerHTML = `<span class="spinner"></span> ${getMessage('connecting')}`;
    button.disabled = true;
    return originalText;
  }
  
  // Restore connect button state
  function restoreConnectButton(button, originalText) {
    button.innerHTML = originalText;
    button.disabled = false;
  }
  
  // Show animated error notification
  function showErrorNotification(message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-notification fade-in';
    errorContainer.textContent = message;
    
    // Add to DOM
    document.body.appendChild(errorContainer);
    
    // Animate in
    setTimeout(() => {
      errorContainer.classList.add('slide-in');
    }, 10);
    
    // Automatically remove after 3 seconds
    setTimeout(() => {
      errorContainer.classList.remove('slide-in');
      errorContainer.classList.add('slide-out');
      
      setTimeout(() => {
        document.body.removeChild(errorContainer);
      }, 300);
    }, 3000);
  }
  
  // Function to show a previous connection error
  function showPreviousConnectionError(error) {
    if (!error) return;
    
    const errorNotice = document.createElement('div');
    errorNotice.className = 'error-notice';
    
    const timestamp = new Date(error.timestamp).toLocaleString();
    
    errorNotice.innerHTML = `
      <p>${getMessage('previousConnectionFailed')}: ${error.message}</p>
      <p class="error-timestamp">${getMessage('lastAttempt')}: ${timestamp}</p>
    `;
    
    // Insert after the form
    connectionForm.appendChild(errorNotice);
  }
  
  // Function to show timer modal
  function showTimerModal() {
    timerModal.classList.remove('hidden');
  }
  
  // Function to hide timer modal
  function hideTimerModal() {
    timerModal.classList.add('hidden');
  }
  
  // Function to disable protection temporarily
  function disableTemporarily(minutes) {
    // Hide the timer modal
    hideTimerModal();
    
    // Show loading notification
    showErrorNotification(getMessage('disablingProtectionForMinutes', { minutes: minutes }));
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'disableTemporarily',
      minutes: minutes
    }, function(response) {
      if (response && response.success) {
        // Show success notification
        showSuccessNotification(getMessage('protectionDisabledForMinutes', { minutes: minutes }));
        
        // Update protection status in UI (disabled)
        updateProtectionStatus(false);
        
        // Show the timer UI
        showTimer(minutes);
        
        // Update the toggle switch
        protectionToggle.checked = false;
      } else {
        // Show error notification
        showErrorNotification(getMessage('failedToDisableProtectionTemporarily'));
        
        // Show error details if available
        if (response && response.error) {
          showError(getErrorMessage(response.error));
        }
      }
    });
  }
  
  // Function to show the timer UI
  function showTimer(minutes) {
    const timerContainer = document.getElementById('timer-container');
    const timerValue = document.getElementById('timer-value');
    const tempDisableBtn = document.getElementById('temp-disable-btn');
    
    // Calculate end time
    let endTime;
    
    // If minutes is a Date object, it's an endTime passed from checkTemporaryDisableStatus
    if (minutes instanceof Date) {
      endTime = minutes;
    } else {
      // Calculate new end time based on minutes
      endTime = new Date(Date.now() + minutes * 60 * 1000);
    }
    
    // Show timer container and hide the disable button
    timerContainer.classList.remove('hidden');
    tempDisableBtn.classList.add('hidden');
    
    // Update timer display
    updateTimerDisplay(endTime);
    
    // Store the end time in storage
    chrome.storage.local.set({
      timerEndTime: endTime.toISOString()
    });
    
    // Start the countdown
    startCountdown(endTime);
  }
  
  // Function to start countdown
  function startCountdown(endTime) {
    // Clear any existing timer
    if (window.timerInterval) {
      clearInterval(window.timerInterval);
    }
    
    // Create a new timer that updates every second
    window.timerInterval = setInterval(function() {
      const now = new Date();
      const endTimeDate = new Date(endTime);
      
      // Check if timer has expired
      if (now >= endTimeDate) {
        clearInterval(window.timerInterval);
        timerExpired();
        return;
      }
      
      // Update the timer display
      updateTimerDisplay(endTimeDate);
    }, 1000);
  }
  
  // Function to update timer display
  function updateTimerDisplay(endTime) {
    const timerValue = document.getElementById('timer-value');
    if (!timerValue) return;
    
    const now = new Date();
    let diff = endTime - now;
    
    // Guard against negative values
    if (diff < 0) diff = 0;
    
    // Calculate minutes and seconds
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    // Format the time
    timerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Function to handle timer expiration
  function timerExpired() {
    // Show loading notification
    showErrorNotification(getMessage('timerExpiredReEnablingProtection'));
    
    // Re-enable protection
    chrome.runtime.sendMessage({
      action: 'toggleProtection',
      enabled: true
    }, function(response) {
      if (response && response.success) {
        // Show success notification
        showSuccessNotification(getMessage('protectionReEnabledSuccessfully'));
        
        // Update protection status in UI
        updateProtectionStatus(true);
        
        // Update the toggle switch
        protectionToggle.checked = true;
        
        // Reset timer UI
        resetTimerUI();
      } else {
        // Show error notification
        showErrorNotification(getMessage('failedToReEnableProtection'));
        
        // Show error details if available
        if (response && response.error) {
          showError(getErrorMessage(response.error));
        }
      }
    });
  }
  
  // Function to reset timer UI
  function resetTimerUI() {
    const timerContainer = document.getElementById('timer-container');
    const tempDisableBtn = document.getElementById('temp-disable-btn');
    
    // Hide timer container and show the disable button
    timerContainer.classList.add('hidden');
    tempDisableBtn.classList.remove('hidden');
    
    // Clear the stored end time
    chrome.storage.local.remove('timerEndTime');
    
    // Clear any existing timer
    if (window.timerInterval) {
      clearInterval(window.timerInterval);
    }
  }
  
  // Function to cancel temporary disable
  function cancelTemporaryDisable() {
    // Show loading notification
    showErrorNotification(getMessage('cancellingTemporaryDisable'));
    
    // Re-enable protection
    chrome.runtime.sendMessage({
      action: 'toggleProtection',
      enabled: true
    }, function(response) {
      if (response && response.success) {
        // Show success notification
        showSuccessNotification(getMessage('protectionReEnabled'));
        
        // Update protection status in UI
        updateProtectionStatus(true);
        
        // Update the toggle switch
        protectionToggle.checked = true;
        
        // Reset timer UI
        resetTimerUI();
      } else {
        // Show error notification
        showErrorNotification(getMessage('failedToReEnableProtection'));
        
        // Show error details if available
        if (response && response.error) {
          showError(getErrorMessage(response.error));
        }
      }
    });
  }

  // Function to check if protection is temporarily disabled
  function checkTemporaryDisableStatus() {
    chrome.storage.local.get(['timerEndTime', 'protectionEnabled'], function(result) {
      if (result.timerEndTime) {
        const endTime = new Date(result.timerEndTime);
        const now = new Date();
        
        // Check if timer has expired
        if (now < endTime) {
          // Timer still active, show the timer UI
          showTimer(endTime);
          
          // Ensure protection toggle shows correct state
          if (protectionToggle && result.protectionEnabled === false) {
            protectionToggle.checked = false;
          }
        } else {
          // Timer expired, reset UI and storage
          resetTimerUI();
          
          // If protection is still disabled, re-enable it
          if (result.protectionEnabled === false) {
            // Re-enable protection
            chrome.runtime.sendMessage({
              action: 'toggleProtection',
              enabled: true
            }, function(response) {
              if (response && response.success) {
                // Show success notification
                showSuccessNotification(getMessage('protectionReEnabledAfterExpiry'));
                
                // Update protection status in UI
                updateProtectionStatus(true);
                
                // Update the toggle switch
                if (protectionToggle) {
                  protectionToggle.checked = true;
                }
              } else {
                // Show error but don't retry automatically to avoid loops
                showErrorNotification(getMessage('failedToReEnableAfterExpiry'));
              }
            });
          }
        }
      }
    });
  }
  
  // Function to toggle protection
  function toggleProtection() {
    // Get new toggle state
    const isEnabled = protectionToggle.checked;
    
    // Show loading notification
    showErrorNotification(getMessage('protectionStatusChanging', { status: isEnabled ? getMessage('enabling') : getMessage('disabling') }));
    
    // Animate the toggle
    animateProtectionToggle(protectionToggle, isEnabled);
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'toggleProtection',
      enabled: isEnabled
    }, function(response) {
      if (response && response.success) {
        // Show success notification
        showSuccessNotification(getMessage('protectionStatusChanged', { status: isEnabled ? getMessage('enabled') : getMessage('disabled') }));
        
        // Update protection status in UI
        displayConnectionStatus(response.data);
        
        // Toggle temporary disable section
        const temporaryDisable = document.querySelector('.temporary-disable');
        if (temporaryDisable) {
          if (isEnabled) {
            temporaryDisable.classList.remove('hidden');
            temporaryDisable.classList.add('fade-in');
          } else {
            temporaryDisable.classList.add('hidden');
            temporaryDisable.classList.remove('fade-in');
          }
        }
      } else {
        // Show error notification
        showErrorNotification(getMessage('failedToToggleProtection'));
        
        // Revert toggle to previous state
        protectionToggle.checked = !isEnabled;
        
        // Add shake animation to the toggle
        animateShake(protectionToggle.closest('.toggle-switch'));
        
        // Show error details if available
        if (response && response.error) {
          console.error('Protection toggle error:', response.error);
        }
      }
    });
  }
  
  // Function to update temporary disable button
  function updateTemporaryDisableButton(isProtectionEnabled) {
    const tempDisableContainer = document.querySelector('.temporary-disable');
    
    if (isProtectionEnabled) {
      tempDisableContainer.classList.remove('hidden');
    } else {
      tempDisableContainer.classList.add('hidden');
    }
  }
  
  // Function to update protection status in UI
  function updateProtectionStatus(isEnabled) {
    // Update stored status
    chrome.storage.local.set({
      protectionEnabled: isEnabled
    });
    
    // Update UI
    updateStatusDisplay();
  }
  
  // Function to update status display
  function updateStatusDisplay() {
    chrome.storage.local.get(['isConnected', 'protectionEnabled', 'lastUpdated'], function(result) {
      createStatusHtml(
        result.isConnected === true,
        result.protectionEnabled === true,
        result.lastUpdated || null
      );
    });
  }
  
  // Show animated success notification
  function showSuccessNotification(message) {
    const successContainer = document.createElement('div');
    successContainer.className = 'success-notification fade-in';
    successContainer.textContent = message;
    
    // Add to DOM
    document.body.appendChild(successContainer);
    
    // Animate in
    setTimeout(() => {
      successContainer.classList.add('slide-in');
    }, 10);
    
    // Automatically remove after 3 seconds
    setTimeout(() => {
      successContainer.classList.remove('slide-in');
      successContainer.classList.add('slide-out');
      
      setTimeout(() => {
        document.body.removeChild(successContainer);
      }, 300);
    }, 3000);
  }
  
  // Function to display connection status
  function displayConnectionStatus(statusData) {
    if (!statusData) return;
    
    // Extract protection status
    const isProtectionEnabled = statusData.protection_enabled === true;
    
    // Update UI based on protection status
    protectionToggle.checked = isProtectionEnabled;
    
    // Show/hide temporary disable button
    updateTemporaryDisableButton(isProtectionEnabled);
    
    // Store the protection status and connection state
    chrome.storage.local.set({
      isConnected: true,
      protectionEnabled: isProtectionEnabled,
      lastUpdated: new Date().toISOString()
    }, function() {
      // Create status HTML after storage is updated
      createStatusHtml(true, isProtectionEnabled, new Date().toISOString());
    });
  }
  
  // Function to create status HTML
  function createStatusHtml(isConnected, isProtectionEnabled, lastUpdated) {
    const statusArea = document.getElementById('status-area');
    if (!statusArea) return;
    
    statusArea.innerHTML = `
      <div class="status-row">
        <span class="status-label">${getMessage('status')}:</span>
        <span class="status-indicator ${isConnected ? 'connected' : 'disconnected'}">${isConnected ? getMessage('connected') : getMessage('disconnected')}</span>
      </div>
      <div class="status-row">
        <button id="refresh-button">${getMessage('refresh')}</button>
      </div>
    `;
    
    // Add event listener to refresh button
    document.getElementById('refresh-button').addEventListener('click', refreshAll);
  }
  
  // Function to display stats
  function displayStats(statsData) {
    if (!statsData) return;
    
    const statsArea = document.getElementById('stats-area');
    if (!statsArea) return;
    
    displayStatsData(
      statsData.num_dns_queries || 0,
      statsData.num_blocked_filtering || 0,
      statsData.avg_processing_time || 0,
      new Date().toISOString()
    );
  }
  
  // Update displayStatsData to use the stats-area div
  function displayStatsData(queries, blocked, avgTime, lastUpdated) {
    const statsArea = document.getElementById('stats-area');
    
    // Calculate blocking percentage
    const blockingPercentage = queries > 0 ? ((blocked / queries) * 100).toFixed(1) : 0;
    
    statsArea.innerHTML = `
      <div class="stats-box">
        <h2>${getMessage('dnsQueryStatistics')}</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${formatNumber(queries)}</div>
            <div class="stat-label">${getMessage('dnsQueries')}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatNumber(blocked)}</div>
            <div class="stat-label">${getMessage('blockedQueries')}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${blockingPercentage}%</div>
            <div class="stat-label">${getMessage('blockingRate')}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${avgTime ? avgTime.toFixed(2) + 'ms' : 'N/A'}</div>
            <div class="stat-label">${getMessage('avgProcessing')}</div>
          </div>
        </div>
        ${lastUpdated ? `<p class="stats-updated">${getMessage('lastUpdated')}: ${new Date(lastUpdated).toLocaleTimeString()}</p>` : ''}
      </div>
    `;
  }
  
  // Function to display status from storage (modified to use status-area)
  function displayStatusFromStorage() {
    chrome.storage.local.get(['isConnected', 'protectionEnabled', 'lastUpdated'], function(result) {
      // Update toggle switch
      if (protectionToggle) {
        protectionToggle.checked = result.protectionEnabled === true;
      }
      
      // Update temporary disable button
      updateTemporaryDisableButton(result.protectionEnabled === true);
      
      // Create status HTML
      createStatusHtml(
        result.isConnected === true,
        result.protectionEnabled === true,
        result.lastUpdated || null
      );
    });
  }
  
  // Function to refresh all data
  function refreshAll() {
    // Show loading state
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
      const originalButtonText = refreshButton.textContent;
      refreshButton.textContent = getMessage('refreshing');
      refreshButton.disabled = true;
      
      // Refresh status and stats
      chrome.runtime.sendMessage({ action: 'refreshStatus' }, function(response) {
        if (refreshButton) {
          refreshButton.textContent = originalButtonText;
          refreshButton.disabled = false;
        }
        
        if (response && response.success) {
          displayConnectionStatus(response.data);
          fetchAndDisplayStats();
        } else {
          // Failed to refresh
          showErrorNotification(getMessage('failedToRefreshStatus'));
          
          // Show error details if available
          if (response && response.error) {
            showError(getErrorMessage(response.error));
          }
        }
      });
    }
  }
  
  // Fetch and display stats from the API
  function fetchAndDisplayStats() {
    const statsArea = document.getElementById('stats-area');
    if (!statsArea) return;
    
    statsArea.innerHTML = '<p class="loading">Loading stats...</p>';
    
    chrome.runtime.sendMessage({ action: 'refreshStats' }, function(response) {
      if (response && response.success) {
        displayStats(response.data);
      } else {
        // If failed to get fresh stats, try to display stored stats
        displayStatsFromStorage();
        
        // Show error if there is one
        if (response && response.error) {
          showErrorNotification(response.error.message || getMessage('failedToLoadStatistics'));
        }
      }
    });
  }
  
  // Display stats from storage
  function displayStatsFromStorage() {
    chrome.storage.local.get(['stats', 'lastStatsUpdated'], function(result) {
      if (result.stats) {
        displayStatsData(
          result.stats.num_dns_queries || 0,
          result.stats.num_blocked_filtering || 0,
          result.stats.avg_processing_time || 0,
          result.lastStatsUpdated || new Date().toISOString()
        );
      } else {
        // No stats available
        const statsArea = document.getElementById('stats-area');
        if (statsArea) {
          statsArea.innerHTML = '<p class="error">No statistics available</p>';
        }
      }
    });
  }
  
  // Format large numbers with commas
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
  
  /**
   * Localize timer options with appropriate units
   */
  function localizeTimerOptions() {
    timerOptions.forEach(option => {
      const minutes = parseInt(option.getAttribute('data-minutes'), 10);
      if (minutes === 60) {
        option.textContent = `1 ${getMessage('hour')}`;
      } else if (minutes < 60) {
        option.textContent = `${minutes} ${getMessage('minutes')}`;
      } else {
        const hours = minutes / 60;
        option.textContent = `${hours} ${getMessage('hours')}`;
      }
    });
    
    // Also localize the custom minutes input placeholder
    customMinutesInput.placeholder = getMessage('minutes');
  }

  // Animate protection toggle
  function animateProtectionToggle(toggle, isEnabled) {
    if (!toggle) return;
    
    const statusIndicator = document.querySelector('.status-indicator' + (isEnabled ? '.enabled' : '.disabled'));
    if (statusIndicator) {
      // Add pulse animation briefly
      statusIndicator.classList.add('pulse');
      
      // Remove after animation completes
      setTimeout(() => {
        statusIndicator.classList.remove('pulse');
      }, 1500);
    }
    
    // Add ripple effect to toggle container
    const toggleContainer = toggle.closest('.toggle-header');
    if (toggleContainer) {
      toggleContainer.classList.add('ripple');
      
      // Remove ripple class after animation completes
      setTimeout(() => {
        toggleContainer.classList.remove('ripple');
      }, 600);
    }
  }

  // Add shake animation to element
  function animateShake(element) {
    if (!element) return;
    
    element.classList.add('shake');
    
    // Remove class after animation completes
    setTimeout(() => {
      element.classList.remove('shake');
    }, 500);
  }
  
  // Function to open the AdGuard Home dashboard in a new tab
  function openDashboard() {
    // Show loading state
    showErrorNotification(getMessage('openingDashboard'));
    
    // Get the current active instance from background script
    chrome.runtime.sendMessage({ action: 'getActiveInstance' }, function(response) {
      if (response && response.success && response.instance && response.instance.url) {
        // Open the dashboard URL in a new tab
        const dashboardUrl = response.instance.url;
        try {
          // Ensure URL is valid
          new URL(dashboardUrl);
          chrome.tabs.create({ url: dashboardUrl });
        } catch (e) {
          // URL is invalid
          showErrorNotification(getMessage('dashboardUrlInvalid'));
          console.error('Invalid dashboard URL:', dashboardUrl, e);
        }
      } else {
        // Failed to get instance or URL
        showErrorNotification(getMessage('failedToOpenDashboard'));
        console.error('Failed to get dashboard URL:', response);
      }
    });
  }
}); 