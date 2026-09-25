import os
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
FIT_DIR = '/home/tm/Laufwerk-T/GarminEdge130Plus-fit/'
CSV_FILE = os.path.join(os.path.dirname(__file__), 'fitdb.csv')
DELIMITER = "***"

def update_csv_database():
    """Prüft den fit-Ordner und trägt neue .fit-Dateien mit Platzhaltern in die fitdb.csv ein."""
    existing_filenames = set()
    database_lines = []

    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                stripped = line.strip()
                if not stripped:
                    continue
                parts = stripped.split(DELIMITER)
                filename = parts[0].strip()
                existing_filenames.add(filename)
                database_lines.append(stripped)

    if not os.path.exists(FIT_DIR):
        return

    fit_files = [f for f in os.listdir(FIT_DIR) if f.lower().endswith('.fit')]
    fit_files.sort(reverse=True)

    new_entries_added = False

    for filename in fit_files:
        if filename not in existing_filenames:
            print(f"Neue .fit-Datei entdeckt: {filename}")
            radart = "#---"
            activity_name = filename
            dist = "--"
            ascent = "--"
            time_val = "--:--"
            speed = "--"

            new_line = DELIMITER.join([filename, radart, activity_name, dist, ascent, time_val, speed])
            database_lines.append(new_line)
            new_entries_added = True

    if new_entries_added:
        with open(CSV_FILE, 'w', encoding='utf-8') as f:
            for line in database_lines:
                f.write(line + "\n")
        print("fitdb.csv wurde aktualisiert.")

class LocalFitServer(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/files':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            fit_files = []
            if os.path.exists(FIT_DIR):
                fit_files = [f for f in os.listdir(FIT_DIR) if f.lower().endswith('.fit')]
                fit_files.sort(reverse=True)
                
            self.wfile.write(json.dumps(fit_files).encode('utf-8'))
            return

        # Neu: Abfangen der Anfragen an /archiv_fit/ und Ausliefern aus FIT_DIR
        if self.path.startswith('/archiv_fit/'):
            from urllib.parse import unquote
            # Dateinamen aus der URL extrahieren und decodieren
            filename = unquote(self.path[len('/archiv_fit/'):])
            file_path = os.path.join(FIT_DIR, filename)

            if os.path.exists(file_path) and os.path.isfile(file_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', str(os.path.getsize(file_path)))
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, "FIT-Datei nicht gefunden")
                return

        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/update_csv':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            filename = data.get('filename')
            
            if os.path.exists(CSV_FILE):
                lines = []
                with open(CSV_FILE, 'r', encoding='utf-8') as f:
                    for line in f:
                        stripped = line.strip()
                        if not stripped:
                            continue
                        parts = stripped.split(DELIMITER)
                        if parts[0].strip() == filename:
                            radart = parts[1] if len(parts) > 1 else "#---"
                            name = parts[2] if len(parts) > 2 else filename
                            dist = parts[3] if len(parts) > 3 else "--"
                            ascent = parts[4] if len(parts) > 4 else "--"
                            time_val = parts[5] if len(parts) > 5 else "--:--"
                            speed = parts[6] if len(parts) > 6 else "--"
                            
                            if 'name' in data:
                                name = data['name']
                            if 'rad' in data:
                                radart = data['rad']
                            if 'dist' in data:
                                dist = str(data['dist'])
                            if 'ascent' in data:
                                ascent = str(data['ascent'])
                            if 'time' in data:
                                time_val = str(data['time'])
                            if 'speed' in data:
                                speed = str(data['speed'])
                            
                            updated_line = DELIMITER.join([filename, radart, name, dist, ascent, time_val, speed])
                            lines.append(updated_line)
                        else:
                            lines.append(stripped)
                
                with open(CSV_FILE, 'w', encoding='utf-8') as f:
                    for line in lines:
                        f.write(line + "\n")
                        
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    update_csv_database()
    print(f"Server gestartet unter: http://localhost:{PORT}")
    httpd = HTTPServer(('localhost', PORT), LocalFitServer)
    httpd.serve_forever()