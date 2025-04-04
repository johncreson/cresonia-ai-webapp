// Evaluator.js - Handles the story evaluation functionality
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
        
        // Load any existing evaluation from storage
        StorageService.getCurrentProject().then(project => {
            if (project && project.evaluation && this.evaluationResults) {
                this.evaluationResults.innerHTML = project.evaluation;
                this.updateWordCount();
            }
        });
    }
    
    updateWordCount() {
        if (!this.evaluationResults || !this.evaluationWordCount) return;
        
        const text = this.evaluationResults.textContent || this.evaluationResults.innerText;
        const wordCount = this.countWords(text);
        
        this.evaluationWordCount.textContent = `(${wordCount} words)`;
    }
    
    countWords(text) {
        text = text.trim();
        if (!text) return 0;
        
        return text.split(/\s+/).filter(word => word.trim() !== '').length;
    }
    
    showStatus(message, timeout = 0) {
        if (!this.evaluationStatus) return;
        
        this.evaluationStatus.textContent = message;
        
        if (timeout > 0) {
            setTimeout(() => {
                this.evaluationStatus.textContent = '';
            }, timeout);
        }
    }
    
    async evaluateStory() {
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
        
        const settings = StorageService.getSettings();
        if (!settings.apiKey) {
            this.showStatus('Please enter your API key in settings', 3000);
            return;
        }
        
        if (window.isGeneratingContent) {
            this.showStatus('Content generation already in progress', 3000);
            return;
        }
        
        try {
            window.isGeneratingContent = true;
            this.showStatus('Generating story evaluation...', 0);
            
            if (this.evaluateButton) {
                this.evaluateButton.disabled = true;
                this.evaluateButton.textContent = 'Evaluating...';
            }
            
            if (this.evaluationResults) {
                this.evaluationResults.innerHTML = 'Evaluating story... This may take a minute.';
                this.updateWordCount();
            }
            
            const response = await AIService.evaluateStory(proseContent, settings);
            
            const formattedResponse = AIService.formatResponseAsHTML(response);
            
            if (this.evaluationResults) {
                this.evaluationResults.innerHTML = formattedResponse;
                this.updateWordCount();
            }
            
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
            
            if (this.evaluateButton) {
                this.evaluateButton.disabled = false;
                this.evaluateButton.textContent = 'Evaluate Story';
            }
        }
    }
    
    copyEvaluation() {
        if (!this.evaluationResults) return;
        
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
    
    clearEvaluation() {
        if (this.evaluationResults) {
            this.evaluationResults.innerHTML = 'Story evaluation will appear here after clicking \'Evaluate Story\'...';
            this.updateWordCount();
            
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
    
    setContent(content) {
        if (!this.evaluationResults) return;
        
        if (!content) {
            this.evaluationResults.innerHTML = 'Story evaluation will appear here after clicking \'Evaluate Story\'...';
            this.updateWordCount();
            return;
        }
        
        this.evaluationResults.innerHTML = content;
        this.updateWordCount();
    }
    
    getContent() {
        if (!this.evaluationResults) return '';
        
        return this.evaluationResults.innerHTML;
    }
}

// Initialize the evaluator when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.evaluator = new Evaluator();
});
