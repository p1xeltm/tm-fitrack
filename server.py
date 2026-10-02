from flask import Flask, render_template, jsonify
import sqlite3

DATENBANK = "fitdb.db"
app = Flask(__name__, template_folder="templates", static_folder="static")

@app.route("/")
def index(): return render_template("index.html")

@app.route("/api/activities")
def activities():
    with sqlite3.connect(DATENBANK) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""SELECT * FROM activities ORDER BY datum DESC, startzeit DESC""")
        daten = [dict(row) for row in cursor.fetchall()]
    return jsonify(daten)

if __name__ == "__main__":
    app.run(host="localhost", port=5000, debug=True)