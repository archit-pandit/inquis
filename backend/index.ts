import express from "express";

const app = express();

app.post("/ask", async (req, res) => {
    // get query from user
    // make sure user has access/credits
    // check if web search indexed
    // if not, hit web search
    // context engineering on prompt + web search results
    // call chosen LLM with context
    // stream back to user + follow up questions
});

app.listen(3000);