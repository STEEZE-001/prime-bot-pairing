require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing environment variables.");
    process.exit(1);
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.json({
        name: "PRIME MUSIC API",
        status: "online",
        version: "1.0.0"
    });
});

// ===============================
// GET ALL SONGS
// ===============================

app.get("/api/songs", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("songs")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            songs: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===============================
// SEARCH SONGS
// ===============================

app.get("/api/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();

        if (!q) {
            return res.json({
                success: true,
                songs: []
            });
        }

        const search = `%${q}%`;

        const { data, error } = await supabase
            .from("songs")
            .select("*")
            .or(`title.ilike.${search},artist.ilike.${search}`)
            .order("created_at", {
                ascending: false
            });

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        res.json({
            success: true,
            songs: data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===============================
// UPLOAD SONG (Direct Upload)
// ===============================

app.post(
    "/api/upload",
    upload.fields([
        {
            name: "music",
            maxCount: 1
        },
        {
            name: "cover",
            maxCount: 1
        }
    ]),
    async (req, res) => {

        let musicPath = null;
        let coverPath = null;

        try {
            const {
                title,
                artist,
                credits
            } = req.body;

            const musicFile = req.files?.music?.[0];
            const coverFile = req.files?.cover?.[0];

            if (!title || !artist || !musicFile) {
                return res.status(400).json({
                    success: false,
                    error: "Title, artist and music file are required."
                });
            }

            const musicExtension =
                musicFile.originalname
                    .split(".")
                    .pop()
                    .toLowerCase();

            const musicName =
                `${crypto.randomUUID()}.${musicExtension}`;

            musicPath = musicName;

            const { error: musicError } =
                await supabase.storage
                    .from("music")
                    .upload(
                        musicPath,
                        musicFile.buffer,
                        {
                            contentType:
                                musicFile.mimetype ||
                                "audio/mpeg",
                            upsert: false
                        }
                    );

            if (musicError) {
                throw musicError;
            }

            const {
                data: musicPublic
            } = supabase.storage
                .from("music")
                .getPublicUrl(musicPath);

            const fileUrl = musicPublic.publicUrl;

            let coverUrl = null;

            if (coverFile) {
                const coverExtension =
                    coverFile.originalname
                        .split(".")
                        .pop()
                        .toLowerCase();

                const coverName =
                    `${crypto.randomUUID()}.${coverExtension}`;

                coverPath = coverName;

                const {
                    error: coverError
                } = await supabase.storage
                    .from("covers")
                    .upload(
                        coverPath,
                        coverFile.buffer,
                        {
                            contentType:
                                coverFile.mimetype ||
                                "image/jpeg",
                            upsert: false
                        }
                    );

                if (coverError) {
                    throw coverError;
                }

                const {
                    data: coverPublic
                } = supabase.storage
                    .from("covers")
                    .getPublicUrl(coverPath);

                coverUrl = coverPublic.publicUrl;
            }

            const {
                data: song,
                error: dbError
            } = await supabase
                .from("songs")
                .insert({
                    title: title.trim(),
                    artist: artist.trim(),
                    credits: credits
                        ? credits.trim()
                        : null,
                    file_url: fileUrl,
                    file_path: musicPath,
                    cover_url: coverUrl,
                    cover_path: coverPath,
                    file_size: musicFile.size
                })
                .select()
                .single();

            if (dbError) {
                throw dbError;
            }

            res.status(201).json({
                success: true,
                message: "Song uploaded successfully.",
                song
            });

        } catch (error) {

            if (musicPath) {
                await supabase.storage
                    .from("music")
                    .remove([musicPath])
                    .catch(() => {});
            }

            if (coverPath) {
                await supabase.storage
                    .from("covers")
                    .remove([coverPath])
                    .catch(() => {});
            }

            console.error("Upload error:", error);

            res.status(500).json({
                success: false,
                error: error.message ||
                    "Upload failed."
            });
        }
    }
);

// ===============================
// EDIT SONG
// ===============================

app.put(
    "/api/songs/:id",
    upload.fields([
        {
            name: "cover",
            maxCount: 1
        }
    ]),
    async (req, res) => {
        let newCoverPath = null;

        try {
            const { id } = req.params;
            const { title, artist, credits } = req.body;
            const coverFile = req.files?.cover?.[0];

            const { data: existingSong, error: findError } = await supabase
                .from("songs")
                .select("*")
                .eq("id", id)
                .single();

            if (findError || !existingSong) {
                return res.status(404).json({
                    success: false,
                    error: "Song not found."
                });
            }

            let coverUrl = existingSong.cover_url;
            let coverPath = existingSong.cover_path;

            if (coverFile) {
                const coverExtension = coverFile.originalname
                    .split(".")
                    .pop()
                    .toLowerCase();

                const coverName = `${crypto.randomUUID()}.${coverExtension}`;
                newCoverPath = coverName;

                const { error: coverError } = await supabase.storage
                    .from("covers")
                    .upload(newCoverPath, coverFile.buffer, {
                        contentType: coverFile.mimetype || "image/jpeg",
                        upsert: false
                    });

                if (coverError) throw coverError;

                const { data: coverPublic } = supabase.storage
                    .from("covers")
                    .getPublicUrl(newCoverPath);

                coverUrl = coverPublic.publicUrl;

                if (existingSong.cover_path) {
                    await supabase.storage
                        .from("covers")
                        .remove([existingSong.cover_path])
                        .catch(() => {});
                }

                coverPath = newCoverPath;
            }

            const updates = {
                title: title ? title.trim() : existingSong.title,
                artist: artist ? artist.trim() : existingSong.artist,
                credits: credits !== undefined ? (credits ? credits.trim() : null) : existingSong.credits,
                cover_url: coverUrl,
                cover_path: coverPath
            };

            const { data: updatedSong, error: dbError } = await supabase
                .from("songs")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (dbError) throw dbError;

            res.json({
                success: true,
                message: "Song updated successfully.",
                song: updatedSong
            });

        } catch (error) {
            if (newCoverPath) {
                await supabase.storage
                    .from("covers")
                    .remove([newCoverPath])
                    .catch(() => {});
            }

            console.error("Edit error:", error);
            res.status(500).json({
                success: false,
                error: error.message || "Edit failed."
            });
        }
    }
);

// ===============================
// DELETE SONG
// ===============================

app.delete(
    "/api/songs/:id",
    async (req, res) => {

        try {
            const { id } = req.params;

            const {
                data: song,
                error: findError
            } = await supabase
                .from("songs")
                .select("*")
                .eq("id", id)
                .single();

            if (findError || !song) {
                return res.status(404).json({
                    success: false,
                    error: "Song not found."
                });
            }

            if (song.file_path) {
                await supabase.storage
                    .from("music")
                    .remove([song.file_path]);
            }

            if (song.cover_path) {
                await supabase.storage
                    .from("covers")
                    .remove([song.cover_path]);
            }

            const {
                error: deleteError
            } = await supabase
                .from("songs")
                .delete()
                .eq("id", id);

            if (deleteError) {
                throw deleteError;
            }

            res.json({
                success: true,
                message: "Song deleted successfully."
            });

        } catch (error) {

            console.error("Delete error:", error);

            res.status(500).json({
                success: false,
                error: error.message ||
                    "Delete failed."
            });
        }
    }
);

// ===============================
// 404
// ===============================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Route not found"
    });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
    console.log("🔥 PRIME MUSIC API");
    console.log(`🚀 Server running on port ${PORT}`);
});
