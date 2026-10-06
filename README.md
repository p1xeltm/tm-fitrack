```
sudo apt install python3-full sqlite3 python3-pip
sudo pip3 install fitparse flask rdp --break-system-packages

mkdir -p ~/.config/systemd/user/
ln -s "/home/tm/Laufwerk-T/git p1xeltm/tmfitrack/tmfitrack.service" ~/.config/systemd/user/tmfitrack.service
systemctl --user daemon-reload
systemctl --user enable --now tmfitrack


-----------------------------------------------------------------------
Grundcode für v1.0.00
-----------------------------------------------------------------------
Laden der .fit-Tracks auf OSM-Karte
    Parsen aller bisherigen .fit-Dateien und Speichern des Tracks in neuer db-feld; epsilon=0.00005
    Parsen einer .fit-Datei inklusive Schreiben in db-feld beim Import fitimport.py

-----------------------------------------------------------------------
Issues
-----------------------------------------------------------------------
(main) Überarbeitung edit-Funktionen (Position von »)
(main) Suche von Datum mit .2026 oder 05.2026 möglich trotz Datumformat mmm-dd
(main) <rename?> tmfitrack.local
(main) Ausführung von fitimport.py über Oberfläche, +Pfad für fitdb/Verzeichnis (siehe server.py)
(main) server.py debug=False
(layout) Höhenschummerung in OSM-Karte
(layout) dynamische Größenänderung der Container durch Anfasser im Fadenkreuz
(layout-min)    . mittige vertikale Position für rad-Buttons
                . git-Icon hinter Versionscode
                . gap oben+unten zwischen Banner Suchfeld und Tabelle identisch
                . Scrollbalken nur anzeigen, wenn Cursor innerhalb von Tabelle
(Funktion) Ändern der Trackfarbe, inkl. Transparenz+Farbe
(Funktion) Export to .gpx
(optional) Umbau Dateistruktur auf Wurzelverzeichnis (ohne template/ und static/)
(optional) Aufteilung der script.js in main, functionen, ...
(optional) Mehrfachauswahl/Mehrfachanzeige von Touren
```