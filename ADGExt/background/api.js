/**
 * AdGuard Home API Client
 * This class handles communication with the AdGuard Home API
 */
export class AdGuardHomeAPI {
  constructor(url, username, password) {
    // Fix URL handling - AdGuard Home API expects base URL to end with /control
    this.url = this.formatUrl(url);
    this.auth = { username, password };
    console.log('AdGuard Home API initialized with URL:', this.url);
  }

  /**
   * Format the URL correctly for AdGuard Home API
   * @param {string} url - The base URL provided by the user
   * @returns {string} Properly formatted API URL
   */
  formatUrl(url) {
    // Remove trailing slashes
    let formattedUrl = url.trim().replace(/\/+$/, '');
    
    // Check if URL already has /control path
    if (formattedUrl.endsWith('/control')) {
      return formattedUrl;
    }
    
    // Add /control if needed
    return `${formattedUrl}/control`;
  }

  /**
   * Get basic authentication header
   * @returns {string} Basic authentication header
   */
  getAuthHeader() {
    return 'Basic ' + btoa(`${this.auth.username}:${this.auth.password}`);
  }

  /**
   * Handle API errors with more detailed information
   * @param {Error} error - The original error
   * @param {string} operation - The operation that failed
   * @returns {Error} Enhanced error with more details
   */
  handleApiError(error, operation) {
    console.error(`API Error during ${operation}:`, error);
    
    // Check if it's a JSON parsing error
    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      return {
        code: 'PARSE_ERROR',
        message: 'Response format error: The server returned an unexpected format. This might be an API version mismatch.',
        details: error.message,
        operation,
        troubleshooting: [
          'Make sure you are using the correct URL for your AdGuard Home instance',
          'Check if your AdGuard Home version is compatible with this extension',
          'Try updating your AdGuard Home to the latest version'
        ]
      };
    }
    
