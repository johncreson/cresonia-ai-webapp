/**
 * content-protection-fix.js
 * Protects prose content from being accidentally lost or reset
 */

/**
 * Protect content from being unexpectedly changed with throttling 
 * and improved user action detection
 */
function protectContent() {
    console.log("Setting up content protection");
    
    // Get the response box
    const responseBox = document.getElementById('response');
    if (!responseBox) {
        console.warn("Cannot protect content - response box not found");
        return;
    }
    
    // Check for intentional clear operation in progress
    if (window._intentionalClear) {
        console.log("Not protecting during intentional clear operation");
        return;
    }
    
    // Don't protect error messages
    if (responseBox.innerHTML.includes('<div class="error">')) {
        console.log("Not protecting error message content");
        return;
    }
    
    // Don't protect empty or default content
    if (responseBox.innerHTML === 'Response will appear here...' || 
        !responseBox.innerHTML.trim()) {
        console.log("Not protecting default/empty content");
        return;
    }
    
    // Store the current content for comparison
    const currentContent = responseBox.innerHTML;
    console.log("Protecting content:", currentContent.substring(0, 50) + "...");
    
    // Cancel any existing protection interval
    if (window._contentProtectionInterval) {
        clearInterval(window._contentProtectionInterval);
        console.log("Cleared existing protection interval");
    }
    
    // Store a copy of the content in a data attribute for safer storage
    responseBox.setAttribute('data-protected-content', currentContent);
    
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
                console.log("Not restoring during intentional clear");
                return false;
            }
            
            // Check if we've had too many restorations in a row
            if (window._protectionRestoreCount > 5) {
                console.log("Too many consecutive restorations, pausing protection");
                setTimeout(() => { window._protectionRestoreCount = 0; }, 5000);
                return false;
            }
            
            // Throttle restorations to prevent freezing
            const now = Date.now();
            if (now - window._lastProtectionTime < 1000) { // At most 1 restoration per second
                console.log("Throttling restoration");
                return false;
            }
            
            // Update timestamp
            window._lastProtectionTime = now;
            
            // Increment counter
            window._protectionRestoreCount++;
            
            // Do the actual restoration
            console.log("Restoring content (count: " + window._protectionRestoreCount + ")");
            targetEl.innerHTML = protectedContent;
            
            return true;
        };
    }
    
    // Create a backup restoration function that will be called on mutation events
    if (!window._contentRestoreHandler) {
        window._contentRestoreHandler = function(mutations) {
            // Skip if we're in an intentional clear operation
            if (window._intentionalClear) {
                console.log("Mutation ignored during intentional clear");
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
                                console.log("Detected append operation, not triggering protection");
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
                console.log("Content reset detected in mutation");
                window._throttledRestore(targetEl, protectedContent);
            } else {
                // If content was changed but not reset, check if it's an append
                const isAppend = 
                    currentContent.includes(protectedContent) || 
                    protectedContent.includes(currentContent);
                
                if (isAppend) {
                    // It's probably an append, update the protected content
                    targetEl.setAttribute('data-protected-content', currentContent);
                    console.log("Detected append, updated protected content");
                    window._protectionRestoreCount = 0; // Reset counter
                } else if (currentContent !== protectedContent && 
                           currentContent.length > 100) {
                    // It's a substantial change, update protected content
                    targetEl.setAttribute('data-protected-content', currentContent);
                    console.log("Updated protected content due to substantial change");
                    window._protectionRestoreCount = 0; // Reset counter
                }
            }
        };
    }
    
    // Use a MutationObserver for more reliable monitoring
    if (!window._contentObserver) {
        window._contentObserver = new MutationObserver(window._contentRestoreHandler);
        console.log("Created new MutationObserver");
    } else {
        // Disconnect existing observer
        window._contentObserver.disconnect();
        console.log("Disconnected existing MutationObserver");
    }
    
    // Start observing with the observer - only watch for childList changes
    window._contentObserver.observe(responseBox, {
        childList: true,
        subtree: true
    });
    console.log("MutationObserver started");
    
    // Reset counter when we set up new protection
    window._protectionRestoreCount = 0;
    
    // Find all Clear buttons and add event listeners
    const clearButtons = Array.from(document.querySelectorAll('button')).filter(
        button => button.textContent.trim().includes("Clear")
    );
    
    clearButtons.forEach(button => {
        // Remove any existing listeners
        button.removeEventListener('click', window._handleClearClick);
        
        // Create a listener if it doesn't exist
        if (!window._handleClearClick) {
            window._handleClearClick = function() {
                window._intentionalClear = true;
                console.log("Clear button clicked, disabling protection temporarily");
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
        if (responseBox && !window._intentionalClear) {
            const protectedContent = responseBox.getAttribute('data-protected-content');
            if (!protectedContent) return; // No protected content yet
            
            const currentBoxContent = responseBox.innerHTML;
            
            // Check if content was reset to default or emptied
            if (currentBoxContent !== protectedContent && 
                (currentBoxContent === 'Response will appear here...' || 
                 currentBoxContent === '' || 
                 !currentBoxContent.trim() ||
                 (responseBox.textContent && 
                  responseBox.textContent.length < 50 && 
                  protectedContent.length > 100))) {
                
                console.log("Content reset detected in interval check");
                window._throttledRestore(responseBox, protectedContent);
            }
        }
    }, 5000); // Check only every 5 seconds
    
    console.log("Permanent content protection enabled");
}

/**
 * Function to recover content from local storage backup
 */
function recoverFromBackup() {
    const responseBox = document.getElementById('response');
    if (!responseBox) return false;
    
    // Check for backup in localStorage
    const backupContent = localStorage.getItem('prose_content_backup');
    if (!backupContent) {
        console.log("No backup content found");
        return false;
    }
    
    // Restore the content
    responseBox.innerHTML = backupContent;
    console.log("Content restored from backup");
    
    // Protect the restored content
    protectContent();
    
    return true;
}

/**
 * Save content to local backup
 */
function saveToLocalBackup() {
    const responseBox = document.getElementById('response');
    if (!responseBox) return;
    
    const content = responseBox.innerHTML;
    if (content && content !== 'Response will appear here...') {
        localStorage.setItem('prose_content_backup', content);
        localStorage.setItem('prose_backup_timestamp', new Date().toISOString());
        console.log("Content saved to local backup");
    }
}

/**
 * Set up listeners for content protection
 */
function setupContentProtection() {
    // Setup protection on load
    const responseBox = document.getElementById('response');
    if (responseBox) {
        // Initialize protection flags
        window._intentionalClear = false;
        window._protectionRestoreCount = 0;
        window._lastProtectionTime = 0;
        
        // Set up input handler to save to backup
        responseBox.addEventListener('input', function() {
            saveToLocalBackup();
        });
        
        // Protect content if it's not empty/default
        if (responseBox.innerHTML !== 'Response will appear here...' && 
            responseBox.innerHTML.trim() !== '') {
            protectContent();
        } else {
            // Try to recover from backup if content is empty/default
            recoverFromBackup();
        }
    }
    
    // Add global emergency recovery function
    window.recoverContent = function() {
        return recoverFromBackup();
    };
    
    // Add function to stop protection (for debugging)
    window.stopProtection = function() {
        if (window._contentObserver) {
            window._contentObserver.disconnect();
            window._contentObserver = null;
        }
        
        if (window._contentProtectionInterval) {
            clearInterval(window._contentProtectionInterval);
            window._contentProtectionInterval = null;
        }
        
        console.log("Content protection disabled");
        return "Protection stopped";
    };
}

// Initialize the content protection when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Content Protection Fix: Initializing...');
    setupContentProtection();
    console.log('Content Protection Fix: Initialized successfully');
});

// Also set up on window load as backup
window.addEventListener('load', function() {
    setTimeout(function() {
        if (!window._contentProtectionInterval) {
            console.log('Content Protection Fix: Initializing on window load...');
            setupContentProtection();
        }
    }, 1000);
});
