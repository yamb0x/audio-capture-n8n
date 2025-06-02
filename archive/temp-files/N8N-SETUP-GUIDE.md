# 🚀 n8n Workflow Setup Guide

## Overview
This enhanced n8n workflow processes audio recordings from the Chrome extension, transcribes them with OpenAI, analyzes the content with AI, and creates beautifully organized Notion pages.

## Workflow Features

### 🎯 **Smart Processing**
- ✅ Aggregates audio chunks by session
- ✅ Only processes complete recordings (waits for `isLastChunk: true`)
- ✅ Handles different platforms (Zoom, Meet, Teams, YouTube, etc.)
- ✅ Adapts analysis based on recording type

### 🤖 **AI-Powered Analysis**
- ✅ Transcribes audio with OpenAI Whisper
- ✅ Extracts key information with GPT-4
- ✅ Identifies action items, decisions, and participants
- ✅ Generates executive summaries

### 📝 **Organized Notion Pages**
- ✅ Structured with sections for different content types
- ✅ Action items as checkboxes
- ✅ Collapsible full transcription
- ✅ Metadata and tags for organization

## Setup Instructions

### 1. Import the Workflow
1. In your n8n interface, click **"Import from File"**
2. Upload `n8n-enhanced-workflow.json`
3. The workflow will be imported with all nodes configured

### 2. Configure Credentials

#### A. OpenAI API Credentials
1. Go to **Settings → Credentials**
2. Create **"OpenAI API"** credential
3. Add your OpenAI API key
4. Update the credential ID in these nodes:
   - `OpenAI Transcribe`
   - `Analyze Content with AI`

#### B. Notion API Credentials
1. Create a Notion integration at https://developers.notion.com/
2. In n8n, create **"Notion API"** credential
3. Add your Notion integration token
4. Update the credential ID in `Create Notion Page` node

### 3. Configure Notion Database

#### A. Create Notion Database
Create a new Notion database with these properties:

| Property Name | Type | Options |
|---------------|------|---------|
| **Title** | Title | - |
| **Date** | Date | - |
| **Platform** | Select | `google-meet`, `zoom`, `ms-teams`, `youtube`, `spotify`, `discord`, `browser` |
| **Type** | Select | `video-call`, `media-playback`, `chat-audio`, `general-audio` |
| **Duration** | Rich Text | - |
| **Priority** | Select | `high`, `medium`, `low` |
| **Follow-up Required** | Checkbox | - |
| **Tags** | Multi-select | (auto-populated by workflow) |
| **Participants** | Rich Text | - |
| **Session ID** | Rich Text | - |

#### B. Update Database ID
1. Copy your Notion database ID from the URL
2. Update the `databaseId` parameter in the `Create Notion Page` node

### 4. Update Node IDs

Replace these placeholder IDs with your actual values:

```json
{
  "webhookId": "your-webhook-id",           // Your existing webhook ID
  "openAiCredentialsId": "your-openai-id", // Your OpenAI credential ID  
  "notionCredentialsId": "your-notion-id", // Your Notion credential ID
  "databaseId": "your-database-id"          // Your Notion database ID
}
```

### 5. Activate the Workflow
1. Toggle the **"Active"** switch ON
2. Your webhook URL should be: `https://your-n8n-instance.com/webhook/meeting-audio`

## How It Works

### 📊 **Data Flow**
1. **Chrome Extension** → Sends audio chunks to webhook
2. **Session Aggregator** → Collects chunks until session complete
3. **OpenAI Whisper** → Transcribes each audio chunk
4. **GPT-4 Analysis** → Extracts structured information
5. **Notion Creation** → Builds organized page

### 🧠 **AI Analysis**
The workflow extracts:
- **Executive Summary** - 2-3 sentence overview
- **Main Topics** - Key discussion points
- **Key Decisions** - Important conclusions
- **Action Items** - Tasks with owners and deadlines
- **Participants** - Meeting attendees
- **Questions** - Items needing follow-up
- **Next Steps** - Planned actions

### 📋 **Notion Page Structure**
```
📋 Executive Summary
🎯 Main Topics  
✅ Key Decisions
📝 Action Items (checkboxes)
❓ Questions & Follow-ups
⏭️ Next Steps
📄 Full Transcription (collapsible)
ℹ️ Metadata & Source Info
```

## Recording Type Adaptations

### 🎥 **Video Calls** (Meet, Zoom, Teams)
- Focus on meeting outcomes
- Extract action items and decisions
- Identify participants and roles

### 🎵 **Media Content** (YouTube, Spotify)
- Extract key insights and quotes
- Identify main themes
- Capture actionable advice

### 💬 **Chat Audio** (Discord, Slack)
- Focus on conversation highlights
- Track important links or resources shared

### 🌐 **General Audio** (Other websites)
- Adapt analysis based on content type
- Extract relevant information dynamically

## Troubleshooting

### ❌ **Common Issues**

**1. No Notion pages created**
- Check Notion database ID is correct
- Verify Notion integration has access to the database
- Check credential permissions

**2. OpenAI transcription fails**
- Verify OpenAI API key is valid
- Check audio format is supported (WebM)
- Monitor API usage limits

**3. Sessions not completing**
- Ensure Chrome extension is sending `isLastChunk: true`
- Check session aggregator node logs
- Verify recording stops properly

**4. Missing analysis**
- Check GPT-4 model access in OpenAI account
- Verify prompt formatting
- Monitor token usage

### 🔍 **Debugging Tips**
1. **Enable Debug Mode** in n8n settings
2. **Check Execution Logs** for each node
3. **Test Individual Nodes** with sample data
4. **Monitor OpenAI Usage** dashboard

## Customization Options

### 🎨 **Notion Customization**
- Modify page template in `Create Notion Page` node
- Add custom properties to database
- Change page structure and formatting

### 🤖 **AI Prompts**
- Customize analysis prompts in `Analyze Content with AI`
- Adjust for specific use cases
- Add domain-specific terminology

### 📊 **Data Processing**
- Modify session aggregation logic
- Add filtering by platform or type
- Implement custom metadata extraction

## Performance Optimization

### ⚡ **Speed Improvements**
- Use parallel processing where possible
- Optimize prompt length for faster AI responses
- Cache frequently used data

### 💰 **Cost Optimization**
- Monitor OpenAI usage and costs
- Adjust transcription quality settings
- Implement smart filtering to reduce API calls

## Next Steps

1. **Test the workflow** with a short recording
2. **Monitor execution logs** for any errors
3. **Customize Notion page template** to your needs
4. **Set up alerts** for failed executions
5. **Create additional workflows** for specific use cases

Your n8n workflow is now ready to transform audio recordings into organized, actionable Notion pages! 🎉