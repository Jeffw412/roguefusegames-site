// Home page hero: the Rogue Fuse Games intro plays once, muted (browsers only autoplay muted video), and stops on its
// last frame, the logo. The Sound button replays it with sound. With reduced motion asked for, it stays on the poster
// (that same logo frame); without JavaScript the poster shows too.
(function () {
	var v = document.getElementById("rfg-intro");
	var btn = document.getElementById("rfg-sound");
	if (!v) {
		return;
	}
	var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (btn) {
		btn.hidden = false;
		btn.addEventListener("click", function () {
			v.muted = false;
			v.currentTime = 0;
			var p = v.play();
			if (p && p.catch) {
				p.catch(function () {});
			}
		});
	}
	if (reduce) {
		return;
	}
	var p = v.play();
	if (p && p.catch) {
		p.catch(function () {});    // autoplay refused (data saver, low power): the poster stays
	}
})();
