/**
 * Internationalization utility functions
 */

/**
 * Get localized message by key
 * @param {string} messageName - The name of the message
 * @param {string[]} substitutions - Substitution strings
 * @returns {string} - Localized message
 */
export function getMessage(messageName, substitutions = []) {
  return chrome.i18n.getMessage(messageName, substitutions);
}

/**
 * Localize HTML elements with data-i18n attribute
 * Sets the textContent of elements with data-i18n attribute
 * Sets the placeholder of inputs with data-i18n-placeholder
 * Sets the title of elements with data-i18n-title
 */
export function localizeHtml() {
  // Localize text content
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const messageName = element.getAttribute('data-i18n');
    const message = getMessage(messageName);
    if (message) {
      element.textContent = message;
    }
  });

  // Localize placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const messageName = element.getAttribute('data-i18n-placeholder');
    const message = getMessage(messageName);
    if (message) {
      element.placeholder = message;
    }
  });

  // Localize titles
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const messageName = element.getAttribute('data-i18n-title');
    const message = getMessage(messageName);
    if (message) {
      element.title = message;
    }
  });

  // Localize buttons
  document.querySelectorAll('button[data-i18n-value]').forEach(element => {
    const messageName = element.getAttribute('data-i18n-value');
    const message = getMessage(messageName);
    if (message) {
      element.value = message;
    }
  });

  // Localize options
  document.querySelectorAll('option[data-i18n]').forEach(element => {
    const messageName = element.getAttribute('data-i18n');
    const message = getMessage(messageName);
    if (message) {
      element.textContent = message;
    }
  });
}

/**
 * Get formatted message with substitutions
 * @param {string} messageName - The name of the message
 * @param {object} substitutions - Key-value pairs for substitutions
 * @returns {string} - Formatted message
 */
export function getFormattedMessage(messageName, substitutions = {}) {
  const message = getMessage(messageName);
  if (!message) return '';
  
  let formattedMessage = message;
  for (const [key, value] of Object.entries(substitutions)) {
    formattedMessage = formattedMessage.replace(`$${key}$`, value);
  }
  
  return formattedMessage;
}

/**
 * Create an element with localized text
 * @param {string} tag - HTML tag name
 * @param {string} i18nKey - Internationalization key
 * @param {object} attributes - Additional attributes for the element
 * @returns {HTMLElement} - Created element
 */
export function createLocalizedElement(tag, i18nKey, attributes = {}) {
  const element = document.createElement(tag);
  
  // Set text content if i18nKey is provided
  if (i18nKey) {
    element.textContent = getMessage(i18nKey);
  }
  
  // Set additional attributes
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  
  return element;
}

/**
 * Format a date using the user's locale
 * @param {Date|string} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date
 */
export function formatDate(date, options = {}) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(navigator.language, options).format(dateObj);
}

/**
 * Format a number using the user's locale
 * @param {number} number - Number to format
 * @param {object} options - Intl.NumberFormat options
 * @returns {string} - Formatted number
 */
export function formatNumber(number, options = {}) {
  return new Intl.NumberFormat(navigator.language, options).format(number);
} 