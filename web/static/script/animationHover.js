window.setupHoverPreview = function setupHoverPreview(slide, item, mediaType) {
	if (!(slide instanceof HTMLElement) || !item) {
		return;
	}

	const title = item.title || item.name || "Titre inconnu";
	const year = (item.release_date || item.first_air_date || "").slice(0, 4);
	const kind = mediaType === "tv" ? "Série" : "Film";
	const meta = year ? `${year} · ${kind}` : kind;
	const frenchOverview = typeof item.overview === "string" && item.overview.trim() ? item.overview.trim() : "";

	const hover = document.createElement("div");
	hover.className = "movie-slide-btn__hover";

	const hoverTitle = document.createElement("p");
	hoverTitle.className = "movie-slide-btn__hover-title";
	hoverTitle.textContent = title;

	const hoverMeta = document.createElement("p");
	hoverMeta.className = "movie-slide-btn__hover-meta";
	hoverMeta.textContent = meta;

	const hoverOverview = document.createElement("p");
	hoverOverview.className = "movie-slide-btn__hover-overview";
	hoverOverview.textContent = frenchOverview || "Chargement du résumé anglais...";

	hover.appendChild(hoverTitle);
	hover.appendChild(hoverMeta);
	hover.appendChild(hoverOverview);
	slide.appendChild(hover);

	if (!frenchOverview && item.id) {
		const detailsType = mediaType === "tv" ? "tv" : "movie";
		fetch(`/api/tmdb/details?type=${detailsType}&id=${item.id}&language=en-US`, {
			credentials: "same-origin",
		})
			.then((response) => response.json())
			.then((data) => {
				const englishOverview = typeof data.overview === "string" && data.overview.trim() ? data.overview.trim() : "Aucune description disponible.";
				hoverOverview.textContent = englishOverview;
			})
			.catch(() => {
				hoverOverview.textContent = "Aucune description disponible.";
			});
	}
}
