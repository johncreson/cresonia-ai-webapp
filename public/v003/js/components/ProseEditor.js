// ProseEditor.js - Handles the prose editing functionality
class ProseEditor {
    constructor() {
        this.responseBox = document.getElementById('response');
        this.responseWordCount = document.getElementById('responseWordCount');
        this.saveStatus = document.getElementById('saveStatus');
        this.copyBtn = document.getElementById('copyResponse');
        this.clearBtn = document.getElementById('clearResponse');
        this.saveTimeout = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.responseBox) {
            // Content change detection
            this.responseBox.addEventListener('input', () => {
                this.updateWordCount();
                this.onContentChanged();
                this.saveToLocalBackup();
            });
            
            // Handle paste events to clean up formatting
            this.responseBox.addEventListener('paste', (e) => {
                // If we're not handling paste ourselves, return
                if (!e.clipboardData) return;
                
                // Prevent the default paste behavior
                e.preventDefault();
                
                // Get the clipboard text
                const text = e.clipboardData.getData('text/plain');
                
                // Insert text at cursor position
                document.execCommand('insertText', false, text);
            });
            
            // Load from backup if exists and no active content
            this.loadFromLocalBackup();
        }
        
        // Copy button
        if (this.copyBtn) {
            this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        }
        
        // Clear button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clear());
        }
    }
    
    updateWordCount() {
        if (!this.responseBox || !this.responseWordCount) return;
        
        const text = this.responseBox.textContent || this.responseBox.innerText;
        const wordCount = this.countWords(text);
        
        this.responseWordCount.textContent = `(${wordCount} words)`;
    }
    
    countWords(text) {
        text = text.trim();
        if (!text) return 0;
        
        // Split by whitespace and filter out empty strings
        return text.split(/\s+/).filter(word => word.trim() !== '').length;
    }
    
    onContentChanged() {
        // Skip if this is just default content
        const content = this.responseBox.textContent || this.responseBox.innerText;
        if (content === 'Response will appear here...' || content === 'Loading...') {
            return;
        }
        
        // Update save status
        if (this.saveStatus) {
            this.saveStatus.textContent = 'Unsaved changes';
            this.saveStatus.className = 'save-status saving';
        }
        
        // Debounce the save operation
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            StorageService.saveCurrentContent().catch(error => {
                console.error('Error auto-saving content:', error);
                
                if (this.saveStatus) {
                    this.saveStatus.textContent = 'Error saving';
                    this.saveStatus.className = 'save-status error';
                }
            });
        }, 2000);
    }
    
    saveToLocalBackup() {
        if (!this.responseBox) return;
        
        const content = this.responseBox.innerHTML;
        if (content && content !== 'Response will appear here...') {
            localStorage.setItem('prose_content_backup', content);
            localStorage.setItem('prose_backup_timestamp', new Date().toISOString());
        }
    }
    
    loadFromLocalBackup() {
        if (!this.responseBox) return;
        
        // Only load from backup if the current content is empty/default
        const currentContent = this.responseBox.textContent || this.responseBox.innerText;
        if (currentContent === 'Response will appear here...' || !currentContent.trim()) {
            const backupContent = localStorage.getItem('prose_content_backup');
            const timestamp = localStorage.getItem('prose_backup_timestamp');
            
            if (backupContent && timestamp) {
                const date = new Date(timestamp);
                const formattedDate = date.toLocaleString();
                
                // Add a note about restored content
                this.responseBox.innerHTML = `
                    <div class="backup-notice">Content restored from local backup (${formattedDate})</div>
                    ${backupContent}
                `;
                this.updateWordCount();
            }
        }
    }
    
    setContent(content) {
        if (!this.responseBox) return;
        
        // Skip if empty or null content
        if (!content) {
            this.responseBox.innerHTML = 'Response will appear here...';
            this.updateWordCount();
            return;
        }
        
        // Check if it's HTML content or plain text
        if (content.trim().startsWith('<') && content.trim().endsWith('>')) {
            this.responseBox.innerHTML = content;
        } else {
            // Convert plain text to HTML paragraphs
            const htmlContent = content
                .split('\n')
                .filter(para => para.trim() !== '')
                .map(para => `<p>${para}</p>`)
                .join('');
            
            this.responseBox.innerHTML = htmlContent;
        }
        
        this.updateWordCount();
        this.saveToLocalBackup();
    }
    
    getContent() {
        if (!this.responseBox) return '';
        
        return this.responseBox.innerHTML;
    }
    
    getPlainTextContent() {
        if (!this.responseBox) return '';
        
        // Create a temporary element to extract text content without HTML formatting
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.responseBox.innerHTML;
        return tempDiv.textContent || tempDiv.innerText;
    }
    
    clear() {
        if (this.responseBox) {
            this.responseBox.innerHTML = 'Response will appear here...';
            this.updateWordCount();
            
            // Clear the local backup
            localStorage.removeItem('prose_content_backup');
            localStorage.removeItem('prose_backup_timestamp');
            
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
    
    copyToClipboard() {
        if (!this.responseBox) return;
        
        // Create a temporary element to extract text content without HTML formatting
        const tempElement = document.createElement('div');
        tempElement.innerHTML = this.responseBox.innerHTML;
        const responseText = tempElement.textContent || tempElement.innerText;
        
        if (responseText && 
            responseText !== 'Response will appear here...' && 
            responseText !== 'Loading...') {
            
            navigator.clipboard.writeText(responseText)
                .then(() => {
                    const responseStatus = document.getElementById('responseStatus');
                    if (responseStatus) {
                        responseStatus.textContent = 'Response copied to clipboard!';
                        setTimeout(() => {
                            responseStatus.textContent = '';
                        }, 3000);
                    }
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    const responseStatus = document.getElementById('responseStatus');
                    if (responseStatus) {
                        responseStatus.textContent = 'Could not copy text';
                        setTimeout(() => {
                            responseStatus.textContent = '';
                        }, 3000);
                    }
                });
        }
    }
    
    appendContent(content, addSeparator = false) {
        if (!this.responseBox || !content) return;
        
        // If current content is default, replace it
        const currentContent = this.responseBox.textContent || this.responseBox.innerText;
        if (currentContent === 'Response will appear here...' || currentContent === 'Loading...') {
            this.setContent(content);
            return;
        }
        
        // Add separator if requested
        if (addSeparator) {
            this.responseBox.innerHTML += '<div class="response-separator"></div>';
        }
        
        // Append the new content
        this.responseBox.innerHTML += content;
        this.updateWordCount();
        this.saveToLocalBackup();
    }
}

// Initialize the prose editor when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.proseEditor = new ProseEditor();
});
