/**
 * AdGuard Home API Client
 * This class handles communication with the AdGuard Home API
 */
class AdGuardHomeAPI {
  constructor(url, username, password) {
    // Ensure URL ends with /control
    this.url = url.endsWith('/control') ? url : `${url}/control`;
    this.auth = { username, password };
  }

  /**
   * Get basic authentication header
   * @returns {string} Basic authentication header
   */
  getAuthHeader() {
    return 'Basic ' + btoa(`${this.auth.username}:${this.auth.password}`);
  }

  /**
   * Test connection to AdGuard Home server
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.url}/status`, {
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get DNS server status and settings
   * @returns {Promise<Object>} Server status object
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.url}/status`, {
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get status:', error);
      throw error;
    }
  }

  /**
   * Get DNS query statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    try {
      const response = await fetch(`${this.url}/stats`, {
        headers: {
          'Authorization': this.getAuthHeader()
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw error;
    }
  }

  /**
   * Toggle protection on/off
   * @param {boolean} enabled - Protection state
   * @returns {Promise<Object>} Response object
   */
  async toggleProtection(enabled) {
    try {
      const response = await fetch(`${this.url}/protection`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: enabled
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to toggle protection:', error);
      throw error;
    }
  }

  /**
   * Temporarily disable protection
   * @param {number} minutes - Duration in minutes
   * @returns {Promise<Object>} Response object
   */
  async disableTemporarily(minutes) {
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
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to disable temporarily:', error);
      throw error;
    }
  }
} 