    // Check if it's a network error
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      // Check for specific CORS-related messages
      if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
        return {
          code: 'CORS_ERROR',
          message: 'CORS policy error: The AdGuard Home server is not allowing requests from this extension. Please check if your AdGuard Home server is correctly configured and accessible.',
          details: error.message,
          operation,
          troubleshooting: [
            'Make sure your URL is correct and includes the protocol (http:// or https://)',
            'Verify that AdGuard Home is running and accessible from your browser directly',
            'Try using the latest version of AdGuard Home which might have better CORS support'
          ]
        };
      }
      
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error: Unable to reach AdGuard Home server. Please check if the server is running and reachable.',
        details: error.message,
        operation
      };
    }
    
    // Check for 401 unauthorized errors
    if (error.message && error.message.includes('401')) {
      return {
        code: 'AUTH_ERROR',
        message: 'Authentication failed: Invalid username or password.',
        details: error.message,
        operation
      };
    }
    
    // Check for 404 not found errors
    if (error.message && error.message.includes('404')) {
      return {
        code: 'NOT_FOUND',
        message: 'API endpoint not found: The URL might be incorrect or AdGuard Home API might have changed.',
        details: error.message,
        operation
      };
    }
    
    // Default error
    return {
      code: 'API_ERROR',
      message: `Error during ${operation}: ${error.message || 'Unknown error'}`,
      details: error.stack || error.message || 'No details available',
      operation
    };
  }

  /**
   * Test connection to AdGuard Home server
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    console.log('Testing connection to AdGuard Home at:', this.url);
    try {
      const response = await fetch(`${this.url}/status`, {
        headers: {
          'Authorization': this.getAuthHeader()
        },
        // Add cache control to prevent cached responses
        cache: 'no-cache',
        // Explicitly set mode to cors
        mode: 'cors'
      });
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown status';
        console.error(`Connection test failed with status: ${response.status} (${statusText})`);
        throw new Error(`HTTP error! Status: ${response.status} (${statusText})`);
      }
      
      const data = await response.json();
      console.log('Connection test successful:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Connection test failed:', error);
      return { 
        success: false,
        error: this.handleApiError(error, 'testing connection')
      };
    }
  }

  /**
   * Get DNS server status and settings
   * @returns {Promise<Object>} Server status object
   */
  async getStatus() {
    console.log('Fetching AdGuard Home status from:', `${this.url}/status`);
    try {
      const response = await fetch(`${this.url}/status`, {
        headers: {
          'Authorization': this.getAuthHeader()
        },
        cache: 'no-cache',
        mode: 'cors'
      });
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown status';
        console.error(`Status fetch failed with status: ${response.status} (${statusText})`);
        throw new Error(`HTTP error! Status: ${response.status} (${statusText})`);
      }
      
      const data = await response.json();
      console.log('Status fetch successful:', data);
      return data;
    } catch (error) {
      console.error('Failed to get status:', error);
      throw this.handleApiError(error, 'fetching status');
    }
  }

  /**
   * Get DNS query statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    console.log('Fetching AdGuard Home stats from:', `${this.url}/stats`);
    try {
      const response = await fetch(`${this.url}/stats`, {
        headers: {
          'Authorization': this.getAuthHeader()
        },
        cache: 'no-cache',
        mode: 'cors'
      });
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown status';
        console.error(`Stats fetch failed with status: ${response.status} (${statusText})`);
        throw new Error(`HTTP error! Status: ${response.status} (${statusText})`);
      }
      
      const data = await response.json();
      console.log('Stats fetch successful:', data);
      return data;
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw this.handleApiError(error, 'fetching statistics');
    }
  }

  /**
   * Toggle protection on/off
   * @param {boolean} enabled - Protection state
   * @returns {Promise<Object>} Response object
   */
  async toggleProtection(enabled) {
    console.log(`Toggling protection to: ${enabled ? 'enabled' : 'disabled'}`);
    try {
      const response = await fetch(`${this.url}/protection`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: enabled
        }),
        cache: 'no-cache',
        mode: 'cors'
      });
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown status';
        console.error(`Toggle protection failed with status: ${response.status} (${statusText})`);
        throw new Error(`HTTP error! Status: ${response.status} (${statusText})`);
      }
      
      // Check content type to determine how to handle the response
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        // Parse as JSON if content type is JSON
        data = await response.json();
      } else {
        // Handle text responses (like "OK")
        const text = await response.text();
        data = { success: true, message: text };
      }
      
      console.log('Toggle protection successful:', data);
      return data;
    } catch (error) {
      console.error('Failed to toggle protection:', error);
      throw this.handleApiError(error, 'toggling protection');
    }
  }

  /**
   * Temporarily disable protection
   * @param {number} minutes - Duration in minutes
   * @returns {Promise<Object>} Response object
   */
  async disableTemporarily(minutes) {
    console.log(`Temporarily disabling protection for ${minutes} minutes`);
    try {
      // Convert minutes to milliseconds for the API
      const durationMs = minutes * 60 * 1000;
      
      const response = await fetch(`${this.url}/protection`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: false,
          duration: durationMs
        }),
        cache: 'no-cache',
        mode: 'cors'
      });
      
      if (!response.ok) {
        const statusText = response.statusText || 'Unknown status';
        console.error(`Temporary disable failed with status: ${response.status} (${statusText})`);
        throw new Error(`HTTP error! Status: ${response.status} (${statusText})`);
      }
      
      // Check content type to determine how to handle the response
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        // Parse as JSON if content type is JSON
        data = await response.json();
      } else {
        // Handle text responses (like "OK")
        const text = await response.text();
        data = { success: true, message: text };
      }
      
      console.log('Temporary disable successful:', data);
      return data;
    } catch (error) {
      console.error('Failed to disable temporarily:', error);
      throw this.handleApiError(error, 'temporarily disabling protection');
    }
  }
} 