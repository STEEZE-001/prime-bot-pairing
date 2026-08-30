const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.post('/api/download', async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ success: false, message: 'Please paste a TikTok link.' });
  }

  try {
    // Send request to TikWM API
    const response = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({
      url: videoUrl,
      count: 12,
      cursor: 0,
      web: 1,
      hd: 1
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
      }
    });

    const data = response.data;

    if (data.code === 0 && data.data) {
      return res.json({
        success: true,
        title: data.data.title || 'Prime Downloader Video',
        cover: data.data.cover,
        // Fallback to standard play URL if HD link isn't returned
        downloadUrl: data.data.hdplay ? `https://www.tikwm.com${data.data.hdplay}` : `https://www.tikwm.com${data.data.play}`
      });
    } else {
      return res.status(400).json({ success: false, message: data.msg || 'Unable to parse video URL.' });
    }
  } catch (error) {
    console.error('Extraction Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error processing video.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Prime Downloader running on port ${PORT}`));
