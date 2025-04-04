import { AdGuardHomeAPI } from '../api';

// Mock fetch
global.fetch = jest.fn();
global.btoa = jest.fn(() => 'base64encodedstring');

describe('AdGuardHomeAPI', () => {
  let api;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create API instance
    api = new AdGuardHomeAPI('http://localhost:3000', 'admin', 'password');
    
    // Setup fetch mock to return successful response
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  });
  
  test('should construct with correct URL formatting', () => {
    // Without /control suffix
    const api1 = new AdGuardHomeAPI('http://localhost:3000', 'admin', 'password');
    expect(api1.url).toBe('http://localhost:3000/control');
    
    // With /control suffix
    const api2 = new AdGuardHomeAPI('http://localhost:3000/control', 'admin', 'password');
    expect(api2.url).toBe('http://localhost:3000/control');
  });
  
  test('should generate correct auth header', () => {
    api.getAuthHeader();
    expect(btoa).toHaveBeenCalledWith('admin:password');
  });
  
  test('testConnection should call the status endpoint', async () => {
    await api.testConnection();
    
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/control/status', {
      headers: {
        'Authorization': 'Basic base64encodedstring'
      }
    });
  });
  
  test('getStatus should return the response data', async () => {
    const data = await api.getStatus();
    
    expect(data).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/control/status', {
      headers: {
        'Authorization': 'Basic base64encodedstring'
      }
    });
  });
  
  test('toggleProtection should call with correct parameters', async () => {
    await api.toggleProtection(true);
    
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/control/protection', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic base64encodedstring',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enabled: true
      })
    });
  });
}); 