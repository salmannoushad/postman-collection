// src/components/CollectionCard.js
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Chip,
  Tooltip,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import axios from 'axios';

// Utility function to get color based on method
const getMethodColor = (method) => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'primary';
    case 'POST':
      return 'success';
    case 'PUT':
      return 'warning';
    case 'DELETE':
      return 'error';
    case 'PATCH':
      return 'secondary';
    default:
      return 'default';
  }
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const UPDATE_TOKEN_ENDPOINT = process.env.REACT_APP_UPDATE_TOKEN_ENDPOINT;
const updateTokenUrl = `${API_BASE_URL}${UPDATE_TOKEN_ENDPOINT}`;

const CollectionCard = ({ collection, onTokenUpdate, loadingCollections, errorCollections }) => {
  const [token, setToken] = useState(collection.token || '');
  const [showMore, setShowMore] = useState(false);
  const [apiList, setApiList] = useState([]);

  const handleTokenChange = (e) => {
    setToken(e.target.value);
  };

  const handleAddToken = async () => {
    try {
      await axios.post(updateTokenUrl, {
        collectionId: collection.id,
        token,
      });
      onTokenUpdate(collection.id, token);
    } catch (error) {
      console.error('Error updating token', error);
      // Optionally, display an error message to the user
    }
  };

  const handleShowMore = () => {
    if (!showMore) {
      const apis = collection.collection.item.map((item) => ({
        id: item.globalId, // Unique identifier
        name: item.name,
        url: item.request.url.raw,
        method: item.request.method,
      }));
      setApiList(apis);
    }
    setShowMore(!showMore);
  };

  // Determine if any API requests in this collection are loading or have errors
  const isCollectionLoading = loadingCollections.some(
    (col) => col.collectionId === collection.id
  );
  const collectionErrors = errorCollections.filter(
    (col) => col.collectionId === collection.id
  );

  return (
    <Card style={{ marginBottom: '20px' }}>
      <CardContent>
        <Typography variant="h5">{collection.name}</Typography>
        <div style={{ marginTop: '10px' }}>
          <TextField
            label="Token"
            variant="outlined"
            size="small"
            value={token}
            onChange={handleTokenChange}
            style={{ marginRight: '10px', width: '300px' }}
          />
          <Button variant="contained" color="primary" onClick={handleAddToken}>
            Add Token
          </Button>
        </div>
        {collection.collection.item.length >= 1 && (
          <Button
            variant="text"
            color="secondary"
            startIcon={showMore ? <ExpandLess /> : <ExpandMore />}
            onClick={handleShowMore}
            style={{ marginTop: '10px' }}
          >
            {showMore ? 'Show Less' : 'Show More'}
          </Button>
        )}
        <Collapse in={showMore}>
          <List>
            {apiList.map((api) => (
              <ListItem key={api.id} divider>
                <Tooltip title={api.method}>
                  <Chip
                    label={api.method}
                    color={getMethodColor(api.method)}
                    size="small"
                    style={{ marginRight: '10px' }}
                  />
                </Tooltip>
                <ListItemText primary={`${api.name}`} secondary={api.url} />
              </ListItem>
            ))}
          </List>
        </Collapse>
        {/* Optionally, display loading or error indicators specific to this collection */}
        {isCollectionLoading && (
          <Typography variant="body2" color="textSecondary" style={{ marginTop: '10px' }}>
            Executing API requests...
          </Typography>
        )}
        {collectionErrors.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            {collectionErrors.map((err, idx) => (
              <Typography key={idx} variant="body2" color="error">
                Error in Request ID {err.globalId}: {err.message}
              </Typography>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CollectionCard;
