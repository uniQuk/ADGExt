/**
 * Crypto utilities for secure credential storage
 */

// Key used for encryption (in a real-world scenario, this would be derived from user input or other secure means)
const STORAGE_KEY_NAME = 'adg_storage_key';

/**
 * Generate a random encryption key
 * @returns {Promise<CryptoKey>} The generated encryption key
 */
async function generateEncryptionKey() {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to raw bytes
 * @param {CryptoKey} key - The key to export
 * @returns {Promise<ArrayBuffer>} The exported key
 */
async function exportKey(key) {
  return await crypto.subtle.exportKey('raw', key);
}

/**
 * Import a raw key
 * @param {ArrayBuffer} rawKey - The raw key data
 * @returns {Promise<CryptoKey>} The imported key
 */
async function importKey(rawKey) {
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create the encryption key
 * @returns {Promise<CryptoKey>} The encryption key
 */
async function getEncryptionKey() {
  // Check if we have a stored key
  const result = await chrome.storage.local.get([STORAGE_KEY_NAME]);
  
  if (result[STORAGE_KEY_NAME]) {
    // Convert from base64 to ArrayBuffer
    const rawKey = base64ToArrayBuffer(result[STORAGE_KEY_NAME]);
    return await importKey(rawKey);
  } else {
    // Generate a new key
    const key = await generateEncryptionKey();
    
    // Export and store the key
    const rawKey = await exportKey(key);
    const base64Key = arrayBufferToBase64(rawKey);
    
    await chrome.storage.local.set({
      [STORAGE_KEY_NAME]: base64Key
    });
    
    return key;
  }
}

/**
 * Encrypt a string
 * @param {string} data - The data to encrypt
 * @returns {Promise<string>} The encrypted data as a base64 string
 */
async function encrypt(data) {
  try {
    const key = await getEncryptionKey();
    
    // Generate a random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encodedData = new TextEncoder().encode(data);
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );
    
    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encryptedData.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedData), iv.length);
    
    // Convert to base64 for storage
    return arrayBufferToBase64(result);
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedData - The encrypted data as a base64 string
 * @returns {Promise<string>} The decrypted data
 */
async function decrypt(encryptedData) {
  try {
    if (!encryptedData) return null;
    
    const key = await getEncryptionKey();
    
    // Convert from base64
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    
    // Extract IV (first 12 bytes)
    const iv = encryptedBuffer.slice(0, 12);
    
    // Extract encrypted data (everything after IV)
    const data = encryptedBuffer.slice(12);
    
    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );
    
    // Convert to string
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - The buffer to convert
 * @returns {string} The base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 * @param {string} base64 - The base64 string to convert
 * @returns {ArrayBuffer} The array buffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Export the crypto functions
export { encrypt, decrypt }; 