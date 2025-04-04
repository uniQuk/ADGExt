/**
 * AdGuard Home Manager Settings
 * Handles multiple instance management and user preferences
 */
import { localizeHtml, getMessage, getFormattedMessage, createLocalizedElement } from '../src/utils/i18n.js';
import { initializeTheme, applyTheme, saveThemePreference as saveTheme } from '../src/utils/theme.js';

// DOM Elements
const backButton = document.getElementById('btnBack');
const instanceList = document.getElementById('instanceList');
const addInstanceButton = document.getElementById('btnAddInstance');
const instanceModal = document.getElementById('instanceModal');
const modalClose = document.querySelector('.close');
const instanceForm = document.getElementById('instanceForm');
const modalTitle = document.getElementById('modalTitle');
const instanceIdInput = document.getElementById('instanceId');
const instanceNameInput = document.getElementById('instanceName');
const instanceUrlInput = document.getElementById('instanceUrl');
const instanceUsernameInput = document.getElementById('instanceUsername');
const instancePasswordInput = document.getElementById('instancePassword');
const saveInstanceButton = document.getElementById('btnSaveInstance');
const cancelInstanceButton = document.getElementById('btnCancelInstance');
const themeSelector = document.getElementById('themeSelector');
const refreshIntervalSelect = document.getElementById('refreshInterval');
const showNotificationsCheckbox = document.getElementById('showNotifications');

// State
let instances = [];
let currentInstanceId = null;
let editMode = false;

// Initialize settings page
document.addEventListener('DOMContentLoaded', () => {
    // Localize HTML elements
    localizeHtml();
    
    // Apply theme settings
    initializeTheme();
    
    // Set up refresh interval options with localized text
    setupRefreshIntervalOptions();
    
    // Load data and set up event listeners
    loadInstances();
    loadPreferences();
    setupEventListeners();
});

/**
 * Set up localized refresh interval options
 */
function setupRefreshIntervalOptions() {
    // Get existing options
    const options = Array.from(refreshIntervalSelect.options);
    
    // Skip the first option (Disabled) as it's already localized via data-i18n
    for (let i = 1; i < options.length; i++) {
        const option = options[i];
        const value = parseInt(option.value);
        
        if (value === 60) {
            option.textContent = `1 ${getMessage('minute')}`;
        } else if (value < 60) {
            option.textContent = `${value} ${getMessage('seconds')}`;
        } else {
            const minutes = value / 60;
            option.textContent = `${minutes} ${getMessage('minutes')}`;
        }
    }
}

/**
 * Set up all event listeners for the settings page
 */
function setupEventListeners() {
    // Navigation
    backButton.addEventListener('click', () => {
        window.location.href = '../popup/popup.html';
    });

    // Instance management
    addInstanceButton.addEventListener('click', openAddInstanceModal);
    modalClose.addEventListener('click', closeInstanceModal);
    cancelInstanceButton.addEventListener('click', closeInstanceModal);
    instanceForm.addEventListener('submit', saveInstance);

    // Preferences
    themeSelector.addEventListener('change', saveThemePreference);
    refreshIntervalSelect.addEventListener('change', saveRefreshInterval);
    showNotificationsCheckbox.addEventListener('change', saveNotificationPreference);

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === instanceModal) {
            closeInstanceModal();
        }
    });
}

/**
 * Load instances from storage and populate the list
 */
function loadInstances() {
    chrome.storage.sync.get('adguardInstances', (data) => {
        instances = data.adguardInstances || [];
        renderInstanceList();
        
        // Check if there's an active instance
        chrome.storage.sync.get('activeInstance', (data) => {
            currentInstanceId = data.activeInstance || null;
        });
    });
}

/**
 * Render the list of instances in the UI
 */
function renderInstanceList() {
    instanceList.innerHTML = '';
    
    if (instances.length === 0) {
        const noInstancesElement = createLocalizedElement('div', 'noInstances', {
            className: 'no-instances'
        });
        instanceList.appendChild(noInstancesElement);
        return;
    }
    
    instances.forEach((instance, index) => {
        const instanceElement = document.createElement('div');
        instanceElement.classList.add('instance-item');
        
        if (instance.id === currentInstanceId) {
            instanceElement.classList.add('active-instance');
        }
        
        instanceElement.innerHTML = `
            <div class="instance-info">
                <div class="instance-name">${instance.name}</div>
                <div class="instance-url">${instance.url}</div>
            </div>
            <div class="instance-actions">
                <button class="btn-edit ripple" data-id="${instance.id}">✏️</button>
                <button class="btn-delete ripple" data-id="${instance.id}">🗑️</button>
            </div>
        `;
        
        instanceList.appendChild(instanceElement);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', () => openEditInstanceModal(button.dataset.id));
    });
    
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', () => deleteInstance(button.dataset.id));
    });
    
    // Make instances selectable
    document.querySelectorAll('.instance-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Ignore clicks on buttons
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            
            const instanceId = item.querySelector('.btn-edit').dataset.id;
            setActiveInstance(instanceId);
        });
        
        // Add a simple hover effect without scaling
        item.addEventListener('mouseenter', () => {
            if (!item.classList.contains('active-instance')) {
                item.classList.add('hover');
            }
        });
        
        item.addEventListener('mouseleave', () => {
            item.classList.remove('hover');
        });
    });
}

/**
 * Set an instance as active
 * @param {string} instanceId - ID of the instance to set as active
 */
function setActiveInstance(instanceId) {
    currentInstanceId = instanceId;
    chrome.storage.sync.set({ activeInstance: instanceId }, () => {
        // Also message the background script to switch active instance
        chrome.runtime.sendMessage({ 
            action: 'switchActiveInstance',
            instanceId: instanceId
        });
        renderInstanceList();
    });
}

