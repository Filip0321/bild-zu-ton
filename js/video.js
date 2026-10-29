import { neueAufnahme, schneideTon, ladeHerunter, zeitstempel, warte, FPS } from "/lib/export.js";
import { zeichneSkala } from "./kopf.js";

const HOEHE = 1080;
const MAX_BREITE = 3840; // 4K: mehr schafft H.264 nicht
const KOPF_BREITE = 3; // Pixel im Video
const KOPF_FARBE = "#dddddd";
const RAND_FARBE = "rgba(17, 17, 17, 0.8)"; 

const gerade = (zahl) => zahl - (zahl % 2); // H.264 verlangt gerade Maße

export async function speichereVideo({ puffer, bild, verhaeltnis, pixelig, mitSkala, name, beiFortschritt }) {
  
  const hintergrund = baueHintergrund({ bild, verhaeltnis, pixelig, mitSkala });
  const breite = hintergrund.width; 
  const hoehe = hintergrund.height;
  const rahmen = document.createElement("canvas");
  rahmen.width = breite;
  rahmen.height = hoehe;
  const ctxRahmen = rahmen.getContext("2d");

  const rate = puffer.sampleRate;
  let aufnahme = null; // außerhalb von try, damit catch es abbrechen kann
  try {
    aufnahme = await neueAufnahme(rahmen, FPS, "#111111", { kanaele: puffer.numberOfChannels, rate });

    const anzahl = Math.ceil(puffer.duration * FPS);
    let letztePause = performance.now();
    for (let i = 0; i < anzahl; i++) {
      const t = i / FPS; // Zeit im Video = Zeit im Ton (beide fangen bei 0 an)
      ctxRahmen.drawImage(hintergrund, 0, 0);
      const x = Math.min(Math.round((t / puffer.duration) * breite), breite - KOPF_BREITE); // am Ende nicht über den Rand
      ctxRahmen.fillStyle = RAND_FARBE;
      ctxRahmen.fillRect(x - 1, 0, KOPF_BREITE + 2, hoehe);
      ctxRahmen.fillStyle = KOPF_FARBE;
      ctxRahmen.fillRect(x, 0, KOPF_BREITE, hoehe);

      // der Ton für genau dieses Bild: von t bis zum nächsten Bild
      const anfang = Math.round(t * rate);
      const ende = Math.round(((i + 1) / FPS) * rate);
      const tonStueck = schneideTon(puffer, anfang, ende); // null, wenn nichts mehr übrig ist
      // Bild und Ton gleichzeitig abgeben und auf beide warten
      await Promise.all([aufnahme.bild(rahmen, t, 1 / FPS), tonStueck && aufnahme.ton(tonStueck)]);

      if (performance.now() - letztePause > 50) {
        beiFortschritt?.((i + 1) / anzahl);
        await warte();
        letztePause = performance.now();
      }
    }
    ladeHerunter(await aufnahme.fertig(), `${name}-${zeitstempel()}.mp4`);
    return { codec: aufnahme.codec, tonCodec: aufnahme.tonCodec }; // für den Hinweis in main.js
  } catch (fehler) {
    await aufnahme?.abbrechen(); 
    throw fehler; 
  }
}

export function baueHintergrund({ bild, verhaeltnis, pixelig, mitSkala }) {
  let hoehe = HOEHE;
  let breite = Math.round(hoehe * verhaeltnis);
  if (breite > MAX_BREITE) {
    hoehe = Math.round((hoehe * MAX_BREITE) / breite);
    breite = MAX_BREITE;
  }
  breite = gerade(breite);
  hoehe = gerade(hoehe);

  const hintergrund = document.createElement("canvas");
  hintergrund.width = breite; 
  hintergrund.height = hoehe;
  const ctxHintergrund = hintergrund.getContext("2d");
  ctxHintergrund.imageSmoothingEnabled = !pixelig; 
  ctxHintergrund.drawImage(bild, 0, 0, breite, hoehe);
  if (mitSkala) zeichneSkala(ctxHintergrund, breite, hoehe, 2); 

  return hintergrund;
}