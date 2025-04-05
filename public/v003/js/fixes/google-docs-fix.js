/**
 * google-docs-fix.js
 * Fixes Google Docs integration issues in Cresonia AI
 */

/**
 * Improved connect to Google Docs function with proper error handling
 */
function connectToGoogleDocs() {
    console.log("Connect to Google Docs button clicked");
    
    // Get the current settings
    const settings = typeof StorageService !== 'undefined' ? StorageService.getSettings() : 
                   JSON.parse(localStorage.getItem('cresonia-settings') || '{}');
    
    if (!settings.googleApiKey || !settings.googleClientId) {
        console.error('Missing Google API credentials');
        
        // Update status message
        const statusEl = document.getElementById('googleAuthStatus');
        if (statusEl) {
            statusEl.className = 'auth-status not-connected';
            const statusText = statusEl.querySelector('.status-text');
            if (statusText) {
                statusText.textContent = 'API credentials required in Settings';
            }
        }
        
        // Show alert
        alert('Google API credentials are required. Please add them in Settings.');
        return;
    }
    
    // Initialize the service manually
    initializeAndConnectGoogleDocs(settings.googleApiKey, settings.googleClientId);
}

/**
 * Initialize and connect to Google Docs with proper error handling
 */
async function initializeAndConnectGoogleDocs(apiKey, clientId) {
    console.log("Initializing Google Docs service with provided credentials");
    
    try {
        // Ensure gapi is loaded
        if (typeof gapi === 'undefined') {
            console.error("GAPI not available");
            alert("Google API not available. Please refresh the page and try again.");
            return;
        }
        
        // Load the client
        await new Promise((resolve, reject) => {
            gapi.load('client', {
                callback: resolve,
                onerror: reject,
                timeout: 5000,
                ontimeout: () => reject(new Error('GAPI loading timeout'))
            });
        });
        
        console.log("GAPI client loaded");
        
        // Initialize the client with API key
        await gapi.client.init({
            apiKey: apiKey,
            discoveryDocs: [
                'https://docs.googleapis.com/$discovery/rest?version=v1',
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
            ]
        });
        
        console.log("GAPI client initialized with API key");
        
        // Check if we have Google accounts API
        if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
            console.error("Google Accounts API not available");
            alert("Google Accounts API not available. Please refresh the page and try again.");
            return;
        }
        
        console.log("Google Accounts API is available");
        
        // Initialize token client
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
            callback: (response) => {
                console.log("Auth callback received:", response);
                
                if (response.error) {
                    console.error("OAuth error:", response);
                    alert("Authentication failed: " + response.error);
                    
                    // Update UI
                    const statusElement = document.getElementById('googleAuthStatus');
                    if (statusElement) {
                        statusElement.className = 'auth-status not-connected';
                        const statusText = statusElement.querySelector('.status-text');
                        if (statusText) {
                            statusText.textContent = 'Authentication failed';
                        }
                    }
                    
                } else {
                    console.log("Authorization successful");
                    
                    // Update UI
                    const statusElement = document.getElementById('googleAuthStatus');
                    const controlsElement = document.getElementById('googleDocsControls');
                    const connectButton = document.getElementById('connectGoogleDocs');
                    
                    if (statusElement) {
                        statusElement.className = 'auth-status connected';
                        const statusText = statusElement.querySelector('.status-text');
                        if (statusText) {
                            statusText.textContent = 'Connected';
                        }
                    }
                    
                    if (controlsElement) {
                        controlsElement.style.display = 'flex';
                    }
                    
                    if (connectButton) {
                        connectButton.textContent = 'Disconnect from Google Docs';
                    }
                    
                    // Try to list docs
                    listGoogleDocs();
                }
            },
            prompt: 'consent'
        });
        
        // Request the token
        console.log("Requesting access token");
        tokenClient.requestAccessToken();
        
    } catch (error) {
        console.error("Error initializing Google Docs:", error);
        alert("Failed to initialize Google Docs: " + error.message);
    }
}

/**
 * List Google Docs with proper error handling
 */
