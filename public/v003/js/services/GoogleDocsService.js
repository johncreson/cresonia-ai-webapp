// GoogleDocsService.js - Handles all interactions with the Google Docs API
class GoogleDocsService {
    // API config - these need to be filled with actual values from Google Cloud Console
    static CLIENT_ID = '190817661401-ufnlbdsqrrpir58bfgibtreuv338plb6.apps.googleusercontent.com'; // You'll need to add your Google API Client ID
    static API_KEY = 'AIzaSyAYCWiYNWw0mtjb5ZC_T1hWHeUthO0l_R0';  // You'll need to add your Google API Key
    static DISCOVERY_DOCS = [
        'https://docs.googleapis.com/$discovery/rest?version=v1',
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ];
    static SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';
    
    // Service state
    static isInitialized = false;
    static isAuthorized = false;
    static gisInitialized = false;
    static tokenClient = null;
    static hasCredentials = false;
    
    /**
     * Initialize the Google API client
     */
    static async initialize() {
        console.log('GoogleDocsService: Initializing...');
        
        // Skip if already initialized
        if (this.isInitialized) {
            console.log('GoogleDocsService: Already initialized');
            return;
        }
        
        try {
            // Load settings
            const settings = StorageService.getSettings();
            if (settings.googleApiKey) {
                this.API_KEY = settings.googleApiKey;
                console.log('GoogleDocsService: API key loaded from settings');
            }
            
            // Update the auth status UI to show not connected
            this.updateAuthStatus(false);
            
            // Check if we have the required credentials
            if (!this.API_KEY && !this.CLIENT_ID) {
                console.log('GoogleDocsService: No API key or Client ID provided. Google Docs integration unavailable.');
                this.hasCredentials = false;
                this.isInitialized = true; // Mark as initialized even though we can't use it
                this.updateAuthStatusMessage('Google API credentials not configured. Add them in Settings.');
                return;
            }

            this.hasCredentials = true;
            
            try {
                // Initialize the Google API client library
                await new Promise((resolve, reject) => {
                    gapi.load('client', {
                        callback: resolve,
                        onerror: reject,
                        timeout: 5000,
                        ontimeout: reject
                    });
                });
                
                console.log('GoogleDocsService: GAPI client loaded');
                
                // Initialize the client with API key and discovery docs
                if (this.API_KEY) {
                    await gapi.client.init({
                        apiKey: this.API_KEY,
                        discoveryDocs: this.DISCOVERY_DOCS,
                    });
                    console.log('GoogleDocsService: GAPI client initialized with API key');
                } else {
                    console.log('GoogleDocsService: No API key available, skipping gapi.client.init');
                }
                
                // Initialize the GIS client if we have a client ID
                if (this.CLIENT_ID && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: this.CLIENT_ID,
                        scope: this.SCOPES,
                        callback: (response) => {
                            if (response.error) {
                                console.error('OAuth error:', response);
                                this.isAuthorized = false;
                            } else {
                                this.isAuthorized = true;
                            }
                            this.updateAuthStatus(this.isAuthorized);
                        },
                        prompt: 'consent'
                    });
                    this.gisInitialized = true;
                    console.log('GoogleDocsService: Token client initialized');
                } else {
                    console.log('GoogleDocsService: Missing CLIENT_ID or Google accounts API, auth unavailable');
                    this.updateAuthStatusMessage('Google Client ID not configured. Add it in Settings.');
                }
                
                // Check if we're already authorized
                this.isAuthorized = gapi.client.getToken() !== null;
                this.updateAuthStatus(this.isAuthorized);
            } catch (apiError) {
                console.error('Error initializing Google APIs:', apiError);
                this.updateAuthStatusMessage('Error initializing Google APIs. Check console for details.');
            }
            
