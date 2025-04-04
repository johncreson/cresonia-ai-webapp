/**
 * GoogleDocsService.js
 * Handles all interactions with the Google Docs API
 */
class GoogleDocsService {
    // API config
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
    
    /**
     * Initialize the Google API client
     */
    static async initialize() {
        // Skip if already initialized
        if (this.isInitialized) return;
        
        try {
            // Load settings
            const settings = await StorageService.getSettings();
            if (settings.googleApiKey) {
                this.API_KEY = settings.googleApiKey;
            }
            
            // Initialize the Google API client library
            await new Promise((resolve, reject) => {
                gapi.load('client', {
                    callback: resolve,
                    onerror: reject,
                    timeout: 5000,
                    ontimeout: reject
                });
            });
            
            // Initialize the client with API key and discovery docs
            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: this.DISCOVERY_DOCS,
            });
            
            // Initialize the GIS client
            if (!this.gisInitialized) {
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: this.CLIENT_ID,
                    scope: this.SCOPES,
                    callback: (response) => {
                        if (response.error) {
                            throw response;
                        }
                        
                        this.isAuthorized = true;
                        this.updateAuthStatus(true);
                    },
                });
                this.gisInitialized = true;
            }
            
            // Check if we're already authorized
            this.isAuthorized = gapi.client.getToken() !== null;
            this.updateAuthStatus(this.isAuthorized);
            
            this.isInitialized = true;
            console.log('Google Docs API initialized');
        } catch (error) {
            console.error('Error initializing Google API client:', error);
            this.updateAuthStatus(false);
            throw error;
        }
    }
    
    /**
     * Authorize with Google
     */
    static async authorize() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        // Request an access token
        this.tokenClient.requestAccessToken();
    }
    
    /**
     * Check if user is authorized
     */
    static async isAuthenticated() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        return this.isAuthorized;
    }
    
    /**
     * Sign out of Google
     */
    static signOut() {
        const token = gapi.client.getToken();
        if (token) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken(null);
            this.isAuthorized = false;
            this.updateAuthStatus(false);
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
            this.listDocs();
        } else {
            statusElement.className = 'auth-status not-connected';
            statusElement.querySelector('.status-text').textContent = 'Not connected';
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
        if (!this.isAuthorized) {
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
     * Create a new Google Doc
     */
    static async createDocument(title, content) {
        if (!this.isAuthorized) {
            throw new Error('Not authorized with Google');
        }
        
        try {
            // Make sure Docs API is loaded
            if (!gapi.client.docs) {
                await gapi.client.load('docs', 'v1');
            }
            
            // Create an empty document first
            const createResponse = await gapi.client.docs.documents.create({
                title: title || 'Cresonia AI Generated Content'
            });
            
            const documentId = createResponse.result.documentId;
            
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
        if (!this.isAuthorized) {
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
        
        if (!proseContent || proseContent === 'Response will appear here...') {
            alert('Please generate some prose content first');
            return;
        }
        
        // Check if authorized
        if (!this.isAuthorized) {
            await this.authorize();
            return; // The callback will handle the rest
        }
        
        try {
            const currentProject = await StorageService.getCurrentProject();
            const title = currentProject ? 
                `${currentProject.name} - Cresonia AI` : 
                'Cresonia AI Generated Content';
            
            const doc = await this.createDocument(title, proseContent);
            
            // Show success message
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
            docsList.innerHTML = `<div class="empty-placeholder error">Error loading documents: ${error.message}</div>`;
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
            // Fetch the document content
            const document = await this.getDocument(documentId);
            
            // Update the response area with the content
            const responseElement = document.getElementById('response');
            if (responseElement && document.content) {
                // Convert plain text to HTML paragraphs
                const htmlContent = document.content
                    .split('\n')
                    .filter(para => para.trim() !== '')
                    .map(para => `<p>${para}</p>`)
                    .join('');
                
                responseElement.innerHTML = htmlContent;
                
                // Update word count
                const wordCountElement = document.getElementById('responseWordCount');
                if (wordCountElement) {
                    const wordCount = document.content.split(/\s+/).filter(word => word.trim() !== '').length;
                    wordCountElement.textContent = `(${wordCount} words)`;
                }
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

// Initialize event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Google Docs service
    GoogleDocsService.initialize().catch(error => {
        console.error('Error initializing Google Docs service:', error);
    });
    
    // Connect/disconnect button
    const connectButton = document.getElementById('connectGoogleDocs');
    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            if (await GoogleDocsService.isAuthenticated()) {
                GoogleDocsService.signOut();
            } else {
                GoogleDocsService.authorize();
            }
        });
    }
    
    // Refresh docs button
    const refreshButton = document.getElementById('refreshGoogleDocs');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            GoogleDocsService.listDocs();
        });
    }
    
    // Export to Google Docs button
    const exportButton = document.getElementById('exportToDocsButton');
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            GoogleDocsService.exportCurrentProse();
        });
    }
    
    // Import from Google Docs button
    const importButton = document.getElementById('importFromGoogleDocs');
    if (importButton) {
        importButton.addEventListener('click', () => {
            GoogleDocsService.showImportDialog();
        });
    }
    
    // Close modals when clicking the close button or outside
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('show');
            });
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
});