/**
 * Open the modal to add a new instance
 */
function openAddInstanceModal() {
    editMode = false;
    modalTitle.textContent = getMessage('addInstance');
    instanceIdInput.value = '';
    instanceForm.reset();
    
    // Add animation classes
    instanceModal.classList.add('fade-in');
    instanceModal.style.display = 'block';
    
    // Animate modal content
    const modalContent = instanceModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.add('slide-in');
    }
}

/**
 * Open the modal to edit an existing instance
 * @param {string} instanceId - ID of the instance to edit
 */
function openEditInstanceModal(instanceId) {
    editMode = true;
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return;
    
    modalTitle.textContent = getMessage('editInstance');
    instanceIdInput.value = instance.id;
    instanceNameInput.value = instance.name;
    instanceUrlInput.value = instance.url;
    instanceUsernameInput.value = instance.username;
    instancePasswordInput.value = ''; // For security, don't pre-fill password
    
    // Add animation classes
    instanceModal.classList.add('fade-in');
    instanceModal.style.display = 'block';
    
    // Animate modal content
    const modalContent = instanceModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.add('slide-in');
    }
}

/**
 * Close the instance modal with animation
 */
function closeInstanceModal() {
    // Add fade-out animation
    instanceModal.classList.add('fade-out');
    instanceModal.classList.remove('fade-in');
    
    // Animate modal content
    const modalContent = instanceModal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.add('slide-out');
        modalContent.classList.remove('slide-in');
    }
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        instanceModal.style.display = 'none';
        instanceForm.reset();
        
        // Reset animation classes
        instanceModal.classList.remove('fade-out');
        if (modalContent) {
            modalContent.classList.remove('slide-out');
        }
    }, 300); // Match animation duration
}

/**
 * Save instance to storage
 * @param {Event} e - Form submit event
 */
function saveInstance(e) {
    e.preventDefault();
    
    const instanceId = instanceIdInput.value || crypto.randomUUID();
    const instance = {
        id: instanceId,
        name: instanceNameInput.value,
        url: instanceUrlInput.value,
        username: instanceUsernameInput.value
    };
    
    // If password was entered, update it
    if (instancePasswordInput.value) {
        // In a real extension, you'd encrypt this or use a more secure method
        instance.password = instancePasswordInput.value;
    } else if (editMode) {
        // If editing and no password entered, keep the existing one
        const existingInstance = instances.find(inst => inst.id === instanceId);
        if (existingInstance) {
            instance.password = existingInstance.password;
        }
    }
    
    if (editMode) {
        // Update existing instance
        const index = instances.findIndex(inst => inst.id === instanceId);
        if (index !== -1) {
            instances[index] = instance;
        }
    } else {
        // Add new instance
        instances.push(instance);
        
        // If this is the first instance, set it as active
        if (instances.length === 1) {
            currentInstanceId = instance.id;
            chrome.storage.sync.set({ activeInstance: instance.id });
        }
    }
    
    // Save to storage
    chrome.storage.sync.set({ adguardInstances: instances }, () => {
        closeInstanceModal();
        renderInstanceList();
    });
}

/**
 * Delete an instance
 * @param {string} instanceId - ID of the instance to delete
 */
function deleteInstance(instanceId) {
    if (confirm(getMessage('deleteConfirm'))) {
        instances = instances.filter(instance => instance.id !== instanceId);
        
        // If the active instance was deleted, set the first available as active
        if (currentInstanceId === instanceId) {
            currentInstanceId = instances.length > 0 ? instances[0].id : null;
            chrome.storage.sync.set({ activeInstance: currentInstanceId });
        }
        
        // Save to storage
        chrome.storage.sync.set({ adguardInstances: instances }, () => {
            renderInstanceList();
        });
    }
}

/**
 * Load user preferences from storage
 */
function loadPreferences() {
    // Load refresh interval
    chrome.storage.sync.get(['refreshInterval'], (data) => {
        if (data.refreshInterval !== undefined) {
            refreshIntervalSelect.value = data.refreshInterval;
        }
    });
    
    // Load notification preference
    chrome.storage.sync.get(['showNotifications'], (data) => {
        if (data.showNotifications !== undefined) {
            showNotificationsCheckbox.checked = data.showNotifications;
        }
    });
    
    // Load theme preference using our utility
    chrome.storage.local.get(['themePreference'], (data) => {
        if (data.themePreference) {
            themeSelector.value = data.themePreference;
        }
    });
}

/**
 * Save theme preference
 */
function saveThemePreference() {
    const theme = themeSelector.value;
    saveTheme(theme).then(() => {
        // Apply the theme immediately
        applyTheme(theme);
    });
}

/**
 * Save refresh interval preference
 */
function saveRefreshInterval() {
    const refreshInterval = parseInt(refreshIntervalSelect.value);
    chrome.storage.sync.set({ refreshInterval });
}

/**
 * Save notification preference
 */
function saveNotificationPreference() {
    const showNotifications = showNotificationsCheckbox.checked;
    chrome.storage.sync.set({ showNotifications });
}

// Theme selector handling
if (themeSelector) {
    // Load saved theme preference
    chrome.storage.local.get(['themePreference'], function(result) {
        const themePreference = result.themePreference || 'light';
        themeSelector.value = themePreference;
    });
    
    // Save theme preference when changed
    themeSelector.addEventListener('change', function() {
        const theme = themeSelector.value;
        chrome.storage.local.set({ themePreference: theme }, function() {
            // Apply the theme immediately
            applyTheme(theme);
        });
    });
} 