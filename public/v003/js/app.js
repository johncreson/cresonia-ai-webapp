/**
 * app.js
 * Main application logic for Cresonia AI v.003
 */
(function() {
    'use strict';
    
    // Debug mode
    const DEBUG = true;
    
    // Application state
    let isGeneratingResponse = false;
    let autoSaveInterval = null;
    let contentProtectionTimeout = null;
    let responseHistory = [];
    
    // Debug logging
    function debugLog(...args) {
        if (DEBUG) {
            console.log(`[Cresonia Debug ${new Date().toISOString().slice(11, 19)}]`, ...args);
        }
    }
    
    // Global debug info function
    window.debugCresonia = function() {
        console.group("🔍 Cresonia AI Debug Info");
        console.log("Current state:", {
            isGeneratingResponse,
            hasContentProtection: !!window._contentProtectionInterval,
            hasMutationObserver: !!window._contentObserver,
            responseHistoryEntries: responseHistory.length,
            lastResponseTime: responseHistory.length > 0 ? responseHistory[responseHistory.length - 1].timestamp : 'none'
        });
        
        // Check DOM elements
        console.group("DOM Elements");
        const elements = ['promptTextarea', 'responseBox', 'evaluationResults', 'sendPromptBtn'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            console.log(`${id}: ${el ? '✅ Present' : '❌ Missing'}`);
            if (id === 'responseBox' && el) {
                console.log(" - Current content:", el.innerHTML.substring(0, 100) + '...');
                console.log(" - Has protected content:", !!el.getAttribute('data-protected-content'));
            }
        });
        console.groupEnd();
        
        // Check local storage
        console.group("Local Storage");
        const keys = ['lastSentPrompt', 'lastGeneratedResponse', 'cresonia-settings', 'cresonia-current-project'];
        keys.forEach(key => {
            const value = localStorage.getItem(key);
            console.log(`${key}: ${value ? '✅ Present' : '❌ Missing'} ${value ? '(' + value.substring(0, 50) + '...)' : ''}`);
        });
        console.groupEnd();
        
        console.log("Response History:", responseHistory);
        console.groupEnd();
        
        return "Debug info logged to console";
    };
    
    // Global recovery function
    window.recoverCresonia = function(index = -1) {
        if (responseHistory.length === 0) {
            console.error("No responses in history to recover");
            return false;
        }
        
        const targetIndex = index === -1 ? responseHistory.length - 1 : index;
        if (targetIndex < 0 || targetIndex >= responseHistory.length) {
            console.error(`Invalid index ${targetIndex}. History has ${responseHistory.length} entries`);
            return false;
        }
        
        const entry = responseHistory[targetIndex];
        const responseBox = document.getElementById('response');
        if (!responseBox) {
            console.error("Response box not found");
            return false;
        }
        
        console.log(`Recovering response from ${entry.timestamp}`);
        responseBox.innerHTML = entry.content;
        protectContent();
        return true;
    };
    
    // DOM element getter function for more reliable element access
    function getElement(id, alternativeSelectors = []) {
        // Try the ID first
        let element = document.getElementById(id);
        
        // If not found, try any alternative selectors
        if (!element && alternativeSelectors.length > 0) {
            for (const selector of alternativeSelectors) {
                try {
                    element = document.querySelector(selector);
                    if (element) {
                        debugLog(`Found element ${id} using selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    debugLog(`Error with selector ${selector}: ${e.message}`);
                }
            }
        }
        
        if (!element) {
            debugLog(`Element not found: ${id}`);
        }
        
        return element;
    }
    
    // Create elements object with getters to ensure we always look for the latest elements
    const elements = {
        // Define property getters for all elements to ensure they're always up-to-date
        get promptTextarea() { 
            return getElement('prompt', ['textarea', '.prompt-textarea', 'textarea[placeholder*="prompt"]']); 
        },
        get responseBox() { 
            return getElement('response', ['.response-box', '.prose-section .response-box', '[contenteditable="true"]']); 
        },
        get evaluationResults() { 
            return getElement('evaluationResults', ['.evaluation-section .response-box']); 
        },
        
        // Buttons
        get sendPromptBtn() { return getElement('sendPrompt', ['button:contains("Generate")']); },
        get clearPromptBtn() { return getElement('clearPrompt', ['button:contains("Clear"):first']); },
        get copyResponseBtn() { return getElement('copyResponse', ['button:contains("Copy Response")']); },
        get clearResponseBtn() { return getElement('clearResponse', ['button:contains("Clear"):eq(1)']); },
        get evaluateBtn() { return getElement('evaluateButton', ['button:contains("Evaluate")']); },
        get copyEvaluationBtn() { return getElement('copyEvaluation', ['button:contains("Copy Evaluation")']); },
        get clearEvaluationBtn() { return getElement('clearEvaluation', ['button:contains("Clear"):eq(2)']); },
        get saveProjectBtn() { return getElement('saveProject', ['button[title="Save Project"]']); },
        
        // Status elements
        get promptStatus() { return getElement('promptStatus'); },
        get responseStatus() { return getElement('responseStatus'); },
        get evaluationStatus() { return getElement('evaluationStatus'); },
        get saveStatus() { return getElement('saveStatus'); },
        
        // Word count elements
        get promptWordCount() { return getElement('promptWordCount'); },
        get responseWordCount() { return getElement('responseWordCount'); },
        get evaluationWordCount() { return getElement('evaluationWordCount'); },
        
        // Checkboxes
        get includeProse() { return getElement('includeProse', ['input[type="checkbox"]']); },
        
        // Panels
        get settingsPanel() { return getElement('settingsCard'); },
        
        // Modals
        get projectModal() { return getElement('projectModal'); },
        
        // Settings elements
        get styleGuide() { return getElement('styleGuide'); },
        get apiKey() { return getElement('apiKey'); },
        get siteUrl() { return getElement('siteUrl'); },
        get siteName() { return getElement('siteName'); },
        get model() { return getElement('model'); },
        get defaultEvaluationModel() { return getElement('defaultEvaluationModel'); },
        get googleApiKey() { return getElement('googleApiKey'); },
        get themeToggle() { return getElement('themeToggle'); }
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
     * Permanently protect content from being unexpectedly changed with throttling 
     * and improved user action detection
     */
    function protectContent() {
        debugLog("Setting up content protection");
        
        if (contentProtectionTimeout) {
            clearTimeout(contentProtectionTimeout);
            debugLog("Cleared existing protection timeout");
        }
        
        if (!elements.responseBox) {
            debugLog("Cannot protect content - response box not found");
            return;
        }
        
        // Check for intentional clear operation in progress
        if (window._intentionalClear) {
            debugLog("Not protecting during intentional clear operation");
            return;
        }
        
        // Don't protect error messages
        if (elements.responseBox.innerHTML.includes('<div class="error">')) {
            debugLog("Not protecting error message content");
            return;
        }
        
        // Don't protect empty or default content
        if (elements.responseBox.innerHTML === 'Response will appear here...' || 
            !elements.responseBox.innerHTML.trim()) {
            debugLog("Not protecting default/empty content");
            return;
        }
        
        // Store the current content for comparison
        const currentContent = elements.responseBox.innerHTML;
        debugLog("Protecting content:", currentContent.substring(0, 50) + "...");
        
        // Cancel any existing protection interval
        if (window._contentProtectionInterval) {
            clearInterval(window._contentProtectionInterval);
            debugLog("Cleared existing protection interval");
        }
        
        // Store a copy of the content in a data attribute for safer storage
        elements.responseBox.setAttribute('data-protected-content', currentContent);
        
        // Initialize counter to prevent infinite loops
        if (!window._protectionRestoreCount) {
            window._protectionRestoreCount = 0;
        }
        
        // Initialize timestamp for throttling
        if (!window._lastProtectionTime) {
            window._lastProtectionTime = 0;
        }
        
        // Create a throttled restoration function
        if (!window._throttledRestore) {
            window._throttledRestore = function(targetEl, protectedContent) {
                // Don't protect during clear operations
                if (window._intentionalClear) {
                    debugLog("Not restoring during intentional clear");
                    return false;
                }
                
                // Check if we've had too many restorations in a row
                if (window._protectionRestoreCount > 5) {
                    debugLog("Too many consecutive restorations, pausing protection");
                    setTimeout(() => { window._protectionRestoreCount = 0; }, 5000);
                    return false;
                }
                
                // Throttle restorations to prevent freezing
                const now = Date.now();
                if (now - window._lastProtectionTime < 1000) { // At most 1 restoration per second
                    debugLog("Throttling restoration");
                    return false;
                }
                
                // Update timestamp
                window._lastProtectionTime = now;
                
                // Increment counter
                window._protectionRestoreCount++;
                
                // Do the actual restoration
                debugLog("Restoring content (count: " + window._protectionRestoreCount + ")");
                targetEl.innerHTML = protectedContent;
                
                return true;
            };
        }
        
        // Create a backup restoration function that will be called on mutation events
        if (!window._contentRestoreHandler) {
            window._contentRestoreHandler = function(mutations) {
                // Skip if we're in an intentional clear operation
                if (window._intentionalClear) {
                    debugLog("Mutation ignored during intentional clear");
                    return;
                }
                
                // Skip if any mutation includes loading or separator markers (indicating append operation)
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.id === 'loading-placeholder' || 
                                    node.className === 'response-separator' ||
                                    node.innerHTML?.includes('response-separator')) {
                                    debugLog("Detected append operation, not triggering protection");
                                    return;
                                }
                            }
                        }
                    }
                }
                
                const targetEl = mutations[0].target;
                const protectedContent = targetEl.getAttribute('data-protected-content');
                
                // Only protect if we have valid content
                if (!protectedContent) return;
                
                // If current content is empty, default, or very short
                const currentContent = targetEl.innerHTML;
                
                // Check if this is a complete reset (vs. an edit or append)
                const isCompleteReset = 
                    currentContent === 'Response will appear here...' || 
                    currentContent === '' || 
                    (!currentContent.trim()) || 
                    (targetEl.textContent && 
                     targetEl.textContent.length < 50 && 
                     protectedContent.length > 100);
                
                if (isCompleteReset) {
                    debugLog("Content reset detected in mutation");
                    window._throttledRestore(targetEl, protectedContent);
                } else {
                    // If content was changed but not reset, check if it's an append
                    const isAppend = 
                        currentContent.includes(protectedContent) || 
                        protectedContent.includes(currentContent);
                    
                    if (isAppend) {
                        // It's probably an append, update the protected content
                        targetEl.setAttribute('data-protected-content', currentContent);
                        debugLog("Detected append, updated protected content");
                        window._protectionRestoreCount = 0; // Reset counter
                    } else if (currentContent !== protectedContent && 
                               currentContent.length > 100) {
                        // It's a substantial change, update protected content
                        targetEl.setAttribute('data-protected-content', currentContent);
                        debugLog("Updated protected content due to substantial change");
                        window._protectionRestoreCount = 0; // Reset counter
                    }
                }
            };
        }
        
        // Use a MutationObserver for more reliable monitoring
        if (!window._contentObserver) {
            window._contentObserver = new MutationObserver(window._contentRestoreHandler);
            debugLog("Created new MutationObserver");
        } else {
            // Disconnect existing observer
            window._contentObserver.disconnect();
            debugLog("Disconnected existing MutationObserver");
        }
        
        // Start observing with the observer - only watch for childList changes
        window._contentObserver.observe(elements.responseBox, {
            childList: true,
            subtree: true
        });
        debugLog("MutationObserver started");
        
        // Reset counter when we set up new protection
        window._protectionRestoreCount = 0;
        
        // Add event listeners to clear buttons
        const clearButtons = document.querySelectorAll('button:contains("Clear")');
        clearButtons.forEach(button => {
            // Remove any existing listeners
            button.removeEventListener('click', window._handleClearClick);
            
            // Create a listener if it doesn't exist
            if (!window._handleClearClick) {
                window._handleClearClick = function() {
                    window._intentionalClear = true;
                    debugLog("Clear button clicked, disabling protection temporarily");
                    setTimeout(() => {
                        window._intentionalClear = false;
                    }, 1000);
                };
            }
            
            // Add the listener
            button.addEventListener('click', window._handleClearClick);
        });
        
        // Setup a less frequent interval check as an extra safety net
        window._contentProtectionInterval = setInterval(() => {
            if (elements.responseBox && !window._intentionalClear) {
                const protectedContent = elements.responseBox.getAttribute('data-protected-content');
                if (!protectedContent) return; // No protected content yet
                
                const currentBoxContent = elements.responseBox.innerHTML;
                
                // Check if content was reset to default or emptied
                if (currentBoxContent !== protectedContent && 
                    (currentBoxContent === 'Response will appear here...' || 
                     currentBoxContent === '' || 
                     !currentBoxContent.trim() ||
                     (elements.responseBox.textContent && 
                      elements.responseBox.textContent.length < 50 && 
                      protectedContent.length > 100))) {
                    
                    debugLog("Content reset detected in interval check");
                    window._throttledRestore(elements.responseBox, protectedContent);
                }
            }
        }, 5000); // Check only every 5 seconds
        
        debugLog("Permanent content protection enabled");
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
            
            // Save both the prompt and response for debugging/recovery
            localStorage.setItem('lastSentPrompt', formattedPrompt);
            localStorage.setItem('lastGeneratedResponse', formattedResponse);
            
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
            
            // Start content protection immediately after updating content
            // instead of waiting for the next section of code to execute
            protectContent();
            
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
     * Clear response - properly handle protection
     */
    function clearResponse() {
        if (elements.responseBox) {
            // Temporarily disable protection
            const shouldProtect = window._contentObserver !== null;
            
            if (shouldProtect) {
                debugLog("Temporarily suspending protection for clear operation");
                if (window._contentObserver) {
                    window._contentObserver.disconnect();
                }
                if (window._contentProtectionInterval) {
                    clearInterval(window._contentProtectionInterval);
                    window._contentProtectionInterval = null;
                }
                
                // Flag that this is an intentional clear
                window._intentionalClear = true;
            }
            
            // Clear the content
            elements.responseBox.innerHTML = 'Response will appear here...';
            
            // Also clear the protected content attribute
            elements.responseBox.removeAttribute('data-protected-content');
            
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
            
            // Let the clear operation settle before re-enabling protection
            setTimeout(() => {
                window._intentionalClear = false;
                debugLog("Clear operation complete");
            }, 1000);
        }
    }
    
    /**
     * Clear evaluation - with proper protection handling
     */
    function clearEvaluation() {
        if (elements.evaluationResults) {
            // Temporarily disable protection
            window._intentionalClear = true;
            
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
            
            // Let the clear operation settle before re-enabling protection
            setTimeout(() => {
                window._intentionalClear = false;
                debugLog("Evaluation clear operation complete");
            }, 1000);
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
    
    // Also initialize after window load as a backup
    window.addEventListener('load', function() {
        setTimeout(initialize, 1000);
    });
    
    // Emergency recovery function - expose globally
    window.recoverLastResponse = function() {
        const lastResponse = localStorage.getItem('lastGeneratedResponse');
        
        // Try to find the response box even if elements.responseBox is null
        const responseBox = elements.responseBox || 
                          document.querySelector('[contenteditable="true"]') ||
                          document.querySelector('.response-box');
        
        if (lastResponse && responseBox) {
            console.log("Attempting to recover last response");
            responseBox.innerHTML = lastResponse;
            
            // If this isn't in elements yet, add it
            if (!elements.responseBox && !responseBox.id) {
                responseBox.id = 'response';
            }
            
            protectContent();
            return true;
        }
        
        return false;
    };
    
    // Monitor and fix missing elements - poll every second
    setInterval(function() {
        const responseBox = elements.responseBox;
        if (!responseBox) {
            debugLog("Response box still missing - searching again");
            const candidates = document.querySelectorAll('[contenteditable="true"]');
            if (candidates.length > 0) {
                candidates[0].id = 'response';
                debugLog("Added ID to candidate element");
            }
        }
    }, 1000);
    
    // Emergency fix function - call this to stop protection if frozen
    window.stopProtection = function() {
        // Clear all protection mechanisms
        if (window._contentProtectionInterval) {
            clearInterval(window._contentProtectionInterval);
            window._contentProtectionInterval = null;
            console.log("Stopped protection interval");
        }
        
        if (window._contentObserver) {
            window._contentObserver.disconnect();
            window._contentObserver = null;
            console.log("Disconnected mutation observer");
        }
        
        // Reset counters and flags
        window._protectionRestoreCount = 0;
        window._lastProtectionTime = 0;
        
        // Try to restore original innerHTML setter
        if (elements.responseBox && window._originalInnerHTMLSetter) {
            try {
                const elementProto = Object.getPrototypeOf(elements.responseBox);
                Object.defineProperty(elements.responseBox, 'innerHTML', {
                    set: window._originalInnerHTMLSetter,
                    configurable: true
                });
                console.log("Restored original innerHTML setter");
            } catch (e) {
                console.error("Could not restore innerHTML setter:", e);
            }
        }
        
        console.log("All protection mechanisms stopped");
        return "Protection stopped";
    };
})();