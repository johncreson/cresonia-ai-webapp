/**
 * ProseEditor.js
 * Handles the prose editing functionality
 */
class ProseEditor {
    constructor() {
        this.responseBox = document.getElementById('response');
        this.responseWordCount = document.getElementById('responseWordCount');
        this.saveStatus = document.getElementById('saveStatus');
        
        this.setupEventListeners();
    }
    
    /**
     * Set up event listeners for the prose editor
     */
    setupEventListeners() {
        if (this.responseBox) {
            // Content change detection
            this.responseBox.addEventListener('input', () => {
                this.updateWordCount();
                this.onContentChanged();
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
        }
    }
    
    /**
     * Update the word count display
     */
    updateWordCount() {
        if (!this.responseBox || !this.responseWordCount) return;
        
        const text = this.responseBox.textContent || this.responseBox.innerText;
        const wordCount = this.countWords(text);
        
        this.responseWordCount.textContent = `(${wordCount} words)`;
    }
    
    /**
     * Count words in text
     */
    countWords(text) {
        text = text.trim();
        if (!text) return 0;
        
        // Split by whitespace and filter out empty strings
        return text.split(/\s+/).filter(word => word.trim() !== '').length;
    }
    
    /**
     * Handle content changes
     */
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
    
    /**
     * Set prose content
     */
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
    }
    
    /**
     * Get prose content
     */
    getContent() {
        if (!this.responseBox) return '';
        
        return this.responseBox.innerHTML;
    }
    
    /**
     * Get plain text content
     */
    getPlainTextContent() {
        if (!this.responseBox) return '';
        
        // Create a temporary element to extract text content without HTML formatting
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.responseBox.innerHTML;
        return tempDiv.textContent || tempDiv.innerText;
    }
    
    /**
     * Clear the prose editor
     */
    clear() {
        if (this.responseBox) {
            this.responseBox.innerHTML = 'Response will appear here...';
            this.updateWordCount();
        }
    }
    
    /**
     * Append content to the prose editor
     */
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
    }
}

// Initialize the prose editor when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.proseEditor = new ProseEditor();
});
