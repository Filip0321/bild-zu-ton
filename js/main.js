import { ladeBild, rastere, zeigeRaster, zeigeOriginal, 
         originalBild, rastertBild, dateiName, schneide,
         setzeOriginal, rasterAlsBild } from "./bild.js";
import { waehleFarbskala } from "/lib/farben.js";
import { erzeugeTon, alsAudioBuffer } from "./ton.js";
import { zuWav, ladeHerunter, zeitstempel } from "/lib/export.js";
import { passeGroesseAn, setzeSkala } from "./kopf.js";
import { speichereVideo, baueHintergrund } from "./video.js";
import { analysiere } from "./ton-in-bild.js";

const datei = hole("datei");
const spaltenRegler = hole("spalten");
const zeilenRegler = hole("zeilen");
const invertieren = hole("invertieren");
const anzeige = hole("anzeige"); // raster / verzerrt / original
const anzeigeLabel = hole("anzeigeLabel"); // erst sichtbar, wenn ein Bild geladen ist
const farbskala = hole("farbskala");
const farbenLabel = hole("farbenLabel"); // nur beim Raster
const spaltenAnzeige = hole("spaltenAnzeige");
const zeilenAnzeige = hole("zeilenAnzeige");
const feld = hole("feld"); // bekommt die Klasse "original" (weich skalieren, bild-zu-ton.css)
const stapel = hole("stapel"); // bekommt --verhaeltnis (dort steht es auch im CSS)
const meldung = hole("meldung");
const dauerRegler = hole("dauer");
const dauerAnzeige = hole("dauerAnzeige");
const tiefsteFeld = hole("tiefste");
const hoechsteFeld = hole("hoechste");
const dynamikRegler = hole("dynamik");
const dynamikAnzeige = hole("dynamikAnzeige");
const erzeugenKnopf = hole("erzeugen");
const spieler = hole("spieler");
const bildSpeichern = hole("bildSpeichern")
const wavSpeichern = hole("wavSpeichern");
const videoSpeichern = hole("videoSpeichern");
const schleife = hole("schleife");
const schwelleAb = hole("schwelleAb");
const schwelleBis = hole("schwelleBis");
const schwelleAbAnzeige = hole("schwelleAbAnzeige");
const schwelleBisAnzeige = hole("schwelleBisAnzeige");
const zurueckKnopf = hole("zurueckInsBild");
const kippen = hole("kippen");
const rundenFeld = hole("runden");
const rundenKnopf = hole("rundenStarten");
const stufenFeld = hole("stufen"); // hier erscheinen die kleinen Bilder der Stufen
const stufenKnopf = hole("stufenSpeichern");

let wav = null; 
let puffer = null;
let letzterTon = null; // { spalten, zeilen, tief, hoch, dynamik } 
let stufen = []; // Runde 0 (Start) bis N: { raster, spalten, zeilen, bild }

const spalten = () => Number(spaltenRegler.value);
const zeilen = () => Number(zeilenRegler.value);
const ab = () => Number(schwelleAb.value);
const bis = () => Number(schwelleBis.value);

function zeigeMeldung(text) {
  meldung.textContent = text;
  meldung.hidden = text === ""; // leer = Zeile verstecken
}

function zeige() {
  const art = anzeige.value;
  const rasterVerhaeltnis = spalten() / zeilen();
  const fotoVerhaeltnis = originalBild.width / originalBild.height;
  if (art === "raster") zeigeRaster(spalten(), zeilen());
  else zeigeOriginal(art === "original" ? fotoVerhaeltnis : rasterVerhaeltnis, invertieren.checked);
  stapel.style.setProperty("--verhaeltnis", art === "original" ? fotoVerhaeltnis : rasterVerhaeltnis);
  feld.classList.toggle("original", art !== "raster");
  farbenLabel.hidden = art !== "raster"; 
}

function aktualisiere() {
  spaltenAnzeige.textContent = spalten();
  zeilenAnzeige.textContent = zeilen();
  zeigeTonRegler();
  zeigeSchwelle();
  if (!originalBild) return; // noch kein Bild geladen
  rastere(spalten(), zeilen(), invertieren.checked);
  schneide(rastertBild, ab(), bis());
  zeige();
}

datei.addEventListener("change", async () => {
  const gewaehlt = datei.files[0]; 
  if (!gewaehlt) return; // Dialog abgebrochen
  zeigeMeldung("");
  try {
    await ladeBild(gewaehlt);
    stufen = [];
  } catch {
    zeigeMeldung("Das Bild kann der Browser nicht lesen.");
    return; 
  }
  anzeigeLabel.hidden = false;
  stufen = []; // die Stufen gehörten zum alten Bild
  zeigeStufen();
  aktualisiere();
});

