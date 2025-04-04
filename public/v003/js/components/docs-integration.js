/**
 * DocsIntegration.js
 * Handles UI interactions for Google Docs integration
 */
class DocsIntegration {
    constructor() {
        this.connectButton = document.getElementById('connectGoogleDocs');
        this.googleAuthStatus = document.getElementById('googleAuthStatus');
        this.googleDocsControls = document.getElementById('googleDocsControls');
        this.refreshButton = document.getElementById('refreshGoogleDocs');
        this.exportButton = document.getElementById('exportToDocsButton');
        this.importButton = document.getElementById('importFromGoogleDocs');
        this.googleDocsList = document.getElementById('googleDocsList');
        
        // Modals
        this.importModal = document.getElementById('googleDocsImportModal');
        this.importDocsList = document.getElementById('importDocsList');
        this.importDocsLoader = document.getElementById('importDocsLoader');
        this.importSelectedDocsBtn = document.getElementById('importSelectedDocs');
        
        this.setupEventListeners();
    }
    
    /**
     * Set up event listeners for Docs Integration
     */
    setupEventListeners() {
        if (this.connectButton) {
            this.connectButton.addEventListener('click', async () => {
                if (!window.GoogleDocsService) {
                    console.error('Google Docs Service not initialized');
                    return;
                }
                
                try {
                    if (await window.GoogleDocsService.isAuthenticated()) {
                        window.GoogleDocsService.signOut();
                    } else {
                        window.GoogleDocsService.authorize();
                    }
                } catch (error) {
                    console.error('Error toggling Google Docs authentication:', error);
                    this.showError('Failed to connect to Google Docs');
                }
            });
        }
        
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => {
                if (!window.GoogleDocsService) {
                    console.error('Google Docs Service not initialized');
                    return;
                }
                
                window.GoogleDocsService.listDocs();
            });
        }
        
        if (this.exportButton) {
            this.exportButton.addEventListener('click', () => {
                if (!window.GoogleDocsService) {
                    console.error('Google Docs Service not initialized');
                    return;
                }
                
                window.GoogleDocsService.exportCurrentProse();
            });
        }
        
        if (this.importButton) {
            this.importButton.addEventListener('click', () => {
                if (!window.GoogleDocsService) {
                    console.error('Google Docs Service not initialized');
                    return;
                }
                
                this.showImportDialog();
            });
        }
        
        // Import selected document button
        if (this.importSelectedDocsBtn) {
            this.importSelectedDocsBtn.addEventListener('click', () => {
                this.importSelectedDocument();
            });
        }
        
        // Close modal buttons
        document.querySelectorAll('.close-modal').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                this.closeModals();
            });
        });
        
        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });
    }
    
    /**
     * Show an error message
     */
    showError(message) {
        console.error(message);
        
        if (this.googleDocsList) {
            this.googleDocsList.innerHTML = `<div class="error">${message}</div>`;
        }
    }
    
    /**
     * Close all modals
     */
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }
    
    /**
     * Show the import dialog
     */
    async showImportDialog() {
        // Check if authenticated
        if (!window.GoogleDocsService) {
            console.error('Google Docs Service not initialized');
            return;
        }
        
        const isAuthorized = await window.GoogleDocsService.isAuthenticated();
        if (!isAuthorized) {
            window.GoogleDocsService.authorize();
            return; // The callback will handle the rest
        }
        
        // Show the modal with loader
        if (this.importModal) this.importModal.classList.add('show');
        if (this.importDocsLoader) this.importDocsLoader.style.display = 'flex';
        if (this.importDocsList) this.importDocsList.innerHTML = '';
        
        try {
            // Fetch the documents
            const docs = await window.GoogleDocsService.listDocs(20);
            
            // Hide loader
            if (this.importDocsLoader) this.importDocsLoader.style.display = 'none';
            
            // Populate the docs list
            if (this.importDocsList) {
                if (!docs || docs.length === 0) {
                    this.importDocsList.innerHTML = '<div class="empty-placeholder">No documents found</div>';
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
                
                this.importDocsList.innerHTML = docsHTML;
                
                // Add event listeners for document items
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
            }
        } catch (error) {
            console.error('Error loading documents for import:', error);
            
            // Hide loader
            if (this.importDocsLoader) this.importDocsLoader.style.display = 'none';
            
            // Show error message
            if (this.importDocsList) {
                this.importDocsList.innerHTML = `<div class="error">Error loading documents: ${error.message}</div>`;
            }
        }
    }
    
    /**
     * Import the selected document
     */
    async importSelectedDocument() {
        const selectedRadio = document.querySelector('input[name="selectedDoc"]:checked');
        if (!selectedRadio) {
            alert('Please select a document to import');
            return;
        }
        
        const documentId = selectedRadio.value;
        
        // Show loading state
        if (this.importSelectedDocsBtn) {
            this.importSelectedDocsBtn.disabled = true;
            this.importSelectedDocsBtn.innerHTML = '<span class="loader"></span> Importing...';
        }
        
        try {
            if (!window.GoogleDocsService) {
                throw new Error('Google Docs Service not initialized');
            }
            
            // Fetch the document content
            const document = await window.GoogleDocsService.getDocument(documentId);
            
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
            this.closeModals();
            
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
            
            if (this.importDocsList) {
                this.importDocsList.innerHTML += `<div class="error">Error importing document: ${error.message}</div>`;
            }
        } finally {
            // Reset button state
            if (this.importSelectedDocsBtn) {
                this.importSelectedDocsBtn.disabled = false;
                this.importSelectedDocsBtn.textContent = 'Import Selected Document';
            }
        }
    }
}

// Initialize the docs integration when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.docsIntegration = new DocsIntegration();
});
