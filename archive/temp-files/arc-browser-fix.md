# Arc Browser Microphone Permission Fix

Arc browser handles extension permissions differently than Chrome. Here are specific solutions for Arc:

## Solution 1: Open Extension in a New Tab (Recommended)

Arc allows extensions to run in full tabs, which have better permission handling:

1. **Right-click on your extension icon**
2. **Select "Open in New Tab"** 
3. **In the new tab, click "Request Microphone Permission"**
4. **Arc should show the permission prompt properly**

## Solution 2: Use Arc's Site Settings

1. **While the extension popup is open**
2. **Click the lock icon in Arc's address bar**
3. **Find "Microphone" in the dropdown**
4. **Change it from "Ask" or "Block" to "Allow"**

## Solution 3: Grant Permission via a Regular Website First

1. **Open a new tab and go to:** https://www.onlinemictest.com/
2. **Click "Test my mic"**
3. **Allow microphone permission when prompted**
4. **Now go back to your extension and try again**

## Solution 4: Arc Browser Settings

1. **Open Arc Settings** (Cmd+,)
2. **Go to "Privacy and Security"**
3. **Click "Site Settings"**
4. **Click "Microphone"**
5. **Make sure it's set to "Sites can ask to use your microphone"**
6. **Check if your extension is in the blocked list and remove it**

## Solution 5: Use Chrome Instead (Temporary)

If Arc continues to have issues:
1. **Export your extension folder**
2. **Load it in regular Chrome**
3. **Test if it works there**
4. **This will confirm if it's Arc-specific**

## Why This Happens in Arc

Arc Browser is based on Chromium but has its own permission system that sometimes conflicts with Chrome extensions. Extensions run in a special context in Arc that may not trigger permission prompts correctly.

## Alternative: Direct Tab Recording

Since Arc has issues with extension popups, we could modify the extension to work differently:

1. Create a full page instead of a popup
2. Open it in a new Arc tab
3. Record from there

Would you like me to create this alternative version?