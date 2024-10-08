// server.js (Backend)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

// Increase the payload size limits
app.use(express.json({ limit: '50mb' })); // Adjust as needed
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Adjust as needed

app.use(cors());

// Configure Multer with file size limits
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (req, file, cb) => {
    // Optional: Filter files by type if needed
    if (file.mimetype !== 'application/json') {
      return cb(new Error('Only JSON files are allowed!'), false);
    }
    cb(null, true);
  },
});

// In-memory storage for collections and tokens
let collections = [];

// Helper function to flatten nested items
function flattenItems(items, parentPath = '') {
  let flatItems = [];
  items.forEach((item, index) => {
    const currentPath = `${parentPath}/${item.name || `Item ${index + 1}`}`;
    if (item.item && Array.isArray(item.item)) {
      // It's a folder; recurse into it
      flatItems = flatItems.concat(flattenItems(item.item, currentPath));
    } else {
      // It's an API request
      flatItems.push({
        ...item,
        fullPath: currentPath,
        globalId: `${parentPath}/${item.name || `Item ${index + 1}`}`,
      });
    }
  });
  return flatItems;
}

// Route to upload Postman collections
app.post('/upload', upload.array('collections'), (req, res) => {
  try {
    const files = req.files;

    // Reset the collections array to clear previous uploads
    collections = [];

    files.forEach(file => {
      const collectionPath = path.join(__dirname, file.path);
      const rawData = fs.readFileSync(collectionPath);
      const collection = JSON.parse(rawData);

      // Log the entire collection object for debugging
      console.log('Uploaded Collection:', JSON.stringify(collection, null, 2));

      // Extract initial token if exists
      let token = '';
      if (collection.item && Array.isArray(collection.item)) {
        // Flatten items to handle nested folders
        const flatItems = flattenItems(collection.item);
        flatItems.forEach(item => {
          if (item.request && item.request.auth && item.request.auth.bearer) {
            token = item.request.auth.bearer.token || '';
          }
        });

        collections.push({
          id: collections.length + 1,
          name: collection.info ? collection.info.name : 'Unnamed Collection',
          collection: {
            ...collection,
            item: flatItems, // Replace with flattened items
          },
          token,
        });
      } else {
        collections.push({
          id: collections.length + 1,
          name: collection.info ? collection.info.name : 'Unnamed Collection',
          collection,
          token,
        });
      }

      // Remove the uploaded file after processing
      fs.unlinkSync(collectionPath);
    });

    res.json({ message: 'Collections uploaded successfully', collections });
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});

// Route to update token
app.post('/update-token', (req, res) => {
  const { collectionId, token } = req.body;

  const collection = collections.find(col => col.id === collectionId);
  if (collection) {
    collection.token = token;

    // Update token in the collection items
    collection.collection.item.forEach(item => {
      if (item.request && item.request.auth && item.request.auth.bearer) {
        item.request.auth.bearer.token = token;
      }
    });

    // Log the updated collection for verification
    console.log(`Updated Collection ID ${collectionId}:`, JSON.stringify(collection, null, 2));

    res.json({ message: 'Token updated successfully' });
  } else {
    res.status(404).json({ message: 'Collection not found' });
  }
});

// Route to execute individual API request
app.post('/execute-request', async (req, res) => {
  const { collectionId, globalId } = req.body;

  const collectionEntry = collections.find(col => col.id === collectionId);
  if (!collectionEntry) {
    return res.status(404).json({ message: 'Collection not found' });
  }

  const collection = collectionEntry.collection;

  if (!collection || !collection.item || !Array.isArray(collection.item)) {
    return res.status(400).json({ message: 'Invalid collection structure' });
  }

  // Find the item by globalId
  const item = collection.item.find(itm => itm.globalId === globalId);
  if (!item) {
    return res.status(404).json({ message: 'API request not found' });
  }

  const request = item.request;
  if (!request || !request.url || !request.method) {
    return res.status(400).json({ message: 'Invalid API request structure' });
  }

  const url = request.url.raw;
  const method = request.method.toLowerCase();
  const headers = {};

  // Add headers from Postman
  if (request.header && Array.isArray(request.header)) {
    request.header.forEach(header => {
      headers[header.key] = header.value;
    });
  }

  // Add/Override Authorization header with the updated token
  if (collectionEntry.token) {
    headers['Authorization'] = `Bearer ${collectionEntry.token}`;
  }

  // Prepare Axios config
  const axiosConfig = {
    method,
    url,
    headers,
    timeout: 30000, // 30 seconds timeout
  };

  // Handle request body based on method
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (request.body && request.body.raw) {
      try {
        axiosConfig.data = JSON.parse(request.body.raw);
      } catch (err) {
        axiosConfig.data = request.body.raw; // If not JSON, send as is
      }
    }
  }

  try {
    const response = await axios(axiosConfig);
    res.json({
      collectionName: collection.info ? collection.info.name : 'Unnamed Collection',
      apiName: item.name || 'Unnamed API',
      method: request.method,
      url,
      status: response.status,
      data: response.data,
    });
  } catch (error) {
    res.json({
      collectionName: collection.info ? collection.info.name : 'Unnamed Collection',
      apiName: item.name || 'Unnamed API',
      method: request.method,
      url,
      status: error.response ? error.response.status : 'Error',
      data: error.response ? error.response.data : error.message,
    });
  }
});

// Optional: Route to execute all API requests sequentially
app.post('/execute', async (req, res) => {
  const { collections: inputCollections } = req.body;
  const responses = [];

  for (const col of inputCollections) {
    const collection = collections.find(c => c.id === col.id).collection;
    for (const item of collection.item) {
      const request = item.request;
      const url = request.url.raw;
      const method = request.method.toLowerCase();
      const headers = {};

      // Add headers from Postman
      if (request.header && Array.isArray(request.header)) {
        request.header.forEach(header => {
          headers[header.key] = header.value;
        });
      }

      // Add token if exists
      if (collection.token) {
        headers['Authorization'] = `Bearer ${collection.token}`;
      }

      // Prepare Axios config
      const axiosConfig = {
        method,
        url,
        headers,
      };

      // Handle request body based on method
      if (['post', 'put', 'patch', 'delete'].includes(method)) {
        if (request.body && request.body.raw) {
          try {
            axiosConfig.data = JSON.parse(request.body.raw);
          } catch (err) {
            axiosConfig.data = request.body.raw; // If not JSON, send as is
          }
        }
      }

      try {
        const response = await axios(axiosConfig);
        responses.push({
          collectionName: collection.info ? collection.info.name : 'Unnamed Collection',
          apiName: item.name || 'Unnamed API',
          method: request.method,
          url,
          status: response.status,
          data: response.data,
        });
      } catch (error) {
        responses.push({
          collectionName: collection.info ? collection.info.name : 'Unnamed Collection',
          apiName: item.name || 'Unnamed API',
          method: request.method,
          url,
          status: error.response ? error.response.status : 'Error',
          data: error.response ? error.response.data : error.message,
        });
      }
    }
  }

  res.json({ responses });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
