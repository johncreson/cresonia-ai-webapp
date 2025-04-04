/**
 * StorageService.js
 * Handles all data persistence operations using localStorage and IndexedDB
 */
class StorageService {
    static DB_NAME = 'cresonia-db';
    static DB_VERSION = 1;
    static SETTINGS_KEY = 'cresonia-settings';
    static CURRENT_PROJECT_KEY = 'cresonia-current-project';
    
    static db = null;
    
    /**
     * Initialize the database
     */
    static async initDB() {
        if (this.db) return this.db;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create projects store
                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    projectsStore.createIndex('name', 'name', { unique: false });
                    projectsStore.createIndex('created', 'created', { unique: false });
                    projectsStore.createIndex('lastModified', 'lastModified', { unique: false });
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            
            request.onerror = (event) => {
                console.error('Error opening database:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Save settings to localStorage
     */
    static saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    }
    
    /**
     * Get settings from localStorage
     */
    static getSettings() {
        const settings = localStorage.getItem(this.SETTINGS_KEY);
        if (!settings) {
            return {
                apiKey: '',
                siteUrl: '',
                siteName: '',
                model: 'openai/gpt-4o',
                defaultEvaluationModel: 'deepseek/deepseek-chat:free',
                styleGuide: '',
                googleApiKey: ''
            };
        }
        
        try {
            return JSON.parse(settings);
        } catch (error) {
            console.error('Error parsing settings:', error);
            return {
                apiKey: '',
                siteUrl: '',
                siteName: '',
                model: 'openai/gpt-4o',
                defaultEvaluationModel: 'deepseek/deepseek-chat:free',
                styleGuide: '',
                googleApiKey: ''
            };
        }
    }
    
    /**
     * Save a project to IndexedDB
     */
    static async createProject(project) {
        const db = await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            
            // Ensure required fields
            const newProject = {
                name: project.name || 'Untitled Project',
                description: project.description || '',
                created: project.created || new Date().toISOString(),
                lastModified: project.lastModified || new Date().toISOString(),
                content: project.content || '',
                evaluation: project.evaluation || '',
                googleDocId: project.googleDocId || null,
                googleDocUrl: project.googleDocUrl || null,
                ...project
            };
            
            const request = store.add(newProject);
            
            request.onsuccess = (event) => {
                const id = event.target.result;
                newProject.id = id;
                
                // Set as current project
                this.setCurrentProject(newProject);
                
                resolve(newProject);
                
                // Update the project list in the UI
                this.updateProjectListUI();
            };
            
            request.onerror = (event) => {
                console.error('Error creating project:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Update an existing project
     */
    static async updateProject(project) {
        if (!project.id) {
            throw new Error('Project ID is required for update');
        }
        
        const db = await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            
            // Update last modified timestamp
            project.lastModified = new Date().toISOString();
            
            const request = store.put(project);
            
            request.onsuccess = () => {
                // Update current project if it's the active one
                const currentProject = this.getCurrentProjectSync();
                if (currentProject && currentProject.id === project.id) {
                    this.setCurrentProject(project);
                }
                
                resolve(project);
                
                // Update the project list in the UI
                this.updateProjectListUI();
            };
            
            request.onerror = (event) => {
                console.error('Error updating project:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Delete a project
     */
    static async deleteProject(projectId) {
        const db = await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['projects'], 'readwrite');
            const store = transaction.objectStore('projects');
            
            const request = store.delete(projectId);
            
            request.onsuccess = () => {
                // If this was the current project, clear it
                const currentProject = this.getCurrentProjectSync();
                if (currentProject && currentProject.id === projectId) {
                    this.clearCurrentProject();
                }
                
                resolve();
                
                // Update the project list in the UI
                this.updateProjectListUI();
            };
            
            request.onerror = (event) => {
                console.error('Error deleting project:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Get a project by ID
     */
    static async getProject(projectId) {
        const db = await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            
            const request = store.get(projectId);
            
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            
            request.onerror = (event) => {
                console.error('Error getting project:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Get all projects
     */
    static async getAllProjects() {
        const db = await this.initDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['projects'], 'readonly');
            const store = transaction.objectStore('projects');
            const index = store.index('lastModified');
            
            const request = index.openCursor(null, 'prev'); // Get most recent first
            const projects = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    projects.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(projects);
                }
            };
            
            request.onerror = (event) => {
                console.error('Error getting projects:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Set the current active project
     */
    static setCurrentProject(project) {
        localStorage.setItem(this.CURRENT_PROJECT_KEY, JSON.stringify(project));
        
        // Update UI to reflect current project
        this.updateProjectListUI();
        this.updateEditorContent(project);
    }
    
    /**
     * Get the current active project (sync version)
     */
    static getCurrentProjectSync() {
        const projectJson = localStorage.getItem(this.CURRENT_PROJECT_KEY);
        if (!projectJson) return null;
        
        try {
            return JSON.parse(projectJson);
        } catch (error) {
            console.error('Error parsing current project:', error);
            return null;
        }
    }
    
    /**
     * Get the current active project (async version)
     */
    static async getCurrentProject() {
        const project = this.getCurrentProjectSync();
        
        // If we have a current project with an ID, get the latest version from the DB
        if (project && project.id) {
            try {
                const latestProject = await this.getProject(project.id);
                if (latestProject) {
                    // Update the stored current project
                    this.setCurrentProject(latestProject);
                    return latestProject;
                }
            } catch (error) {
                console.error('Error getting latest project:', error);
                // Fall back to the stored version
                return project;
            }
        }
        
        return project;
    }
    
    /**
     * Clear the current project
     */
    static clearCurrentProject() {
        localStorage.removeItem(this.CURRENT_PROJECT_KEY);
        
        // Update UI
        this.updateProjectListUI();
        
        // Clear the editor
        const responseElement = document.getElementById('response');
        if (responseElement) {
            responseElement.innerHTML = 'Response will appear here...';
        }
        
        const evaluationElement = document.getElementById('evaluationResults');
        if (evaluationElement) {
            evaluationElement.innerHTML = 'Story evaluation will appear here after clicking \'Evaluate Story\'...';
        }
    }
    
    /**
     * Update the project list in the UI
     */
    static async updateProjectListUI() {
        const projectListElement = document.getElementById('projectList');
        if (!projectListElement) return;
        
        try {
            const projects = await this.getAllProjects();
            const currentProject = this.getCurrentProjectSync();
            
            if (projects.length === 0) {
                projectListElement.innerHTML = '<li class="empty-placeholder">No projects yet</li>';
                return;
            }
            
            const projectListHTML = projects.map(project => {
                const isActive = currentProject && currentProject.id === project.id;
                const date = new Date(project.lastModified);
                const formattedDate = date.toLocaleDateString();
                
                return `
                    <li class="project-item ${isActive ? 'active' : ''}" data-id="${project.id}">
                        <div class="project-name">${project.name}</div>
                        <div class="project-date">${formattedDate}</div>
                    </li>
                `;
            }).join('');
            
            projectListElement.innerHTML = projectListHTML;
            
            // Add event listeners for project items
            document.querySelectorAll('.project-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const projectId = parseInt(item.dataset.id);
                    const project = await this.getProject(projectId);
                    if (project) {
                        this.setCurrentProject(project);
                    }
                });
            });
        } catch (error) {
            console.error('Error updating project list:', error);
            projectListElement.innerHTML = '<li class="empty-placeholder error">Error loading projects</li>';
        }
    }
    
    /**
     * Update the editor content with the current project
     */
    static updateEditorContent(project) {
        if (!project) return;
        
        // Update prose content
        const responseElement = document.getElementById('response');
        if (responseElement && project.content) {
            // Check if it's HTML content or plain text
            if (project.content.trim().startsWith('<') && project.content.trim().endsWith('>')) {
                responseElement.innerHTML = project.content;
            } else {
                // Convert plain text to HTML paragraphs
                const htmlContent = project.content
                    .split('\n')
                    .filter(para => para.trim() !== '')
                    .map(para => `<p>${para}</p>`)
                    .join('');
                
                responseElement.innerHTML = htmlContent;
            }
            
            // Update word count
            const wordCountElement = document.getElementById('responseWordCount');
            if (wordCountElement) {
                const wordCount = project.content.split(/\s+/).filter(word => word.trim() !== '').length;
                wordCountElement.textContent = `(${wordCount} words)`;
            }
        }
        
        // Update evaluation content
        const evaluationElement = document.getElementById('evaluationResults');
        if (evaluationElement && project.evaluation) {
            evaluationElement.innerHTML = project.evaluation;
            
            // Update word count
            const wordCountElement = document.getElementById('evaluationWordCount');
            if (wordCountElement) {
                const wordCount = project.evaluation.split(/\s+/).filter(word => word.trim() !== '').length;
                wordCountElement.textContent = `(${wordCount} words)`;
            }
        }
    }
    
    /**
     * Save the current editor content to the active project
     */
    static async saveCurrentContent() {
        const project = await this.getCurrentProject();
        if (!project) {
            // No current project, prompt to create one
            document.getElementById('projectModal').classList.add('show');
            return false;
        }
        
        try {
            // Update save status
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.textContent = 'Saving...';
                saveStatus.className = 'save-status saving';
            }
            
            // Get current content
            const responseElement = document.getElementById('response');
            const evaluationElement = document.getElementById('evaluationResults');
            
            if (responseElement) {
                // Get the inner HTML as the content (preserves formatting)
                project.content = responseElement.innerHTML;
            }
            
            if (evaluationElement) {
                // Get the inner HTML as the evaluation (preserves formatting)
                project.evaluation = evaluationElement.innerHTML;
            }
            
            // Update the project
            await this.updateProject(project);
            
            // Update save status
            if (saveStatus) {
                saveStatus.textContent = 'Saved';
                saveStatus.className = 'save-status';
                
                setTimeout(() => {
                    saveStatus.textContent = 'Saved';
                }, 2000);
            }
            
            return true;
        } catch (error) {
            console.error('Error saving content:', error);
            
            // Update save status
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.textContent = 'Error saving';
                saveStatus.className = 'save-status error';
            }
            
            return false;
        }
    }
    
    /**
     * Create a new project from the current content
     */
    static async createProjectFromCurrentContent(name, description) {
        // Get current content
        const responseElement = document.getElementById('response');
        const evaluationElement = document.getElementById('evaluationResults');
        
        let content = '';
        let evaluation = '';
        
        if (responseElement) {
            // Skip if there's no meaningful content
            const plainText = responseElement.textContent || responseElement.innerText;
            if (plainText === 'Response will appear here...') {
                content = '';
            } else {
                content = responseElement.innerHTML;
            }
        }
        
        if (evaluationElement) {
            const plainText = evaluationElement.textContent || evaluationElement.innerText;
            if (plainText === 'Story evaluation will appear here after clicking \'Evaluate Story\'...') {
                evaluation = '';
            } else {
                evaluation = evaluationElement.innerHTML;
            }
        }
        
        // Create the project
        const project = {
            name: name || 'Untitled Project',
            description: description || '',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            content,
            evaluation
        };
        
        return this.createProject(project);
    }
}

// Initialize event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize projects list
    StorageService.updateProjectListUI();
    
    // Load current project if available
    StorageService.getCurrentProject().then(project => {
        if (project) {
            StorageService.updateEditorContent(project);
        }
    });
    
    // Create project button
    const createProjectBtn = document.getElementById('createProject');
    if (createProjectBtn) {
        createProjectBtn.addEventListener('click', () => {
            document.getElementById('projectModal').classList.add('show');
        });
    }
    
    // Create project form submission
    const createProjectForm = document.getElementById('createProjectButton');
    if (createProjectForm) {
        createProjectForm.addEventListener('click', async () => {
            const nameInput = document.getElementById('projectName');
            const descInput = document.getElementById('projectDescription');
            
            if (nameInput && nameInput.value.trim()) {
                await StorageService.createProjectFromCurrentContent(
                    nameInput.value.trim(),
                    descInput ? descInput.value.trim() : ''
                );
                
                // Close the modal
                document.getElementById('projectModal').classList.remove('show');
                
                // Clear the form
                nameInput.value = '';
                if (descInput) descInput.value = '';
            } else {
                alert('Please enter a project name');
            }
        });
    }
    
    // Save project button
    const saveProjectBtn = document.getElementById('saveProject');
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', () => {
            StorageService.saveCurrentContent();
        });
    }
    
    // Auto-save when editor content changes
    const responseElement = document.getElementById('response');
    if (responseElement) {
        let saveTimeout;
        
        responseElement.addEventListener('input', () => {
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.textContent = 'Unsaved changes';
                saveStatus.className = 'save-status saving';
            }
            
            // Debounce the save operation
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                StorageService.saveCurrentContent();
            }, 2000);
        });
    }
});