// Knöpfe, die rechnen, während einer Rechnung sperren: sonst funkt ein zweiter Klick dazwischen
function sperre(an) {
  for (const knopf of [erzeugenKnopf, zurueckKnopf, rundenKnopf, videoSpeichern]) knopf.disabled = an;
}

// Ton -> neues Bild: misst mit denselben Werten, mit denen der Ton erzeugt wurde
async function zurueck() {
  const { spalten: sp, zeilen: ze, ...werte } = letzterTon; // werte = { tief, hoch, dynamik }
  const raster = await analysiere(puffer.getChannelData(0), sp, ze, {
    ...werte,
    beiFortschritt: (anteil) => zeigeMeldung(`Höre zurück ... ${Math.round(anteil * 100)} %`),
  });
  // genau eins von beiden an -> umdrehen (XOR): so kippt es mit "kippen" immer, egal wie es angefangen hat
  const umkehren = invertieren.checked !== kippen.checked;
  setzeOriginal(await rasterAlsBild(raster, sp, ze, umkehren));
  aktualisiere(); // das neue Original rastern (Schwelle wirkt auch wieder) und zeigen
}

zurueckKnopf.addEventListener("click", async () => {
  if (!puffer) {
    zeigeMeldung("Erst einen Ton erzeugen.");
    return;
  }
  sperre(true);
  try {
    await zurueck();
    zeigeMeldung("");
  } catch (fehler) {
    console.error(fehler);
    zeigeMeldung(`Zurück ins Bild hat nicht geklappt: ${fehler.message}`);
  } finally {
    sperre(false);
  }
});

spaltenRegler.addEventListener("input", aktualisiere);
zeilenRegler.addEventListener("input", aktualisiere);
invertieren.addEventListener("change", aktualisiere);
anzeige.addEventListener("change", zeige); // nur zeigen, das Raster bleibt gleich
farbskala.addEventListener("change", () => {
  waehleFarbskala(farbskala.value);
  if (originalBild) zeige();
  zeigeStufen();
});
  
// ab darf nicht über bis: der gezogene Regler schiebt den anderen mit
function nichtUeberholen(gezogen) {
  if (ab() <= bis()) return; // alles in Ordnung
  if (gezogen === schwelleAb) schwelleBis.value = schwelleAb.value;
  else schwelleAb.value = schwelleBis.value;
}

// Helligkeit -> dB, wie in ton.js: Weiß 0 dB, Schwarz −dynamik dB
function alsDb(wert) {
  return `${Math.round((wert - 1) * Number(dynamikRegler.value))} dB`;
}

// "aus", wenn an dieser Seite nichts abgeschnitten wird
function zeigeSchwelle() {
  schwelleAbAnzeige.textContent = ab() === 0 ? "aus" : alsDb(ab());
  schwelleBisAnzeige.textContent = bis() === 1 ? "aus" : alsDb(bis());
}

for (const regler of [schwelleAb, schwelleBis]) {
  regler.addEventListener("input", () => {
    nichtUeberholen(regler);
    aktualisiere(); // neu rastern, schneiden, zeigen
  });
}

function zeigeTonRegler() {
  const msProSpalte = Math.round((Number(dauerRegler.value) * 1000) / spalten());
  dauerAnzeige.textContent = `${dauerRegler.value} s (${msProSpalte} ms pro Spalte)`;
  dynamikAnzeige.textContent = `${dynamikRegler.value} dB`;
}
dauerRegler.addEventListener("input", zeigeTonRegler);
dynamikRegler.addEventListener("input", () => { 
  zeigeTonRegler(); 
  zeigeSchwelle(); 
});

// tiefste und höchste Frequenz passen zusammen? Sonst Meldung und false
function frequenzenOk() {
  const tief = Number(tiefsteFeld.value);
  const hoch = Number(hoechsteFeld.value);
  if (tief > 0 && hoch > tief) return true;
  zeigeMeldung("Die höchste Frequenz muss über der tiefsten liegen.");
  return false;
}

