document.querySelectorAll("details[data-quelle]").forEach((box) => {
  const ziel = box.querySelector("code");

  box.addEventListener("toggle", () => {
    fetch(box.dataset.quelle)
      .then((antwort) => {
        if (!antwort.ok) throw new Error(antwort.status);
        return antwort.text();
      })
      .then((text) => {
        ziel.textContent = text;
      })
      .catch(() => {
        ziel.textContent = "Der Code konnte nicht geladen werden.";
      });
  }, { once: true });
});


// Hilfsfunktion

function hole(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Im HTML fehlt ein Element mit id="${id}"`);
  }
  return element;
}


// bei for Each ist "schalter" und "feld" indexvariable (nimmt jeden wert einmal an)
document.querySelectorAll("[data-zeigt]").forEach((schalter) => {
  const gruppe = hole(schalter.dataset.zeigt);
  const aktualisiere = () => {
    gruppe.hidden = !schalter.checked;
  }; // wenn Schalter soll data-zeigt gruppe gezeigt werden
  schalter.addEventListener("change", aktualisiere);
  aktualisiere();
});

function stelleVideosEin() {
  document.querySelectorAll(".karte video").forEach((video) => {
    if (wenigBewegung.matches) {
      video.load();
    } else {
      video.play().catch(() => {});
    }
  });
}
