// Settings.js - Handles the application settings functionality
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
        this.debugBtn = document.getElementById('debugBtn');
        this.sendTestMsgBtn = document.getElementById('sendTestMsgBtn');
        this.copyPromptBtn = document.getElementById('copyPromptBtn');
        
        this.setupEventListeners();
        this.loadSettings();
    }
    
    setupEventListeners() {
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }
        
        if (this.saveStyleGuideBtn) {
            this.saveStyleGuideBtn.addEventListener('click', () => this.saveStyleGuide());
        }
        
        if (this.debugBtn) {
            this.debugBtn.addEventListener('click', () => this.testConnection());
        }
        
        if (this.sendTestMsgBtn) {
            this.sendTestMsgBtn.addEventListener('click', () => this.sendTestMessage());
        }
        
        if (this.copyPromptBtn) {
            this.copyPromptBtn.addEventListener('click', () => this.copyLastPrompt());
        }
    }
    
    loadSettings() {
        const settings = StorageService.getSettings();
        
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
        
        if (this.settingsStatus) {
            this.settingsStatus.textContent = 'Settings saved!';
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 3000);
        }
        
        if (window.GoogleDocsService && 
            window.GoogleDocsService.API_KEY !== settings.googleApiKey) {
            window.GoogleDocsService.API_KEY = settings.googleApiKey;
            window.GoogleDocsService.initialize().catch(error => {
                console.error('Error reinitializing Google Docs service:', error);
            });
        }
    }
    
    saveStyleGuide() {
        if (!this.styleGuideInput) return;
        
        const settings = StorageService.getSettings();
        settings.styleGuide = this.styleGuideInput.value || '';
        StorageService.saveSettings(settings);
        
        if (this.saveStyleGuideBtn) {
            const originalText = this.saveStyleGuideBtn.textContent;
            this.saveStyleGuideBtn.textContent = 'Saved!';
            setTimeout(() => {
                this.saveStyleGuideBtn.textContent = originalText;
            }, 2000);
        }
    }
    
    async testConnection() {
        if (!this.debugBtn || !this.settingsStatus) return;
        
        try {
            this.debugBtn.disabled = true;
            this.settingsStatus.textContent = 'Testing connection...';
            
            const settings = StorageService.getSettings();
            if (!settings.apiKey) {
                this.settingsStatus.textContent = 'API key is required';
                setTimeout(() => {
                    this.settingsStatus.textContent = '';
                }, 3000);
                return;
            }
            
            const response = await AIService.generateResponse('Hello, this is a test message.', settings);
            
            this.settingsStatus.textContent = 'Connection successful!';
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 3000);
            
            const lastSentPromptEl = document.getElementById('lastSentPrompt');
            if (lastSentPromptEl) {
                lastSentPromptEl.value = `Test response: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`;
            }
        } catch (error) {
            console.error('Test connection error:', error);
            this.settingsStatus.textContent = `Connection error: ${error.message}`;
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 5000);
        } finally {
            this.debugBtn.disabled = false;
        }
    }
    
    async sendTestMessage() {
        if (!this.sendTestMsgBtn || !this.settingsStatus) return;
        
        try {
            this.sendTestMsgBtn.disabled = true;
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
                    const wordCount = response.split(/\s+/).filter(word => word.trim() !== '').length;
                    responseWordCount.textContent = `(${wordCount} words)`;
                }
            }
            
            this.settingsStatus.textContent = 'Test message sent successfully!';
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 3000);
            
            const lastSentPromptEl = document.getElementById('lastSentPrompt');
            if (lastSentPromptEl) {
                lastSentPromptEl.value = testMessage;
            }
        } catch (error) {
            console.error('Send test message error:', error);
            this.settingsStatus.textContent = `Error: ${error.message}`;
            setTimeout(() => {
                this.settingsStatus.textContent = '';
            }, 5000);
        } finally {
            this.sendTestMsgBtn.disabled = false;
        }
    }
    
    copyLastPrompt() {
        const lastSentPrompt = localStorage.getItem('lastSentPrompt');
        if (lastSentPrompt) {
            navigator.clipboard.writeText(lastSentPrompt)
                .then(() => {
                    if (this.settingsStatus) {
                        this.settingsStatus.textContent = 'Last prompt copied to clipboard!';
                        setTimeout(() => {
                            this.settingsStatus.textContent = '';
                        }, 3000);
                    }
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    if (this.settingsStatus) {
                        this.settingsStatus.textContent = 'Could not copy text';
                        setTimeout(() => {
                            this.settingsStatus.textContent = '';
                        }, 3000);
                    }
                });
        }
    }
}

// Initialize settings component when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.settingsComponent = new Settings();
});
