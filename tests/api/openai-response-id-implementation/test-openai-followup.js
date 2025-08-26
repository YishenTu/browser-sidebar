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

async function testFollowUp(previousResponseId) {
  try {
    console.log("🔄 发送续聊请求...\n");
    console.log("📌 使用上一轮 Response ID:", previousResponseId);
    console.log("─".repeat(50));
    
    const followUpResponse = await client.responses.create({
      model: "gpt-5-mini",
      previous_response_id: previousResponseId,  // 继承对话上下文
      instructions: SYSTEM_PROMPT,  // 仍需显式传入
      reasoning: { 
        effort: "low", 
        summary: "auto" 
      },
      input: [
        { 
          role: "user", 
          content: "用简洁语句概括" 
        }
      ],
      tools: [{ type: "web_search" }],  // Enable web search
      store: true  // Store for future reference
    });

    console.log("\n✅ 续聊响应 ID:", followUpResponse.id);
    console.log("\n📝 响应内容:");
    console.log("─".repeat(50));
    console.log(followUpResponse.output_text);
    console.log("─".repeat(50));
    
    // 如果有 reasoning summary，打印出来
    if (followUpResponse.reasoning_summary) {
      console.log("\n💭 Reasoning Summary:");
      console.log(followUpResponse.reasoning_summary);
    }
    
    // 打印使用的 tokens
    if (followUpResponse.usage) {
      console.log("\n📊 Token 使用情况:");
      console.log(`  - Input tokens: ${followUpResponse.usage.input_tokens}`);
      console.log(`  - Output tokens: ${followUpResponse.usage.output_tokens}`);
      console.log(`  - Reasoning tokens: ${followUpResponse.usage.reasoning_tokens || 0}`);
      console.log(`  - Total tokens: ${followUpResponse.usage.total_tokens}`);
    }
    
    // 保存完整响应到文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `openai-followup-${timestamp}.json`;
    const filepath = path.join(process.cwd(), filename);
    
    const responseData = {
      timestamp: new Date().toISOString(),
      previous_response_id: previousResponseId,
      request: {
        model: "gpt-5-mini",
        previous_response_id: previousResponseId,
        instructions: SYSTEM_PROMPT,
        reasoning: { effort: "low", summary: "auto" },
        input: [{ role: "user", content: "用简洁语句概括" }],
        tools: [{ type: "web_search" }],
        store: true
      },
      response: followUpResponse
    };
    
    await fs.writeFile(filepath, JSON.stringify(responseData, null, 2), 'utf-8');
    console.log(`\n💾 续聊响应已保存到: ${filename}`);
    
    return followUpResponse.id;  // 返回 ID 供后续使用
    
  } catch (error) {
    console.error("❌ 错误:", error.message);
    if (error.response) {
      console.error("API 响应:", error.response.data);
    }
  }
}

// 从命令行参数获取 previous_response_id，或使用默认值
const previousId = process.argv[2] || "resp_68ac8301b5508195b964c033a349c8a00995dc3199d3acfe";

console.log("========================================");
console.log("OpenAI Response API 续聊测试");
console.log("========================================\n");

// 执行续聊测试
testFollowUp(previousId);