let player;

function onYouTubeIframeAPIReady() {
    const iframe = document.getElementById("iframeSon");
    const buttonMute = document.getElementById("buttonMute");
    const buttonFullscreen = document.getElementById("buttonFullscreen");
    const buttonPlay = document.getElementById("buttonPlay");

    if (!iframe || !buttonMute || !buttonFullscreen || !buttonPlay) {
        return;
    }

    player = new YT.Player("iframeSon", {
        events: {
            onReady: function () {
                buttonMute.onclick = function () {
                    if (player.isMuted()) {
                        player.unMute();
                        buttonMute.textContent = "Couper le son";
                    } else {
                        player.mute();
                        buttonMute.textContent = "Activer le son";
                    }
                };
                buttonFullscreen.onclick = function () {
                    const iframeElement = document.getElementById("iframeSon");
                    if (iframeElement.requestFullscreen) {
                        iframeElement.requestFullscreen();
                    } else if (iframeElement.mozRequestFullScreen) { /* Firefox */
                        iframeElement.mozRequestFullScreen();
                    } else if (iframeElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
                        iframeElement.webkitRequestFullscreen();
                    } else if (iframeElement.msRequestFullscreen) { /* IE/Edge */
                        iframeElement.msRequestFullscreen();
                    }
                };
                buttonPlay.onclick = function () {
                    const isPlaying = player.getPlayerState() === YT.PlayerState.PLAYING;

                    if (isPlaying) {
                        player.pauseVideo();
                        buttonPlay.textContent = "Play";
                    } else {
                        player.playVideo();
                        buttonPlay.textContent = "Pause";
                    }
                };
            }
        }
    });
}