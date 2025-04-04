document.addEventListener('DOMContentLoaded', function() {
  // Get references to DOM elements
  const connectForm = document.getElementById('connect-form');
  const connectionForm = document.getElementById('connection-form');
  const statsContainer = document.getElementById('stats-container');
  
  // Check if we have saved connection settings
  chrome.storage.local.get(['adguardUrl', 'adguardUsername'], function(result) {
    if (result.adguardUrl && result.adguardUsername) {
      // If we have saved settings, try to connect automatically
      // This would be implemented in Phase 1.4
    }
  });
  
  // Handle form submission
  connectForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Get form values
    const url = document.getElementById('url').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate URL format
    if (!isValidUrl(url)) {
      alert('Please enter a valid URL (including http:// or https://)');
      return;
    }
    
    // Show loading state
    const connectButton = document.getElementById('connect-button');
    const originalButtonText = connectButton.textContent;
    connectButton.textContent = 'Connecting...';
    connectButton.disabled = true;
    
    // Save connection details (credentials saving will be improved in Phase 1.8)
    chrome.storage.local.set({
      adguardUrl: url,
      adguardUsername: username,
      adguardPassword: password // Note: We'll improve secure storage in Phase 1.8
    }, function() {
      console.log('Connection details saved');
      
      // In Phase 1.4, we'll implement actual connection here
      // For now, we'll just simulate a successful connection
      
      setTimeout(() => {
        // Reset button
        connectButton.textContent = originalButtonText;
        connectButton.disabled = false;
        
        // Switch UI state (would be based on real connection in Phase 1.4)
        connectionForm.classList.add('hidden');
        statsContainer.classList.remove('hidden');
        statsContainer.innerHTML = '<p>Successfully connected. Stats will be displayed in Phase 1.7.</p>';
      }, 1000);
    });
  });
  
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