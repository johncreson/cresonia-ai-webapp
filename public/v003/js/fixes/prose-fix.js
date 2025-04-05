/**
 * prose-fix.js
 * Fixes issues with prose editing in Cresonia AI
 * Focuses on the append and clear functionality
 */

/**
 * Improved sendPrompt function that correctly handles appending to existing content
 */
async function sendPrompt() {
    console.log("Starting sendPrompt function");
    
    // Get prompt text
    const promptTextarea = document.getElementById('prompt');
    const responseBox = document.getElementById('response');
    const promptStatus = document.getElementById('promptStatus');
    
    if (!promptTextarea || !responseBox) {
        console.error("Prompt textarea or response box not found");
        return;
    }
    
    const promptText = promptTextarea.value.trim();
    if (!promptText) {
        if (promptStatus) promptStatus.textContent = 'Please enter a prompt';
        setTimeout(() => { if (promptStatus) promptStatus.textContent = ''; }, 3000);
        return;
    }
    
    // Check if API key is set
    const settings = typeof StorageService !== 'undefined' ? StorageService.getSettings() : 
                     JSON.parse(localStorage.getItem('cresonia-settings') || '{}');
    
    if (!settings.apiKey) {
        if (promptStatus) promptStatus.textContent = 'Please enter your API key in settings';
        setTimeout(() => { if (promptStatus) promptStatus.textContent = ''; }, 3000);
        return;
    }
    
    // Check if we're already generating
    if (window.isGeneratingResponse) {
        if (promptStatus) promptStatus.textContent = 'Already generating a response';
        setTimeout(() => { if (promptStatus) promptStatus.textContent = ''; }, 3000);
        return;
    }
    
    try {
        window.isGeneratingResponse = true;
        if (promptStatus) promptStatus.textContent = 'Generating response...';
        
        // Get include prose checkbox value
        const includeProseCheckbox = document.getElementById('includeProse');
        const includeProse = includeProseCheckbox && includeProseCheckbox.checked;
        
        // Get previous content if needed
        let previousContent = '';
        if (includeProse && responseBox) {
            const currentContent = responseBox.textContent || responseBox.innerText;
            if (currentContent && currentContent !== 'Response will appear here...') {
                previousContent = currentContent;
            }
        }
        
        // Format the prompt
        const formattedPrompt = AIService.formatPrompt(
            promptText,
            settings.styleGuide || '',
            previousContent,
            includeProse
        );
        
        // Check if the response box has default content
        const isDefaultResponse = !responseBox || 
                               responseBox.innerHTML === 'Response will appear here...' ||
                               responseBox.innerHTML.includes('Loading...');
        
        // Store original content for appending
        const originalContent = isDefaultResponse ? '' : responseBox.innerHTML;
        
        // Set loading state based on whether we're appending or replacing
        if (!isDefaultResponse) {
            // Create a separator and loading placeholder for append
            responseBox.innerHTML += '<div class="response-separator"></div><div id="loading-placeholder">Loading...</div>';
        } else {
            // Simple loading for replace
            responseBox.innerHTML = '<div id="loading-placeholder">Loading...</div>';
        }
        
        // Generate response
        const response = await AIService.generateResponse(formattedPrompt, settings);
        
        // Format the response
        const formattedResponse = AIService.formatResponseAsHTML(response);
        
        // Disable any protection mechanisms temporarily
        if (window._contentObserver) {
            window._contentObserver.disconnect();
        }
        if (window._contentProtectionInterval) {
            clearInterval(window._contentProtectionInterval);
        }
        
        // Update the response box
        const loadingPlaceholder = document.getElementById('loading-placeholder');
        if (loadingPlaceholder && responseBox) {
            // Replace only the loading placeholder with the new content
            loadingPlaceholder.outerHTML = formattedResponse;
        } else if (responseBox) {
            if (isDefaultResponse) {
                // Replace if this was default content
                responseBox.innerHTML = formattedResponse;
            } else {
                // Append the new content while preserving existing content
                responseBox.innerHTML = originalContent + 
                    '<div class="response-separator"></div>' + formattedResponse;
            }
        }
        
        // Re-enable content protection if such a function exists
        if (typeof protectContent === 'function') {
            setTimeout(protectContent, 100);
        }
        
        // Update word count if we have the function
        if (typeof updateWordCount === 'function') {
            updateWordCount('response');
        } else if (window.proseEditor && window.proseEditor.updateWordCount) {
            window.proseEditor.updateWordCount();
        }
        
        // Save content if available
        if (typeof StorageService !== 'undefined' && StorageService.saveCurrentContent) {
            setTimeout(() => {
                StorageService.saveCurrentContent().catch(error => {
                    console.error('Error saving content after generation:', error);
                });
            }, 500);
        }
        
        if (promptStatus) {
            promptStatus.textContent = 'Response generated successfully!';
            setTimeout(() => { promptStatus.textContent = ''; }, 3000);
        }
        
    } catch (error) {
        console.error('Error generating response:', error);
        
        const loadingPlaceholder = document.getElementById('loading-placeholder');
        if (loadingPlaceholder && responseBox) {
            loadingPlaceholder.outerHTML = `<div class="error">Error: ${error.message}</div>`;
        } else if (responseBox) {
            responseBox.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        }
        
        if (promptStatus) {
            promptStatus.textContent = 'Failed to get response';
            setTimeout(() => { promptStatus.textContent = ''; }, 3000);
        }
        
    } finally {
        window.isGeneratingResponse = false;
    }
}

