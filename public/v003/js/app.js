/**
 * app.js
 * Main application logic for Cresonia AI v.003
 */
(function() {
    'use strict';
    
    // Application state
    let isGeneratingResponse = false;
    let autoSaveInterval = null;
    let contentProtectionTimeout = null;
    
    // DOM element references
    const elements = {
        // Main UI elements
        promptTextarea: document.getElementById('prompt'),
        responseBox: document.getElementById('response'),
        evaluationResults: document.getElementById('evaluationResults'),
        
        // Buttons
        sendPromptBtn: document.getElementById('sendPrompt'),
        clearPromptBtn: document.getElementById('clearPrompt'),
        copyResponseBtn: document.getElementById('copyResponse'),
        clearResponseBtn: document.getElementById('clearResponse'),
        evaluateBtn: document.getElementById('evaluateButton'),
        copyEvaluationBtn: document.getElementById('copyEvaluation'),
        clearEvaluationBtn: document.getElementById('clearEvaluation'),
        saveProjectBtn: document.getElementById('saveProject'),
        
        // Status elements
        promptStatus: document.getElementById('promptStatus'),
        responseStatus: document.getElementById('responseStatus'),
        evaluationStatus: document.getElementById('evaluationStatus'),
        saveStatus: document.getElementById('saveStatus'),
        
        // Word count elements
        promptWordCount: document.getElementById('promptWordCount'),
        responseWordCount: document.getElementById('responseWordCount'),
        evaluationWordCount: document.getElementById('evaluationWordCount'),
        
        // Checkboxes
        includeProse: document.getElementById('includeProse'),
        
        // Panels
        settingsPanel: document.getElementById('settingsCard'),
        
        // Modals
        projectModal: document.getElementById('projectModal'),
        
        // Settings elements
        styleGuide: document.getElementById('styleGuide'),
        apiKey: document.getElementById('apiKey'),
        siteUrl: document.getElementById('siteUrl'),
        siteName: document.getElementById('siteName'),
        model: document.getElementById('model'),
        defaultEvaluationModel: document.getElementById('defaultEvaluationModel'),
        googleApiKey: document.getElementById('googleApiKey'),
        themeToggle: document.getElementById('themeToggle')
    };
    
    /**
     * Initialize the application
     */
    function initialize() {
        console.log('Initializing Cresonia AI v.003...');
        
        // Load settings
        loadSettings();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize auto-save
        setupAutoSave();
        
        // Set initial theme
        setTheme(localStorage.getItem('theme') || 'light');
        
        // Update word counts
        updateAllWordCounts();
        
        console.log('Cresonia AI v.003 initialized');
    }
    
    /**
     * Load settings from storage
     */
    function loadSettings() {
        const settings = StorageService.getSettings();
        
        // Apply settings to form fields
        if (elements.apiKey) elements.apiKey.value = settings.apiKey || '';
        if (elements.siteUrl) elements.siteUrl.value = settings.siteUrl || '';
        if (elements.siteName) elements.siteName.value = settings.siteName || '';
        if (elements.model) elements.model.value = settings.model || 'openai/gpt-4o';
        if (elements.styleGuide) elements.styleGuide.value = settings.styleGuide || '';
        if (elements.defaultEvaluationModel) elements.defaultEvaluationModel.value = settings.defaultEvaluationModel || 'deepseek/deepseek-chat:free';
        if (elements.googleApiKey) elements.googleApiKey.value = settings.googleApiKey || '';
    }
    
    /**
     * Save settings to storage
     */
    function saveSettings() {
        const settings = {
            apiKey: elements.apiKey?.value || '',
            siteUrl: elements.siteUrl?.value || '',
            siteName: elements.siteName?.value || '',
            model: elements.model?.value || 'openai/gpt-4o',
            styleGuide: elements.styleGuide?.value || '',
            defaultEvaluationModel: elements.defaultEvaluationModel?.value || 'deepseek/deepseek-chat:free',
            googleApiKey: elements.googleApiKey?.value || ''
        };
        
        StorageService.saveSettings(settings);
        
        // Update UI
        if (elements.settingsStatus) {
            elements.settingsStatus.textContent = 'Settings saved!';
            setTimeout(() => {
                elements.settingsStatus.textContent = '';
            }, 3000);
        }
        
        // If Google API key changed, reinitialize Google Docs service
        if (GoogleDocsService.API_KEY !== settings.googleApiKey) {
            GoogleDocsService.API_KEY = settings.googleApiKey;
            GoogleDocsService.initialize().catch(error => {
                console.error('Error reinitializing Google Docs service:', error);
            });
        }
    }
    
    /**
     * Set up application event listeners
     */
    function setupEventListeners() {
        // Send prompt
        if (elements.sendPromptBtn) {
            elements.sendPromptBtn.addEventListener('click', sendPrompt);
        }
        
        // Clear prompt
        if (elements.clearPromptBtn) {
            elements.clearPromptBtn.addEventListener('click', clearPrompt);
        }
        
        // Copy response
        if (elements.copyResponseBtn) {
            elements.copyResponseBtn.addEventListener('click', copyResponse);
        }
        
        // Clear response
        if (elements.clearResponseBtn) {
            elements.clearResponseBtn.addEventListener('click', clearResponse);
        }
        
        // Evaluate story
        if (elements.evaluateBtn) {
            elements.evaluateBtn.addEventListener('click', evaluateStory);
        }
        
        // Copy evaluation
        if (elements.copyEvaluationBtn) {
            elements.copyEvaluationBtn.addEventListener('click', copyEvaluation);
        }
        
        // Clear evaluation
        if (elements.clearEvaluationBtn) {
            elements.clearEvaluationBtn.addEventListener('click', clearEvaluation);
        }
        
        // Save project
        if (elements.saveProjectBtn) {
            elements.saveProjectBtn.addEventListener('click', () => {
                StorageService.saveCurrentContent();
            });
        }
        
        // Save settings
        const saveSettingsBtn = document.getElementById('saveSettings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', saveSettings);
        }
        
        // Save style guide
        const saveStyleGuideBtn = document.getElementById('saveStyleGuide');
        if (saveStyleGuideBtn) {
            saveStyleGuideBtn.addEventListener('click', () => {
                const settings = StorageService.getSettings();
                settings.styleGuide = elements.styleGuide?.value || '';
                StorageService.saveSettings(settings);
                
                // Show feedback
                const styleGuideBtn = document.getElementById('saveStyleGuide');
                if (styleGuideBtn) {
                    const originalText = styleGuideBtn.textContent;
                    styleGuideBtn.textContent = 'Saved!';
                    setTimeout(() => {
                        styleGuideBtn.textContent = originalText;
                    }, 2000);
                }
            });
        }
        
        // Theme toggle
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }
        
        // Word count updates
        if (elements.promptTextarea) {
            elements.promptTextarea.addEventListener('input', () => {
                updateWordCount('prompt');
            });
        }
        
        if (elements.responseBox) {
            elements.responseBox.addEventListener('input', () => {
                updateWordCount('response');
            });
        }

        // Custom model management
        const addCustomModelBtn = document.getElementById('addCustomModelBtn');
        if (addCustomModelBtn) {
            addCustomModelBtn.addEventListener('click', () => {
                if (window.settingsComponent) {
                    window.settingsComponent.addCustomModel();
                }
            });
        }

        const removeCustomModelBtn = document.getElementById('removeCustomModelBtn');
        if (removeCustomModelBtn) {
            removeCustomModelBtn.addEventListener('click', () => {
                if (window.settingsComponent) {
                    window.settingsComponent.removeCustomModel();
                }
            });
        }

        // Project management
        const createProjectForm = document.getElementById('createProjectButton');
        if (createProjectForm) {
            createProjectForm.addEventListener('click', async () => {
                const nameInput = document.getElementById('projectName');
                const descInput = document.getElementById('projectDescription');
                
                if (nameInput && nameInput.value.trim()) {
                    await StorageService.createProjectFromCurrentContent(
                        nameInput.value.trim(),
                        descInput ? descInput.value.trim() : ''
                    );
                    
                    // Close the modal
                    document.getElementById('projectModal').classList.remove('show');
                    
                    // Clear the form
                    nameInput.value = '';
                    if (descInput) descInput.value = '';
                }
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.classList.remove('show');
                });
            });
        });
    }
    
    /**
     * Setup auto-save functionality
     */
    function setupAutoSave() {
        // Clear any existing interval
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
        }
        
        // Set up new interval
        autoSaveInterval = setInterval(() => {
            // Only auto-save if there's a current project
            const currentProject = StorageService.getCurrentProjectSync();
            if (currentProject) {
                StorageService.saveCurrentContent().catch(error => {
                    console.error('Auto-save error:', error);
                });
            }
        }, 60000); // Auto-save every minute
    }
    
    /**
     * Toggle between light and dark themes
     */
    function toggleTheme() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }
    
    /**
     * Set the application theme
     */
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update theme toggle icon
        if (elements.themeToggle) {
            elements.themeToggle.innerHTML = theme === 'dark' ? '🌙' : '☀️';
            elements.themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
        }
        
        // Switch stylesheets
        const themeStylesheet = document.getElementById('theme-stylesheet');
        if (themeStylesheet) {
            themeStylesheet.href = `css/${theme}-theme.css`;
        }
    }
    
    /**
     * Protect content from being unexpectedly changed
     */
    function protectContent() {
        if (contentProtectionTimeout) {
            clearTimeout(contentProtectionTimeout);
        }
        
        if (!elements.responseBox) return;
        
        // Store the current content for comparison
        const currentContent = elements.responseBox.innerHTML;
        console.log("Setting up content protection for:", 
                    currentContent.substring(0, 50) + "...");
        
        // Cancel any existing protection
        if (window._contentProtectionInterval) {
            clearInterval(window._contentProtectionInterval);
        }
        
        // Set up a protection interval that checks for unexpected changes
        window._contentProtectionInterval = setInterval(() => {
            if (elements.responseBox && 
                elements.responseBox.innerHTML !== currentContent &&
                elements.responseBox.innerHTML === 'Response will appear here...') {
                
                console.warn("Content was reset unexpectedly, restoring content");
                elements.responseBox.innerHTML = currentContent;
            }
        }, 100);
        
        // Stop protection after 3 seconds
        contentProtectionTimeout = setTimeout(() => {
            if (window._contentProtectionInterval) {
                clearInterval(window._contentProtectionInterval);
                window._contentProtectionInterval = null;
                console.log("Content protection disabled after timeout");
            }
        }, 3000);
    }
    
    /**
     * Send prompt to AI and get response
     */
    async function sendPrompt() {
        console.log("Starting sendPrompt function");
        
        // Get prompt text
        const promptText = elements.promptTextarea?.value.trim();
        if (!promptText) {
            showStatus(elements.promptStatus, 'Please enter a prompt', 3000);
            return;
        }
        
        // Check if API key is set
        const settings = StorageService.getSettings();
        if (!settings.apiKey) {
            showStatus(elements.promptStatus, 'Please enter your API key in settings', 3000);
            return;
        }
        
        // Don't allow multiple requests at once
        if (isGeneratingResponse) {
            showStatus(elements.promptStatus, 'Already generating a response', 3000);
            return;
        }
        
        try {
            isGeneratingResponse = true;
            showStatus(elements.promptStatus, 'Generating response...', 0);
            
            // Get include prose checkbox value
            const includeProse = elements.includeProse?.checked || false;
            
            // Get previous content if needed
            let previousContent = '';
            if (includeProse && elements.responseBox) {
                const responseContent = elements.responseBox.textContent || elements.responseBox.innerText;
                if (responseContent && responseContent !== 'Response will appear here...') {
                    previousContent = responseContent;
                }
            }
            
            // Format the prompt
            const formattedPrompt = AIService.formatPrompt(
                promptText,
                settings.styleGuide,
                previousContent,
                includeProse
            );
            
            // Save current response if it's not empty/default
            let isDefaultResponse = !elements.responseBox ||
                elements.responseBox.innerHTML === 'Response will appear here...' ||
                elements.responseBox.innerHTML.includes('Loading...');
                
            // Store content for appending later
            const originalContent = isDefaultResponse ? '' : elements.responseBox.innerHTML;
            
            if (!isDefaultResponse && elements.responseBox) {
                // Create a separator and add loading placeholder with an ID
                elements.responseBox.innerHTML += '<div class="response-separator"></div><div id="loading-placeholder">Loading...</div>';
            } else if (elements.responseBox) {
                // Just set loading placeholder if there's no existing content
                elements.responseBox.innerHTML = '<div id="loading-placeholder">Loading...</div>';
            }
            
            // Update word count
            updateWordCount('response');
            
            // Generate response
            const response = await AIService.generateResponse(formattedPrompt, settings);
            
            // Format the response
            const formattedResponse = AIService.formatResponseAsHTML(response);
            
            // Save last sent prompt for debugging
            localStorage.setItem('lastSentPrompt', formattedPrompt);
            
            // Update the response box
            const loadingPlaceholder = document.getElementById('loading-placeholder');
            if (loadingPlaceholder && elements.responseBox) {
                // Replace only the loading placeholder with the new content
                loadingPlaceholder.outerHTML = formattedResponse;
                console.log("Content updated by replacing placeholder");
            } else if (elements.responseBox) {
                // Handle the case where we need to completely reset or append content
                if (isDefaultResponse) {
                    // Replace if this was default content
                    elements.responseBox.innerHTML = formattedResponse;
                    console.log("Content updated by replacing default content");
                } else {
                    // Append the new content while preserving existing content
                    if (window.proseEditor && typeof window.proseEditor.appendContent === 'function') {
                        window.proseEditor.appendContent(formattedResponse, true);
                        console.log("Content updated using ProseEditor.appendContent");
                    } else {
                        elements.responseBox.innerHTML = originalContent + 
                            '<div class="response-separator"></div>' + formattedResponse;
                        console.log("Content updated by manual append");
                    }
                }
            }
            
            console.log("Content updated successfully:", 
                      elements.responseBox.innerHTML.substring(0, 100) + "...");
            
            // Protect content from being unexpectedly changed
            protectContent();
            
            // Update word count
            updateWordCount('response');
            
            // Save to current project if exists
            const currentProject = await StorageService.getCurrentProject();
            if (currentProject) {
                // Add a small delay to let the DOM update before saving
                setTimeout(() => {
                    StorageService.saveCurrentContent().catch(error => {
                        console.error('Error saving content after generation:', error);
                    });
                }, 1000);
            }
            
            showStatus(elements.promptStatus, 'Response generated successfully!', 3000);
            
        } catch (error) {
            console.error('Error generating response:', error);
            
            const loadingPlaceholder = document.getElementById('loading-placeholder');
            if (loadingPlaceholder && elements.responseBox) {
                // Replace only the loading placeholder with the error message
                loadingPlaceholder.outerHTML = `<div class="error">Error: ${error.message}</div>`;
            } else if (elements.responseBox) {
                // Fallback in case the placeholder isn't found
                elements.responseBox.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
            
            updateWordCount('response');
            showStatus(elements.promptStatus, 'Failed to get response', 3000);
            
        } finally {
            isGeneratingResponse = false;
            
            // Extra check to make sure we didn't lose content
            setTimeout(() => {
                console.log("Delayed check - content after 500ms:", 
                          elements.responseBox.innerHTML.substring(0, 100) + "...");
            }, 500);
        }
    }
    
    /**
     * Evaluate the current story
     */
    async function evaluateStory() {
        // Get prose content
        if (!elements.responseBox) return;
        
        // Create a temporary element to extract text content without HTML formatting
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = elements.responseBox.innerHTML;
        const proseContent = tempDiv.textContent || tempDiv.innerText;
        
        if (!proseContent.trim() || 
            proseContent === 'Response will appear here...' || 
            proseContent === 'Loading...') {
            showStatus(elements.evaluationStatus, 'Please generate prose content first', 3000);
            return;
        }
        
        // Check if API key is set
        const settings = StorageService.getSettings();
        if (!settings.apiKey) {
            showStatus(elements.evaluationStatus, 'Please enter your API key in settings', 3000);
            return;
        }
        
        // Don't allow multiple requests at once
        if (isGeneratingResponse) {
            showStatus(elements.evaluationStatus, 'Already generating content', 3000);
            return;
        }
        
        try {
            isGeneratingResponse = true;
            showStatus(elements.evaluationStatus, 'Generating story evaluation...', 0);
            
            if (elements.evaluationResults) {
                elements.evaluationResults.innerHTML = 'Evaluating story... This may take a minute.';
            }
            
            // Generate evaluation
            const response = await AIService.evaluateStory(proseContent, settings);
            
            // Format the response
            const formattedResponse = AIService.formatResponseAsHTML(response);
            
            // Update the evaluation box
            if (elements.evaluationResults) {
                elements.evaluationResults.innerHTML = formattedResponse;
            }
            
            // Update word count
            updateWordCount('evaluation');
            
            // Save to current project if exists
            const currentProject = await StorageService.getCurrentProject();
            if (currentProject) {
                currentProject.evaluation = formattedResponse;
                await StorageService.updateProject(currentProject);
            }
            
            showStatus(elements.evaluationStatus, 'Evaluation completed!', 3000);
            
        } catch (error) {
            console.error('Error evaluating story:', error);
            
            if (elements.evaluationResults) {
                elements.evaluationResults.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
            
            showStatus(elements.evaluationStatus, 'Failed to generate evaluation', 3000);
            
        } finally {
            isGeneratingResponse = false;
        }
    }
    
    /**
     * Copy response to clipboard
     */
    function copyResponse() {
        if (!elements.responseBox) return;
        
        // Create a temporary element to extract text content without HTML formatting
        const tempElement = document.createElement('div');
        tempElement.innerHTML = elements.responseBox.innerHTML;
        const responseText = tempElement.textContent || tempElement.innerText;
        
        if (responseText && 
            responseText !== 'Response will appear here...' && 
            responseText !== 'Loading...') {
            
            copyTextToClipboard(responseText, elements.responseStatus);
        }
    }
    
    /**
     * Copy evaluation to clipboard
     */
    function copyEvaluation() {
        if (!elements.evaluationResults) return;
        
        // Create a temporary element to extract text content without HTML formatting
        const tempElement = document.createElement('div');
        tempElement.innerHTML = elements.evaluationResults.innerHTML;
        const evaluationText = tempElement.textContent || tempElement.innerText;
        
        if (evaluationText && 
            evaluationText !== 'Story evaluation will appear here after clicking \'Evaluate Story\'...' && 
            evaluationText !== 'Evaluating story... This may take a minute.') {
            
            copyTextToClipboard(evaluationText, elements.evaluationStatus);
        }
    }
    
    /**
     * Copy text to clipboard
     */
    function copyTextToClipboard(text, statusElement) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showStatus(statusElement, 'Copied to clipboard!', 3000);
            })
            .catch(err => {
                console.error('Could not copy text: ', err);
                showStatus(statusElement, 'Could not copy text', 3000);
            });
    }
    
    /**
     * Clear prompt
     */
    function clearPrompt() {
        if (elements.promptTextarea) {
            elements.promptTextarea.value = '';
            updateWordCount('prompt');
        }
    }
    
    /**
     * Clear response
     */
    function clearResponse() {
        if (elements.responseBox) {
            elements.responseBox.innerHTML = 'Response will appear here...';
            updateWordCount('response');
            
            // Update current project if exists
            StorageService.getCurrentProject().then(project => {
                if (project) {
                    project.content = '';
                    StorageService.updateProject(project).catch(error => {
                        console.error('Error clearing project content:', error);
                    });
                }
            });
        }
    }
    
    /**
     * Clear evaluation
     */
    function clearEvaluation() {
        if (elements.evaluationResults) {
            elements.evaluationResults.innerHTML = 'Story evaluation will appear here after clicking \'Evaluate Story\'...';
            updateWordCount('evaluation');
            
            // Update current project if exists
            StorageService.getCurrentProject().then(project => {
                if (project) {
                    project.evaluation = '';
                    StorageService.updateProject(project).catch(error => {
                        console.error('Error clearing project evaluation:', error);
                    });
                }
            });
        }
    }
    
    /**
     * Show status message with optional timeout
     */
    function showStatus(element, message, timeout = 0) {
        if (!element) return;
        
        element.textContent = message;
        
        if (timeout > 0) {
            setTimeout(() => {
                element.textContent = '';
            }, timeout);
        }
    }
    
    /**
     * Count words in text, handling both HTML and plain text
     */
    function countWords(text) {
        // If it's HTML content, extract the text
        if (text.includes('<') && text.includes('>')) {
            const tempElement = document.createElement('div');
            tempElement.innerHTML = text;
            text = tempElement.textContent || tempElement.innerText;
        }
        
        text = text.trim();
        if (!text) return 0;
        
        // Split by whitespace and filter out empty strings
        return text.split(/\s+/).filter(word => word.trim() !== '').length;
    }
    
    /**
     * Update word count for specific element
     */
    function updateWordCount(elementType) {
        let contentElement, countElement;
        
        switch (elementType) {
            case 'prompt':
                contentElement = elements.promptTextarea;
                countElement = elements.promptWordCount;
                break;
            case 'response':
                contentElement = elements.responseBox;
                countElement = elements.responseWordCount;
                break;
            case 'evaluation':
                contentElement = elements.evaluationResults;
                countElement = elements.evaluationWordCount;
                break;
            default:
                return;
        }
        
        if (!contentElement || !countElement) return;
        
        let text;
        if (elementType === 'prompt') {
            text = contentElement.value || '';
        } else {
            text = contentElement.innerHTML || '';
        }
        
        const wordCount = countWords(text);
        countElement.textContent = `(${wordCount} words)`;
    }
    
    /**
     * Update all word counts at once
     */
    function updateAllWordCounts() {
        updateWordCount('prompt');
        updateWordCount('response');
        updateWordCount('evaluation');
    }
    
    // Initialize the application when the DOM is loaded
    document.addEventListener('DOMContentLoaded', initialize);
})();