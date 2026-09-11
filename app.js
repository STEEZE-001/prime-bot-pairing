/*
============================================
🎵 PRIME MUSIC
Frontend
============================================
*/

const openUpload =
    document.getElementById(
        "openUpload"
    );

const closeUpload =
    document.getElementById(
        "closeUpload"
    );

const uploadModal =
    document.getElementById(
        "uploadModal"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const clearSearch =
    document.getElementById(
        "clearSearch"
    );

const uploadForm =
    document.getElementById(
        "uploadForm"
    );

const uploadStatus =
    document.getElementById(
        "uploadStatus"
    );

const player =
    document.getElementById(
        "player"
    );

const audioPlayer =
    document.getElementById(
        "audioPlayer"
    );

const playerTitle =
    document.getElementById(
        "playerTitle"
    );

const playerArtist =
    document.getElementById(
        "playerArtist"
    );

const playerCover =
    document.getElementById(
        "playerCover"
    );


/* ==========================================
   UPLOAD MODAL
========================================== */

openUpload.addEventListener(
    "click",
    () => {

        uploadModal.classList.add(
            "active"
        );

    }
);


closeUpload.addEventListener(
    "click",
    () => {

        uploadModal.classList.remove(
            "active"
        );

    }
);


uploadModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            uploadModal
        ) {

            uploadModal.classList.remove(
                "active"
            );

        }

    }
);


/* ==========================================
   SEARCH
========================================== */

searchInput.addEventListener(
    "input",
    () => {

        console.log(
            "Searching:",
            searchInput.value
        );

    }
);


clearSearch.addEventListener(
    "click",
    () => {

        searchInput.value = "";

        searchInput.focus();

    }
);


/* ==========================================
   UPLOAD PLACEHOLDER
========================================== */

uploadForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        uploadStatus.textContent =
            "⚠️ API not connected yet.";

    }
);


/* ==========================================
   PLAYER
========================================== */

function playSong(song) {

    if (!song?.file_url) {
        return;
    }

    audioPlayer.src =
        song.file_url;

    playerTitle.textContent =
        song.title || "Unknown";

    playerArtist.textContent =
        song.artist || "Unknown";

    if (song.cover_url) {

        playerCover.innerHTML =
            `<img src="${song.cover_url}" alt="">`;

    } else {

        playerCover.innerHTML =
            "♪";

    }

    player.classList.add(
        "active"
    );

    audioPlayer.play()
        .catch(() => {});

}


/* ==========================================
   EXPOSE PLAYER
========================================== */

window.playSong =
    playSong;


/*
============================================
The API connection will be added next.
============================================
*/
