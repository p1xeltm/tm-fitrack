// Globale Variable für geladenen Aktivitäten
let alleAktivitaeten = [];



/*
  =================================================================================
    FUNKTIONEN
  ================================================================================= 
*/

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

// Funktion: Aktualisieren von Datenbank-Feldern
async function update_dbFeld(activityId, spalte, wert) {
    const aktivitaet = alleAktivitaeten.find(a => a.id === activityId);
    const alterWert = aktivitaet ? aktivitaet[spalte] : null;

    // Lokalen Datenstand vorab anpassen
    if (aktivitaet) aktivitaet[spalte] = wert;

    try {
        const antwort = await fetch(`/api/activities/${activityId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spalte: spalte, wert: wert })
        });

        if (!antwort.ok) throw new Error('Netzwerk-Fehler');
    } catch (err) {
        console.error(`Fehler beim Speichern von ${spalte}:`, err);
        // Bei Fehler Wert zurückrollen
        if (aktivitaet) aktivitaet[spalte] = alterWert;
        rendereTabelle(alleAktivitaeten);
    }
}

// Funktion: Renderung von gefilterten Tabellenzeilen
function rendereTabelle(liste) {
    const ziel = document.getElementById('daten');
    ziel.innerHTML = '';

    if (liste.length === 0) {
        ziel.innerHTML = '<tr><td colspan="9">Keine Treffer gefunden.</td></tr>';
        return;
    }

    liste.forEach(zeile => {
        const tr = document.createElement('tr');
        const istFav = Boolean(zeile.fav);
        
        tr.innerHTML = `
            <td class="spalte-align-left">${formDatum(zeile.datum)}</td>
            <td class="spalte-align-left">${zeile.startzeit || ''}</td>
            <td class="spalte-align-left edit-zelle" data-id="${zeile.id}" data-spalte="rad" contenteditable="false" spellcheck="false"><span class="edit-text">${zeile.rad || ''}</span><span class="icon-edit">»</span></td>
            <td class="spalte-align-left edit-zelle" data-id="${zeile.id}" data-spalte="titel" contenteditable="false" spellcheck="false"><span class="edit-text">${zeile.titel || ''}</span><span class="icon-edit">»</span></td>
            <td class="spalte-align-right">${formZahl(zeile.distanz)}</td>
            <td class="spalte-align-right">${zeile.anstieg ?? ''}</td>
            <td class="spalte-align-right">${formZeit(zeile.zeit)}</td>
            <td class="spalte-align-right">${formZahl(zeile.avg)}</td>
            <td class="spalte-align-right fav-zelle ${istFav ? 'ist-favorit' : ''}" data-id="${zeile.id}">
                ${istFav ? '★' : ''}
            </td>
        `;
        ziel.appendChild(tr);
    });
}


// Abruf der Daten von API
fetch('/api/activities')
    .then(antwort => antwort.json())
    .then(liste => {
        alleAktivitaeten = liste;
        rendereTabelle(alleAktivitaeten);
    });



/*
  =================================================================================
    EVENT-LISTENER
  ================================================================================= 
*/

// Event-Listener für Suchfeld
document.getElementById('suche').addEventListener('input', function(e) {
    const begriff = e.target.value.toLowerCase().trim();

    const gefiltert = alleAktivitaeten.filter(zeile => {
        const datum = formDatum(zeile.datum).toLowerCase();
        const rad = (zeile.rad || '').toLowerCase();
        const titel = (zeile.titel || '').toLowerCase();

        return datum.includes(begriff) || 
               rad.includes(begriff) || 
               titel.includes(begriff);
    });

    rendereTabelle(gefiltert);
});

// Event-Listener für Klicks (edit_fav & Icon-Klick bei edit-Zellen)
document.getElementById('daten').addEventListener('click', function(e) {
    // 1. Favorit umstellen
    const favZelle = e.target.closest('.fav-zelle');
    if (favZelle) {
        const activityId = Number(favZelle.dataset.id);
        const aktivitaet = alleAktivitaeten.find(a => a.id === activityId);
        if (!aktivitaet) return;

        const neuerStatus = aktivitaet.fav ? 0 : 1;
        favZelle.classList.toggle('ist-favorit', neuerStatus === 1);
        favZelle.textContent = neuerStatus === 1 ? '★' : '';

        update_dbFeld(activityId, 'fav', neuerStatus);
        return;
    }

    // 2. Klick DIREKT auf das Edit-Icon
    if (e.target.classList.contains('icon-edit')) {
        const editZelle = e.target.closest('.edit-zelle');
        if (!editZelle) return;

        editZelle.setAttribute('contenteditable', 'true');
        editZelle.focus();
    }
});



/*
  =================================================================================
    STEUERUNG BEIM EDITIEREN VON FELDERN (edit_rad, edit_titel)
  ================================================================================= 
*/

// Hilfsvariable zum Speichern des Werts vor der Bearbeitung
let alterZellenWert = '';

// Speicherung Ursprungswert vor Editieren + Cursor ans Ende setzen
document.getElementById('daten').addEventListener('focusin', function(e) {
    if (!e.target.classList.contains('edit-zelle')) return;

    const textSpan = e.target.querySelector('.edit-text');
    alterZellenWert = textSpan ? textSpan.textContent : e.target.textContent;

    // Cursor ans Ende des Textes setzen
    setTimeout(() => {
        const zielKnoten = textSpan || e.target;
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(zielKnoten);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }, 0);
});

// Tastatur-Steuerung Enter (Speichern) / Esc (Abbruch)
document.getElementById('daten').addEventListener('keydown', function(e) {
    if (!e.target.classList.contains('edit-zelle')) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
    } 
    else if (e.key === 'Escape') {
        const textSpan = e.target.querySelector('.edit-text');
        if (textSpan) {
            textSpan.textContent = alterZellenWert;
        } else {
            e.target.textContent = alterZellenWert;
        }
        e.target.blur();
    }
});

// Speichern beim Verlassen eines Feldes
document.getElementById('daten').addEventListener('focusout', function(e) {
    const editZelle = e.target.closest('.edit-zelle');
    if (!editZelle) return;

    const activityId = Number(editZelle.dataset.id);
    const spalte = editZelle.dataset.spalte;
    
    const textSpan = editZelle.querySelector('.edit-text');
    const neuerWert = (textSpan ? textSpan.textContent : editZelle.textContent).trim();
    
    // Zelle sperren & HTML-Struktur zurücksetzen
    editZelle.setAttribute('contenteditable', 'false');
    editZelle.innerHTML = `<span class="edit-text">${neuerWert}</span><span class="icon-edit">»</span>`;

    update_dbFeld(activityId, spalte, neuerWert);
});