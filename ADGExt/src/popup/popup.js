import './popup.css';

document.addEventListener('DOMContentLoaded', function() {
  // Get references to DOM elements
  const connectForm = document.getElementById('connect-form');
  const connectionForm = document.getElementById('connection-form');
  const statsContainer = document.getElementById('stats-container');
  const urlInput = document.getElementById('url');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const rememberCheckbox = document.getElementById('remember');
  const connectButton = document.getElementById('connect-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const connectionError = document.getElementById('connection-error');
  
  // Error message elements
  const urlError = document.getElementById('url-error');
  const usernameError = document.getElementById('username-error');
  const passwordError = document.getElementById('password-error');
  
  // Load saved values if they exist
  loadSavedFormValues();
  
  // Check if we have saved connection settings and auto-connect
  function loadSavedFormValues() {
    chrome.storage.local.get(['adguardUrl', 'adguardUsername', 'adguardPassword', 'rememberCredentials'], function(result) {
      if (result.adguardUrl) {
        urlInput.value = result.adguardUrl;
      }
      
      if (result.adguardUsername) {
        usernameInput.value = result.adguardUsername;
      }
      
      if (result.adguardPassword && result.rememberCredentials) {
        passwordInput.value = result.adguardPassword;
      }
      
      if (result.rememberCredentials !== undefined) {
        rememberCheckbox.checked = result.rememberCredentials;
      }
      
      // If we have all the connection details, we could auto-connect
      // but we'll implement that in Phase 1.4
    });
  }
  
  // Handle form submission
  connectForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Reset error messages
    resetErrorMessages();
    
    // Get form values
    const url = urlInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const remember = rememberCheckbox.checked;
    
    // Validate form
    if (!validateForm(url, username, password)) {
      return;
    }
    
    // Show loading state
    connectButton.classList.add('loading');
    connectButton.disabled = true;
    connectButton.textContent = 'Connecting...';
    
    // Save connection details
    const saveData = {
      adguardUrl: url,
      adguardUsername: username,
      rememberCredentials: remember
    };
    
    // Only save password if remember is checked
    if (remember) {
      saveData.adguardPassword = password;
    }
    
    chrome.storage.local.set(saveData, function() {
      // In Phase 1.4, we'll implement actual connection here
      // For now, we'll just simulate a successful connection
      
      setTimeout(() => {
        simulateConnection(url, username, password);
      }, 1000);
    });
  });
  
  // Handle disconnect button
  disconnectButton.addEventListener('click', function() {
    // Reset UI state
    statsContainer.classList.add('hidden');
    connectionForm.classList.remove('hidden');
    
    // In Phase 1.4, we'll implement actual disconnection
    
    // Reset form if remember is not checked
    if (!rememberCheckbox.checked) {
      connectForm.reset();
    }
  });
  
  // Input validation listeners
  urlInput.addEventListener('input', function() {
    validateUrl(this.value.trim());
  });
  
  usernameInput.addEventListener('input', function() {
    validateUsername(this.value.trim());
  });
  
  passwordInput.addEventListener('input', function() {
    validatePassword(this.value);
  });
  
  // Form validation
  function validateForm(url, username, password) {
    const isUrlValid = validateUrl(url);
    const isUsernameValid = validateUsername(username);
    const isPasswordValid = validatePassword(password);
    
    return isUrlValid && isUsernameValid && isPasswordValid;
  }
  
  function validateUrl(url) {
    if (!url) {
      showError(urlError, 'Server URL is required');
      return false;
    }
    
    if (!isValidUrl(url)) {
      showError(urlError, 'Please enter a valid URL (including http:// or https://)');
      return false;
    }
    
    clearError(urlError);
    return true;
  }
  
  function validateUsername(username) {
    if (!username) {
      showError(usernameError, 'Username is required');
      return false;
    }
    
    clearError(usernameError);
    return true;
  }
  
  function validatePassword(password) {
    if (!password) {
      showError(passwordError, 'Password is required');
      return false;
    }
    
    clearError(passwordError);
    return true;
  }
  
  function showError(element, message) {
    element.textContent = message;
  }
  
  function clearError(element) {
    element.textContent = '';
  }
  
  function resetErrorMessages() {
    clearError(urlError);
    clearError(usernameError);
    clearError(passwordError);
    clearError(connectionError);
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
  
  // Simulate successful connection (for development)
  function simulateConnection(url, username, password) {
    // Reset button state
    connectButton.classList.remove('loading');
    connectButton.disabled = false;
    connectButton.textContent = 'Connect';
    
    // For now, always simulate success
    const success = true;
    
    if (success) {
      // Switch UI state
      connectionForm.classList.add('hidden');
      statsContainer.classList.remove('hidden');
      document.getElementById('status-value').textContent = 'Connected';
    } else {
      // Show error message
      showError(connectionError, 'Connection failed. Please check your credentials and try again.');
    }
  }
}); 