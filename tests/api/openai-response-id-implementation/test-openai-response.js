// npm i openai dotenv
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// System prompt for consistent behavior
const SYSTEM_PROMPT = `
You are a helpful assistant. Be concise and accurate.
`;

async function testFirstRound() {
  try {
    console.log('🔄 Sending request for Netflix stock price with web search...\n');

    const firstResponse = await client.responses.create({
      model: 'gpt-5-mini',
      instructions: SYSTEM_PROMPT,
      reasoning: {
        effort: 'low',
        summary: 'auto',
      },
      input: [
        {
          role: 'user',
          content: 'stock price for netflix',
        },
      ],
      tools: [{ type: 'web_search' }], // Enable web search
      store: true, // Store for future reference
    });

    console.log('✅ Response ID:', firstResponse.id);
    console.log('\n📝 Response Content:');
    console.log('─'.repeat(50));
    console.log(firstResponse.output_text);
    console.log('─'.repeat(50));

    // Check for web search in outputs
    if (firstResponse.output || firstResponse.outputs) {
      const outputs = firstResponse.output || firstResponse.outputs || [];
      console.log('\n🔍 Checking for web search results...');

      for (const output of outputs) {
        if (output.type === 'web_search_call') {
          console.log('✅ Found web_search_call:');
          console.log('  - Type:', output.type);
          if (output.action) {
            console.log('  - Action:', JSON.stringify(output.action, null, 2));
          }
          if (output.item) {
            console.log('  - Item:', JSON.stringify(output.item, null, 2));
          }
        }

        if (output.type === 'message' && output.content) {
          for (const content of output.content) {
            if (content.annotations && content.annotations.length > 0) {
              console.log('\n📌 Found annotations (citations):');
              for (const annotation of content.annotations) {
                if (annotation.type === 'url_citation') {
                  console.log(`  - ${annotation.title || 'Untitled'}: ${annotation.url}`);
                }
              }
            }
          }
        }
      }
    }

    // 如果有 reasoning summary，打印出来
    if (firstResponse.reasoning_summary) {
      console.log('\n💭 Reasoning Summary:');
      console.log(firstResponse.reasoning_summary);
    }

    // 打印使用的 tokens
    if (firstResponse.usage) {
      console.log('\n📊 Token 使用情况:');
      console.log(`  - Input tokens: ${firstResponse.usage.input_tokens}`);
      console.log(`  - Output tokens: ${firstResponse.usage.output_tokens}`);
      console.log(`  - Reasoning tokens: ${firstResponse.usage.reasoning_tokens || 0}`);
      console.log(`  - Total tokens: ${firstResponse.usage.total_tokens}`);
    }

    // 保存完整响应到文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `openai-response-${timestamp}.json`;
    const filepath = path.join(process.cwd(), filename);

    const responseData = {
      timestamp: new Date().toISOString(),
      request: {
        model: 'gpt-5-mini',
        instructions: SYSTEM_PROMPT,
        reasoning: { effort: 'low', summary: 'auto' },
        input: [{ role: 'user', content: 'stock price for netflix' }],
        tools: [{ type: 'web_search' }],
        store: true,
      },
      response: firstResponse,
    };

    await fs.writeFile(filepath, JSON.stringify(responseData, null, 2), 'utf-8');
    console.log(`\n💾 响应已保存到: ${filename}`);

    return firstResponse.id; // 返回 ID 供后续使用
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.response) {
      console.error('API 响应:', error.response.data);
    }
  }
}

// 执行测试
testFirstRound();