// Raster -> Ton, mit den Werten der Regler; merkt sich alles fürs Zurück, Video und WAV
async function erzeuge() {
  // alle Werte JETZT festhalten: wer während des Rechnens an Reglern zieht, verändert nichts mehr
  const anzahlSpalten = spalten();
  const anzahlZeilen = zeilen();
  const tief = Number(tiefsteFeld.value);
  const hoch = Math.min(Number(hoechsteFeld.value), 23999); // wie in erzeugeTon: nicht über Nyquist
  const dynamik = Number(dynamikRegler.value);
  zeigeMeldung("Rechne ... 0 %");
  const ton = await erzeugeTon(rastertBild, anzahlSpalten, anzahlZeilen, {
    dauer: Number(dauerRegler.value),
    tief,
    hoch,
    dynamik,
    beiFortschritt: (anteil) => zeigeMeldung(`Rechne ... ${Math.round(anteil * 100)} %`),
  });
  puffer = alsAudioBuffer(ton); // fürs Video (schneidet pro Bild ein Stück heraus) und fürs Zurück
  letzterTon = { spalten: anzahlSpalten, zeilen: anzahlZeilen, tief, hoch, dynamik };
  wav = zuWav(puffer);
  if (spieler.src.startsWith("blob:")) URL.revokeObjectURL(spieler.src);
  spieler.src = URL.createObjectURL(wav);
  setzeSkala(anzahlZeilen, tief, hoch);
}

erzeugenKnopf.addEventListener("click", async () => {
  if (!rastertBild) {
    zeigeMeldung("Erst ein Bild öffnen.");
    return;
  }
  if (!frequenzenOk()) return;
  sperre(true);
  try {
    await erzeuge();
    zeigeMeldung("");
  } catch (fehler) {
    console.error(fehler);
    zeigeMeldung(`Der Ton konnte nicht erzeugt werden: ${fehler.message}`);
  } finally {
    sperre(false);
  }
});

// Kreislauf: automatisch N Runden
//------------------------------------------------------
// eine Stufe merken: das Raster selbst (zum Weiterbenutzen) und ein Grau-Bild davon (zum Zeigen)
async function merkeStufe() {
  const raster = rastertBild.slice(); // Kopie: rastertBild wird in der nächsten Runde überschrieben
  stufen.push({ raster, spalten: spalten(), zeilen: zeilen(), bild });
}

function zeigeStufen() {
  stufenFeld.replaceChildren(); // alles Alte raus
  stufen.forEach((stufe, i) => {
    const figur = document.createElement("figure");
    const leinwand = document.createElement("canvas");
    leinwand.width = stufe.spalten;
    leinwand.height = stufe.zeilen;
    leinwand.getContext("2d");
    zeigeRaster(stufe.spalten, stufe.zeilen, stufe.raster, leinwand);
    const text = document.createElement("figcaption");
    text.textContent = i === 0 ? "Start" : `Runde ${i}`;
    figur.append(leinwand, text);
    figur.title = "Diese Stufe weiterbenutzen";
    // Klick: diese Stufe wird das Bild. "invertieren" wirkt beim Rastern wieder, also vorher umdrehen
    figur.addEventListener("click", async () => {
      setzeOriginal(await rasterAlsBild(stufe.raster, stufe.spalten, stufe.zeilen, invertieren.checked));
      aktualisiere();
    });
    stufenFeld.append(figur);
  });
  stufenKnopf.hidden = stufen.length === 0; // ohne Stufen gibt es nichts zu speichern
}

rundenKnopf.addEventListener("click", async () => {
  if (!rastertBild) {
    zeigeMeldung("Erst ein Bild öffnen.");
    return;
  }
  if (!frequenzenOk()) return;
  const anzahl = Math.max(1, Math.round(Number(rundenFeld.value)));
  sperre(true);
  try {
    await merkeStufe(); // Runde 0: so fängt es an
    zeigeStufen();
    for (let runde = 1; runde <= anzahl; runde++) {
      await erzeuge();
      await zurueck();
      await merkeStufe();
      zeigeStufen(); // nach jeder Runde, dann sieht man die Reihe wachsen
      zeigeMeldung(`Runde ${runde} von ${anzahl} fertig`);
    }
    zeigeMeldung("");
  } catch (fehler) {
    console.error(fehler);
    zeigeMeldung(`Die Runden haben nicht geklappt: ${fehler.message}`);
  } finally {
    sperre(false);
  }
});

