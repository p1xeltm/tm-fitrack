// Funktion: Umwandlung Datum YYYY-MM-DD >> DD.MM.YYYY
function formDatum(str) {
    if (!str) return '';
    const teile = str.split('-');
    if (teile.length !== 3) return str;
    return `${teile[2]}.${teile[1]}.${teile[0]}`;
}

// Funktion: Umwandlung Punkt<>Komma + 2 Nachkommastellen
function formZahl(wert) {
    if (wert === null || wert === undefined || wert === '') return '';
    return Number(wert).toFixed(2).replace('.', ',');
}

// Funktion: Umwandlung Sekunden in h:mm:ss
function formZeit(sekunden) {
    if (!sekunden) return '';
    const h = Math.floor(sekunden / 3600);
    const m = Math.floor((sekunden % 3600) / 60);
    const s = sekunden % 60;
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    return `${h}:${mStr}:${sStr}`;
}

// Abruf Daten aus API und Eintragung in Tabelle
fetch('/api/activities')
    .then(antwort => antwort.json())
    .then(liste => {
        const ziel = document.getElementById('daten');
        ziel.innerHTML = '';

        liste.forEach(zeile => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="spalte-align-left">${formDatum(zeile.datum)}</td>
                <td class="spalte-align-left">${zeile.startzeit || ''}</td>
                <td class="spalte-align-left">${zeile.rad || ''}</td>
                <td class="spalte-align-left">${zeile.titel || ''}</td>
                <td class="spalte-align-right">${formZahl(zeile.distanz)}</td>
                <td class="spalte-align-right">${zeile.anstieg ?? ''}</td>
                <td class="spalte-align-right">${formZeit(zeile.zeit)}</td>
                <td class="spalte-align-right">${formZahl(zeile.avg)}</td>
                <td class="spalte-align-right">${zeile.fav ? '★' : ''}</td>
            `;
            ziel.appendChild(tr);
        });
    });