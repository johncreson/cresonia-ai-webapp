/**
 * AIService.js
 * Handles all interactions with the OpenRouter API for AI generation
 */
class AIService {
    /**
     * Send a request to the OpenRouter API
     */
    static async generateResponse(prompt, settings) {
        try {
            console.log('Generating AI response with model:', settings.model);
            
            const requestBody = {
                model: settings.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`,
                    'HTTP-Referer': settings.siteUrl || window.location.origin,
                    'X-Title': settings.siteName || 'Cresonia AI'
                },
                body: JSON.stringify(requestBody)
            });
            
            // Get the raw response text for debugging
            const responseText = await response.text();
            
            // Try to parse the response as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                console.error('Error parsing JSON response:', e);
                throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
            }
            
            if (!response.ok) {
                const errorMessage = data.error?.message || `HTTP error! status: ${response.status}`;
                console.error('API error:', errorMessage);
                throw new Error(errorMessage);
            }
            
            // Validate the response structure
            if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                console.error('Unexpected API response format:', data);
                throw new Error('Received an invalid response from the API');
            }
            
            const firstChoice = data.choices[0];
            if (!firstChoice.message || typeof firstChoice.message.content !== 'string') {
                console.error('Response missing expected content:', firstChoice);
                throw new Error('Response did not contain the expected content');
            }
            
            return firstChoice.message.content;
        } catch (error) {
            console.error('Error in generateResponse:', error);
            throw error;
        }
    }
    
    /**
     * Format the prompt with style guide and previous content
     */
    static formatPrompt(promptText, styleGuideText, previousContent, includePrevious) {
        let completePrompt = '';
        
        // Add style guide if it exists
        if (styleGuideText?.trim()) {
            completePrompt += `Style Guide: ${styleGuideText.trim()}\n\n`;
        }
        
        // Add the user's prompt
        completePrompt += promptText.trim();
        
        // Add previous response as prose if the checkbox is checked and there's a valid response
        if (includePrevious && previousContent) {
            completePrompt += `\n\nProse to continue: ${previousContent.trim()}`;
        }
        
        return completePrompt;
    }
    
    /**
     * Generate evaluation for the current prose
     */
    static async evaluateStory(proseContent, settings) {
        // Build the evaluation prompt
        const evaluationPrompt = `
system:
I am a literary consultant evaluating a manuscript for readiness for professional editing or self-publishing. My goal is to provide a clear recommendation on whether the story is ready for the next stage, along with a detailed report justifying my decision and offering specific suggestions for improvement if needed.

user:
The expected genre of the story is:

Fiction

The expected style of the story is:

Contemporary

Here are other considerations or requests from the author:

Please provide detailed feedback

This is the story so far:

${proseContent}

Your evaluation should be structured as follows:

1. Readiness Verdict (Top-Line Decision):

Based on your overall assessment, provide a clear verdict:

✅ Ready for Editing/Publishing (Minor Polish Recommended): Indicate that the story is fundamentally sound and ready for professional editing or self-publishing with minor revisions.

❌ Needs Revision Before Editing/Publishing: Indicate that the story requires significant revisions before it's ready for professional editing or self-publishing.

❌ Not Ready for Editing/Publishing (Major Overhaul Needed): Indicate that the story has significant fundamental issues and requires a major overhaul before considering editing or publishing.

2. Detailed Category Assessment and Justification:

For each category below, provide a score out of 10 and a detailed explanation justifying your score and how it impacts the story's readiness for editing/publishing. Use ✅ symbol to indicate categories that are particularly strong. Use the ❌ symbol to highlight areas that are significant roadblocks to readiness.

Plot Structure & Completeness: (Score / 10)

Pacing & Momentum for Reader Engagement: (Score / 10)

Character Development & Believability: (Score / 10)

Worldbuilding & Setting (if applicable): (Score / 10)

Dialogue Effectiveness & Naturalness: (Score / 10)

Writing Quality & Clarity: (Score / 10)

Word Choice & Impact: (Score / 10)

Clichés & Originality of Voice: (Score / 10)

Repetition & Redundancy: (Score / 10)

Readability & Flow for Target Audience: (Score / 10)

Genre Convention Adherence & Subversion (if genre is specified): (Score / 10)

Overall Reader Experience & Impact: (Score / 10)

3. Appendix: Actionable Steps for Improvement (If Needed):

If the "Readiness Verdict" is "Needs Revision Before Editing/Publishing" or "Not Ready for Editing/Publishing (Major Overhaul Needed)," provide a detailed list of actionable steps with examples included that the author should take to improve the manuscript. Focus on the weakest areas identified in your category assessments. For each point, explain why it's important for readiness and how to address it concretely. Prioritize the most critical improvements needed to reach readiness. If the verdict is "Ready for Editing/Publishing (Minor Polish Recommended)," this section can offer suggestions for minor polishing during the editing phase.
`;

        try {
            // Use the specified evaluation model or default to the general model
            const evaluationModel = settings.defaultEvaluationModel || 'deepseek/deepseek-chat:free';
            
            // Clone the settings and change the model
            const evaluationSettings = { ...settings, model: evaluationModel };
            
            return await this.generateResponse(evaluationPrompt, evaluationSettings);
        } catch (error) {
            console.error('Error evaluating story:', error);
            throw error;
        }
    }
    
    /**
     * Clean up the AI response text
     */
    static cleanResponseText(response) {
        return response
            .replace(/\\boxed\{([\s\S]*?)\}/g, '$1')
            .replace(/```markdown\s+/g, '')
            .replace(/```(?:\w+)?\s+/g, '')
            .replace(/```/g, '')
            .replace(/^plaintext\s+/im, '')
            .replace(/^```\s*plaintext\s+/im, '')
            .replace(/^```\s*\w+\s+/gm, '');
    }
    
    /**
     * Format the response as HTML for display
     */
    static formatResponseAsHTML(response) {
        // First clean the response text
        const cleanText = this.cleanResponseText(response);
        
        // Process with marked.js if available
        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(cleanText);
            } catch (error) {
                console.error('Error parsing markdown:', error);
                return cleanText;
            }
        }
        
        return cleanText;
    }
}
