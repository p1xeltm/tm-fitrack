import sqlite3
from datetime import timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from fitparse import FitFile

FIT_VERZEICHNIS = "/home/tm/Laufwerk-T/GarminEdge130Plus-fit"
DB_DATEI = "fitdb.db"

conn = sqlite3.connect(DB_DATEI)
cursor = conn.cursor()

# Laden bereits importierte Dateinamen aus fitdb.db
cursor.execute("SELECT datei FROM activities")
bereits_importiert = {row[0] for row in cursor.fetchall()}

# Filtern neuer .fit-Dateien
neue_dateien = [
    f for f in sorted(Path(FIT_VERZEICHNIS).glob("*.fit")) 
    if f.name not in bereits_importiert
]

for fit_datei in neue_dateien:
    try:
        fit = FitFile(str(fit_datei))
        session = next(fit.get_messages("session"), None)

        start_time_utc = session.get_value("start_time")
        total_distance = session.get_value("total_distance") or 0
        total_ascent = session.get_value("total_ascent") or 0
        total_timer_time = session.get_value("total_timer_time") or 0
        avg_speed = session.get_value("avg_speed") or 0

        # Berücksichtigung UTC-Zeit in Ortszeit Berlin (Sommer-/Winterzeit)
        if start_time_utc:
            start_time_utc = start_time_utc.replace(tzinfo=timezone.utc)
            start_time_local = start_time_utc.astimezone(ZoneInfo("Europe/Berlin"))
            datum_str = str(start_time_local.date())
            startzeit_str = str(start_time_local.strftime("%H:%M:%S"))
        else:
            datum_str, startzeit_str = None, None

        cursor.execute("""
            INSERT INTO activities (datei, datum, startzeit, distanz, anstieg, zeit, avg)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            fit_datei.name,
            datum_str,
            startzeit_str,
            round(float(total_distance) / 1000, 2),
            int(total_ascent),
            int(round(float(total_timer_time))),
            round(float(avg_speed) * 3.6, 2)
        ))
        print(f"{fit_datei.name} importiert")

    except Exception as e:
        print(f"error >> {fit_datei.name} >> {e}")

conn.commit()
conn.close()