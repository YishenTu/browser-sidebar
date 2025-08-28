/**
 * Example output of the new content formatter
 * Clean markdown with minimal XML tags as separators
 * Includes browser context instruction for clarity
 */

const exampleOutput = `
<browser_context>
The user is viewing 2 web pages in the browser.
Sources: x.com, reddit.com
Below is the extracted content from these tabs, followed by the user question.
Please analyze this content to answer the user query.
</browser_context>

<tab_content>
<tab>
  <metadata>
    <title>Thariq on X: "is there a polymarket for who the antichrist is" / X</title>
    <url>https://x.com/trq212/status/1960923999862509938</url>
    <domain>x.com</domain>
  </metadata>
  <content>
**Thariq** @trq212 2025-08-28

is there a polymarket for who the antichrist is

* * *

**jeff** @jeffreyhuber 2025-08-28

bet

* * *

**DNC Operative Groyper** @StochNoticer 2025-08-28

No nigga, he OWNS it
  </content>
</tab>

<tab>
  <metadata>
    <title>Gemini 2.5 Pro has a dramatic, literary tone, whereas GPT-5 Thinking is more plain and straightforward. : r/Bard</title>
    <url>https://www.reddit.com/r/Bard/comments/1n1z3xy/gemini_25_pro_has_a_dramatic_literary_tone/</url>
    <domain>reddit.com</domain>
  </metadata>
  <content>
While Gemini 2.5 Pro is superior when it comes to conversational fun, GPT-5 Thinking seems to win at intellectual debate. Unlike Gemini, it doesn't flatter, and its perceived hallucination rate is lower, so it feels more trustworthy. So it would be nice if Gemini 3.0 launched with a straightforward tone like GPT-5 Thinking.

## Comments

> **bludgeonerV** • 10 points •
> 
> Just create a Gem with the personality you want, it's extremely good at fitting the style you tell it to.
> 
> I have one set up for language learning that gives me completely toneless information in the exact format i told it to, optimized for text to speech with no fluff at all.

> **abbumm** • 7 points •
> 
> Uhh nah thanks, I enjoy Gemini precisely because it's so good at humanities. Don't flatten it out. And I had GPT-5-High get physics questions wrong with Gemini 2.5 Pro getting the same questions right (I'm a physics teacher and researcher). I was disappointed with GPT-5's release :( I hope OpenAI returns to be competitive because that's really not it

> **Klutzy_Telephone468** • 1 point •
> 
> I like the conversational tone. It helps when you ask LLM to explain complex topics
  </content>
</tab>

</tab_content>

<user_query>
what does these two pages say?
</user_query>
`;

/**
 * Benefits of the new structure:
 * 
 * 1. **Clear Separation**: Three distinct parts with XML labels
 *    - <browser_context>: System instruction explaining the context
 *    - <tab_content>: The actual tab content with structured metadata
 *    - <user_query>: The user's actual question
 * 
 * 2. **Better Organization**: Each tab is a separate XML element with:
 *    - Structured metadata (title, url, domain)
 *    - Content properly escaped for XML
 *    - No unnecessary identifiers or status flags
 * 
 * 3. **Easier Parsing**: AI providers can easily:
 *    - Extract specific tab content
 *    - Understand the context before the query
 *    - Focus on the actual user question at the end
 * 
 * 4. **Truncation Support**: When content is truncated:
 *    - Individual tabs can be marked as truncated
 *    - A truncation notice is included
 *    - Metadata shows which tabs were omitted
 * 
 * 5. **System Context**: Moved to API system parameter for cleaner separation
 */

export { exampleOutput };