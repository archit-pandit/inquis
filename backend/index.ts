import axios from "axios"
import express from "express";
import { tavily } from "@tavily/core";
import { ANSWER_SCHEMA, PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt.ts";

const client = tavily({apiKey: process.env.TAVILY_API_KEY});
const app = express();

const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
const stream = true;

const model = "deepseek-ai/deepseek-v4-pro-0813";

const headers = {
    "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": stream ? "text/event-stream" : "application/json"
};  

function contentFromSseLine(line: string): string {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
        return "";
    }

    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") {
        return "";
    }

    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? "";
}

async function writeStreamedAnswer(nimStream: NodeJS.ReadableStream, res: express.Response) {
    let buffer = "";

    for await (const chunk of nimStream) {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            try {
                const content = contentFromSseLine(line);
                if (content) {
                    res.write(content);
                }
            } catch {
                // A split SSE frame can be incomplete until the next chunk.
            }
        }
    }
}

app.use(express.json());

app.post("/sign-up", async (req, res) => {
    
});

app.post("/sign-in", async (req, res) => { 

});

app.get("/conversations", async (req, res) => {

});

app.post("/conversations/:conversationId", async (req, res) => {

});

app.post("/ask", async (req, res) => {
    const query = req.body.query;

    const searchResponse = await client.search(query, {
        searchDepth: "advanced",
    });

    const searchResults = searchResponse.results;

    // context engineering on prompt + web search results
    const prompt = PROMPT_TEMPLATE
        .replace("{{USER_QUERY}}", query)
        .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(searchResults));

    // NIM Kimi-K3: system/assistant content must be a string, not a content-part array.
    // Thinking is always on; the JSON answer arrives later in `content`, not `reasoning_content`.
    const payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": prompt
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "answer_object",
                "strict": true,
                "schema": ANSWER_SCHEMA,
            },
        },
        "max_tokens": 16384,
        "stream": stream,
        "temperature": 1,
    };

    const response = await axios.post(invokeUrl, payload, { 
        headers: headers,
        responseType: stream ? "stream" : "json",
        validateStatus: () => true
    });

    if (stream) {
        await writeStreamedAnswer(response.data, res);
    } else {
        res.write(response.data?.choices?.[0]?.message?.content ?? JSON.stringify(response.data));
    }

    res.write("\n<sources>\n");
    res.write(JSON.stringify(searchResults.map(result => ({ title: result.title, url: result.url }))));
    res.write("\n</sources>\n");

    // close event stream
    res.end();
});

app.post("/ask-follow-up", async (req, res) => {
    // get existing chat from db
    // forward full history to model
    // TODO: context engineering on prompt + web search results
    // stream response
});

app.listen(3000);
