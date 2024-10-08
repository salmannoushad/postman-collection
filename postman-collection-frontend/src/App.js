// src/App.js
import React, { useState } from 'react';
import { Container, Typography, Button, CircularProgress } from '@mui/material';
import FileUpload from './components/FileUpload';
import CollectionCard from './components/CollectionCard';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const EXECUTE_REQUEST = process.env.REACT_APP_EXECUTE_REQUEST;
const executeRequestURL = `${API_BASE_URL}${EXECUTE_REQUEST}`;

function App() {
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState([]);
  const [errorCollections, setErrorCollections] = useState([]);
  const [responses, setResponses] = useState([]);

  const handleUpload = (uploadedCollections) => {
    setCollections(uploadedCollections);
    setResponses([]); // Clear previous responses
    setLoadingCollections([]);
    setErrorCollections([]);
  };

  const handleTokenUpdate = (collectionId, token) => {
    setCollections(prev =>
      prev.map(col => (col.id === collectionId ? { ...col, token } : col))
    );
  };

  const executeSequentially = async (collection) => {
    const totalItems = collection.collection.item.length;
    for (let i = 0; i < totalItems; i++) {
      const item = collection.collection.item[i];
      const globalId = item.globalId;
      try {
        setLoadingCollections(prev => [...prev, { collectionId: collection.id, globalId }]);

        const response = await axios.post(executeRequestURL, {
          collectionId: collection.id,
          globalId,
        });

        setResponses(prev => [...prev, response.data]);

        setLoadingCollections(prev => prev.filter(
          loading => !(loading.collectionId === collection.id && loading.globalId === globalId)
        ));
      } catch (error) {
        console.error(`Error executing request ${globalId} in collection ${collection.id}:`, error);
        setErrorCollections(prev => [...prev, { collectionId: collection.id, globalId, message: error.message }]);

        setLoadingCollections(prev => prev.filter(
          loading => !(loading.collectionId === collection.id && loading.globalId === globalId)
        ));
      }
    }
  };

  const handleApply = async () => {
    setResponses([]);
    setErrorCollections([]);
    for (const collection of collections) {
      await executeSequentially(collection);
    }
  };

  return (
    <Container maxWidth="md" style={{ marginTop: '40px', marginBottom: '40px' }}>
      <Typography variant="h4" align="center" gutterBottom>
        Postman Collection Manager
      </Typography>
      <FileUpload onUpload={handleUpload} />
      {collections.map(collection => (
        <CollectionCard
          key={collection.id}
          collection={collection}
          onTokenUpdate={handleTokenUpdate}
          loadingCollections={loadingCollections}
          errorCollections={errorCollections}
        />
      ))}
      {collections.length > 0 && (
        <Button
          variant="contained"
          color="success"
          onClick={handleApply}
          disabled={loadingCollections.length > 0}
          style={{ marginTop: '20px' }}
        >
          {loadingCollections.length > 0 ? <CircularProgress size={24} color="inherit" /> : 'Apply'}
        </Button>
      )}
      {responses.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <Typography variant="h5" gutterBottom>
            API Responses
          </Typography>
          {responses.map((res, index) => (
            <div key={index} style={{ marginBottom: '20px' }}>
              <Typography variant="h6">
                {res.method} - {res.apiName}
              </Typography>
              <Typography variant="subtitle2">URL: {res.url}</Typography>
              <Typography variant="subtitle2">Status: {res.status}</Typography>
              <pre style={{ background: '#f4f4f4', padding: '10px', overflowX: 'auto' }}>
                {typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : res.data}
              </pre>
            </div>
          ))}
        </div>
      )}
      {errorCollections.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <Typography variant="h5" gutterBottom color="error">
            Errors
          </Typography>
          {errorCollections.map((err, index) => (
            <div key={index} style={{ marginBottom: '20px' }}>
              <Typography variant="h6">
                Collection ID {err.collectionId} - Request ID {err.globalId}
              </Typography>
              <Typography variant="subtitle2" color="error">
                Error: {err.message}
              </Typography>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}

export default App;
