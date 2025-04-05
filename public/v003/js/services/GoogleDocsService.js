/**
 * GoogleDocsService.js
 * Handles all interactions with the Google Docs API
 */
class GoogleDocsService {
    // API config
    static CLIENT_ID = ''; // Removed hardcoded client ID
    static API_KEY = ''; // Removed hardcoded API key
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
            this.API_KEY = settings.googleApiKey || '';
            this.CLIENT_ID = settings.googleClientId || '';
            
            console.log('GoogleDocsService: Credentials loaded from settings');
            
            // Update the auth status UI to show not connected
            this.updateAuthStatus(false);
            
            // Check if we have the required credentials
            if (!this.API_KEY || !this.CLIENT_ID) {
                console.log('GoogleDocsService: Missing API key or Client ID. Google Docs integration unavailable.');
                this.hasCredentials = false;
                this.isInitialized = true; // Mark as initialized even though we can't use it
                this.updateAuthStatusMessage('Google API credentials required. Add them in Settings.');
                return;
            }

            this.hasCredentials = true;
            
            try {
                // Initialize the Google API client library
                await new Promise((resolve, reject) => {
                    if (typeof gapi === 'undefined') {
                        console.error('GoogleDocsService: GAPI not available. Make sure the script is loaded.');
                        reject(new Error('GAPI not available'));
                        return;
                    }
                    
                    gapi.load('client', {
                        callback: () => {
                            console.log('GoogleDocsService: GAPI client loaded successfully');
                            resolve();
                        },
                        onerror: (error) => {
                            console.error('GoogleDocsService: GAPI loading error:', error);
                            reject(error);
                        },
                        timeout: 5000,
                        ontimeout: () => {
                            console.error('GoogleDocsService: GAPI loading timeout');
                            reject(new Error('GAPI loading timeout'));
                        }
                    });
                });
                
                console.log('GoogleDocsService: GAPI client loaded');
                
                // Initialize the client with API key and discovery docs
                if (this.API_KEY) {
                    try {
                        await gapi.client.init({
                            apiKey: this.API_KEY,
                            discoveryDocs: this.DISCOVERY_DOCS,
                        });
                        console.log('GoogleDocsService: GAPI client initialized with API key');
                    } catch (initError) {
                        console.error('GoogleDocsService: GAPI client initialization error:', initError);
                        this.updateAuthStatusMessage('Error initializing Google API. Check console.');
                        throw initError;
                    }
                } else {
                    console.log('GoogleDocsService: No API key available, skipping gapi.client.init');
                }
                
                // Initialize the GIS client if we have a client ID
                if (this.CLIENT_ID && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                    try {
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: this.CLIENT_ID,
                            scope: this.SCOPES,
                            callback: (response) => {
                                console.log('GoogleDocsService: Auth callback received', response);
                                if (response.error) {
                                    console.error('OAuth error:', response);
                                    this.isAuthorized = false;
                                } else {
                                    console.log('GoogleDocsService: Authorization successful');
                                    this.isAuthorized = true;
                                }
                                this.updateAuthStatus(this.isAuthorized);
                            },
                            prompt: 'consent'
                        });
                        this.gisInitialized = true;
                        console.log('GoogleDocsService: Token client initialized');
                    } catch (gisError) {
                        console.error('GoogleDocsService: Error initializing token client:', gisError);
                        this.updateAuthStatusMessage('Error with Google auth. Check console.');
                        throw gisError;
                    }
                } else {
                    console.log('GoogleDocsService: Missing CLIENT_ID or Google accounts API, auth unavailable');
                    if (!this.CLIENT_ID) {
                        console.error('GoogleDocsService: CLIENT_ID is not set');
                    }
                    if (typeof google === 'undefined') {
                        console.error('GoogleDocsService: Google object is not defined');
                    } else if (!google.accounts) {
                        console.error('GoogleDocsService: google.accounts is not defined');
                    } else if (!google.accounts.oauth2) {
                        console.error('GoogleDocsService: google.accounts.oauth2 is not defined');
                    }
                    
                    this.updateAuthStatusMessage('Google Client ID not configured or API not loaded.');
                }
                
                // Check if we're already authorized
                try {
                    this.isAuthorized = gapi.client.getToken() !== null;
                    this.updateAuthStatus(this.isAuthorized);
                } catch (tokenError) {
                    console.error('GoogleDocsService: Error checking token:', tokenError);
                }
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
    
    // Rest of the methods remain unchanged...
}

// Initialize event listeners and add debug button
document.addEventListener('DOMContentLoaded', () => {
    // Add a test button to help debug Google API issues
    const testButton = document.createElement('button');
    testButton.id = 'testGoogleAPI';
    testButton.textContent = 'Test Google API';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '10px';
    testButton.style.right = '10px';
    testButton.style.zIndex = '9999';
    testButton.style.padding = '8px 12px';
    testButton.style.backgroundColor = '#f0ad4e';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.cursor = 'pointer';
    
    testButton.addEventListener('click', function() {
        console.clear();
        console.log("Testing Google API initialization...");
        
        if (typeof gapi === 'undefined') {
            console.error("GAPI not available");
            alert("GAPI not available. Check if the script is loaded.");
            return;
        }
        
        console.log("GAPI is available");
        
        gapi.load('client', function() {
            console.log("GAPI client loaded");
            gapi.client.init({
                apiKey: GoogleDocsService.API_KEY,
                discoveryDocs: GoogleDocsService.DISCOVERY_DOCS,
            }).then(function() {
                console.log("GAPI client initialized");
                alert("Google API initialized successfully! Check console for details.");
                
                if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                    console.log("Google Accounts API is available");
                } else {
                    console.error("Google Accounts API is NOT available");
                    alert("Google Accounts API is not available. OAuth will not work.");
                }
            }).catch(function(error) {
                console.error("GAPI init error:", error);
                alert("Google API initialization failed. Check console for details.");
            });
        });
    });
    
    document.body.appendChild(testButton);
    
    // Initialize Google Docs service
    try {
        GoogleDocsService.initialize().catch(error => {
            console.error('Error initializing Google Docs service:', error);
        });
    } catch (error) {
        console.error('Fatal error during Google Docs service initialization:', error);
    }
});