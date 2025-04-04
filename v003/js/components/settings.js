/**
 * Settings.js
 * Handles the application settings functionality and custom model management
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
        this.customModelInput = document.getElementById('customModelInput');
        this.addCustomModelBtn = document.getElementById('addCustomModelBtn');
        this.removeCustomModelBtn = document.getElementById('removeCustomModelBtn');
        
        // Default models to add
        this.defaultModelsToAdd = [
            'google/gemini-2.5-pro-exp-03-25:free',
            'qwen/qwen2.5-vl-3b-instruct:free',
            'openrouter/quasar-alpha',
            'nousresearch/deephermes-3-llama-3-8b-preview:free',
            'deepseek/deepseek-r1-distill-llama-70b:free',
            'sophosympatheia/rogue-rose-103b-v0.2:free'
        ];
        
        this.setupEventListeners();
        this.loadSettings();
        this.loadCustomModels();
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
        
        if (this.addCustomModelBtn) {
            this.addCustomModelBtn.addEventListener('click', () => this.addCustomModel());
        }
        
        if (this.removeCustomModelBtn) {
            this.removeCustomModelBtn.addEventListener('click', () => this.removeCustomModel());
        }
        
        // Add debug buttons
        const debugBtn = document.getElementById('debugBtn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.testConnection());
        }
        
        const sendTestMsgBtn = document.getElementById('sendTestMsgBtn');
        if (sendTestMsgBtn) {
            sendTestMsgBtn.addEventListener('click', () => this.sendTestMessage());
        }
        
        const copyPromptBtn = document.getElementById('copyPromptBtn');
        if (copyPromptBtn) {
            copyPromptBtn.addEventListener('click', () => this.copyLastPrompt());
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
        
        const lastSentPromptEl = document.getElementById('lastSentPrompt');
        const lastSentPrompt = localStorage.getItem('lastSentPrompt') || 'No messages sent yet.';
        if (lastSentPromptEl) {
            lastSentPromptEl.value = lastSentPrompt;
        }
    }
    
    /**
     * Load custom models from storage and update dropdowns
     */
    loadCustomModels() {
        // Get existing custom models
        const customModels = this.getCustomModels();
        
        // Add default models if they don't exist
        let modelsAdded = false;
        this.defaultModelsToAdd.forEach(model => {
            if (!customModels.includes(model)) {
                customModels.push(model);
                modelsAdded = true;
            }
        });
        
        // Save if we added any new default models
        if (modelsAdded) {
            localStorage.setItem('customModels', JSON.stringify(customModels));
        }
        
        // Update the model dropdowns
        this.updateModelDropdowns(customModels);
    }
    
    /**
     * Get custom models from storage
     */
    getCustomModels() {
        const customModelsJson = localStorage.getItem('customModels');
        if (!customModelsJson) return [];
        
        try {
            return JSON.parse(customModelsJson);
        } catch (error) {
            console.error('Error parsing custom models:', error);
            return [];
        }
    }
    
    /**
     * Update model dropdown options
     */
    updateModelDropdowns(customModels) {
        if (!this.modelSelect || !this.evaluationModelSelect) return;
        
        // Save currently selected values
        const currentModelValue = this.modelSelect.value;
        const currentEvalModelValue = this.evaluationModelSelect.value;
        
        // Get existing built-in options (first 10 options are built-in)
        const builtInModelOptions = Array.from(this.modelSelect.options)
            .slice(0, 10)
            .map(option => ({
                value: option.value,
                text: option.text
            }));
        
        const builtInEvalOptions = Array.from(this.evaluationModelSelect.options)
            .slice(0, 3)  // First 3 options for evaluation are built-in
            .map(option => ({
                value: option.value,
                text: option.text
            }));
        
        // Clear existing options
        this.modelSelect.innerHTML = '';
        this.evaluationModelSelect.innerHTML = '';
        
        // Add built-in options back
        builtInModelOptions.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            this.modelSelect.appendChild(optionEl);
        });
        
        builtInEvalOptions.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            this.evaluationModelSelect.appendChild(optionEl);
        });
        
        // Add separator if there are custom models
        if (customModels.length > 0) {
            const separatorEl = document.createElement('option');
            separatorEl.disabled = true;
            separatorEl.textContent = '──────────────';
            this.modelSelect.appendChild(separatorEl.cloneNode(true));
            this.evaluationModelSelect.appendChild(separatorEl.cloneNode(true));
            
            // Add custom models header
            const headerEl = document.createElement('option');
            headerEl.disabled = true;
            headerEl.textContent = 'Custom Models';
            this.modelSelect.appendChild(headerEl.cloneNode(true));
            this.evaluationModelSelect.appendChild(headerEl.cloneNode(true));
        }
        
        // Add custom models
        customModels.forEach(model => {
            const optionEl = document.createElement('option');
            optionEl.value = model;
            // Format the display name to be cleaner
            const parts = model.split('/');
            const displayName = parts.length > 1 
                ? `${parts[0]} - ${parts[1].split(':')[0]}`
                : model;
            optionEl.textContent = displayName;
            
            this.modelSelect.appendChild(optionEl.cloneNode(true));
            this.evaluationModelSelect.appendChild(optionEl.cloneNode(true));
        });
        
        // Restore selected values if they exist
        if (this.modelSelect.querySelector(`option[value="${currentModelValue}"]`)) {
            this.modelSelect.value = currentModelValue;
        }
        
        if (this.evaluationModelSelect.querySelector(`option[value="${currentEvalModelValue}"]`)) {
            this.evaluationModelSelect.value = currentEvalModelValue;
        }
    }
    
    /**
     * Add a custom model
     */
    addCustomModel() {
        if (!this.customModelInput) return;
        
        const modelInput = this.customModelInput.value.trim();
        if (!modelInput) {
            this.showStatus('Please enter a model identifier');
            return;
        }
        
        // Get existing custom models
        const customModels = this.getCustomModels();
        
        // Check if model already exists
        if (customModels.includes(modelInput)) {
            this.showStatus('This model is already in your list');
            return;
        }
        
        // Add the new model
        customModels.push(modelInput);
        localStorage.setItem('customModels', JSON.stringify(customModels));
        
        // Update dropdowns
        this.updateModelDropdowns(customModels);
        
        // Clear input and show success
        this.customModelInput.value = '';
        this.showStatus('Model added successfully');
    }
    
    /**
     * Remove a custom model
     */
    removeCustomModel() {
        if (!this.modelSelect) return;
        
        const selectedModel = this.modelSelect.value;
        
        // Get existing custom models
        const customModels = this.getCustomModels();
        
        // Check if the selected model is a custom model
        const index = customModels.indexOf(selectedModel);
        if (index === -1) {
            this.showStatus('Please select a custom model to remove');
            return;
        }
        
        // Remove the model
        customModels.splice(index, 1);
        localStorage.setItem('customModels', JSON.stringify(customModels));
        
        // Update dropdowns
        this.updateModelDropdowns(customModels);
        
        this.showStatus('Model removed successfully');
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
    
    /**
     * Show status message
     */
    showStatus(message, timeout = 3000) {
        if (!this.settingsStatus) return;
        
        this.settingsStatus.textContent = message;
        
        if (timeout > 0) {
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, timeout);
        }
    }
    
    /**
     * Test API connection
     */
    async testConnection() {
        if (!this.settingsStatus) return;
        
        try {
            const debugBtn = document.getElementById('debugBtn');
            if (debugBtn) debugBtn.disabled = true;
            
            this.settingsStatus.textContent = 'Testing connection...';
            
            const settings = StorageService.getSettings();
            if (!settings.apiKey) {
                this.settingsStatus.textContent = 'API key is required';
                setTimeout(() => {
                    this.settingsStatus.textContent = '';
                }, 3000);
                return;
            }
            
            const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${settings.apiKey}`
                }
            });
            
            const data = await response.json();
            console.log('API Key info:', data);
            
            if (response.ok) {
                this.settingsStatus.textContent = 'Connection successful! Check console for details.';
            } else {
                this.settingsStatus.textContent = `API Error: ${data.error?.message || 'Unknown error'}`;
            }
        } catch (error) {
            console.error('Test connection error:', error);
            this.settingsStatus.textContent = `Connection error: ${error.message}`;
        } finally {
            const debugBtn = document.getElementById('debugBtn');
            if (debugBtn) debugBtn.disabled = false;
            
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 5000);
        }
    }
    
    /**
     * Send a test message
     */
    async sendTestMessage() {
        if (!this.settingsStatus) return;
        
        try {
            const sendTestMsgBtn = document.getElementById('sendTestMsgBtn');
            if (sendTestMsgBtn) sendTestMsgBtn.disabled = true;
            
            this.settingsStatus.textContent = 'Sending test message...';
            
            const settings = StorageService.getSettings();
            if (!settings.apiKey) {
                this.settingsStatus.textContent = 'API key is required';
                setTimeout(() => {
                    this.settingsStatus.textContent = '';
                }, 3000);
                return;
            }
            
            const testMessage = `
                This is a test message from Cresonia AI.
                
                Please provide a short story (2-3 paragraphs) about a robot learning to paint.
                
                Include some dialogue and a happy ending.
            `;
            
            localStorage.setItem('lastSentPrompt', testMessage);
            
            const response = await AIService.generateResponse(testMessage, settings);
            
            const responseElement = document.getElementById('response');
            if (responseElement) {
                const formattedResponse = AIService.formatResponseAsHTML(response);
                responseElement.innerHTML = formattedResponse;
                
                const responseWordCount = document.getElementById('responseWordCount');
                if (responseWordCount) {
                    const wordCount = this.countWords(response);
                    responseWordCount.textContent = `(${wordCount} words)`;
                }
            }
            
            this.settingsStatus.textContent = 'Test message sent successfully!';
            
            const lastSentPromptEl = document.getElementById('lastSentPrompt');
            if (lastSentPromptEl) {
                lastSentPromptEl.value = testMessage;
            }
        } catch (error) {
            console.error('Send test message error:', error);
            this.settingsStatus.textContent = `Error: ${error.message}`;
        } finally {
            const sendTestMsgBtn = document.getElementById('sendTestMsgBtn');
            if (sendTestMsgBtn) sendTestMsgBtn.disabled = false;
            
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 5000);
        }
    }
    
    /**
     * Copy the last prompt
     */
    copyLastPrompt() {
        const lastSentPrompt = localStorage.getItem('lastSentPrompt');
        if (lastSentPrompt) {
            navigator.clipboard.writeText(lastSentPrompt)
                .then(() => {
                    this.showStatus('Last prompt copied to clipboard!');
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    this.showStatus('Could not copy text');
                });
        }
    }
    
    /**
     * Count words in text
     */
    countWords(text) {
        text = text.trim();
        if (!text) return 0;
        
        // Split by whitespace and filter out empty strings
        return text.split(/\s+/).filter(word => word.trim() !== '').length;
    }
}

// Initialize settings component when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.settingsComponent = new Settings();
});