async function listGoogleDocs() {
    try {
        console.log("Listing Google Docs");
        
        // Make sure Drive API is loaded
        if (!gapi.client.drive) {
            await gapi.client.load('drive', 'v3');
        }
        
        const response = await gapi.client.drive.files.list({
            pageSize: 10,
            fields: 'files(id, name, createdTime, webViewLink)',
            q: "mimeType='application/vnd.google-apps.document' and trashed=false",
            orderBy: 'modifiedTime desc'
        });
        
        const docs = response.result.files;
        
        // Update the UI
        const listElement = document.getElementById('googleDocsList');
        if (!listElement) {
            console.warn('googleDocsList element not found');
            return;
        }
        
        if (!docs || docs.length === 0) {
            listElement.innerHTML = '<div class="empty-placeholder">No documents found</div>';
            return;
        }
        
        // Format the docs list
        const docItems = docs.map(doc => {
            const date = new Date(doc.createdTime);
            const formattedDate = date.toLocaleDateString();
            
            return `
                <div class="doc-item" data-id="${doc.id}" data-url="${doc.webViewLink}">
                    <div class="doc-icon">📄</div>
                    <div class="doc-title">${doc.name}</div>
                    <div class="doc-date">${formattedDate}</div>
                </div>
            `;
        }).join('');
        
        listElement.innerHTML = docItems;
        
        // Add event listeners for document items
        document.querySelectorAll('.doc-item').forEach(item => {
            item.addEventListener('click', () => {
                const docUrl = item.dataset.url;
                window.open(docUrl, '_blank');
            });
        });
        
        console.log("Google Docs list updated");
        
    } catch (error) {
        console.error("Error listing Google Docs:", error);
        
        // Update the UI with error
        const listElement = document.getElementById('googleDocsList');
        if (listElement) {
            listElement.innerHTML = `<div class="empty-placeholder error">Error listing documents: ${error.message}</div>`;
        }
    }
}

/**
 * Set up event listeners for Google Docs integration
 */
function setupGoogleDocsHandlers() {
    // Connect button
    const connectBtn = document.getElementById('connectGoogleDocs');
    if (connectBtn) {
        // Replace with a fresh button to clear any previous listeners
        const newBtn = connectBtn.cloneNode(true);
        connectBtn.parentNode.replaceChild(newBtn, connectBtn);
        
        // Add our direct handler
        newBtn.addEventListener('click', connectToGoogleDocs);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshGoogleDocs');
    if (refreshBtn) {
        // Replace with a fresh button to clear any previous listeners
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        // Add our direct handler
        newRefreshBtn.addEventListener('click', listGoogleDocs);
    }
    
    // Export button
    const exportBtn = document.getElementById('exportToDocsButton');
    if (exportBtn) {
        // Replace with a fresh button to clear any previous listeners
        const newExportBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
        
        // Add our handler
        newExportBtn.addEventListener('click', async () => {
            // Check if authenticated
            if (typeof gapi === 'undefined' || !gapi.client || !gapi.client.getToken()) {
                const responseStatus = document.getElementById('responseStatus');
                if (responseStatus) {
                    responseStatus.textContent = 'Please connect to Google Docs first';
                    setTimeout(() => { responseStatus.textContent = ''; }, 3000);
                }
                return;
            }
            
            const responseElement = document.getElementById('response');
            if (!responseElement) return;
            
            // Get the prose content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = responseElement.innerHTML;
            const proseContent = tempDiv.textContent || tempDiv.innerText;
            
            if (!proseContent || proseContent === 'Response will appear here...') {
                alert('Please generate some prose content first');
                return;
            }
            
            // Update button state
            newExportBtn.disabled = true;
            newExportBtn.innerHTML = '<span class="google-icon"></span> Exporting...';
            
            try {
                const responseStatus = document.getElementById('responseStatus');
                if (responseStatus) {
                    responseStatus.textContent = 'Creating Google Doc...';
                }
                
                // Create an empty document first
                const createResponse = await gapi.client.docs.documents.create({
                    title: 'Cresonia AI Generated Content'
                });
                
                const documentId = createResponse.result.documentId;
                
                // Insert content into the document
                await gapi.client.docs.documents.batchUpdate({
                    documentId,
                    resource: {
                        requests: [{
                            insertText: {
                                location: {
                                    index: 1
                                },
                                text: proseContent
                            }
                        }]
                    }
                });
                
                // Show success message
                if (responseStatus) {
                    responseStatus.textContent = `Exported to Google Docs successfully! Opening document...`;
                    setTimeout(() => {
                        responseStatus.textContent = '';
                    }, 3000);
                }
                
                // Open the document in a new tab
                const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;
                window.open(docUrl, '_blank');
                
                // Refresh the docs list
                listGoogleDocs();
                
            } catch (error) {
                console.error('Error exporting to Google Docs:', error);
                
                const responseStatus = document.getElementById('responseStatus');
                if (responseStatus) {
                    responseStatus.textContent = `Error exporting to Google Docs: ${error.message}`;
                    setTimeout(() => {
                        responseStatus.textContent = '';
                    }, 5000);
                }
            } finally {
                // Restore button state
                newExportBtn.disabled = false;
                newExportBtn.innerHTML = '<span class="google-icon"></span> Export to Google Docs';
            }
        });
    }
}

// Initialize the Google Docs fix when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Google Docs Fix: Initializing...');
    setupGoogleDocsHandlers();
    console.log('Google Docs Fix: Initialized successfully');
});
