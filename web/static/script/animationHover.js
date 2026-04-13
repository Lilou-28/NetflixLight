let favoritesSetPromise = null;

function getFavoritesSet() {
	if (!favoritesSetPromise) {
		favoritesSetPromise = fetch("/api/favoris", { credentials: "same-origin" })
			.then((response) => {
				if (!response.ok) {
					return [];
				}
				return response.json();
			})
			.then((items) => {
				const list = Array.isArray(items) ? items : [];
				return new Set(list.map((fav) => String(fav.media_id)));
			})
			.catch(() => new Set());
	}

	return favoritesSetPromise;
}

async function addFavorite(mediaId, mediaType, title, posterPath) {
	try {
		const response = await fetch("/api/favoris", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				media_id: mediaId,
				media_type: mediaType,
				title,
				poster_path: posterPath,
			}),
		});

		return response.ok;
	} catch {
		return false;
	}
}

async function removeFavorite(mediaId) {
	try {
		const response = await fetch(`/api/favoris/${encodeURIComponent(mediaId)}`, {
			method: "DELETE",
			credentials: "same-origin",
		});

		return response.ok;
	} catch {
		return false;
	}
}

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

	const favoriteAction = document.createElement("span");
	favoriteAction.className = "movie-slide-btn__fav";
	favoriteAction.setAttribute("role", "button");
	favoriteAction.setAttribute("tabindex", "0");
	favoriteAction.setAttribute("aria-label", "Ajouter aux favoris");
	favoriteAction.textContent = "♡";

	const mediaId = item.id == null ? "" : String(item.id);

	const updateFavoriteState = (isFavorite) => {
		favoriteAction.classList.toggle("is-active", isFavorite);
		favoriteAction.textContent = isFavorite ? "♥" : "♡";
		favoriteAction.setAttribute(
			"aria-label",
			isFavorite ? "Retirer des favoris" : "Ajouter aux favoris",
		);
	};

	const onFavoriteInteraction = async (event) => {
		event.preventDefault();
		event.stopPropagation();

		if (!mediaId || favoriteAction.classList.contains("is-loading")) {
			return;
		}

		favoriteAction.classList.add("is-loading");

		const favorites = await getFavoritesSet();
		const alreadyFavorite = favorites.has(mediaId);
		const requestOk = alreadyFavorite
			? await removeFavorite(mediaId)
			: await addFavorite(mediaId, mediaType === "tv" ? "tv" : "movie", title, item.poster_path || "");

		if (requestOk) {
			if (alreadyFavorite) {
				favorites.delete(mediaId);
			} else {
				favorites.add(mediaId);
			}
			updateFavoriteState(!alreadyFavorite);
		}

		favoriteAction.classList.remove("is-loading");
	};

	favoriteAction.addEventListener("click", onFavoriteInteraction);
	favoriteAction.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			onFavoriteInteraction(event);
		}
	});

	hover.appendChild(hoverTitle);
	hover.appendChild(hoverMeta);
	hover.appendChild(favoriteAction);
	hover.appendChild(hoverOverview);
	slide.appendChild(hover);

	if (mediaId) {
		getFavoritesSet().then((favorites) => {
			updateFavoriteState(favorites.has(mediaId));
		});
	}

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
