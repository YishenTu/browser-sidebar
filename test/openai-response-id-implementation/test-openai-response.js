// npm i openai dotenv
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

// Load environment variables
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// System prompt for consistent behavior
const SYSTEM_PROMPT = `
你是一个严谨、简洁的中文助理。输出结构：先结论，再依据，最后给不确定性与下一步建议。
遵循：必要时给出公式/代码；不要使用表情；引用外部信息时给出来源。
`;

async function testFirstRound() {
  try {
    console.log("🔄 发送首轮请求...\n");
    
    const firstResponse = await client.responses.create({
      model: "gpt-5-mini",
      instructions: SYSTEM_PROMPT,
      reasoning: { 
        effort: "low", 
        summary: "auto" 
      },
      input: [
        { 
          role: "user", 
          content: "什么是量子计算？它与传统计算的主要区别是什么？" 
        }
      ],
      tools: [{ type: "web_search" }],  // Enable web search
      store: true  // Store for future reference
    });

    console.log("✅ 首轮响应 ID:", firstResponse.id);
    console.log("\n📝 响应内容:");
    console.log("─".repeat(50));
    console.log(firstResponse.output_text);
    console.log("─".repeat(50));
    
    // 如果有 reasoning summary，打印出来
    if (firstResponse.reasoning_summary) {
      console.log("\n💭 Reasoning Summary:");
      console.log(firstResponse.reasoning_summary);
    }
    
    // 打印使用的 tokens
    if (firstResponse.usage) {
      console.log("\n📊 Token 使用情况:");
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
        model: "gpt-5-mini",
        instructions: SYSTEM_PROMPT,
        reasoning: { effort: "low", summary: "auto" },
        input: [{ role: "user", content: "什么是量子计算？它与传统计算的主要区别是什么？" }],
        tools: [{ type: "web_search" }],
        store: true
      },
      response: firstResponse
    };
    
    await fs.writeFile(filepath, JSON.stringify(responseData, null, 2), 'utf-8');
    console.log(`\n💾 响应已保存到: ${filename}`);
    
    return firstResponse.id;  // 返回 ID 供后续使用
    
  } catch (error) {
    console.error("❌ 错误:", error.message);
    if (error.response) {
      console.error("API 响应:", error.response.data);
    }
  }
}

// 执行测试
testFirstRound();