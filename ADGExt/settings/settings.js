/**
 * AdGuard Home Manager Settings
 * Handles multiple instance management and user preferences
 */

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
    loadInstances();
    loadPreferences();
    setupEventListeners();
});

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
        instanceList.innerHTML = '<div class="no-instances">No instances configured yet. Add your first AdGuard Home instance.</div>';
        return;
    }
    
    instances.forEach(instance => {
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
                <button class="btn-edit" data-id="${instance.id}">✏️</button>
                <button class="btn-delete" data-id="${instance.id}">🗑️</button>
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
    });
}

/**
 * Set an instance as active
 * @param {string} instanceId - ID of the instance to set as active
 */
function setActiveInstance(instanceId) {
    currentInstanceId = instanceId;
    chrome.storage.sync.set({ activeInstance: instanceId }, () => {
        renderInstanceList();
    });
}

/**
 * Open the modal to add a new instance
 */
function openAddInstanceModal() {
    editMode = false;
    modalTitle.textContent = 'Add Instance';
    instanceIdInput.value = '';
    instanceForm.reset();
    instanceModal.style.display = 'block';
}

/**
 * Open the modal to edit an existing instance
 * @param {string} instanceId - ID of the instance to edit
 */
function openEditInstanceModal(instanceId) {
    editMode = true;
    const instance = instances.find(inst => inst.id === instanceId);
    if (!instance) return;
    
    modalTitle.textContent = 'Edit Instance';
    instanceIdInput.value = instance.id;
    instanceNameInput.value = instance.name;
    instanceUrlInput.value = instance.url;
    instanceUsernameInput.value = instance.username;
    instancePasswordInput.value = ''; // For security, don't pre-fill password
    
    instanceModal.style.display = 'block';
}

/**
 * Close the instance modal
 */
function closeInstanceModal() {
    instanceModal.style.display = 'none';
    instanceForm.reset();
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
    if (confirm('Are you sure you want to delete this instance?')) {
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
    chrome.storage.sync.get(['theme', 'refreshInterval', 'showNotifications'], (data) => {
        // Theme preference
        const theme = data.theme || 'auto';
        themeSelector.value = theme;
        applyTheme(theme);
        
        // Refresh interval
        const refreshInterval = data.refreshInterval || 0;
        refreshIntervalSelect.value = refreshInterval.toString();
        
        // Notifications
        const showNotifications = data.showNotifications || false;
        showNotificationsCheckbox.checked = showNotifications;
    });
}

/**
 * Save theme preference
 */
function saveThemePreference() {
    const theme = themeSelector.value;
    chrome.storage.sync.set({ theme }, () => {
        applyTheme(theme);
    });
}

/**
 * Apply the selected theme
 * @param {string} theme - Theme to apply (auto, light, dark)
 */
function applyTheme(theme) {
    if (theme === 'auto') {
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.dataset.theme = 'dark';
        } else {
            document.body.dataset.theme = 'light';
        }
        
        // Listen for changes in system preference
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            document.body.dataset.theme = e.matches ? 'dark' : 'light';
        });
    } else {
        document.body.dataset.theme = theme;
    }
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