            this.isInitialized = true;
            console.log('GoogleDocsService: Initialization complete');
            
        } catch (error) {
            console.error('Fatal error initializing Google Docs service:', error);
            this.updateAuthStatus(false);
            this.updateAuthStatusMessage('Failed to initialize Google Docs integration.');
        }
    }
    
    /**
     * Update auth status message with custom text
     */
    static updateAuthStatusMessage(message) {
        const statusElement = document.getElementById('googleAuthStatus');
        if (!statusElement) return;
        
        const statusText = statusElement.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = message;
        }
    }
    
    /**
     * Authorize with Google
     */
    static async authorize() {
        console.log('GoogleDocsService: Authorization requested');
        
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        if (!this.hasCredentials) {
            console.log('GoogleDocsService: Cannot authorize - missing credentials');
            this.updateAuthStatusMessage('Google API credentials required in Settings');
            return;
        }
        
        if (!this.gisInitialized || !this.tokenClient) {
            console.log('GoogleDocsService: Cannot authorize - token client not initialized');
            this.updateAuthStatusMessage('Google auth not available. Check settings.');
            return;
        }
        
        // Detect if we're on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        try {
            // For mobile, we need to use redirect flow without popups
            if (isMobile) {
                console.log("GoogleDocsService: Using mobile auth flow");
                this.tokenClient.requestAccessToken({
                    prompt: '',
                    hint: '',
                });
            } else {
                // For desktop, we can use the default flow
                console.log("GoogleDocsService: Using desktop auth flow");
                this.tokenClient.requestAccessToken();
            }
        } catch (error) {
            console.error('Authorization error:', error);
            this.updateAuthStatusMessage('Authorization failed. See console for details.');
        }
    }
    
    /**
     * Check if user is authorized
     */
    static async isAuthenticated() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        return this.isAuthorized && this.hasCredentials;
    }
    
    /**
     * Sign out of Google
     */
    static signOut() {
        const token = gapi.client.getToken();
        if (token) {
            try {
                google.accounts.oauth2.revoke(token.access_token, () => {
                    console.log('Token revoked');
                });
                gapi.client.setToken(null);
                this.isAuthorized = false;
                this.updateAuthStatus(false);
                console.log('GoogleDocsService: Signed out');
            } catch (error) {
                console.error('Error signing out:', error);
            }
        }
    }
    
    /**
     * Update the auth status UI
     */
    static updateAuthStatus(isConnected) {
        const statusElement = document.getElementById('googleAuthStatus');
        const controlsElement = document.getElementById('googleDocsControls');
        const connectButton = document.getElementById('connectGoogleDocs');
        
        if (!statusElement || !controlsElement || !connectButton) return;
        
        if (isConnected) {
            statusElement.className = 'auth-status connected';
            statusElement.querySelector('.status-text').textContent = 'Connected';
            controlsElement.style.display = 'flex';
            connectButton.textContent = 'Disconnect from Google Docs';
            
            // Update documents list
            this.listDocs().catch(error => {
                console.error('Error listing docs after auth:', error);
            });
        } else {
            statusElement.className = 'auth-status not-connected';
            if (!this.hasCredentials) {
                statusElement.querySelector('.status-text').textContent = 'API credentials required';
            } else {
                statusElement.querySelector('.status-text').textContent = 'Not connected';
            }
            controlsElement.style.display = 'none';
            connectButton.textContent = 'Connect to Google Docs';
            
            // Clear documents list
            document.getElementById('googleDocsList').innerHTML = 
                '<div class="empty-placeholder">Connect to see your Google Docs</div>';
        }
    }
    
    /**
     * List user's Google Docs
     */
    static async listDocs(maxResults = 10) {
        if (!this.isAuthorized || !this.hasCredentials) {
            console.log('GoogleDocsService: Cannot list docs - not authorized');
            return [];
        }
        
        try {
            // Make sure Drive API is loaded
            if (!gapi.client.drive) {
                await gapi.client.load('drive', 'v3');
            }
            
            const response = await gapi.client.drive.files.list({
                pageSize: maxResults,
                fields: 'files(id, name, createdTime, webViewLink)',
                q: "mimeType='application/vnd.google-apps.document' and trashed=false",
                orderBy: 'modifiedTime desc'
            });
            
            const docs = response.result.files;
            this.updateDocsList(docs);
            return docs;
        } catch (error) {
            console.error('Error listing documents:', error);
            throw error;
        }
    }
    
    /**
     * Update the Google Docs list in the UI
     */
    static updateDocsList(docs) {
        const listElement = document.getElementById('googleDocsList');
        if (!listElement) return;
        
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
                const docId = item.dataset.id;
                const docUrl = item.dataset.url;
                window.open(docUrl, '_blank');
            });
        });
    }
    
    /**
     * Create or find a folder in Google Drive
     */
    static async getOrCreateFolder(folderName) {
        if (!this.isAuthorized || !this.hasCredentials) {
            throw new Error('Not authorized with Google');
        }
        
        try {
            // Make sure Drive API is loaded
            if (!gapi.client.drive) {
                await gapi.client.load('drive', 'v3');
            }
            
            // Check if folder already exists
            const response = await gapi.client.drive.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
                fields: 'files(id, name)'
            });
            
            // If folder exists, return its ID
            if (response.result.files && response.result.files.length > 0) {
                return response.result.files[0].id;
            }
            
            // Create new folder
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            
            return createResponse.result.id;
        } catch (error) {
            console.error('Error creating/finding folder:', error);
            throw error;
        }
    }
    
    /**
     * Create a new Google Doc
     */
    static async createDocument(title, content, folderId = null) {
        if (!this.isAuthorized || !this.hasCredentials) {
            throw new Error('Not authorized with Google');
        }
        
        try {
            // Make sure Drive API is loaded
            if (!gapi.client.drive) {
                await gapi.client.load('drive', 'v3');
            }
            
            // Make sure Docs API is loaded
            if (!gapi.client.docs) {
                await gapi.client.load('docs', 'v1');
            }
            
            // Create document metadata including folder if provided
            const fileMetadata = {
                name: title || 'Cresonia AI Generated Content',
                mimeType: 'application/vnd.google-apps.document'
            };
            
            // Add to folder if folder ID is provided
            if (folderId) {
                fileMetadata.parents = [folderId];
            }
            
            // Create an empty document first
            const createResponse = await gapi.client.docs.documents.create({
                title: title || 'Cresonia AI Generated Content'
            });
            
            const documentId = createResponse.result.documentId;
            
            // If we have a folder, move the document to that folder
            if (folderId) {
                try {
                    // Get current parents
                    const getFileResponse = await gapi.client.drive.files.get({
                        fileId: documentId,
                        fields: 'parents'
                    });
                    
                    // Move file to new folder
                    await gapi.client.drive.files.update({
                        fileId: documentId,
                        addParents: folderId,
                        removeParents: getFileResponse.result.parents.join(','),
                        fields: 'id, parents'
                    });
                } catch (moveError) {
                    console.warn("Couldn't move document to folder:", moveError);
                    // Continue without moving
                }
            }
            
            // Insert content into the document
            if (content) {
                await gapi.client.docs.documents.batchUpdate({
                    documentId,
                    resource: {
                        requests: [{
                            insertText: {
                                location: {
                                    index: 1
                                },
                                text: content
                            }
                        }]
                    }
                });
            }
            
            return {
                id: documentId,
                url: `https://docs.google.com/document/d/${documentId}/edit`,
                title: createResponse.result.title
            };
        } catch (error) {
            console.error('Error creating document:', error);
            throw error;
        }
    }
    
    /**
     * Get a Google Doc content
     */
    static async getDocument(documentId) {
        if (!this.isAuthorized || !this.hasCredentials) {
            throw new Error('Not authorized with Google');
        }
        
        try {
            // Make sure Docs API is loaded
            if (!gapi.client.docs) {
                await gapi.client.load('docs', 'v1');
            }
            
            const response = await gapi.client.docs.documents.get({
                documentId
            });
            
            // Extract plain text content from the document
            const document = response.result;
            let content = '';
            
            // Process the document content
            if (document.body && document.body.content) {
                for (const element of document.body.content) {
                    if (element.paragraph) {
                        for (const paragraphElement of element.paragraph.elements) {
                            if (paragraphElement.textRun && paragraphElement.textRun.content) {
                                content += paragraphElement.textRun.content;
                            }
                        }
                    }
                }
            }
            
            return {
                id: document.documentId,
                title: document.title,
                content
            };
        } catch (error) {
            console.error('Error getting document:', error);
            throw error;
        }
    }
    
    /**
     * Export current prose to Google Docs
     */
    static async exportCurrentProse() {
        const responseElement = document.getElementById('response');
        if (!responseElement) return;
        
        // Get the prose content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = responseElement.innerHTML;
        const proseContent = tempDiv.textContent || tempDiv.innerText;
        
        // Save original content for restoring later
        const originalHTML = responseElement.innerHTML;
        
        if (!proseContent || proseContent === 'Response will appear here...') {
            alert('Please generate some prose content first');
            return;
        }
        
        // Check if authorized
        if (!this.isAuthorized) {
            if (!this.hasCredentials) {
                const responseStatus = document.getElementById('responseStatus');
                if (responseStatus) {
                    responseStatus.textContent = 'Google API credentials required in Settings';
                    setTimeout(() => {
                        responseStatus.textContent = '';
                    }, 3000);
                }
                return;
            }
            
            await this.authorize();
            return; // The callback will handle the rest
        }
        
        try {
            const currentProject = await StorageService.getCurrentProject();
            const title = currentProject ? 
                `${currentProject.name} - Cresonia AI` : 
                'Cresonia AI Generated Content';
            
            // Create Google Doc in a project folder if possible
            let folderId = null;
            
            // Try to create or use a Cresonia AI folder
            try {
                folderId = await this.getOrCreateFolder('Cresonia AI Projects');
                console.log("Using Cresonia AI folder:", folderId);
            } catch (folderError) {
                console.warn("Couldn't create/access folder:", folderError);
                // Continue without folder
            }
            
            // Show creating document status
            responseElement.innerHTML += '<div class="response-separator"></div><div id="export-status">Creating Google Doc...</div>';
            
            const doc = await this.createDocument(title, proseContent, folderId);
            
            // Show success message (replace the export status)
            const exportStatus = document.getElementById('export-status');
            if (exportStatus) {
                exportStatus.innerHTML = `<div class="success-message">Exported to Google Docs successfully! <a href="${doc.url}" target="_blank">Open document</a></div>`;
            }
            
            const responseStatus = document.getElementById('responseStatus');
            if (responseStatus) {
                responseStatus.textContent = `Exported to Google Docs successfully! Opening document...`;
                setTimeout(() => {
                    responseStatus.textContent = '';
                }, 3000);
            }
            
            // Open the document in a new tab
            window.open(doc.url, '_blank');
            
            // Add the doc to the current project if applicable
            if (currentProject) {
                currentProject.googleDocId = doc.id;
                currentProject.googleDocUrl = doc.url;
                await StorageService.updateProject(currentProject);
            }
            
            // Refresh the docs list
            this.listDocs();
            
            return doc;
        } catch (error) {
            console.error('Error exporting to Google Docs:', error);
            
            // Restore original content
            responseElement.innerHTML = originalHTML;
            
            const responseStatus = document.getElementById('responseStatus');
            if (responseStatus) {
                responseStatus.textContent = `Error exporting to Google Docs: ${error.message}`;
                setTimeout(() => {
                    responseStatus.textContent = '';
                }, 5000);
            }
            
            throw error;
        }
    }
    
    /**
     * Import content from Google Docs
     */
    static async showImportDialog() {
        // Check if authorized
        if (!this.isAuthorized) {
            if (!this.hasCredentials) {
                alert('Google API credentials required in Settings');
                return;
            }
            
            await this.authorize();
            return; // The callback will handle the rest
        }
        
        // Get the modal elements
        const modal = document.getElementById('googleDocsImportModal');
        const loader = document.getElementById('importDocsLoader');
        const docsList = document.getElementById('importDocsList');
        
        if (!modal || !loader || !docsList) return;
        
        // Show the modal with loader
        modal.classList.add('show');
        loader.style.display = 'flex';
        docsList.innerHTML = '';
        
        try {
            // Fetch the documents
            const docs = await this.listDocs(20);
            
            // Hide loader
            loader.style.display = 'none';
            
            // Populate the docs list
            if (docs.length === 0) {
                docsList.innerHTML = '<div class="empty-placeholder">No documents found</div>';
                return;
            }
            
            const docsHTML = docs.map(doc => {
                const date = new Date(doc.createdTime);
                const formattedDate = date.toLocaleDateString();
                
                return `
                    <div class="doc-selection-item" data-id="${doc.id}">
                        <input type="radio" name="selectedDoc" class="doc-checkbox" value="${doc.id}">
                        <div class="doc-details">
                            <div class="doc-title">${doc.name}</div>
                            <div class="doc-date">${formattedDate}</div>
                        </div>
                    </div>
                `;
            }).join('');
            
            docsList.innerHTML = docsHTML;
            
            // Add event listeners
            document.querySelectorAll('.doc-selection-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Handle radio button click
                    const radio = item.querySelector('input[type="radio"]');
                    if (e.target !== radio) {
                        radio.checked = !radio.checked;
                    }
                    
                    // Update selected state
                    document.querySelectorAll('.doc-selection-item').forEach(el => {
                        el.classList.remove('selected');
                    });
                    if (radio.checked) {
                        item.classList.add('selected');
                    }
                });
            });
            
            // Set up the import button
            const importButton = document.getElementById('importSelectedDocs');
            if (importButton) {
                importButton.onclick = this.importSelectedDocument.bind(this);
            }
        } catch (error) {
            console.error('Error loading documents for import:', error);
            loader.style.display = 'none';
            docsList.innerHTML = `<div class="error">Error loading documents: ${error.message}</div>`;
        }
    }
    
    /**
     * Import the selected document
     */
    static async importSelectedDocument() {
        const selectedRadio = document.querySelector('input[name="selectedDoc"]:checked');
        if (!selectedRadio) {
            alert('Please select a document to import');
            return;
        }
        
        const documentId = selectedRadio.value;
        const importButton = document.getElementById('importSelectedDocs');
        const docsList = document.getElementById('importDocsList');
        
        // Show loading state
        if (importButton) {
            importButton.disabled = true;
            importButton.innerHTML = '<span class="loader"></span> Importing...';
        }
        
        try {
            if (!this.isAuthorized || !this.hasCredentials) {
                throw new Error('Not authorized with Google');
            }
            
            // Fetch the document content
            const document = await this.getDocument(documentId);
            
            // Update the response area with the content
            if (window.proseEditor && document.content) {
                window.proseEditor.setContent(document.content);
            }
            
            // Create a new project or update current one
            const currentProject = await StorageService.getCurrentProject();
            if (currentProject) {
                currentProject.googleDocId = documentId;
                currentProject.lastModified = new Date().toISOString();
                currentProject.content = document.content;
                await StorageService.updateProject(currentProject);
            } else {
                const newProject = {
                    name: document.title,
                    description: 'Imported from Google Docs',
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    content: document.content,
                    googleDocId: documentId
                };
                await StorageService.createProject(newProject);
            }
            
            // Close the modal
            const modal = document.getElementById('googleDocsImportModal');
            if (modal) {
                modal.classList.remove('show');
            }
            
            // Show success message
            const responseStatus = document.getElementById('responseStatus');
            if (responseStatus) {
                responseStatus.textContent = `Successfully imported "${document.title}" from Google Docs`;
                setTimeout(() => {
                    responseStatus.textContent = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Error importing document:', error);
            
            if (docsList) {
                docsList.innerHTML += `<div class="empty-placeholder error">Error importing document: ${error.message}</div>`;
            }
        } finally {
            // Reset button state
            if (importButton) {
                importButton.disabled = false;
                importButton.textContent = 'Import Selected Document';
            }
        }
    }
}

// No event listeners here - these are set up in DocsIntegration.js
// The service gets initialized in the script block in index.html
