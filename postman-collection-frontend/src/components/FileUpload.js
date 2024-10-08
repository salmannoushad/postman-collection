// src/components/FileUpload.js
import React, { useState } from 'react';
import { Button, Typography } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const UPLOAD = process.env.REACT_APP_UPLOAD;
const uploadURL = `${API_BASE_URL}${UPLOAD}`;

const FileUpload = ({ onUpload }) => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    // Example: Limit total size to 50MB
    const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 50 * 1024 * 1024) { // 50 MB
      setError('Total file size exceeds 50MB.');
      setFiles([]);
      return;
    }
    setError('');
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const formData = new FormData();
    for (let file of files) {
      formData.append('collections', file);
    }

    try {
      const response = await axios.post(uploadURL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      onUpload(response.data.collections);
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('Error uploading collections', error);
      if (error.response && error.response.data && error.response.data.error) {
        setError(`Upload failed: ${error.response.data.error}`);
      } else {
        setError('Upload failed. Please try again.');
      }
    }
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <input
        accept=".json"
        style={{ display: 'none' }}
        id="upload-collections"
        multiple
        type="file"
        onChange={handleFileChange}
      />
      <label htmlFor="upload-collections">
        <Button variant="contained" color="primary" component="span" startIcon={<CloudUpload />}>
          Choose Collections
        </Button>
      </label>
      <Button
        variant="contained"
        color="secondary"
        onClick={handleUpload}
        style={{ marginLeft: '10px' }}
        disabled={files.length === 0}
      >
        Upload
      </Button>
      {files.length > 0 && (
        <Typography variant="body2" style={{ marginTop: '10px' }}>
          {files.length} file(s) selected
        </Typography>
      )}
      {error && (
        <Typography variant="body2" color="error" style={{ marginTop: '10px' }}>
          {error}
        </Typography>
      )}
    </div>
  );
};

export default FileUpload;
