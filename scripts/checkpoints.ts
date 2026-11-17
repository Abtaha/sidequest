import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const saver = PostgresSaver.fromConnString(process.env.DATABASE_URL);
try {
  await saver.setup();
  console.info("LangGraph checkpoint schema is ready");
} finally {
  await saver.end();
}
