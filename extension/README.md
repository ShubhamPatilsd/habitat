Habitat Chrome Extension - quick start

Files:
- manifest.json
- popup.html
- popup.js
- contentScript.js
- service-worker.js
- server.js
- package.json

How to test locally:
1. Server:
   - cd to server folder (where server.js and package.json live)
   - npm install
   - npm start
   - Server will run on http://localhost:3000 by default. In the extension code we post to https://habitat-aiasdiasida.com/api/rabbithole.
   - For local testing either:
     a) Change the fetch URL in popup.js to http://localhost:3000/api/rabbithole, and change host_permissions in manifest.json to include http://localhost:3000/* OR
     b) Deploy the server under the domain you specified in manifest host_permissions.

2. Load extension in Chrome:
   - Open chrome://extensions
   - Toggle Developer mode ON
   - Click "Load unpacked" and select the folder containing manifest.json and the other files
   - Click the extension icon on any page, then click "Scrape & Create Node"

Notes and security:
- This extension only scrapes on explicit user action.
- Server CORS is permissive for testing. In production, set Access-Control-Allow-Origin to your real extension origin or site domain.
- Do not send sensitive form values or passwords. The content script does not read input values, but be careful with pages containing private data.
- Add authentication to associate nodes with users before deploying publicly.
- To improve main content extraction, bundle Mozilla Readability into contentScript.js during your build step. For now the fallback heuristics are used.

If you want, I can:
- bundle a Readability build for you and update contentScript.js to use it,
- add an auth flow (JWT/OAuth) and show how to attach nodes to users,
- create a prettier node display / lightweight frontend to view saved nodes,
- or pack the extension into a zip and provide instructions for publishing.