// alle Stufen nebeneinander als ein PNG, mit "Start", "Runde 1" … darüber
stufenKnopf.addEventListener("click", () => {
  const SPALTEN_IM_BILD = Math.min(stufen.length, 5); // höchstens 5 nebeneinander, dann nächste Reihe
  const reihen = Math.ceil(stufen.length / SPALTEN_IM_BILD);
  const { spalten: sp, zeilen: ze } = stufen[0];
  const massstab = Math.max(1, Math.ceil(256 / ze)); // kleine Raster vergrößern, damit man etwas sieht
  const breite = sp * massstab;
  const hoehe = ze * massstab;
  const RAND = 16;
  const TEXT = 24; // Platz für die Beschriftung über jedem Bild

  const bild = document.createElement("canvas");
  bild.width = RAND + SPALTEN_IM_BILD * (breite + RAND);
  bild.height = RAND + reihen * (TEXT + hoehe + RAND);
  const c = bild.getContext("2d");
  c.fillStyle = "#111111";
  c.fillRect(0, 0, bild.width, bild.height);
  c.imageSmoothingEnabled = false; // jeder Rasterpunkt ein scharfes Quadrat
  c.font = "16px monospace";
  c.fillStyle = "#dddddd";
  c.textBaseline = "middle";
  stufen.forEach((stufe, i) => {
    let kachel = document.createElement("canvas");
    kachel.width = stufe.bild.width;
    kachel.height = stufe.bild.height;
    zeigeRaster(stufe.spalten, stufe.zeilen, stufe.raster, kachel)
    const x = RAND + (i % SPALTEN_IM_BILD) * (breite + RAND);
    const y = RAND + Math.floor(i / SPALTEN_IM_BILD) * (TEXT + hoehe + RAND);
    c.fillText(i === 0 ? "Start" : `Runde ${i}`, x, y + TEXT / 2);
    c.drawImage(kachel, x, y + TEXT, breite, hoehe);
  });
  bild.toBlob((blob) => {
    if (blob) ladeHerunter(blob, `${dateiName}-runden-${zeitstempel()}.png`);
    else zeigeMeldung("Das Bild konnte nicht erstellt werden.");
  }, "image/png");
});
//------------------------------------------------------

bildSpeichern.addEventListener("click", () => {
  if (!originalBild) {
    zeigeMeldung("Erst ein Bild öffnen.");
    return;
  }
  const hintergrund = baueHintergrund({
    bild: hole("bild"), // genau das, was gerade zu sehen ist
    verhaeltnis: Number(getComputedStyle(stapel).getPropertyValue("--verhaeltnis")),
    pixelig: anzeige.value === "raster",
    mitSkala: hole("skalaZeigen").checked,
  });
  // toBlob arbeitet im Hintergrund und ruft die Funktion auf, wenn das PNG fertig ist
  hintergrund.toBlob((blob) => {
    if (!blob) {
      zeigeMeldung("Das Bild konnte nicht erstellt werden.");
      return;
    }
    ladeHerunter(blob, `${dateiName}-${anzeige.value}-${zeitstempel()}.png`);
  }, "image/png");
});

wavSpeichern.addEventListener("click", () => {
  if (!wav) {
    zeigeMeldung("Erst einen Ton erzeugen.");
    return;
  }
  ladeHerunter(wav, `${dateiName}-${zeitstempel()}.wav`);
});

videoSpeichern.addEventListener("click", async () => {
  zeigeMeldung("");
  if (typeof Mediabunny === "undefined" || typeof VideoEncoder === "undefined") {
    zeigeMeldung("Dein Browser kann keine Videos kodieren.");
    return;
  }
  if (!puffer) {
    zeigeMeldung("Erst einen Ton erzeugen.");
    return;
  }
  sperre(true); // nicht zweimal gleichzeitig, und nicht während der Runden
  try {
    const { codec, tonCodec } = await speichereVideo({
      puffer,
      bild: hole("bild"), // genau das, was gerade zu sehen ist
      verhaeltnis: Number(getComputedStyle(stapel).getPropertyValue("--verhaeltnis")), // wie gerade im Rahmen
      pixelig: anzeige.value === "raster",
      mitSkala: hole("skalaZeigen").checked,
      name: dateiName,
      beiFortschritt: (anteil) => (videoSpeichern.textContent = `Video ... ${Math.round(anteil * 100)} %`),
    });
    // nur H.264 + AAC läuft überall (Handy, WhatsApp, Instagram)
    if (codec !== "avc" || tonCodec !== "aac") {
      zeigeMeldung(`Hinweis: Das Video ist ${codec} mit ${tonCodec}. Handys und WhatsApp spielen das vielleicht nicht ab, Chrome oder Edge machen H.264 mit AAC.`);
    }
  } catch (fehler) {
    console.error(fehler);
    zeigeMeldung(`Das Video ist fehlgeschlagen: ${fehler.message}`);
  } finally {
    sperre(false);
    videoSpeichern.textContent = "Video speichern";
  }
});

schleife.addEventListener("change", () => {
  spieler.loop = schleife.checked;
});
spieler.loop = schleife.checked;

zeigeStufen(); // am Anfang leer: versteckt den Speichern-Knopf
waehleFarbskala(farbskala.value); 
aktualisiere(); 
zeigeTonRegler();

const beobachter = new ResizeObserver(passeGroesseAn);
beobachter.observe(stapel);