/**
 * QueueService.js
 * Handles batch processing of multiple prompts in sequence
 */
class QueueService {
    // Service state
    static promptQueue = [];
    static totalQueueSize = 0;
    static isProcessingQueue = false;
    
    /**
     * Start processing the queue of prompts
     */
    static async startProcessingQueue() {
        // Get DOM elements
        const queueTextarea = document.getElementById('promptQueue');
        const processQueueBtn = document.getElementById('processQueue');
        const stopQueueBtn = document.getElementById('stopQueue');
        const queueStatusEl = document.getElementById('queueStatus');
        
        if (!queueTextarea || !processQueueBtn || !stopQueueBtn || !queueStatusEl) {
            console.error('Required DOM elements for queue processing not found');
            return;
        }
        
        const queueText = queueTextarea.value.trim();
        if (!queueText) {
            queueStatusEl.textContent = 'Queue is empty';
            return;
        }
        
        // Split by lines and filter out empty lines
        this.promptQueue = queueText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (this.promptQueue.length === 0) {
            queueStatusEl.textContent = 'Queue is empty';
            return;
        }
        
        // Store the total queue size for progress tracking
        this.totalQueueSize = this.promptQueue.length;
        
        // Update UI
        processQueueBtn.disabled = true;
        stopQueueBtn.disabled = false;
        queueStatusEl.textContent = `Queue: 0/${this.totalQueueSize} processed`;
        this.isProcessingQueue = true;
        
        // Check for external generation in progress
        const isGeneratingExternally = document.getElementById('promptStatus')?.textContent === 'Generating response...';
        
        // Start with the first prompt if we're not already generating a response
        if (!isGeneratingExternally) {
            await this.processNextPrompt();
        }
    }
    
    /**
     * Stop processing the queue
     */
    static stopProcessingQueue() {
        // Get DOM elements
        const processQueueBtn = document.getElementById('processQueue');
        const stopQueueBtn = document.getElementById('stopQueue');
        const queueStatusEl = document.getElementById('queueStatus');
        
        if (!processQueueBtn || !stopQueueBtn || !queueStatusEl) {
            console.error('Required DOM elements for queue processing not found');
            return;
        }
        
        this.promptQueue = [];
        this.isProcessingQueue = false;
        
        processQueueBtn.disabled = false;
        stopQueueBtn.disabled = true;
        queueStatusEl.textContent = 'Queue processing stopped';
    }
    
    /**
     * Process the next prompt in the queue
     */
    static async processNextPrompt() {
        // Get DOM elements
        const promptTextarea = document.getElementById('prompt');
        const sendPromptBtn = document.getElementById('sendPrompt');
        const processQueueBtn = document.getElementById('processQueue');
        const stopQueueBtn = document.getElementById('stopQueue');
        const queueStatusEl = document.getElementById('queueStatus');
        
        if (!promptTextarea || !sendPromptBtn || !processQueueBtn || !stopQueueBtn || !queueStatusEl) {
            console.error('Required DOM elements for queue processing not found');
            return;
        }
        
        try {
            if (this.promptQueue.length === 0 || !this.isProcessingQueue) {
                // Queue is empty or processing was stopped
                processQueueBtn.disabled = false;
                stopQueueBtn.disabled = true;
                queueStatusEl.textContent = 'Queue processing completed';
                this.isProcessingQueue = false;
                return;
            }
            
            // Get the next prompt
            const nextPrompt = this.promptQueue.shift();
            const processed = this.totalQueueSize - this.promptQueue.length;
            
            // Update the prompt text area
            promptTextarea.value = nextPrompt;
            
            // Update word count
            const promptWordCount = document.getElementById('promptWordCount');
            if (promptWordCount) {
                const wordCount = nextPrompt.split(/\s+/).filter(word => word.trim() !== '').length;
                promptWordCount.textContent = `(${wordCount} words)`;
            }
            
            // Update status
            queueStatusEl.textContent = `Queue: ${processed}/${this.totalQueueSize} prompts processed`;
            
            // Trigger the send prompt button
            sendPromptBtn.click();
            
            // Wait for the response to be generated
            await this.waitForResponseGeneration();
            
            // Small delay to ensure UI updates before next processing
            setTimeout(() => {
                this.processNextPrompt();
            }, 1000);
            
        } catch (err) {
            console.error("Error processing queue item:", err);
            this.stopProcessingQueue();
        }
    }
    
    /**
     * Check if a response is being generated
     */
    static isGeneratingResponse() {
        const promptStatus = document.getElementById('promptStatus');
        return promptStatus && promptStatus.textContent === 'Generating response...';
    }
    
    /**
     * Wait for the response generation to complete
     */
    static async waitForResponseGeneration() {
        // Maximum wait time in milliseconds (5 minutes)
        const maxWaitTime = 5 * 60 * 1000;
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const checkStatus = () => {
                // Check if we've exceeded the maximum wait time
                if (Date.now() - startTime > maxWaitTime) {
                    console.warn('Maximum wait time exceeded for response generation');
                    resolve();
                    return;
                }
                
                // Check if the response is still being generated
                if (this.isGeneratingResponse()) {
                    // Still generating, check again after a delay
                    setTimeout(checkStatus, 1000);
                } else {
                    // Generation completed or failed
                    resolve();
                }
            };
            
            // Start checking
            checkStatus();
        });
    }
}

// Initialize event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Process queue button
    const processQueueBtn = document.getElementById('processQueue');
    if (processQueueBtn) {
        processQueueBtn.addEventListener('click', () => {
            QueueService.startProcessingQueue();
        });
    }
    
    // Stop queue button
    const stopQueueBtn = document.getElementById('stopQueue');
    if (stopQueueBtn) {
        stopQueueBtn.addEventListener('click', () => {
            QueueService.stopProcessingQueue();
        });
    }
});
