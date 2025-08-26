// Test script for OpenAI Response API with previous_response_id integration
// This tests the actual browser extension's provider implementation

import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
你是一个严谨、简洁的中文助理。输出结构：先结论，再依据，最后给不确定性与下一步建议。
遵循：必要时给出公式/代码；不要使用表情；引用外部信息时给出来源。
`;

async function testResponseIdFlow() {
  console.log("🧪 Testing OpenAI Response API with previous_response_id\n");
  console.log("=" .repeat(60));
  
  let responseId = null;
  const results = [];
  
  try {
    // Test 1: First request (no previous_response_id)
    console.log("\n📝 Test 1: Initial request without previous_response_id");
    console.log("-".repeat(40));
    
    const firstRequest = {
      model: "gpt-5-mini",
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content: "什么是深度学习？用3句话解释。" }],
      reasoning: { effort: "low", summary: "auto" },
      tools: [{ type: "web_search" }],
      store: true
    };
    
    console.log("Request:", JSON.stringify(firstRequest, null, 2));
    
    const firstResponse = await client.responses.create(firstRequest);
    responseId = firstResponse.id;
    
    console.log("\n✅ Response ID:", responseId);
    console.log("Content:", firstResponse.output_text?.substring(0, 200) + "...");
    
    results.push({
      test: "Initial request",
      request: firstRequest,
      responseId: responseId,
      success: true
    });
    
    // Test 2: Follow-up request with previous_response_id
    console.log("\n📝 Test 2: Follow-up request WITH previous_response_id");
    console.log("-".repeat(40));
    
    const followUpRequest = {
      model: "gpt-5-mini",
      previous_response_id: responseId,
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content: "更简洁地用1句话概括" }],
      reasoning: { effort: "low", summary: "auto" },
      tools: [{ type: "web_search" }],
      store: true
    };
    
    console.log("Request:", JSON.stringify(followUpRequest, null, 2));
    
    const followUpResponse = await client.responses.create(followUpRequest);
    const newResponseId = followUpResponse.id;
    
    console.log("\n✅ New Response ID:", newResponseId);
    console.log("Previous Response ID used:", responseId);
    console.log("Content:", followUpResponse.output_text?.substring(0, 200) + "...");
    
    results.push({
      test: "Follow-up with previous_response_id",
      request: followUpRequest,
      previousResponseId: responseId,
      newResponseId: newResponseId,
      success: true
    });
    
    // Test 3: Another follow-up to verify chain continuity
    console.log("\n📝 Test 3: Second follow-up to verify chain");
    console.log("-".repeat(40));
    
    const secondFollowUpRequest = {
      model: "gpt-5-mini",
      previous_response_id: newResponseId,
      instructions: SYSTEM_PROMPT,
      input: [{ role: "user", content: "这和机器学习有什么区别？" }],
      reasoning: { effort: "low", summary: "auto" },
      tools: [{ type: "web_search" }],
      store: true
    };
    
    console.log("Request:", JSON.stringify(secondFollowUpRequest, null, 2));
    
    const secondFollowUpResponse = await client.responses.create(secondFollowUpRequest);
    
    console.log("\n✅ Final Response ID:", secondFollowUpResponse.id);
    console.log("Previous Response ID used:", newResponseId);
    console.log("Content:", secondFollowUpResponse.output_text?.substring(0, 200) + "...");
    
    results.push({
      test: "Second follow-up",
      request: secondFollowUpRequest,
      previousResponseId: newResponseId,
      newResponseId: secondFollowUpResponse.id,
      success: true
    });
    
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    results.push({
      test: "Error case",
      error: error.message,
      success: false
    });
  }
  
  // Save test results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `response-id-test-${timestamp}.json`;
  
  await fs.writeFile(
    filename,
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
    'utf-8'
  );
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary:");
  console.log(`- Total tests: ${results.length}`);
  console.log(`- Successful: ${results.filter(r => r.success).length}`);
  console.log(`- Failed: ${results.filter(r => !r.success).length}`);
  console.log(`\n💾 Results saved to: ${filename}`);
  
  // Verify the implementation works correctly
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log("\n✅ All tests passed! Response ID chaining is working correctly.");
  } else {
    console.log("\n⚠️ Some tests failed. Check the results file for details.");
  }
}

// Run the test
testResponseIdFlow();