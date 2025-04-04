/**
 * Settings.js
 * Handles the application settings functionality
 */
class Settings {
    constructor() {
        this.apiKeyInput = document.getElementById('apiKey');
        this.siteUrlInput = document.getElementById('siteUrl');
        this.siteNameInput = document.getElementById('siteName');
        this.modelSelect = document.getElementById('model');
        this.evaluationModelSelect = document.getElementById('defaultEvaluationModel');
        this.googleApiKeyInput = document.getElementById('googleApiKey');
        this.styleGuideInput = document.getElementById('styleGuide');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        this.saveStyleGuideBtn = document.getElementById('saveStyleGuide');
        this.settingsStatus = document.getElementById('settingsStatus');
        
        this.setupEventListeners();
        this.loadSettings();
    }
    
    /**
     * Set up event listeners for the settings component
     */
    setupEventListeners() {
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }
        
        if (this.saveStyleGuideBtn) {
            this.saveStyleGuideBtn.addEventListener('click', () => this.saveStyleGuide());
        }
    }
    
    /**
     * Load settings from storage
     */
    loadSettings() {
        const settings = StorageService.getSettings();
        
        // Apply settings to form fields
        if (this.apiKeyInput) this.apiKeyInput.value = settings.apiKey || '';
        if (this.siteUrlInput) this.siteUrlInput.value = settings.siteUrl || '';
        if (this.siteNameInput) this.siteNameInput.value = settings.siteName || '';
        if (this.modelSelect) this.modelSelect.value = settings.model || 'openai/gpt-4o';
        if (this.evaluationModelSelect) this.evaluationModelSelect.value = settings.defaultEvaluationModel || 'deepseek/deepseek-chat:free';
        if (this.googleApiKeyInput) this.googleApiKeyInput.value = settings.googleApiKey || '';
        if (this.styleGuideInput) this.styleGuideInput.value = settings.styleGuide || '';
    }
    
    /**
     * Save settings to storage
     */
    saveSettings() {
        const settings = {
            apiKey: this.apiKeyInput?.value || '',
            siteUrl: this.siteUrlInput?.value || '',
            siteName: this.siteNameInput?.value || '',
            model: this.modelSelect?.value || 'openai/gpt-4o',
            defaultEvaluationModel: this.evaluationModelSelect?.value || 'deepseek/deepseek-chat:free',
            googleApiKey: this.googleApiKeyInput?.value || '',
            styleGuide: this.styleGuideInput?.value || ''
        };
        
        StorageService.saveSettings(settings);
        
        // Update UI
        if (this.settingsStatus) {
            this.settingsStatus.textContent = 'Settings saved!';
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 3000);
        }
        
        // Update Google API key if needed
        if (window.GoogleDocsService && 
            window.GoogleDocsService.API_KEY !== settings.googleApiKey) {
            window.GoogleDocsService.API_KEY = settings.googleApiKey;
            window.GoogleDocsService.initialize().catch(error => {
                console.error('Error reinitializing Google Docs service:', error);
            });
        }
    }
    
    /**
     * Save style guide only
     */
    saveStyleGuide() {
        if (!this.styleGuideInput) return;
        
        const settings = StorageService.getSettings();
        settings.styleGuide = this.styleGuideInput.value || '';
        StorageService.saveSettings(settings);
        
        // Show feedback
        if (this.saveStyleGuideBtn) {
            const originalText = this.saveStyleGuideBtn.textContent;
            this.saveStyleGuideBtn.textContent = 'Saved!';
            setTimeout(() => {
                this.saveStyleGuideBtn.textContent = originalText;
            }, 2000);
        }
    }
}

// Initialize settings component when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.settingsComponent = new Settings();
});
