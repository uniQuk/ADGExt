import { localizeHtml, getMessage, getFormattedMessage, formatDate, formatNumber } from '../src/utils/i18n.js';
import { initializeTheme } from '../src/utils/theme.js';

document.addEventListener('DOMContentLoaded', function() {
  // Localize HTML elements
  localizeHtml();
  
  // Apply theme settings 
  initializeTheme();
  
  // Get references to DOM elements
  const connectForm = document.getElementById('connect-form');
  const connectionForm = document.getElementById('connection-form');
  const statsContainer = document.getElementById('stats-container');
  const protectionToggle = document.getElementById('protection-toggle');
  const tempDisableBtn = document.getElementById('temp-disable-btn');
  const disableDropdown = document.getElementById('disable-dropdown');
  const disableOptions = document.querySelectorAll('.disable-option');
  
  // References to old UI elements that might not exist anymore
  const timerModal = document.getElementById('timer-modal');
  const timerOptions = document.querySelectorAll('.timer-option');
  const cancelTimerSelectionBtn = document.getElementById('cancel-timer-selection');
  const applyCustomTimerBtn = document.getElementById('apply-custom-timer');
  const customMinutesInput = document.getElementById('custom-minutes');
  const cancelTimerBtn = document.getElementById('cancel-timer-btn');
  
  const settingsButton = document.getElementById('settings-button');
  const refreshButton = document.getElementById('refresh-button');
  const logoutButton = document.getElementById('logout-button');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  
  // Only call this if we're using the old timer UI
  if (timerOptions && timerOptions.length > 0) {
    localizeTimerOptions();
  }
  
  // Add event listener for settings button
  settingsButton.addEventListener('click', function() {
    window.location.href = '../settings/settings.html';
  });
  
  // Add event listener for logout button
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      logoutUser();
    });
  }
  
  // Add event listener for open dashboard button
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', openDashboard);
  }
  
  // Check if we have saved connection settings and try to connect
  checkConnectionStatus();
  
  // Add event listener for protection toggle
  protectionToggle.addEventListener('change', toggleProtection);
  
  // Add event listener for refresh button
  if (refreshButton) {
    refreshButton.addEventListener('click', function() {
      refreshStatus();
    });
  }
  
  // Add event listener for temporary disable button
  if (tempDisableBtn) {
    tempDisableBtn.addEventListener('click', function() {
      if (tempDisableBtn.classList.contains('counting')) {
        // If already disabled, clicking again should cancel
        cancelTemporaryDisable();
      } else {
        // Toggle dropdown visibility
        disableDropdown.classList.toggle('hidden');
      }
    });
  }
  
  // Add event listeners for disable options
  disableOptions.forEach(option => {
    option.addEventListener('click', function() {
      const seconds = parseInt(this.getAttribute('data-seconds'), 10);
      disableTemporarily(seconds);
      disableDropdown.classList.add('hidden');
    });
  });
  
  // Close dropdown when clicking elsewhere
  document.addEventListener('click', function(event) {
    if (!tempDisableBtn.contains(event.target) && !disableDropdown.contains(event.target)) {
      disableDropdown.classList.add('hidden');
    }
  });
  
  // Only add event listeners for old timer UI elements if they exist
  if (timerOptions && timerOptions.length > 0) {
    // Add event listeners for timer option buttons
    timerOptions.forEach(option => {
      option.addEventListener('click', function() {
        const minutes = parseInt(this.getAttribute('data-minutes'), 10);
        disableTemporarily(minutes);
      });
    });
  }
  
  // Only add event listener if the element exists
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
  
  // Only add event listener if the element exists
  if (cancelTimerSelectionBtn) {
    cancelTimerSelectionBtn.addEventListener('click', hideTimerModal);
  }
  
  // Only add event listener if the element exists
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
    // Always ensure the settings button is accessible
    settingsButton.addEventListener('click', function() {
      window.location.href = '../settings/settings.html';
    });

    // Check if we have saved credentials
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
            // Not connected, show connection form with saved URL
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
  function disableTemporarily(seconds) {
    // Convert seconds to minutes for the API call
    const minutes = seconds / 60;
    
    // Update UI immediately to provide feedback
    tempDisableBtn.classList.add('counting');
    const endTime = new Date(Date.now() + (seconds * 1000));
    startCountdown(endTime);
    
    // Show status notification
    showErrorNotification(getMessage('disablingTemporarily') || 'Disabling protection temporarily...');
    
    // Send message to background script to disable protection temporarily
    chrome.runtime.sendMessage({
      action: 'disableTemporarily',
      minutes: minutes
    }, function(response) {
      if (response && response.success) {
        console.log(`Protection temporarily disabled for ${minutes} minutes`);
        
        // Update protection toggle to reflect state
        protectionToggle.checked = false;
        
        // Update connection status display
        if (response.data) {
          displayConnectionStatus(response.data);
        } else {
          // If no data returned, update local state
          updateProtectionStatus(false);
        }
        
        // Show success notification
        showSuccessNotification(getMessage('temporarilyDisabled') || 'Protection temporarily disabled');
      } else {
        // Clear the counting state if failed
        tempDisableBtn.classList.remove('counting');
        tempDisableBtn.textContent = getMessage('disableTemporarily');
        
        // Show error notification
        showErrorNotification(response?.error?.message || getMessage('failedToDisable'));
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
    // Update the button text with time remaining
    updateRemainingTime(endTime);
    
    // Update the countdown every second
    const countdownInterval = setInterval(function() {
      const shouldContinue = updateRemainingTime(endTime);
      if (!shouldContinue) {
        clearInterval(countdownInterval);
      }
    }, 1000);
    
    // Store the interval ID to clear if needed
    tempDisableBtn.dataset.countdownInterval = countdownInterval;
  }
  
  // New function to update the time remaining on the button
  function updateRemainingTime(endTime) {
    const now = Date.now();
    const timeLeft = endTime - now;
    
    if (timeLeft <= 0) {
      // Time is up, reset the button
      tempDisableBtn.textContent = getMessage('disableTemporarily');
      tempDisableBtn.classList.remove('counting');
      return false;
    }
    
    // Format the time left
    const formattedTime = formatTimeLeft(timeLeft);
    
    // Update the button text
    tempDisableBtn.textContent = `${getMessage('enableIn')} ${formattedTime}`;
    return true;
  }
  
  // Helper function to format time left
  function formatTimeLeft(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      return `${days}d ${hours}h`;
    }
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
    // Update UI immediately to provide feedback
    tempDisableBtn.textContent = getMessage('disableTemporarily');
    tempDisableBtn.classList.remove('counting');
    
    // Clear the countdown interval
    if (tempDisableBtn.dataset.countdownInterval) {
      clearInterval(tempDisableBtn.dataset.countdownInterval);
    }
    
    // Show status notification
    showErrorNotification(getMessage('reEnablingProtection') || 'Re-enabling protection...');
    
    chrome.runtime.sendMessage({ action: 'cancelTemporaryDisable' }, function(response) {
      if (response && response.success) {
        // Update protection toggle to reflect state
        protectionToggle.checked = true;
        
        // Update connection status display
        if (response.data) {
          displayConnectionStatus(response.data);
        } else {
          // If no data returned, update local state
          updateProtectionStatus(true);
        }
        
        // Show success notification
        showSuccessNotification(getMessage('protectionReEnabled') || 'Protection re-enabled');
      } else {
        // Restore the counting state if failed
        checkTemporaryDisableStatus();
        
        // Show error notification
        showErrorNotification(response?.error?.message || getMessage('failedToCancelDisable'));
      }
    });
  }

  // Function to check if protection is temporarily disabled
  function checkTemporaryDisableStatus() {
    chrome.runtime.sendMessage({ action: 'getTemporaryDisableStatus' }, function(response) {
      const tempDisableContainer = document.querySelector('.temporary-disable');
      
      if (response && response.isTemporarilyDisabled && response.endTime) {
        console.log('Protection is temporarily disabled until:', response.endTime);
        
        // Protection is temporarily disabled
        // 1. Update the toggle to show protection is off
        protectionToggle.checked = false;
        
        // 2. Show the temporary disable button
        if (tempDisableContainer) {
          tempDisableContainer.classList.remove('hidden');
        }
        
        // 3. Set the button to counting state
        tempDisableBtn.classList.add('counting');
        
        // 4. Parse the end time if it's a string
        const endTime = typeof response.endTime === 'string' 
          ? new Date(response.endTime) 
          : response.endTime;
          
        // 5. Start the countdown with the current end time
        startCountdown(endTime);
        
        // 6. Update the status area to reflect protection is off
        chrome.storage.local.get(['lastUpdated'], function(result) {
          createStatusHtml(true, false, result.lastUpdated || new Date().toISOString());
        });
      } else {
        console.log('Protection is not temporarily disabled');
        
        // Get current protection status from storage
        chrome.storage.local.get(['protectionEnabled', 'lastUpdated'], function(result) {
          const isProtectionEnabled = result.protectionEnabled === true;
          
          // 1. Update the toggle to match stored protection state
          protectionToggle.checked = isProtectionEnabled;
          
          // 2. Show/hide the temporary disable button based on protection state
          if (tempDisableContainer) {
            if (isProtectionEnabled) {
              tempDisableContainer.classList.remove('hidden');
            } else {
              tempDisableContainer.classList.add('hidden');
            }
          }
          
          // 3. Reset the button to normal state
          tempDisableBtn.classList.remove('counting');
          tempDisableBtn.textContent = getMessage('disableTemporarily');
          
          // 4. Clear any existing interval
          if (tempDisableBtn.dataset.countdownInterval) {
            clearInterval(tempDisableBtn.dataset.countdownInterval);
          }
          
          // 5. Update the status area
          createStatusHtml(true, isProtectionEnabled, result.lastUpdated || new Date().toISOString());
        });
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
    
    // Update UI immediately to provide feedback
    updateTemporaryDisableButton(isEnabled);
    
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
        
        // Refresh stats
        fetchAndDisplayStats();
        
        // If disabling protection while in temporary disable mode, update button state
        if (!isEnabled) {
          checkTemporaryDisableStatus();
        }
      } else {
        // Show error notification
        showErrorNotification(getMessage('failedToToggleProtection'));
        
        // Revert toggle to previous state
        protectionToggle.checked = !isEnabled;
        
        // Add shake animation to the toggle
        animateShake(protectionToggle.closest('.toggle-switch'));
        
        // Restore previous UI state
        updateTemporaryDisableButton(!isEnabled);
        
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
    
    if (tempDisableContainer) {
      // Show the disable container if protection is enabled or we're in a temporarily disabled state
      chrome.runtime.sendMessage({ action: 'getTemporaryDisableStatus' }, function(response) {
        const isTemporarilyDisabled = response && response.isTemporarilyDisabled;
        
        if (isProtectionEnabled) {
          // Protection is enabled - show the disable button
          tempDisableContainer.classList.remove('hidden');
          tempDisableBtn.classList.remove('counting');
          tempDisableBtn.textContent = getMessage('disableTemporarily');
        } else if (isTemporarilyDisabled) {
          // Protection is temporarily disabled - show countdown
          tempDisableContainer.classList.remove('hidden');
          tempDisableBtn.classList.add('counting');
          
          // Parse the end time if it's a string
          const endTime = typeof response.endTime === 'string' 
            ? new Date(response.endTime) 
            : response.endTime;
          
          // Start the countdown
          startCountdown(endTime);
        } else {
          // Protection is permanently disabled - hide the button
          tempDisableContainer.classList.add('hidden');
        }
      });
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
    `;
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
    `;
    
    // Update last updated text
    const statsUpdated = document.getElementById('stats-updated');
    if (statsUpdated && lastUpdated) {
      statsUpdated.textContent = `${getMessage('lastUpdated')}: ${new Date(lastUpdated).toLocaleTimeString()}`;
    }
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
    // Skip if the timer options no longer exist in the DOM
    if (!timerOptions || timerOptions.length === 0) {
      return;
    }
    
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
    
    // Only set placeholder if the element exists
    if (customMinutesInput) {
      customMinutesInput.placeholder = getMessage('minutes');
    }
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

  // Update the refreshStatus function to add more feedback
  function refreshStatus() {
    // Show loading state on the refresh button
    if (refreshButton) {
      refreshButton.classList.add('loading');
      refreshButton.disabled = true;
    }
    
    chrome.runtime.sendMessage({ action: 'refreshStatus' }, function(response) {
      // Reset refresh button state
      if (refreshButton) {
        refreshButton.classList.remove('loading');
        refreshButton.disabled = false;
      }
      
      if (response && response.success) {
        displayConnectionStatus(response.data);
        fetchAndDisplayStats();
      } else {
        handleConnectionError(response?.error || { message: getMessage('failedToRefreshStatus') });
      }
    });
  }

  /**
   * Logout the user by disconnecting from the current instance
   */
  function logoutUser() {
    chrome.runtime.sendMessage({ action: 'disconnect' }, function() {
      // Show connection form and hide stats
      connectionForm.classList.remove('hidden');
      statsContainer.classList.add('hidden');
      
      // Reset form fields for security
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      
      // Keep the URL field as it might be useful for reconnecting
      
      // Show success message
      showSuccessNotification(getMessage('loggedOut') || 'Successfully logged out');
    });
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    // Handle auto re-enable message
    if (message.action === 'protectionAutoReEnabled') {
      console.log('Protection was automatically re-enabled, refreshing UI');
      
      // Re-fetch status and refresh the UI
      refreshStatus();
      
      // Show notification if we're on the popup page
      showSuccessNotification(getMessage('protectionAutoReEnabled') || 'Protection has been automatically re-enabled');
    }
  });
}); 