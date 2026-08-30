const express = require('express');
const cors = require('cors');
const { TiktokDL } = require('@tobyg74/tiktok-api-dl');

const app = express();

// Enable CORS so your frontend can communicate with this backend
app.use(cors());
app.use(express.json());

// Serve static HTML/CSS directly if hosted together
app.use(express.static('.'));

// Download Endpoint
app.post('/api/download', async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ success: false, message: 'Please provide a valid TikTok URL.' });
  }

  try {
    const result = await TiktokDL(videoUrl, { version: 'v1' });

    if (result.status === 'success' && result.result) {
      // Find video without watermark link
      const videoData = result.result;
      const downloadLink = videoData.video[0] || videoData.video[1];

      return res.json({
        success: true,
        title: videoData.description || 'Prime Downloader Video',
        cover: videoData.cover[0],
        downloadUrl: downloadLink
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unable to fetch video. Check link and try again.' });
    }
  } catch (error) {
    console.error('Extraction Error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing video.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Prime Downloader running on port ${PORT}`);
});
