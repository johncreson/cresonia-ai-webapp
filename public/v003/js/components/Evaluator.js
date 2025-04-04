/**
 * Evaluator.js
 * Handles the story evaluation functionality
 */
class Evaluator {
    constructor() {
        this.evaluationResults = document.getElementById('evaluationResults');
        this.evaluationWordCount = document.getElementById('evaluationWordCount');
        this.evaluateButton = document.getElementById('evaluateButton');
        this.copyEvaluationBtn = document.getElementById('copyEvaluation');
        this.clearEvaluationBtn = document.getElementById('clearEvaluation');
        this.evaluationStatus = document.getElementById('evaluationStatus');
        
        this.setupEventListeners();
    }
    
    /**
     * Set up event listeners for the evaluator
     */
    setupEventListeners() {
        if (this.evaluateButton) {
            this.evaluateButton.addEventListener('click', () => this.evaluateStory());
        }
        
        if (this.copyEvaluationBtn) {
            this.copyEvaluationBtn.addEventListener('click', () => this.copyEvaluation());
        }
        
        if (this.clearEvaluationBtn) {
            this.clearEvaluationBtn.addEventListener('click', () => this.clearEvaluation());
        }
        
        if (this.evaluationResults) {
            this.evaluationResults.addEventListener('input', () => this.updateWordCount());
        }
    }
    
    /**
     * Update the word count display
     */
    updateWordCount() {
        if (!this.evaluationResults || !this.evaluationWordCount) return;
        
        const text = this.evaluationResults.textContent || this.evaluationResults.innerText;
        const wordCount = this.countWords(text);
        
        this.evaluationWordCount.textContent = `(${wordCount} words)`;
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
     * Show status message with optional timeout
     */
    showStatus(message, timeout = 0) {
        if (!this.evaluationStatus) return;
        
        this.evaluationStatus.textContent = message;
        
        if (timeout > 0) {
            setTimeout(() => {
                this.evaluationStatus.textContent = '';
            }, timeout);
        }
    }
    
    /**
     * Evaluate the current story
     */
    async evaluateStory() {
        // Get prose content from the editor
        if (!window.proseEditor) {
            this.showStatus('Prose editor not initialized', 3000);
            return;
        }
        
        const proseContent = window.proseEditor.getPlainTextContent();
        
        if (!proseContent.trim() || 
            proseContent === 'Response will appear here...' || 
            proseContent === 'Loading...') {
            this.showStatus('Please generate prose content first', 3000);
            return;
        }
        
        // Check if API key is set
        const settings = StorageService.getSettings();
        if (!settings.apiKey) {
            this.showStatus('Please enter your API key in settings', 3000);
            return;
        }
        
        // Don't allow multiple requests at once
        if (window.isGeneratingContent) {
            this.showStatus('Content generation already in progress', 3000);
            return;
        }
        
        try {
            window.isGeneratingContent = true;
            this.showStatus('Generating story evaluation...', 0);
            
            if (this.evaluationResults) {
                this.evaluationResults.innerHTML = 'Evaluating story... This may take a minute.';
                this.updateWordCount();
            }
            
            // Generate evaluation
            const response = await AIService.evaluateStory(proseContent, settings);
            
            // Format the response
            const formattedResponse = AIService.formatResponseAsHTML(response);
            
            // Update the evaluation box
            if (this.evaluationResults) {
                this.evaluationResults.innerHTML = formattedResponse;
                this.updateWordCount();
            }
            
            // Save to current project if exists
            const currentProject = await StorageService.getCurrentProject();
            if (currentProject) {
                currentProject.evaluation = formattedResponse;
                await StorageService.updateProject(currentProject);
            }
            
            this.showStatus('Evaluation completed!', 3000);
            
        } catch (error) {
            console.error('Error evaluating story:', error);
            
            if (this.evaluationResults) {
                this.evaluationResults.innerHTML = `<div class="error">Error: ${error.message}</div>`;
                this.updateWordCount();
            }
            
            this.showStatus('Failed to generate evaluation', 3000);
            
        } finally {
            window.isGeneratingContent = false;
        }
    }
    
    /**
     * Copy evaluation to clipboard
     */
    copyEvaluation() {
        if (!this.evaluationResults) return;
        
        // Create a temporary element to extract text content without HTML formatting
        const tempElement = document.createElement('div');
        tempElement.innerHTML = this.evaluationResults.innerHTML;
        const evaluationText = tempElement.textContent || tempElement.innerText;
        
        if (evaluationText && 
            evaluationText !== 'Story evaluation will appear here after clicking \'Evaluate Story\'...' && 
            evaluationText !== 'Evaluating story... This may take a minute.') {
            
            navigator.clipboard.writeText(evaluationText)
                .then(() => {
                    this.showStatus('Evaluation copied to clipboard!', 3000);
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    this.showStatus('Could not copy text', 3000);
                });
        }
    }
    
    /**
     * Clear evaluation
     */
    clearEvaluation() {
        if (this.evaluationResults) {
            this.evaluationResults.innerHTML = 'Story evaluation will appear here after clicking \'Evaluate Story\'...';
            this.updateWordCount();
            
            // Update current project if exists
            StorageService.getCurrentProject().then(project => {
                if (project) {
                    project.evaluation = '';
                    StorageService.updateProject(project).catch(error => {
                        console.error('Error clearing project evaluation:', error);
                    });
                }
            });
        }
    }
    
    /**
     * Set evaluation content
     */
    setContent(content) {
        if (!this.evaluationResults) return;
        
        // Skip if empty or null content
        if (!content) {
            this.evaluationResults.innerHTML = 'Story evaluation will appear here after clicking \'Evaluate Story\'...';
            this.updateWordCount();
            return;
        }
        
        this.evaluationResults.innerHTML = content;
        this.updateWordCount();
    }
}

// Initialize the evaluator when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.evaluator = new Evaluator();
});
