// Game pages: the trailer facade (no YouTube request until play is pressed) and the screenshot lightbox.
(function () {
	"use strict";

	var yt = document.querySelector("[data-yt]");
	var facade = yt && yt.querySelector(".yt-facade");
	if (facade) {
		facade.addEventListener("click", function (e) {
			e.preventDefault();
			var f = document.createElement("iframe");
			f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yt.getAttribute("data-yt")) + "?autoplay=1&rel=0&playsinline=1";
			f.title = facade.getAttribute("aria-label") || "Trailer";
			f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
			f.allowFullscreen = true;
			f.referrerPolicy = "strict-origin-when-cross-origin";
			facade.parentNode.replaceChild(f, facade);
			f.focus();
		});
	}

	// A <dialog> with arrows, keys and swipes. Browsers without <dialog> just open the image.
	var box = document.getElementById("lightbox");
	var links = document.querySelectorAll("#gallery a");
	if (!box || typeof box.showModal !== "function" || !links.length) {
		return;
	}
	var img = document.getElementById("lb-img");
	var cap = document.getElementById("lb-cap");
	var count = document.getElementById("lb-count");
	var at = 0;
	function show(i) {
		at = (i + links.length) % links.length;
		var link = links[at];
		img.src = link.getAttribute("href");
		img.alt = link.querySelector("img").alt;
		cap.textContent = link.querySelector(".cap").textContent;
		count.textContent = (at + 1) + " / " + links.length;
		new Image().src = links[(at + 1) % links.length].getAttribute("href");
	}
	Array.prototype.forEach.call(links, function (link, k) {
		link.addEventListener("click", function (e) {
			e.preventDefault();
			show(k);
			box.showModal();
		});
	});
	document.getElementById("lb-close").addEventListener("click", function () { box.close(); });
	document.getElementById("lb-prev").addEventListener("click", function () { show(at - 1); });
	document.getElementById("lb-next").addEventListener("click", function () { show(at + 1); });
	box.addEventListener("keydown", function (e) {
		if (e.key === "ArrowLeft") { show(at - 1); }
		if (e.key === "ArrowRight") { show(at + 1); }
	});
	document.getElementById("lb-stage").addEventListener("click", function (e) {
		if (e.target === e.currentTarget) { box.close(); }
	});
	var x0 = null;
	box.addEventListener("pointerdown", function (e) { x0 = e.clientX; });
	box.addEventListener("pointerup", function (e) {
		if (x0 !== null && Math.abs(e.clientX - x0) > 50) { show(at + (e.clientX < x0 ? 1 : -1)); }
		x0 = null;
	});
	box.addEventListener("close", function () { img.removeAttribute("src"); links[at].focus(); });
}());
