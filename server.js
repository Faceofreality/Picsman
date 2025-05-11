const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Simple MIME type handling
const mimeTypes = {
  'html': 'text/html',
  'js': 'text/javascript',
  'css': 'text/css',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'json': 'application/json',
  'txt': 'text/plain'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  // Handle file uploads
  if (req.method === 'POST' && pathname === '/upload') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { fileId, fileData, fileName, contentType } = data;
        
        if (!fileId || !fileData || !contentType) {
          res.writeHead(400);
          return res.end(JSON.stringify({ success: false, error: 'Missing required fields' }));
        }
        
        // Get the file extension
        const fileExtension = contentType.split('/')[1];
        const finalFileName = `${fileId}.${fileExtension}`;
        const filePath = path.join(dataDir, finalFileName);
        
        // Remove the data:image/xyz;base64, part
        const base64Data = fileData.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
        
        // Write the file
        fs.writeFile(filePath, base64Data, 'base64', (err) => {
          if (err) {
            console.error('File write error:', err);
            res.writeHead(500);
            return res.end(JSON.stringify({ success: false, error: 'File save failed' }));
          }
          
          // Return success with the file path
          const publicPath = `/data/${finalFileName}`;
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({ 
            success: true, 
            filePath: publicPath,
            fileUrl: `${req.headers.host}${publicPath}`
          }));
        });
      } catch (error) {
        console.error('Upload error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
      }
    });
    
    return;
  }
  
  // Normalize the path to prevent directory traversal attacks
  pathname = pathname.replace(/\\/g, '/');
  let filePath = '';
  
  // Default to index.html for root path
  if (pathname === '/') {
    filePath = path.join(__dirname, 'index.html');
  } else {
    // Handle files in data directory
    if (pathname.startsWith('/data/')) {
      filePath = path.join(__dirname, pathname);
    } else {
      // All other files
      filePath = path.join(__dirname, pathname.substring(1));
    }
  }
  
  // Get file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname.substr(1)] || 'application/octet-stream';
  
  // Read and serve the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        res.writeHead(404);
        res.end('File not found');
      } else {
        // Server error
        res.writeHead(500);
        res.end('Error: ' + error.code);
      }
    } else {
      // Successful response
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}/`);
});