/**
 * Improved clearResponse function that handles content protection properly
 */
function clearResponse() {
    const responseBox = document.getElementById('response');
    
    if (!responseBox) return;
    
    // Set flag for intentional clear if such a flag exists
    if (typeof window._intentionalClear !== 'undefined') {
        window._intentionalClear = true;
    }
    
    // Disable any content protection mechanisms if they exist
    if (window._contentObserver) {
        window._contentObserver.disconnect();
    }
    if (window._contentProtectionInterval) {
        clearInterval(window._contentProtectionInterval);
        window._contentProtectionInterval = null;
    }
    
    // Simply set to default text
    responseBox.innerHTML = 'Response will appear here...';
    
    // Clear the protected content attribute if it exists
    responseBox.removeAttribute('data-protected-content');
    
    // Update word count if available
    if (typeof updateWordCount === 'function') {
        updateWordCount('response');
    } else if (window.proseEditor && window.proseEditor.updateWordCount) {
        window.proseEditor.updateWordCount();
    }
    
    // Update project if available
    if (typeof StorageService !== 'undefined' && StorageService.getCurrentProject) {
        StorageService.getCurrentProject().then(project => {
            if (project) {
                project.content = '';
                StorageService.updateProject(project).catch(error => {
                    console.error('Error clearing project content:', error);
                });
            }
        });
    }
    
    // Allow time for the clear operation to settle
    setTimeout(() => {
        if (typeof window._intentionalClear !== 'undefined') {
            window._intentionalClear = false;
        }
        console.log("Clear operation complete");
    }, 500);
}

/**
 * Set up event handlers for the prose functionalities
 */
function setupProseHandlers() {
    // Generate Response button
    const sendPromptBtn = document.getElementById('sendPrompt');
    if (sendPromptBtn) {
        // Replace with a fresh button to avoid multiple handlers
        const newBtn = sendPromptBtn.cloneNode(true);
        sendPromptBtn.parentNode.replaceChild(newBtn, sendPromptBtn);
        
        // Add our direct handler
        newBtn.addEventListener('click', sendPrompt);
    }
    
    // Clear button
    const clearResponseBtn = document.getElementById('clearResponse');
    if (clearResponseBtn) {
        // Replace with a fresh button to avoid multiple handlers
        const newBtn = clearResponseBtn.cloneNode(true);
        clearResponseBtn.parentNode.replaceChild(newBtn, clearResponseBtn);
        
        // Add our direct handler
        newBtn.addEventListener('click', clearResponse);
    }
    
    // Copy response button
    const copyResponseBtn = document.getElementById('copyResponse');
    if (copyResponseBtn) {
        const newBtn = copyResponseBtn.cloneNode(true);
        copyResponseBtn.parentNode.replaceChild(newBtn, copyResponseBtn);
        
        newBtn.addEventListener('click', () => {
            const responseBox = document.getElementById('response');
            if (!responseBox) return;
            
            // Create a temporary element to extract text content without HTML formatting
            const tempElement = document.createElement('div');
            tempElement.innerHTML = responseBox.innerHTML;
            const responseText = tempElement.textContent || tempElement.innerText;
            
            if (responseText && responseText !== 'Response will appear here...' && responseText !== 'Loading...') {
                navigator.clipboard.writeText(responseText)
                    .then(() => {
                        const responseStatus = document.getElementById('responseStatus');
                        if (responseStatus) {
                            responseStatus.textContent = 'Response copied to clipboard!';
                            setTimeout(() => { responseStatus.textContent = ''; }, 3000);
                        }
                    })
                    .catch(err => {
                        console.error('Could not copy text: ', err);
                        const responseStatus = document.getElementById('responseStatus');
                        if (responseStatus) {
                            responseStatus.textContent = 'Could not copy text';
                            setTimeout(() => { responseStatus.textContent = ''; }, 3000);
                        }
                    });
            }
        });
    }
}

// Set up content protection function if it doesn't exist
if (typeof protectContent !== 'function') {
    window.protectContent = function() {
        console.log("Setting up content protection");
        
        const responseBox = document.getElementById('response');
        if (!responseBox) return;
        
        // Skip protection for default or error content
        if (responseBox.innerHTML === 'Response will appear here...' || 
            responseBox.innerHTML.includes('<div class="error">') ||
            !responseBox.innerHTML.trim()) {
            return;
        }
        
        // Store the current content for comparison
        const currentContent = responseBox.innerHTML;
        responseBox.setAttribute('data-protected-content', currentContent);
        
        console.log("Content protected");
    };
}

// Initialize the prose fix when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Prose Fix: Initializing...');
    setupProseHandlers();
    console.log('Prose Fix: Initialized successfully');
});
