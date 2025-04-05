/**
 * settings-fix.js
 * Fixes issues with settings saving and retrieval in Cresonia AI
 * Especially focused on proper Google API credential handling
 */

/**
 * Improved saveSettings function that ensures all settings are properly saved
 * This correctly handles Google credentials
 */
function saveSettings() {
    console.log("Saving settings...");
    
    // Get all the settings fields
    const apiKey = document.getElementById('apiKey')?.value || '';
    const siteUrl = document.getElementById('siteUrl')?.value || '';
    const siteName = document.getElementById('siteName')?.value || '';
    const modelSelect = document.getElementById('model')?.value || 'openai/gpt-4o';
    const evalModel = document.getElementById('defaultEvaluationModel')?.value || 'deepseek/deepseek-chat:free';
    const googleApiKey = document.getElementById('googleApiKey')?.value || '';
    const googleClientId = document.getElementById('googleClientId')?.value || '';
    const styleGuide = document.getElementById('styleGuide')?.value || '';
    
    // Create the settings object
    const settings = {
        apiKey,
        siteUrl,
        siteName,
        model: modelSelect,
        defaultEvaluationModel: evalModel,
        googleApiKey,
        googleClientId,
        styleGuide
    };
    
    // Save to localStorage and StorageService if available
    localStorage.setItem('cresonia-settings', JSON.stringify(settings));
    
    if (typeof StorageService !== 'undefined' && StorageService.saveSettings) {
        StorageService.saveSettings(settings);
    }
    
    // Show confirmation
    const settingsStatus = document.getElementById('settingsStatus');
    if (settingsStatus) {
        settingsStatus.textContent = 'Settings saved!';
        setTimeout(() => {
            settingsStatus.textContent = '';
        }, 3000);
    }
    
    // Update Google Docs service with new credentials if available
    if (typeof GoogleDocsService !== 'undefined') {
        const credentialsChanged = 
            GoogleDocsService.API_KEY !== settings.googleApiKey || 
            GoogleDocsService.CLIENT_ID !== settings.googleClientId;
            
        if (credentialsChanged) {
            GoogleDocsService.API_KEY = settings.googleApiKey;
            GoogleDocsService.CLIENT_ID = settings.googleClientId;
            
            // Reinitialize if needed
            if (GoogleDocsService.initialize) {
                GoogleDocsService.initialize().catch(error => {
                    console.error('Error reinitializing Google Docs service:', error);
                });
            }
        }
        
        // Update credential status display if the function exists
        if (window.settingsComponent && window.settingsComponent.updateGoogleCredentialStatus) {
            window.settingsComponent.updateGoogleCredentialStatus(settings);
        } else {
            // Update credential status directly
            updateGoogleCredentialStatus(settings);
        }
    }
    
    console.log("Settings saved successfully");
    return settings;
}

/**
 * Update Google credential status message visibility 
 */
function updateGoogleCredentialStatus(settings) {
    const noCredentialsMessage = document.getElementById('noCredentialsMessage');
    const connectBtn = document.getElementById('connectGoogleDocs');
    
    if (!noCredentialsMessage || !connectBtn) return;
    
    const hasCredentials = settings.googleApiKey && settings.googleClientId;
    
    noCredentialsMessage.style.display = hasCredentials ? 'none' : 'block';
    connectBtn.disabled = !hasCredentials;
    
    if (!hasCredentials) {
        connectBtn.title = 'API credentials required in Settings';
    } else {
        connectBtn.title = '';
    }
}

/**
 * Initialize settings from storage
 */
function loadSettings() {
    // Get settings from storage
    let settings = {};
    try {
        const storedSettings = localStorage.getItem('cresonia-settings');
        if (storedSettings) {
            settings = JSON.parse(storedSettings);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    
    // Apply settings to form fields
    if (document.getElementById('apiKey')) document.getElementById('apiKey').value = settings.apiKey || '';
    if (document.getElementById('siteUrl')) document.getElementById('siteUrl').value = settings.siteUrl || '';
    if (document.getElementById('siteName')) document.getElementById('siteName').value = settings.siteName || '';
    if (document.getElementById('model')) document.getElementById('model').value = settings.model || 'openai/gpt-4o';
    if (document.getElementById('defaultEvaluationModel')) document.getElementById('defaultEvaluationModel').value = settings.defaultEvaluationModel || 'deepseek/deepseek-chat:free';
    if (document.getElementById('googleApiKey')) document.getElementById('googleApiKey').value = settings.googleApiKey || '';
    if (document.getElementById('googleClientId')) document.getElementById('googleClientId').value = settings.googleClientId || '';
    if (document.getElementById('styleGuide')) document.getElementById('styleGuide').value = settings.styleGuide || '';
    
    // Update status display
    updateGoogleCredentialStatus(settings);
    
    return settings;
}

/**
 * Set up event listeners for settings
 */
function setupSettingsHandlers() {
    const saveSettingsBtn = document.getElementById('saveSettings');
    if (saveSettingsBtn) {
        // Clone and replace to avoid multiple handlers
        const newBtn = saveSettingsBtn.cloneNode(true);
        saveSettingsBtn.parentNode.replaceChild(newBtn, saveSettingsBtn);
        
        // Add our direct handler
        newBtn.addEventListener('click', saveSettings);
    }
    
    // Save style guide
    const saveStyleGuideBtn = document.getElementById('saveStyleGuide');
    if (saveStyleGuideBtn) {
        const newStyleBtn = saveStyleGuideBtn.cloneNode(true);
        saveStyleGuideBtn.parentNode.replaceChild(newStyleBtn, saveStyleGuideBtn);
        
        newStyleBtn.addEventListener('click', () => {
            const styleGuide = document.getElementById('styleGuide')?.value || '';
            
            // Get current settings and update style guide
            const settings = typeof StorageService !== 'undefined' ? 
                   StorageService.getSettings() : 
                   JSON.parse(localStorage.getItem('cresonia-settings') || '{}');
            
            settings.styleGuide = styleGuide;
            
            // Save updated settings
            localStorage.setItem('cresonia-settings', JSON.stringify(settings));
            if (typeof StorageService !== 'undefined' && StorageService.saveSettings) {
                StorageService.saveSettings(settings);
            }
            
            // Show feedback
            const originalText = newStyleBtn.textContent;
            newStyleBtn.textContent = 'Saved!';
            setTimeout(() => {
                newStyleBtn.textContent = originalText;
            }, 2000);
        });
    }
}

// Initialize the settings fix when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Settings Fix: Initializing...');
    loadSettings();
    setupSettingsHandlers();
    console.log('Settings Fix: Initialized successfully');
});
