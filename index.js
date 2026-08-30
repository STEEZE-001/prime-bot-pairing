const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.post('/api/download', async (req, res) => {
  let { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ success: false, message: 'Please provide a valid TikTok URL.' });
  }

  try {
    // Calling an open extraction API wrapper for reliable fetching
    const apiRes = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(videoUrl)}`);

    if (apiRes.data && apiRes.data.video) {
      return res.json({
        success: true,
        title: apiRes.data.title || 'Prime Downloader Video',
        cover: apiRes.data.cover || '',
        downloadUrl: apiRes.data.video.noWatermark || apiRes.data.video.watermark
      });
    }

    return res.status(400).json({ success: false, message: 'Failed to extract video. Check the link.' });
  } catch (error) {
    console.error('Extraction Error Details:', error.message);
    return res.status(500).json({ success: false, message: 'Server error processing video link.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
