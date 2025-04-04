/**
 * Theme utility functions for consistent theme management
 */

/**
 * Apply theme settings to the current document
 * @param {string} theme - 'light', 'dark', or 'auto'
 */
export function applyTheme(theme) {
  const body = document.body;
  
  // Remove all theme classes
  body.classList.remove('light-theme', 'dark-theme', 'auto-theme');
  
  // Apply the preferred theme
  if (theme === 'dark') {
    body.classList.add('dark-theme');
  } else if (theme === 'auto') {
    body.classList.add('auto-theme');
  } else {
    body.classList.add('light-theme');
  }
}

/**
 * Get the current theme preference from storage
 * @returns {Promise<string>} - The theme preference ('light', 'dark', or 'auto')
 */
export function getThemePreference() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['themePreference'], function(result) {
      resolve(result.themePreference || 'light');
    });
  });
}

/**
 * Save theme preference to storage
 * @param {string} theme - 'light', 'dark', or 'auto'
 * @returns {Promise<void>}
 */
export function saveThemePreference(theme) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ themePreference: theme }, resolve);
  });
}

/**
 * Initialize theme by loading from storage and applying
 */
export function initializeTheme() {
  getThemePreference().then(theme => {
    applyTheme(theme);
  });
} 